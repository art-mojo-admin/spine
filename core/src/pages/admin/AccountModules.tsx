import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, ToggleLeft, ToggleRight, Pencil } from 'lucide-react'

interface AccountModule {
  id: string
  module_slug: string
  label: string
  description: string | null
  enabled: boolean
  config: Record<string, any>
  installed_at: string
}

export function AccountModulesPage() {
  const [modules, setModules] = useState<AccountModule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ module_slug: '', label: '', description: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiGet<AccountModule[]>('account-modules')
      setModules(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      if (editingId) {
        await apiPatch('account-modules', {
          label: form.label,
          description: form.description || null,
        }, { id: editingId })
      } else {
        await apiPost('account-modules', {
          module_slug: form.module_slug,
          label: form.label,
          description: form.description || null,
        })
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ module_slug: '', label: '', description: '' })
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleToggle(mod: AccountModule) {
    try {
      await apiPatch('account-modules', { enabled: !mod.enabled }, { id: mod.id })
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this module?')) return
    try {
      await apiDelete('account-modules', { id })
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  function startEdit(mod: AccountModule) {
    setEditingId(mod.id)
    setForm({ module_slug: mod.module_slug, label: mod.label, description: mod.description || '' })
    setShowForm(true)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modules</h1>
          <p className="text-sm text-muted-foreground">
            Enable or disable feature modules for this account
          </p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm({ module_slug: '', label: '', description: '' }) }}>
          <Plus className="mr-2 h-4 w-4" /> Add Module
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold">{editingId ? 'Edit Module' : 'New Module'}</h3>
          {!editingId && (
            <Input
              placeholder="Module slug (e.g. invoicing)"
              value={form.module_slug}
              onChange={(e) => setForm({ ...form, module_slug: e.target.value })}
            />
          )}
          <Input
            placeholder="Display label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          <Input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={handleSave}>Save</Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : modules.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No modules installed. Add one or install a template pack.
        </div>
      ) : (
        <div className="space-y-2">
          {modules.map((mod) => (
            <div key={mod.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{mod.label}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{mod.module_slug}</code>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${mod.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {mod.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {mod.description && <p className="mt-1 text-sm text-muted-foreground">{mod.description}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleToggle(mod)} title={mod.enabled ? 'Disable' : 'Enable'}>
                  {mod.enabled ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => startEdit(mod)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(mod.id)}>
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
