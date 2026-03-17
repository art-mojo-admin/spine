import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useActiveApp } from '@/hooks/useActiveApp'
import { withActiveAppScope, requireActiveAppScope, MissingActiveAppError } from '@/lib/activeApp'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ActiveAppContextBar } from '@/components/admin/ActiveAppContext'
import { cn } from '@/lib/utils'
import { Link2, Plus, Pencil, Trash2, Save, X, Lock } from 'lucide-react'

const ENTITY_TYPES = [
  { value: '', label: 'Any' },
  { value: 'person', label: 'Person' },
  { value: 'account', label: 'Account' },
  { value: 'item', label: 'Item' },
  { value: 'document', label: 'Document' },
  { value: 'thread', label: 'Thread' },
]

interface LinkTypeDef {
  id: string
  name: string
  slug: string
  source_entity_type: string | null
  target_entity_type: string | null
  metadata_schema: Record<string, any>
  color: string | null
  icon: string | null
  created_at: string
  pack_id?: string | null
}

export function LinkTypeDefinitionsPage() {
  const { currentAccountId } = useAuth()
  const { activeApp } = useActiveApp()
  const [defs, setDefs] = useState<LinkTypeDef[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [targetType, setTargetType] = useState('')
  const [color, setColor] = useState('')

  useEffect(() => {
    if (!currentAccountId) return
    loadDefs()
  }, [currentAccountId])

  async function loadDefs() {
    setLoading(true)
    try {
      const data = await apiGet<LinkTypeDef[]>('link-type-definitions')
      setDefs(data || [])
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setName('')
    setSlug('')
    setSourceType('')
    setTargetType('')
    setColor('')
    setEditingId(null)
    setShowForm(false)
    setErrorMessage(null)
  }

  function startEdit(def: LinkTypeDef) {
    setName(def.name)
    setSlug(def.slug)
    setSourceType(def.source_entity_type || '')
    setTargetType(def.target_entity_type || '')
    setColor(def.color || '')
    setEditingId(def.id)
    setShowForm(true)
  }

  useEffect(() => {
    setContextError(null)
  }, [activeApp?.packId])

  const guardMessage = 'Locked to another pack. Set it active before editing.'
  const isLinkGuarded = (def: LinkTypeDef) => {
    if (!def.pack_id) return false
    if (!activeApp?.packId) return false
    return def.pack_id !== activeApp.packId
  }

  function ensureLinkEditable(def?: LinkTypeDef) {
    setContextError(null)
    if (def && isLinkGuarded(def)) {
      setContextError(guardMessage)
      return false
    }
    return true
  }

  async function handleSave() {
    if (!name.trim()) {
      setErrorMessage('Name is required')
      return
    }
    setSaving(true)
    setErrorMessage(null)
    try {
      if (editingId) {
        const editingDef = defs.find((d) => d.id === editingId)
        if (!ensureLinkEditable(editingDef || undefined)) {
          setSaving(false)
          return
        }
        requireActiveAppScope()
        await apiPatch('link-type-definitions', {
          name,
          source_entity_type: sourceType || null,
          target_entity_type: targetType || null,
          color: color || null,
        }, { id: editingId })
      } else {
        const payload = withActiveAppScope({
          name,
          slug: slug || undefined,
          source_entity_type: sourceType || null,
          target_entity_type: targetType || null,
          color: color || null,
        }, { required: true })
        await apiPost('link-type-definitions', payload)
      }
      resetForm()
      await loadDefs()
    } catch (err: any) {
      if (err instanceof MissingActiveAppError) {
        setContextError(err.message)
      } else {
        setErrorMessage(err?.message || 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const target = defs.find((d) => d.id === id)
    if (!ensureLinkEditable(target || undefined)) return
    try {
      requireActiveAppScope()
      await apiDelete('link-type-definitions', { id })
      setDefs((prev) => prev.filter((d) => d.id !== id))
    } catch (err: any) {
      if (err instanceof MissingActiveAppError) {
        setContextError(err.message)
      } else {
        setErrorMessage(err?.message || 'Delete failed')
      }
    }
  }

  const contextReady = !!activeApp

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Link Types</h1>
        <Button
          size="sm"
          onClick={() => {
            if (showForm) resetForm()
            else setShowForm(true)
          }}
          disabled={!contextReady}
          title={!contextReady ? 'Select an active app to manage link types' : undefined}
        >
          {showForm ? <X className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Link Type'}
        </Button>
      </div>

      <ActiveAppContextBar />

      {contextError && (
        <Card>
          <CardContent className="flex items-center gap-2 py-3 text-sm text-amber-600">
            <Lock className="h-4 w-4" />
            <span>{contextError}</span>
          </CardContent>
        </Card>
      )}

      {errorMessage && (
        <Card><CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent></Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? 'Edit Link Type' : 'New Link Type'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name *</label>
                <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Participant" />
              </div>
              {!editingId && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Slug</label>
                  <Input className="mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated from name" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Source Entity Type</label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                >
                  {ENTITY_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Target Entity Type</label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                >
                  {ENTITY_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Color</label>
                <Input className="mt-1" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#3b82f6" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />{saving ? 'Saving...' : 'Save'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : defs.length === 0 ? (
            <div className="text-center py-8">
              <Link2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No link types defined yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Link types let you define named relationships between entities (e.g. Participant, Contact, Parent).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {defs.map((def) => (
                <div
                  key={def.id}
                  className={cn(
                    'flex items-center justify-between rounded-md border px-4 py-3',
                    isLinkGuarded(def) && 'border-dashed border-muted/80 opacity-60 cursor-not-allowed'
                  )}
                  title={isLinkGuarded(def) ? guardMessage : undefined}
                >
                  <div className="flex items-center gap-3">
                    {def.color && (
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: def.color }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">{def.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{def.slug}</p>
                    </div>
                    {def.pack_id && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {def.pack_id.slice(0, 8)}
                      </Badge>
                    )}
                    {isLinkGuarded(def) && (
                      <Badge variant="destructive" className="text-[10px]">Locked</Badge>
                    )}
                    <div className="flex gap-1">
                      {def.source_entity_type && (
                        <Badge variant="outline" className="text-[10px]">
                          {def.source_entity_type.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {(def.source_entity_type || def.target_entity_type) && (
                        <span className="text-xs text-muted-foreground">→</span>
                      )}
                      {def.target_entity_type && (
                        <Badge variant="outline" className="text-[10px]">
                          {def.target_entity_type.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {!def.source_entity_type && !def.target_entity_type && (
                        <Badge variant="secondary" className="text-[10px]">any → any</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        if (!ensureLinkEditable(def)) return
                        startEdit(def)
                      }}
                      disabled={!contextReady || isLinkGuarded(def)}
                      title={
                        !contextReady
                          ? 'Select an app to edit link types'
                          : isLinkGuarded(def)
                            ? guardMessage
                            : undefined
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(def.id)}
                      disabled={!contextReady || isLinkGuarded(def)}
                      title={
                        !contextReady
                          ? 'Select an app to delete link types'
                          : isLinkGuarded(def)
                            ? guardMessage
                            : 'Delete link type'
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {isLinkGuarded(def) && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-600">
                      <Lock className="h-3 w-3" /> Locked to another pack
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
