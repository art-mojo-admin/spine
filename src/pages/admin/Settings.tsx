import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useTenantSettings, type TenantSettings } from '@/hooks/useTenantSettings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface ConfigPackSummary {
  id: string
  name: string
  slug: string | null
  icon: string | null
  config_active: boolean
  test_data_active: boolean
  activated_at: string | null
}

export function SettingsPage() {
  const { currentAccountId, profile } = useAuth()
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState<any>(null)
  const [slug, setSlug] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugMessage, setSlugMessage] = useState<string | null>(null)
  const {
    settings: tenantSettings,
    loading: tenantLoading,
    save: saveTenantSettings,
    refresh: refreshTenantSettings,
    canConfigure: canConfigureTenant,
  } = useTenantSettings()
  const [tenantTypeDraft, setTenantTypeDraft] = useState<TenantSettings['tenant_type']>('individual')
  const [tenantTypeSaving, setTenantTypeSaving] = useState(false)
  const [tenantTypeMessage, setTenantTypeMessage] = useState<string | null>(null)
  const [packList, setPackList] = useState<ConfigPackSummary[]>([])
  const [packLoading, setPackLoading] = useState(false)
  const [packError, setPackError] = useState<string | null>(null)
  const [activePackDraft, setActivePackDraft] = useState<string>('')
  const [activePackSaving, setActivePackSaving] = useState(false)
  const [activePackMessage, setActivePackMessage] = useState<string | null>(null)
  const [purgeConfirmation, setPurgeConfirmation] = useState('')
  const [purgeNotes, setPurgeNotes] = useState('')
  const [purgeWorking, setPurgeWorking] = useState(false)
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!currentAccountId) return
    Promise.all([
      apiGet<Record<string, any>>('settings'),
      apiGet<any>('accounts', { id: currentAccountId }),
    ])
      .then(([settingsRes, accountRes]) => {
        setSettings(settingsRes)
        setAccount(accountRes)
        setSlug(accountRes?.slug || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId])

  useEffect(() => {
    if (!tenantSettings) return
    setTenantTypeDraft(tenantSettings.tenant_type)
    setActivePackDraft(tenantSettings.active_pack_id ?? '')
  }, [tenantSettings])

  const loadPackList = useCallback(async () => {
    if (!canConfigureTenant || !currentAccountId) {
      setPackList([])
      return
    }
    setPackLoading(true)
    setPackError(null)
    try {
      const data = await apiGet<ConfigPackSummary[]>('config-packs')
      setPackList(data || [])
    } catch (err: any) {
      setPackError(err?.message || 'Failed to load packs')
    } finally {
      setPackLoading(false)
    }
  }, [canConfigureTenant, currentAccountId])

  useEffect(() => {
    loadPackList()
  }, [loadPackList])

  async function toggleSingleTenant() {
    const updated = { single_tenant_mode: !settings.single_tenant_mode }
    const result = await apiPatch<Record<string, any>>('settings', updated)
    setSettings(result)
  }

  async function saveSlug() {
    if (!currentAccountId) return
    setSlugSaving(true)
    setSlugMessage(null)
    try {
      const updated = await apiPatch<any>('accounts', { slug: slug.trim() || null }, { id: currentAccountId })
      setAccount(updated)
      setSlug(updated.slug || '')
      setSlugMessage('Slug saved!')
    } catch (err: any) {
      setSlugMessage(err?.message || 'Failed to save slug')
    } finally {
      setSlugSaving(false)
    }
  }

  async function handleTenantTypeSave() {
    if (!tenantSettings) return
    setTenantTypeSaving(true)
    setTenantTypeMessage(null)
    try {
      await saveTenantSettings({ tenant_type: tenantTypeDraft })
      setTenantTypeMessage('Tenant type updated')
    } catch (err: any) {
      setTenantTypeMessage(err?.message || 'Failed to update tenant type')
    } finally {
      setTenantTypeSaving(false)
    }
  }

  async function handleActivePackSave() {
    if (!tenantSettings) return
    setActivePackSaving(true)
    setActivePackMessage(null)
    try {
      await saveTenantSettings({ active_pack_id: activePackDraft || null })
      setActivePackMessage(activePackDraft ? 'Active pack updated' : 'Workspace context cleared')
      await loadPackList()
    } catch (err: any) {
      setActivePackMessage(err?.message || 'Failed to update workspace pack')
    } finally {
      setActivePackSaving(false)
    }
  }

  async function handlePurgeWorkspace() {
    if (!currentAccountId) return
    setPurgeWorking(true)
    setPurgeMessage(null)
    try {
      await apiPost('admin-reset', {
        confirmation: purgeConfirmation.trim(),
        notes: purgeNotes.trim() ? purgeNotes.trim() : undefined,
      })
      setPurgeMessage('Workspace purge completed successfully. Everything has been reset to a fresh state.')
      setPurgeConfirmation('')
      setPurgeNotes('')
      await refreshTenantSettings()
      await loadPackList()
    } catch (err: any) {
      setPurgeMessage(err?.message || 'Purge failed. Check logs for details.')
    } finally {
      setPurgeWorking(false)
    }
  }

  const tenantTypeChanged = tenantSettings ? tenantTypeDraft !== tenantSettings.tenant_type : false
  const activePackChanged = tenantSettings ? (tenantSettings.active_pack_id ?? '') !== activePackDraft : false
  const installedPacks = packList.filter((pack) => pack.config_active)
  const purgeToken = currentAccountId ? `PURGE-${currentAccountId}`.toUpperCase() : ''
  const purgeReady = purgeConfirmation.trim().toUpperCase() === purgeToken && Boolean(purgeToken)
  const lastPurgedAt = tenantSettings?.workspace_last_purged_at
    ? new Date(tenantSettings.workspace_last_purged_at).toLocaleString()
    : 'Never'
  const lastPurgedBy = tenantSettings?.workspace_last_purged_by_person?.full_name || tenantSettings?.workspace_last_purged_by || '—'
  const isSystemAdmin = profile?.system_role === 'system_admin' || profile?.system_role === 'system_operator'

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Tenant configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Public URL Slug</CardTitle>
          <CardDescription>
            Set a URL-friendly slug for this account. Public pages will be available at <code className="text-xs">/p/{slug || 'your-slug'}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="e.g. mountain-hikers"
              className="max-w-xs"
            />
            <Button size="sm" onClick={saveSlug} disabled={slugSaving}>
              {slugSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
          {slugMessage && <p className="text-xs text-muted-foreground">{slugMessage}</p>}
          {account?.slug && (
            <p className="text-xs text-muted-foreground">
              Public URL: <a href={`/p/${account.slug}`} className="text-primary hover:underline">/p/{account.slug}</a>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Single-Tenant Mode</CardTitle>
          <CardDescription>
            When enabled, tenant context is auto-selected and the tenant switcher is hidden.
            No schema changes required — purely a configuration toggle.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className={`h-4 w-8 rounded-full transition-colors cursor-pointer ${settings.single_tenant_mode ? 'bg-primary' : 'bg-muted'}`} onClick={toggleSingleTenant}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${settings.single_tenant_mode ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-sm">{settings.single_tenant_mode ? 'Enabled' : 'Disabled'}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">{JSON.stringify(settings, null, 2)}</pre>
        </CardContent>
      </Card>

      {canConfigureTenant && isSystemAdmin && (
        <div className="space-y-4 border-t pt-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Advanced Admin Controls</h2>
            <p className="text-sm text-muted-foreground">Tenant type, workspace packs, and purge workflows.</p>
          </div>

          {tenantLoading ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">Loading tenant settings…</CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tenant Type</CardTitle>
                  <CardDescription>
                    Determines default hierarchy (individual vs organization vs service provider). Impacts downstream pack defaults.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="text-sm font-medium" htmlFor="tenant-type-select">Select tenant type</label>
                  <select
                    id="tenant-type-select"
                    className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={tenantTypeDraft}
                    onChange={(e) => {
                      setTenantTypeDraft(e.target.value as TenantSettings['tenant_type'])
                      setTenantTypeMessage(null)
                    }}
                  >
                    <option value="individual">Individual — single workspace</option>
                    <option value="organization">Organization — multi-company</option>
                    <option value="service_provider">Service Provider — partners serving clients</option>
                  </select>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                      size="sm"
                      onClick={handleTenantTypeSave}
                      disabled={!tenantTypeChanged || tenantTypeSaving}
                    >
                      {tenantTypeSaving ? 'Saving…' : 'Save Tenant Type'}
                    </Button>
                    {tenantTypeMessage && (
                      <span className="text-xs text-muted-foreground">{tenantTypeMessage}</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Workspace Pack Context</CardTitle>
                  <CardDescription>
                    Select which installed pack is the active editing context. Only installed packs appear here.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {packError && (
                    <p className="text-xs text-destructive">{packError}</p>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="active-pack-select">Active workspace pack</label>
                    <select
                      id="active-pack-select"
                      className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={packLoading || installedPacks.length === 0}
                      value={activePackDraft}
                      onChange={(e) => {
                        setActivePackDraft(e.target.value)
                        setActivePackMessage(null)
                      }}
                    >
                      <option value="">No active pack</option>
                      {installedPacks.map((pack) => (
                        <option key={pack.id} value={pack.id}>
                          {pack.name} {pack.slug ? `(${pack.slug})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Installed packs available: {installedPacks.length === 0 ? 'None installed yet.' : installedPacks.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      onClick={handleActivePackSave}
                      disabled={!activePackChanged || activePackSaving}
                    >
                      {activePackSaving ? 'Saving…' : 'Save Workspace Pack'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => window.open('/admin/config-packs', '_blank')}>
                      Manage Template Packs
                    </Button>
                    {activePackMessage && (
                      <span className="text-xs text-muted-foreground">{activePackMessage}</span>
                    )}
                  </div>
                  {tenantSettings?.active_pack && (
                    <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      Active pack details: <strong>{tenantSettings.active_pack.name}</strong>
                      {tenantSettings.active_pack.slug ? ` · slug: ${tenantSettings.active_pack.slug}` : ''}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Purge Workspace</CardTitle>
                  <CardDescription>
                    Resets the tenant to a fresh state by uninstalling packs and deleting tenant-owned data. Requires typing the confirmation token.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
                    This action is destructive. Make sure any important data is exported before proceeding.
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="purge-confirm">Type confirmation token ({purgeToken || 'N/A'})</label>
                    <Input
                      id="purge-confirm"
                      value={purgeConfirmation}
                      onChange={(e) => setPurgeConfirmation(e.target.value)}
                      placeholder={purgeToken ? purgeToken : 'No tenant selected'}
                      disabled={!purgeToken || purgeWorking}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="purge-notes">Notes (optional)</label>
                    <Textarea
                      id="purge-notes"
                      rows={3}
                      value={purgeNotes}
                      onChange={(e) => setPurgeNotes(e.target.value)}
                      placeholder="Reason for purge, ticket link, etc."
                      disabled={purgeWorking}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="destructive"
                      onClick={handlePurgeWorkspace}
                      disabled={!purgeReady || purgeWorking}
                    >
                      {purgeWorking ? 'Purging…' : 'Purge Workspace'}
                    </Button>
                    {purgeMessage && (
                      <span className="text-xs text-muted-foreground">{purgeMessage}</span>
                    )}
                  </div>
                  <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    Last purged: {lastPurgedAt} · by {lastPurgedBy}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
