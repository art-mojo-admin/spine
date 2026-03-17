import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ScopeRecord {
  id: string
  slug: string
  label: string
  description: string | null
  category: string
  default_role: string | null
  metadata?: Record<string, unknown>
  is_active: boolean
  scope_capabilities?: Array<{ id: string; capability: string; capability_type: string; description: string | null }>
}

const CATEGORY_OPTIONS = ['general', 'support', 'crm', 'automation', 'education', 'community']

export function ScopeLibraryPage() {
  const [scopes, setScopes] = useState<ScopeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [form, setForm] = useState({
    slug: '',
    label: '',
    category: 'general',
    description: '',
    default_role: '',
  })

  useEffect(() => {
    loadScopes()
  }, [includeInactive])

  async function loadScopes() {
    setLoading(true)
    try {
      const data = await apiGet<ScopeRecord[]>('scopes', {
        include_capabilities: 'true',
        include_inactive: includeInactive ? 'true' : 'false',
      })
      setScopes(data || [])
    } catch (err: any) {
      console.error(err)
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.slug.trim() || !form.label.trim()) {
      alert('Slug and label are required')
      return
    }

    try {
      await apiPost('scopes', {
        slug: form.slug.trim(),
        label: form.label.trim(),
        category: form.category,
        description: form.description || null,
        default_role: form.default_role || null,
      })
      setShowForm(false)
      setForm({ slug: '', label: '', category: 'general', description: '', default_role: '' })
      await loadScopes()
    } catch (err: any) {
      alert(err?.message || 'Failed to create scope')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scope Library</h1>
          <p className="text-muted-foreground">System-wide registry of available scopes and their capabilities.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Show inactive scopes
          </label>
          <Button size="sm" onClick={() => setShowForm((prev) => !prev)}>
            {showForm ? 'Close' : 'New Scope'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create a Scope</CardTitle>
            <CardDescription>System operators can add new capability bundles for packs and tenants.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input
                placeholder="support.inbox"
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Label</label>
              <Input
                placeholder="Support Inbox"
                value={form.label}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Role (optional)</label>
              <Input
                placeholder="operator"
                value={form.default_role}
                onChange={(e) => setForm((prev) => ({ ...prev, default_role: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={handleCreate}>Create Scope</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading scopes…</CardContent>
        </Card>
      ) : scopes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No scopes found.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scopes.map((scope) => (
            <Card key={scope.id} className="h-full">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{scope.label}</CardTitle>
                    <CardDescription>{scope.slug}</CardDescription>
                  </div>
                  <Badge variant={scope.is_active ? 'default' : 'secondary'}>
                    {scope.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{scope.category}</div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {scope.description && <p className="text-muted-foreground">{scope.description}</p>}
                {scope.default_role && (
                  <p>
                    <span className="font-medium">Suggested role:</span> {scope.default_role}
                  </p>
                )}
                {scope.scope_capabilities && scope.scope_capabilities.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Capabilities
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {scope.scope_capabilities.map((cap) => (
                        <Badge key={cap.id} variant="outline">
                          {cap.capability}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
