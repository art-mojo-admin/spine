import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Pencil, GripVertical } from 'lucide-react'

interface NavExtension {
  id: string
  label: string
  icon: string | null
  url: string
  location: string
  position: number
  min_role: string
  module_slug: string | null
  created_at: string
}

const LOCATIONS = ['sidebar', 'admin', 'detail_panel']
const ROLES = ['portal', 'member', 'operator', 'admin']

export function NavExtensionsPage() {
  const [extensions, setExtensions] = useState<NavExtension[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: '', icon: '', url: '', location: 'sidebar', position: '0', min_role: 'member', module_slug: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiGet<NavExtension[]>('nav-extensions')
      setExtensions(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      const payload = {
        label: form.label,
        icon: form.icon || null,
        url: form.url,
        location: form.location,
        position: parseInt(form.position) || 0,
        min_role: form.min_role,
        module_slug: form.module_slug || null,
      }

      if (editingId) {
        await apiPatch('nav-extensions', payload, { id: editingId })
      } else {
        await apiPost('nav-extensions', payload)
      }
      setShowForm(false)
      setEditingId(null)
      resetForm()
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this nav extension?')) return
    try {
      await apiDelete('nav-extensions', { id })
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  function startEdit(ext: NavExtension) {
    setEditingId(ext.id)
    setForm({
      label: ext.label,
      icon: ext.icon || '',
      url: ext.url,
      location: ext.location,
      position: String(ext.position),
      min_role: ext.min_role,
      module_slug: ext.module_slug || '',
    })
    setShowForm(true)
  }

  function resetForm() {
    setForm({ label: '', icon: '', url: '', location: 'sidebar', position: '0', min_role: 'member', module_slug: '' })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nav Extensions</h1>
          <p className="text-sm text-muted-foreground">
            Add custom navigation items to the sidebar, admin panel, or detail views
          </p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); resetForm() }}>
          <Plus className="mr-2 h-4 w-4" /> Add Extension
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold">{editingId ? 'Edit Extension' : 'New Extension'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Label (e.g. Revenue Dashboard)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <Input
              placeholder="Icon name (Lucide, optional)"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
            />
          </div>
          <Input
            placeholder="URL (e.g. /x/revenue or https://app.example.com/embed)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Location</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              >
                {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Min Role</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.min_role}
                onChange={(e) => setForm({ ...form, min_role: e.target.value })}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Position</label>
              <Input
                type="number"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
          </div>
          <Input
            placeholder="Module slug (optional — ties visibility to a module)"
            value={form.module_slug}
            onChange={(e) => setForm({ ...form, module_slug: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={handleSave}>Save</Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : extensions.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No nav extensions configured. Add one to extend the navigation.
        </div>
      ) : (
        <div className="space-y-2">
          {extensions.map((ext) => (
            <div key={ext.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{ext.label}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ext.location}</code>
                    <span className="text-xs text-muted-foreground">min: {ext.min_role}</span>
                    {ext.module_slug && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {ext.module_slug}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{ext.url}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button variant="ghost" size="icon" onClick={() => startEdit(ext)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(ext.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
