import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from '../../netlify/functions/_shared/middleware'
import { db } from '../../netlify/functions/_shared/db'
import { emitActivity } from '../../netlify/functions/_shared/audit'

/**
 * Gmail Extension — demonstrates the custom/ extension pattern.
 *
 * Capabilities:
 * - GET: Returns extension config and connection status for the tenant
 * - POST action=connect: Stores Gmail OAuth credentials (placeholder — real OAuth flow would redirect)
 * - POST action=disconnect: Removes stored credentials
 * - POST action=send: Sends an email via Gmail API (requires stored credentials)
 * - POST action=register: Registers the 'send_email' custom action type for use in workflow actions
 *
 * In production, the connect flow would use Google OAuth2 with redirect.
 * This demo stores credentials in account settings for simplicity.
 */

const EXTENSION_SLUG = 'gmail'
const SETTINGS_KEY = 'gmail_config'

async function getGmailConfig(accountId: string): Promise<any> {
  const { data } = await db
    .from('accounts')
    .select('settings')
    .eq('id', accountId)
    .single()

  return data?.settings?.[SETTINGS_KEY] || null
}

async function saveGmailConfig(accountId: string, config: any): Promise<void> {
  const { data: acct } = await db
    .from('accounts')
    .select('settings')
    .eq('id', accountId)
    .single()

  const settings = acct?.settings || {}
  settings[SETTINGS_KEY] = config

  await db.from('accounts').update({ settings }).eq('id', accountId)
}

async function sendViaGmail(config: any, to: string, subject: string, body: string): Promise<{ success: boolean; detail: string }> {
  // In production, this would use the Gmail API with the stored OAuth token.
  // For the demo, we simulate the send and log it.
  if (!config?.access_token) {
    return { success: false, detail: 'Gmail not connected. Please connect your account first.' }
  }

  // Simulate API call — in production: POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
  console.log(`[gmail-extension] Simulated send: to=${to}, subject=${subject}, body_length=${body.length}`)

  return { success: true, detail: `Email sent to ${to}: "${subject}"` }
}

export default createHandler({
  async GET(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const config = await getGmailConfig(ctx.accountId!)

    return json({
      extension: EXTENSION_SLUG,
      connected: !!config?.access_token,
      email: config?.email || null,
      connected_at: config?.connected_at || null,
    })
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    const action = body.action

    if (action === 'connect') {
      // In production: exchange OAuth code for tokens
      // Demo: accept email + simulated token
      if (!body.email) return error('email required')

      const config = {
        email: body.email,
        access_token: `demo-token-${Date.now()}`,
        refresh_token: `demo-refresh-${Date.now()}`,
        connected_at: new Date().toISOString(),
      }

      await saveGmailConfig(ctx.accountId!, config)
      await emitActivity(ctx, 'extension.gmail.connected', `Connected Gmail: ${body.email}`, 'integration', EXTENSION_SLUG)

      return json({ success: true, connected: true, email: body.email })
    }

    if (action === 'disconnect') {
      await saveGmailConfig(ctx.accountId!, null)
      await emitActivity(ctx, 'extension.gmail.disconnected', 'Disconnected Gmail', 'integration', EXTENSION_SLUG)

      return json({ success: true, connected: false })
    }

    if (action === 'send') {
      if (!body.to || !body.subject || !body.body) {
        return error('to, subject, and body required')
      }

      const config = await getGmailConfig(ctx.accountId!)
      const result = await sendViaGmail(config, body.to, body.subject, body.body)

      if (result.success) {
        await emitActivity(ctx, 'extension.gmail.sent', `Sent email to ${body.to}: "${body.subject}"`, 'integration', EXTENSION_SLUG)
      }

      return json(result)
    }

    if (action === 'register') {
      // Register send_email as a custom action type
      const { data: existing } = await db
        .from('custom_action_types')
        .select('id')
        .eq('account_id', ctx.accountId)
        .eq('slug', 'send_email')
        .maybeSingle()

      if (existing) {
        return json({ success: true, action_type_id: existing.id, already_registered: true })
      }

      const { data, error: dbErr } = await db
        .from('custom_action_types')
        .insert({
          account_id: ctx.accountId,
          slug: 'send_email',
          name: 'Send Email (Gmail)',
          description: 'Send an email via connected Gmail account',
          handler_url: '/.netlify/functions/gmail-extension',
          config_schema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email' },
              subject: { type: 'string', description: 'Email subject (supports {{item.title}} templates)' },
              body: { type: 'string', description: 'Email body (supports {{item.title}} templates)' },
            },
            required: ['to', 'subject', 'body'],
          },
        })
        .select()
        .single()

      if (dbErr) return error(dbErr.message, 500)

      await emitActivity(ctx, 'extension.gmail.registered', 'Registered send_email custom action type', 'custom_action_type', data.id)
      return json({ success: true, action_type_id: data.id })
    }

    return error('Unknown action. Use connect, disconnect, send, or register')
  },
})
