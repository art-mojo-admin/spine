import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus, Edit, Trash2, Package, Navigation, Eye, EyeOff, Save, X,
  LayoutDashboard, List, FileText, Square, Globe
} from 'lucide-react'

interface AppDefinition {
  id: string
  slug: string
  name: string
  icon?: string
  description?: string
  nav_items: any[]
  default_view?: string
  min_role: string
  integration_deps: string[]
  is_active: boolean
  pack_id?: string
  ownership: string
  created_at: string
  updated_at: string
}

interface NavItem {
  key: string
  to: string
  label: string
  icon?: string
  min_role?: string
}

const VIEW_TYPE_ICONS = {
  list: List,
  board: Square,
  detail: FileText,
  portal_page: Globe,
  dashboard: LayoutDashboard,
}

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'operator', label: 'Operator' },
  { value: 'admin', label: 'Admin' },
]

export default function AppsPage() {
  const { currentAccountId } = useAuth()
  const [apps, setApps] = useState<AppDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [editingApp, setEditingApp] = useState<AppDefinition | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    icon: '',
    description: '',
    min_role: 'member',
    nav_items: [] as NavItem[],
    default_view: '',
  })

  useEffect(() => {
    if (currentAccountId) loadApps()
  }, [currentAccountId])

  async function loadApps() {
    setLoading(true)
    try {
      const data = await apiGet<AppDefinition[]>('app-definitions')
      setApps(data || [])
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function saveApp() {
    if (!formData.name.trim() || !formData.slug.trim()) return
    
    setSaving(true)
    setError(null)
    
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        icon: formData.icon.trim() || null,
        description: formData.description.trim() || null,
        min_role: formData.min_role,
        nav_items: formData.nav_items,
        default_view: formData.default_view.trim() || null,
      }

      if (editingApp) {
        await apiPatch(`app-definitions?id=${editingApp.id}`, payload)
      } else {
        await apiPost('app-definitions', payload)
      }
      
      setFormData({
        name: '',
        slug: '',
        icon: '',
        description: '',
        min_role: 'member',
        nav_items: [],
        default_view: '',
      })
      setEditingApp(null)
      setShowCreate(false)
      loadApps()
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function deleteApp(app: AppDefinition) {
    if (!confirm(`Delete app "${app.name}"? This will remove all navigation items.`)) return
    
    try {
      await apiDelete(`app-definitions?id=${app.id}`)
      loadApps()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function toggleActive(app: AppDefinition) {
    try {
      await apiPatch(`app-definitions?id=${app.id}`, {
        is_active: !app.is_active
      })
      loadApps()
    } catch (e: any) {
      setError(e.message)
    }
  }

  function editApp(app: AppDefinition) {
    setEditingApp(app)
    setFormData({
      name: app.name,
      slug: app.slug,
      icon: app.icon || '',
      description: app.description || '',
      min_role: app.min_role,
      nav_items: app.nav_items,
      default_view: app.default_view || '',
    })
    setShowCreate(true)
  }

  function addNavItem() {
    setFormData({
      ...formData,
      nav_items: [
        ...formData.nav_items,
        {
          key: `item-${Date.now()}`,
          to: '',
          label: '',
          icon: 'LayoutDashboard',
          min_role: 'member'
        }
      ]
    })
  }

  function updateNavItem(index: number, field: keyof NavItem, value: string) {
    const updated = [...formData.nav_items]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, nav_items: updated })
  }

  function removeNavItem(index: number) {
    setFormData({
      ...formData,
      nav_items: formData.nav_items.filter((_, i) => i !== index)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading apps...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Apps & Navigation</h1>
          <p className="text-muted-foreground">Manage app definitions and navigation items</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New App
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {editingApp ? 'Edit App' : 'Create New App'}
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              Configure app metadata and navigation items
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="App name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="app-slug"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Icon</label>
                <Input
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="LayoutDashboard"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Minimum Role</label>
                <Select value={formData.min_role} onValueChange={(value) => setFormData({ ...formData, min_role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="App description"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Default View</label>
              <Input
                value={formData.default_view}
                onChange={(e) => setFormData({ ...formData, default_view: e.target.value })}
                placeholder="default-view-slug"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Navigation Items</label>
                <Button variant="outline" size="sm" onClick={addNavItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
              
              {formData.nav_items.map((item, index) => (
                <div key={item.key} className="border rounded-md p-3 mb-2">
                  <div className="grid grid-cols-4 gap-2">
                    <Input
                      placeholder="Label"
                      value={item.label}
                      onChange={(e) => updateNavItem(index, 'label', e.target.value)}
                    />
                    <Input
                      placeholder="/path"
                      value={item.to}
                      onChange={(e) => updateNavItem(index, 'to', e.target.value)}
                    />
                    <Input
                      placeholder="Icon"
                      value={item.icon}
                      onChange={(e) => updateNavItem(index, 'icon', e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Select value={item.min_role} onValueChange={(value) => updateNavItem(index, 'min_role', value)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => removeNavItem(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={saveApp} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apps List */}
      <div className="grid gap-4">
        {apps.map((app) => (
          <Card key={app.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                    <CardDescription>{app.description || 'No description'}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={app.is_active ? 'default' : 'secondary'}>
                    {app.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">{app.min_role}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(app)}>
                    {app.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => editApp(app)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteApp(app)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {app.nav_items.length > 0 && (
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Navigation Items:</div>
                  {app.nav_items.map((item) => (
                    <div key={item.key} className="flex items-center gap-2 text-sm">
                      <Navigation className="h-3 w-3" />
                      <span>{item.label}</span>
                      <span className="text-muted-foreground">({item.to})</span>
                      <Badge variant="outline" className="text-xs">{item.min_role}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
