import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Plus, Trash2, Edit2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface TenantRole {
  id: string
  slug: string
  display_name: string
  description: string
  is_system: boolean
}

export function TenantRolesPage() {
  const { session } = useAuth()
  const [roles, setRoles] = useState<TenantRole[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    slug: '',
    display_name: '',
    description: ''
  })

  useEffect(() => {
    loadRoles()
  }, [])

  async function loadRoles() {
    try {
      const res = await fetch('/api/admin/tenant-roles', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to load roles')
      const data = await res.json()
      setRoles(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch('/api/admin/tenant-roles', {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ ...form, id: editingId })
      })
      
      if (!res.ok) throw new Error('Failed to save role')
      
      setForm({ slug: '', display_name: '', description: '' })
      setEditingId(null)
      loadRoles()
    } catch (err) {
      console.error(err)
      alert('Failed to save role')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this role? Users with this role may lose access.')) return
    
    try {
      const res = await fetch(`/api/admin/tenant-roles?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to delete role')
      loadRoles()
    } catch (err) {
      console.error(err)
      alert('Failed to delete role')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Custom Roles
        </h1>
        <p className="mt-1 text-muted-foreground">Manage custom roles for your tenant</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? 'Edit Role' : 'Create Custom Role'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="display_name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Display Name</label>
                  <Input 
                    id="display_name"
                    value={form.display_name}
                    onChange={e => setForm({...form, display_name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="slug" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Slug (Internal ID)</label>
                  <Input 
                    id="slug"
                    value={form.slug}
                    onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                    placeholder="e.g. billing-manager"
                    required
                    disabled={!!editingId}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Description</label>
                  <Textarea 
                    id="description"
                    value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingId ? 'Update Role' : 'Create Role'}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingId(null)
                      setForm({ slug: '', display_name: '', description: '' })
                    }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Existing Roles</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-4 text-center text-muted-foreground">Loading roles...</div>
              ) : (
                <div className="space-y-4">
                  {roles.map(role => (
                    <div key={role.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{role.display_name}</h4>
                          {role.is_system && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-muted rounded-full">System</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Slug: {role.slug}</p>
                        {role.description && (
                          <p className="text-sm mt-2">{role.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingId(role.id)
                            setForm({ slug: role.slug, display_name: role.display_name, description: role.description || '' })
                          }}
                          disabled={role.is_system}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(role.id)}
                          disabled={role.is_system}
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
