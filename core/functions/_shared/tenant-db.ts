/**
 * Tenant-scoped database query helper.
 *
 * Wraps the Supabase client to automatically inject `.eq('account_id', ctx.accountId)`
 * on every query, reducing the risk of cross-tenant data leaks.
 *
 * Usage:
 *   const tdb = tenantDb(ctx)
 *   const { data } = await tdb.from('items').select('*').eq('status', 'active')
 *   // ↑ automatically scoped to ctx.accountId
 *
 * For inserts, account_id is automatically added to the row data.
 *
 * IMPORTANT: This is the recommended pattern for new handlers. Existing handlers
 * that use raw `db.from(...)` still work but should be migrated over time.
 */
import { db } from './db'
import type { RequestContext } from './middleware'

interface TenantQueryBuilder {
  from(table: string): TenantTableBuilder
}

interface TenantTableBuilder {
  select(columns?: string): any
  insert(row: Record<string, any> | Record<string, any>[]): any
  update(values: Record<string, any>): any
  delete(): any
}

export function tenantDb(ctx: RequestContext): TenantQueryBuilder {
  if (!ctx.accountId) {
    throw new Error('tenantDb requires a resolved account context (ctx.accountId is null)')
  }

  const accountId = ctx.accountId

  return {
    from(table: string): TenantTableBuilder {
      return {
        select(columns = '*') {
          return db.from(table).select(columns).eq('account_id', accountId)
        },
        insert(row: Record<string, any> | Record<string, any>[]) {
          const rows = Array.isArray(row) ? row : [row]
          const scoped = rows.map(r => ({ ...r, account_id: accountId }))
          return db.from(table).insert(scoped.length === 1 ? scoped[0] : scoped)
        },
        update(values: Record<string, any>) {
          return db.from(table).update(values).eq('account_id', accountId)
        },
        delete() {
          return db.from(table).delete().eq('account_id', accountId)
        },
      }
    },
  }
}
