import { db } from './db'

/**
 * Adjust a counter by delta (positive or negative). Floors at 0.
 */
export async function adjustCount(accountId: string, key: string, delta: number) {
  if (delta === 0) return

  // Upsert row then adjust
  const { data: existing } = await db
    .from('admin_counts')
    .select('count')
    .eq('account_id', accountId)
    .eq('counter_key', key)
    .maybeSingle()

  const newCount = Math.max((existing?.count ?? 0) + delta, 0)

  await db.from('admin_counts').upsert(
    {
      account_id: accountId,
      counter_key: key,
      count: newCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id,counter_key' },
  )
}

/**
 * Set a counter to an absolute value.
 */
export async function setCount(accountId: string, key: string, value: number) {
  await db.from('admin_counts').upsert(
    {
      account_id: accountId,
      counter_key: key,
      count: Math.max(value, 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id,counter_key' },
  )
}

/**
 * Recalculate all admin counters from actual table data.
 * Call after pack install/uninstall or for backfill.
 */
export async function recalcAllCounts(accountId: string) {
  const queries: { key: string; query: Promise<{ data: any[] | null }> }[] = [
    {
      key: 'apps',
      query: db.from('app_definitions').select('id').eq('account_id', accountId).eq('is_active', true),
    },
    {
      key: 'automations',
      query: db.from('automation_rules').select('id').eq('account_id', accountId).eq('enabled', true),
    },
    {
      key: 'custom_actions',
      query: db.from('custom_action_types').select('id').eq('account_id', accountId),
    },
    {
      key: 'custom_fields',
      query: db.from('custom_field_definitions').select('id').eq('account_id', accountId).eq('is_active', true),
    },
    {
      key: 'inbound_hooks',
      query: db.from('inbound_webhook_keys').select('id').eq('account_id', accountId).eq('enabled', true),
    },
    {
      key: 'link_types',
      query: db.from('link_type_definitions').select('id').eq('account_id', accountId).eq('is_active', true),
    },
    {
      key: 'members',
      query: db.from('memberships').select('id').eq('account_id', accountId).eq('status', 'active').eq('is_test_data', false),
    },
    {
      key: 'modules',
      query: db.from('account_modules').select('id').eq('account_id', accountId).eq('enabled', true),
    },
    {
      key: 'schedules',
      query: db.from('scheduled_triggers').select('id').eq('account_id', accountId).eq('enabled', true),
    },
    {
      key: 'views',
      query: db.from('view_definitions').select('id').eq('account_id', accountId).eq('is_active', true),
    },
    {
      key: 'webhooks',
      query: db.from('webhook_subscriptions').select('id').eq('account_id', accountId).eq('enabled', true),
    },
    {
      key: 'templates',
      query: db.from('pack_activations').select('id').eq('account_id', accountId).eq('config_active', true),
    },
    {
      key: 'workflows',
      query: db.from('workflow_definitions').select('id').eq('account_id', accountId).eq('is_active', true),
    },
  ]

  const results = await Promise.all(queries.map((q) => q.query))

  for (let i = 0; i < queries.length; i++) {
    await setCount(accountId, queries[i].key, results[i].data?.length ?? 0)
  }
}
