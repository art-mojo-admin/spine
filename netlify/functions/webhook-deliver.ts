import { db } from './_shared/db'
import crypto from 'crypto'
import { validateOutboundUrl } from './_shared/security'

const HEADER_PREFIX = `X-${(process.env.VITE_APP_NAME || 'Spine').replace(/\s+/g, '-')}`

const MAX_ATTEMPTS = 5
const BACKOFF_BASE_MS = 30_000

export const config = {
  schedule: '*/5 * * * *',
}

function computeHmac(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function nextBackoff(attempt: number): Date {
  const delay = BACKOFF_BASE_MS * Math.pow(2, attempt)
  return new Date(Date.now() + delay)
}

export default async function handler() {
  console.log('[webhook-deliver] Starting delivery run')

  const { data: unprocessedEvents } = await db
    .from('outbox_events')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(100)

  if (unprocessedEvents && unprocessedEvents.length > 0) {
    for (const event of unprocessedEvents) {
      const { data: subscriptions } = await db
        .from('webhook_subscriptions')
        .select('*')
        .eq('account_id', event.account_id)
        .eq('enabled', true)
        .or(`event_types.cs.{${event.event_type}},event_types.eq.{}`)

      if (subscriptions) {
        for (const sub of subscriptions) {
          if (sub.event_types.length > 0 && !sub.event_types.includes(event.event_type)) continue

          await db.from('webhook_deliveries').insert({
            webhook_subscription_id: sub.id,
            outbox_event_id: event.id,
            status: 'pending',
            next_attempt_at: new Date().toISOString(),
          })
        }
      }

      await db.from('outbox_events').update({ processed: true }).eq('id', event.id)
    }
  }

  const { data: pendingDeliveries } = await db
    .from('webhook_deliveries')
    .select('*, webhook_subscriptions(url, signing_secret), outbox_events(event_type, payload)')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('next_attempt_at', { ascending: true })
    .limit(50)

  if (!pendingDeliveries || pendingDeliveries.length === 0) {
    console.log('[webhook-deliver] No pending deliveries')
    return new Response(JSON.stringify({ processed: 0 }))
  }

  let processed = 0

  for (const delivery of pendingDeliveries) {
    const sub = delivery.webhook_subscriptions as any
    const event = delivery.outbox_events as any

    if (!sub?.url || !event?.payload) {
      await db.from('webhook_deliveries').update({
        status: 'dead_letter',
        last_error: 'Missing subscription or event data',
      }).eq('id', delivery.id)
      continue
    }

    const payloadStr = JSON.stringify({
      event_type: event.event_type,
      payload: event.payload,
      delivery_id: delivery.id,
      timestamp: new Date().toISOString(),
    })

    const signature = computeHmac(sub.signing_secret, payloadStr)
    const attempt = delivery.attempts + 1

    try {
      const safeUrl = validateOutboundUrl(sub.url)
      const response = await fetch(safeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [`${HEADER_PREFIX}-Signature`]: signature,
          [`${HEADER_PREFIX}-Delivery-Id`]: delivery.id,
          [`${HEADER_PREFIX}-Event`]: event.event_type,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10_000),
      })

      if (response.ok) {
        await db.from('webhook_deliveries').update({
          status: 'success',
          attempts: attempt,
          last_status_code: response.status,
          completed_at: new Date().toISOString(),
          last_error: null,
        }).eq('id', delivery.id)
        console.log(`[webhook-deliver] ${delivery.id} success (${response.status})`)
      } else {
        const errorText = await response.text().catch(() => 'No body')
        const isDeadLetter = attempt >= MAX_ATTEMPTS

        await db.from('webhook_deliveries').update({
          status: isDeadLetter ? 'dead_letter' : 'failed',
          attempts: attempt,
          last_status_code: response.status,
          last_error: errorText.slice(0, 500),
          next_attempt_at: isDeadLetter ? null : nextBackoff(attempt).toISOString(),
        }).eq('id', delivery.id)

        console.log(`[webhook-deliver] ${delivery.id} failed (${response.status}), attempt ${attempt}/${MAX_ATTEMPTS}`)
      }
    } catch (err: any) {
      const isDeadLetter = attempt >= MAX_ATTEMPTS

      await db.from('webhook_deliveries').update({
        status: isDeadLetter ? 'dead_letter' : 'failed',
        attempts: attempt,
        last_error: err.message?.slice(0, 500) || 'Unknown error',
        next_attempt_at: isDeadLetter ? null : nextBackoff(attempt).toISOString(),
      }).eq('id', delivery.id)

      console.log(`[webhook-deliver] ${delivery.id} error: ${err.message}, attempt ${attempt}/${MAX_ATTEMPTS}`)
    }

    processed++
  }

  console.log(`[webhook-deliver] Processed ${processed} deliveries`)
  return new Response(JSON.stringify({ processed }))
}
