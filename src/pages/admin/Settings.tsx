import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function SettingsPage() {
  const { currentAccountId } = useAuth()
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState<any>(null)
  const [slug, setSlug] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugMessage, setSlugMessage] = useState<string | null>(null)

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
    </div>
  )
}
