import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Copy, Pencil, Trash2, Power, Package, LayoutGrid } from 'lucide-react'

interface AppDef {
  id: string
  slug: string
  name: string
  icon: string | null
  description: string | null
  nav_items: any[]
  default_view: string | null
  min_role: string
  integration_deps: string[]
  is_active: boolean
  ownership: string | null
  created_at: string
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function AppDefinitionsPage() {
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const [apps, setApps] = useState<AppDef[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [cloning, setCloning] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (currentAccountId) loadApps()
  }, [currentAccountId])

  async function loadApps() {
    setLoading(true)
    try {
      const data = await apiGet<AppDef[]>('app-definitions', { include_inactive: 'true' })
      setApps(data || [])
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load apps')
    } finally {
      setLoading(false)
    }
  }

  async function createApp() {
    if (!newName.trim()) return
    setErrorMsg(null)
    try {
      const app = await apiPost<AppDef>('app-definitions', {
        name: newName,
        slug: newSlug || slugify(newName),
        is_active: false,
      })
      setShowCreate(false)
      setNewName('')
      setNewSlug('')
      navigate(`/admin/apps/${app.id}/builder`)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create app')
    }
  }

  async function cloneApp(sourceId: string) {
    setCloning(sourceId)
    setErrorMsg(null)
    try {
      const cloned = await apiPost<AppDef>('app-definitions', {
        action: 'clone',
        source_id: sourceId,
      })
      navigate(`/admin/apps/${cloned.id}/builder`)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Clone failed')
    } finally {
      setCloning(null)
    }
  }

  async function toggleApp(app: AppDef) {
    try {
      await apiPatch('app-definitions', { is_active: !app.is_active }, { id: app.id })
      loadApps()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Toggle failed')
    }
  }

  async function deleteApp(id: string) {
    if (!confirm('Delete this app definition? This cannot be undone.')) return
    try {
      await apiDelete(`app-definitions?id=${id}`)
      loadApps()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Delete failed')
    }
  }

  const isPack = (app: AppDef) => app.ownership === 'pack'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Apps</h1>
          <p className="mt-1 text-muted-foreground">
            Build and manage application definitions that control navigation, views, and behavior.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> New App
        </Button>
      </div>

      {errorMsg && (
        <Card><CardContent className="py-3 text-sm text-destructive">{errorMsg}</CardContent></Card>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create New App</CardTitle>
            <CardDescription>Start with a blank app definition. You can configure everything in the builder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. CRM, Support, Admin"
                  onKeyDown={(e) => e.key === 'Enter' && createApp()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={newSlug || (newName ? slugify(newName) : '')}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="auto-generated"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createApp} disabled={!newName.trim()}>Create & Open Builder</Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setNewName(''); setNewSlug('') }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading apps...</p>
      ) : apps.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No apps defined yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Create a new app or activate a template pack to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card key={app.id} className={!app.is_active ? 'opacity-70' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <LayoutGrid className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{app.name}</CardTitle>
                      <code className="text-[10px] font-mono text-muted-foreground">{app.slug}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={app.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {app.is_active ? 'Active' : 'Draft'}
                    </Badge>
                    {isPack(app) && (
                      <Badge variant="outline" className="text-[10px]">
                        <Package className="mr-0.5 h-2.5 w-2.5" /> Pack
                      </Badge>
                    )}
                  </div>
                </div>
                {app.description && (
                  <CardDescription className="text-xs mt-1">{app.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{app.nav_items?.length || 0} nav items</span>
                  <span>min: {app.min_role}</span>
                </div>

                <div className="flex items-center gap-1 border-t pt-3">
                  {isPack(app) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => cloneApp(app.id)}
                      disabled={cloning === app.id}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      {cloning === app.id ? 'Cloning...' : 'Clone to Edit'}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/admin/apps/${app.id}/builder`)}
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Builder
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleApp(app)} title={app.is_active ? 'Unpublish' : 'Publish'}>
                        <Power className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteApp(app.id)} title="Delete">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
