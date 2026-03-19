import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Pencil, Puzzle, Link, Unlink, Settings, Globe, Zap, Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IntegrationDefinition {
  id: string
  slug: string
  name: string
  description: string
  category: string
  icon_url?: string
  config_schema: Record<string, any>
  auth_type: 'api_key' | 'oauth2' | 'webhook' | 'none'
  capabilities: string[]
  created_at: string
  updated_at: string
}

interface IntegrationInstance {
  id: string
  account_id: string
  integration_definition_id: string
  name: string
  status: 'active' | 'inactive' | 'error'
  config: Record<string, any>
  credentials?: Record<string, any>
  last_sync_at?: string
  error_message?: string
  created_at: string
  updated_at: string
  integration_definitions?: IntegrationDefinition
}

const CATEGORIES = [
  'communication',
  'crm',
  'project_management',
  'development',
  'analytics',
  'storage',
  'monitoring',
  'other',
]

const AUTH_TYPES = [
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'none', label: 'None' },
]

const CAPABILITY_OPTIONS = [
  'inbound_webhook',
  'outbound_webhook',
  'api_calls',
  'file_sync',
  'real_time',
  'bulk_import',
  'bulk_export',
]

export function IntegrationCatalogPage() {
  const { currentAccountId } = useAuth()
  const [definitions, setDefinitions] = useState<IntegrationDefinition[]>([])
  const [instances, setInstances] = useState<IntegrationInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'catalog' | 'instances'>('catalog')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    slug: '',
    name: '',
    description: '',
    category: '',
    auth_type: 'none' as 'api_key' | 'oauth2' | 'webhook' | 'none',
    config_schema: {},
    capabilities: [] as string[],
  })

  async function load() {
    setLoading(true)
    try {
      const [definitionsRes, instancesRes] = await Promise.all([
        apiGet<IntegrationDefinition[]>('integration-definitions'),
        apiGet<IntegrationInstance[]>('integration-instances'),
      ])
      setDefinitions(definitionsRes || [])
      setInstances(instancesRes || [])
    } catch {
      setDefinitions([])
      setInstances([])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (currentAccountId) load()
  }, [currentAccountId])

  function resetForm() {
    setForm({
      slug: '',
      name: '',
      description: '',
      category: '',
      auth_type: 'none',
      config_schema: {},
      capabilities: [],
    })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.name || !form.slug || !form.category) return
    setSaving(true)
    try {
      if (editingId) {
        await apiPatch('integration-definitions', form, { id: editingId })
      } else {
        await apiPost('integration-definitions', form)
      }
      resetForm()
      load()
    } catch (err: any) {
      alert(err.message || 'Save failed')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this integration definition? This may affect existing instances.')) return
    try {
      await apiDelete('integration-definitions', { id })
      load()
    } catch (err: any) {
      alert(err.message || 'Delete failed')
    }
  }

  async function connectIntegration(definitionId: string) {
    const name = definitions.find(d => d.id === definitionId)?.name || 'Integration'
    const instanceName = prompt(`Enter a name for this ${name} instance:`, name)
    if (!instanceName) return

    try {
      await apiPost('integration-instances', {
        integration_definition_id: definitionId,
        name: instanceName,
        config: {},
        status: 'inactive',
      })
      load()
      setActiveTab('instances')
    } catch (err: any) {
      alert(err.message || 'Failed to create instance')
    }
  }

  async function disconnectInstance(instanceId: string) {
    if (!confirm('Disconnect this integration instance?')) return
    try {
      await apiDelete('integration-instances', { id: instanceId })
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to disconnect')
    }
  }

  async function toggleInstanceStatus(instanceId: string, status: 'active' | 'inactive') {
    try {
      await apiPatch('integration-instances', { status }, { id: instanceId })
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to update status')
    }
  }

  function startEdit(definition: IntegrationDefinition) {
    setForm({
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      auth_type: definition.auth_type,
      config_schema: definition.config_schema || {},
      capabilities: definition.capabilities || [],
    })
    setEditingId(definition.id)
    setShowForm(true)
  }

  function toggleCapability(capability: string) {
    setForm(p => ({
      ...p,
      capabilities: p.capabilities.includes(capability)
        ? p.capabilities.filter(c => c !== capability)
        : [...p.capabilities, capability]
    }))
  }

  const definitionsByCategory = definitions.reduce((acc, def) => {
    if (!acc[def.category]) acc[def.category] = []
    acc[def.category].push(def)
    return acc
  }, {} as Record<string, IntegrationDefinition[]>)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Integration Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse available integrations and manage connected instances.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'catalog' && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Definition
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            activeTab === 'catalog' && "bg-background shadow-sm"
          )}
          onClick={() => setActiveTab('catalog')}
        >
          <Globe className="mr-2 h-4 w-4 inline" />
          Catalog ({definitions.length})
        </button>
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            activeTab === 'instances' && "bg-background shadow-sm"
          )}
          onClick={() => setActiveTab('instances')}
        >
          <Link className="mr-2 h-4 w-4 inline" />
          Instances ({instances.length})
        </button>
      </div>

      {/* Integration Definition Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit Integration Definition' : 'New Integration Definition'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <Input
                  placeholder="e.g. Slack"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Slug *</label>
                <Input
                  placeholder="e.g. slack"
                  value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value.replace(/[^a-z0-9-]/g, '') }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category *</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Auth Type</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.auth_type}
                  onChange={e => setForm(p => ({ ...p, auth_type: e.target.value as any }))}
                >
                  {AUTH_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Input
                placeholder="What this integration does"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Capabilities</label>
              <div className="flex flex-wrap gap-2">
                {CAPABILITY_OPTIONS.map(cap => (
                  <label key={cap} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={form.capabilities.includes(cap)}
                      onChange={() => toggleCapability(cap)}
                    />
                    {cap.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !form.name || !form.slug || !form.category}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : activeTab === 'catalog' ? (
        <div className="space-y-6">
          {Object.entries(definitionsByCategory).map(([category, categoryDefs]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base capitalize">{category}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {categoryDefs.length} integration{categoryDefs.length !== 1 ? 's' : ''}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryDefs.map(def => (
                    <Card key={def.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {def.icon_url ? (
                              <img src={def.icon_url} alt={def.name} className="h-8 w-8 rounded" />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                <Puzzle className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <h3 className="font-medium">{def.name}</h3>
                              <p className="text-xs text-muted-foreground">{def.slug}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {def.auth_type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{def.description}</p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {def.capabilities.map(cap => (
                            <Badge key={cap} variant="secondary" className="text-xs">
                              {cap.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => connectIntegration(def.id)}
                          >
                            <Link className="mr-1 h-3 w-3" />
                            Connect
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(def)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(def.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {definitions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Puzzle className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No integration definitions yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add integration definitions to make them available for connection.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {instances.map(instance => (
            <Card key={instance.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{instance.name}</h3>
                      <Badge variant={instance.status === 'active' ? 'default' : 'secondary'}>
                        {instance.status}
                      </Badge>
                      <Badge variant="outline">
                        {instance.integration_definitions?.name}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Auth: {instance.integration_definitions?.auth_type}</p>
                      {instance.last_sync_at && (
                        <p>Last sync: {new Date(instance.last_sync_at).toLocaleString()}</p>
                      )}
                      {instance.error_message && (
                        <p className="text-red-600">Error: {instance.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleInstanceStatus(
                        instance.id,
                        instance.status === 'active' ? 'inactive' : 'active'
                      )}
                    >
                      {instance.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => disconnectInstance(instance.id)}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {instances.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Link className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No connected integrations yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Switch to the Catalog tab to browse and connect integrations.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
