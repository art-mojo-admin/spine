import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Database, Plus, Trash2, Edit2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function ItemTypesPage() {
  const { session } = useAuth()
  const [types, setTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    slug: '',
    label: '',
    icon: '',
    schema: '{\n  "record_permissions": {},\n  "fields": {}\n}'
  })

  useEffect(() => {
    loadTypes()
  }, [])

  async function loadTypes() {
    try {
      const res = await fetch('/api/item-types', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to load item types')
      const data = await res.json()
      setTypes(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      // Validate JSON
      let parsedSchema = {}
      try {
        parsedSchema = JSON.parse(form.schema)
      } catch (e) {
        alert('Invalid JSON in schema')
        return
      }

      const method = editingSlug ? 'PATCH' : 'POST'
      const res = await fetch('/api/item-types', {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          slug: editingSlug || form.slug, 
          label: form.label,
          icon: form.icon,
          schema: parsedSchema
        })
      })
      
      if (!res.ok) throw new Error('Failed to save item type')
      
      setForm({ slug: '', label: '', icon: '', schema: '{\n  "record_permissions": {},\n  "fields": {}\n}' })
      setEditingSlug(null)
      loadTypes()
    } catch (err) {
      console.error(err)
      alert('Failed to save item type')
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm('Are you sure you want to delete this item type? This will break any items using it.')) return
    
    try {
      const res = await fetch(`/api/item-types?slug=${slug}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to delete item type')
      loadTypes()
    } catch (err) {
      console.error(err)
      alert('Failed to delete item type')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Database className="h-8 w-8" />
          Item Types & Schema
        </h1>
        <p className="mt-1 text-muted-foreground">Manage dynamic item types and their JSON schemas</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{editingSlug ? 'Edit Item Type' : 'Create Custom Item Type'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="label" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Display Label</label>
                    <Input 
                      id="label"
                      value={form.label}
                      onChange={e => setForm({...form, label: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="slug" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Type Slug (ID)</label>
                    <Input 
                      id="slug"
                      value={form.slug}
                      onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                      placeholder="e.g. project"
                      required
                      disabled={!!editingSlug}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="schema" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">JSON Schema (Fields & Permissions)</label>
                  <Textarea 
                    id="schema"
                    value={form.schema}
                    onChange={e => setForm({...form, schema: e.target.value})}
                    className="font-mono text-sm h-[300px]"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingSlug ? 'Update Type' : 'Create Type'}
                  </Button>
                  {editingSlug && (
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingSlug(null)
                      setForm({ slug: '', label: '', icon: '', schema: '{\n  "record_permissions": {},\n  "fields": {}\n}' })
                    }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Registered Types</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-4 text-center text-muted-foreground">Loading types...</div>
              ) : (
                <div className="space-y-4">
                  {types.map(type => (
                    <div key={type.slug} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{type.label}</h4>
                          {type.is_system && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-muted rounded-full shrink-0">System</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Slug: {type.slug}</p>
                        <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                          <span>Fields: {Object.keys(type.schema?.fields || {}).length}</span>
                          <span>Roles Defined: {Object.keys(type.schema?.record_permissions || {}).length}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingSlug(type.slug)
                            setForm({ 
                              slug: type.slug, 
                              label: type.label, 
                              icon: type.icon || '', 
                              schema: JSON.stringify(type.schema || {}, null, 2) 
                            })
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(type.slug)}
                          disabled={type.is_system}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
