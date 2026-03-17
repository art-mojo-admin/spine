import { apiGet, apiPost } from '@/lib/api'

export interface ConfigPack {
  id: string
  name: string
  slug: string
  icon: string | null
  category: string | null
  description: string | null
  is_system: boolean
  pack_data: Record<string, any> | null
  config_active: boolean
  test_data_active: boolean
  activated_by: string | null
  activated_at: string | null
  created_at: string
  owner_account_id: string | null
  primary_app_id?: string | null
}

export interface CreatePackInput {
  name: string
  slug?: string
  icon?: string | null
  category?: string | null
  description?: string | null
  pack_data?: Record<string, any> | null
}

export function isTenantAuthoredPack(pack: ConfigPack, accountId?: string | null) {
  if (pack.is_system) return false
  if (!pack.owner_account_id) return false
  if (!accountId) return true
  return pack.owner_account_id === accountId
}

export async function listConfigPacks(): Promise<ConfigPack[]> {
  const data = await apiGet<ConfigPack[]>('config-packs')
  return data || []
}

export async function createConfigPack(input: CreatePackInput): Promise<ConfigPack> {
  return apiPost<ConfigPack>('config-packs', {
    action: 'create_pack',
    ...input,
  })
}
