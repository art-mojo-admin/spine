import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { EditableField } from '@/components/shared/EditableField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Pencil, Save, X, GitBranch, Plus, Trash2, GripVertical } from 'lucide-react'

const WF_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

interface StageDraft {
  id?: string
  name: string
  position: number
  is_initial: boolean
  is_terminal: boolean
  _isNew?: boolean
  _deleted?: boolean
}

export function WorkflowDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const navigate = useNavigate()
  const { currentAccountId, currentAccountNodeId } = useAuth()
  const isNew = workflowId === 'new'

  const [workflow, setWorkflow] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [editing, setEditing] = useState(isNew)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Draft fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('active')
  const [stageDrafts, setStageDrafts] = useState<StageDraft[]>([])

  const scopeKey = currentAccountNodeId || currentAccountId || 'root'

  useEffect(() => {
    if (isNew || !workflowId || !currentAccountId) return
    const requestScope = scopeKey

    setLoading(true)
    setErrorMessage(null)

    async function load(expectedScope: string) {
      try {
        const [wfRes, itemsRes] = await Promise.all([
          apiGet<any>('workflow-definitions', { id: workflowId! }),
          apiGet<any[]>('workflow-items', { workflow_definition_id: workflowId! }),
        ])
        if (expectedScope !== scopeKey) return
        setWorkflow(wfRes)
        setItems(itemsRes || [])
        setName(wfRes.name || '')
        setDescription(wfRes.description || '')
        setStatus(wfRes.status || 'active')

        const stages = (wfRes.stage_definitions || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            position: s.position,
            is_initial: s.is_initial,
            is_terminal: s.is_terminal,
          }))
        setStageDrafts(stages)
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    load(requestScope)
  }, [workflowId, currentAccountId, scopeKey, isNew])

  function resetDraft() {
    if (workflow) {
      setName(workflow.name || '')
      setDescription(workflow.description || '')
      setStatus(workflow.status || 'active')
      const stages = (workflow.stage_definitions || [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          position: s.position,
          is_initial: s.is_initial,
          is_terminal: s.is_terminal,
        }))
      setStageDrafts(stages)
    }
    setEditing(false)
  }

  function addStage() {
    const maxPos = stageDrafts.filter((s) => !s._deleted).reduce((m, s) => Math.max(m, s.position), -1)
    setStageDrafts((prev) => [
      ...prev,
      { name: '', position: maxPos + 1, is_initial: prev.filter((s) => !s._deleted).length === 0, is_terminal: false, _isNew: true },
    ])
  }

  function updateStage(index: number, patch: Partial<StageDraft>) {
    setStageDrafts((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function removeStage(index: number) {
    setStageDrafts((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s
        if (s._isNew) return { ...s, _deleted: true }
        return { ...s, _deleted: true }
      }),
    )
  }

  async function handleSave() {
    if (!name.trim()) {
      setErrorMessage('Workflow name is required.')
      return
    }
    setSaving(true)
    setErrorMessage(null)
    try {
      let wfId = workflowId
      if (isNew) {
        const created = await apiPost<any>('workflow-definitions', {
          name,
          description: description || undefined,
        })
        wfId = created.id

        // Create stages for new workflow
        const activeStages = stageDrafts.filter((s) => !s._deleted && s.name.trim())
        for (const stage of activeStages) {
          await apiPost('stage-definitions', {
            workflow_definition_id: wfId,
            name: stage.name,
            position: stage.position,
            is_initial: stage.is_initial,
            is_terminal: stage.is_terminal,
            allowed_transitions: [],
          })
        }

        navigate(`/admin/workflows/${wfId}`, { replace: true })
      } else {
        // Update workflow definition
        await apiPatch('workflow-definitions', {
          name,
          description: description || undefined,
          status,
        }, { id: wfId! })

        // Process stage changes
        const activeStages = stageDrafts.filter((s) => !s._deleted)
        const deletedStages = stageDrafts.filter((s) => s._deleted && s.id)

        for (const stage of deletedStages) {
          await apiDelete(`stage-definitions?id=${stage.id}`)
        }
        for (const stage of activeStages) {
          if (stage._isNew && stage.name.trim()) {
            await apiPost('stage-definitions', {
              workflow_definition_id: wfId,
              name: stage.name,
              position: stage.position,
              is_initial: stage.is_initial,
              is_terminal: stage.is_terminal,
              allowed_transitions: [],
            })
          } else if (stage.id) {
            await apiPatch('stage-definitions', {
              name: stage.name,
              position: stage.position,
              is_initial: stage.is_initial,
              is_terminal: stage.is_terminal,
            }, { id: stage.id })
          }
        }

        // Reload
        const wfRes = await apiGet<any>('workflow-definitions', { id: wfId! })
        setWorkflow(wfRes)
        setName(wfRes.name || '')
        setDescription(wfRes.description || '')
        setStatus(wfRes.status || 'active')
        const stages = (wfRes.stage_definitions || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            position: s.position,
            is_initial: s.is_initial,
            is_terminal: s.is_terminal,
          }))
        setStageDrafts(stages)
        setEditing(false)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Workflow</h1>
        </div>
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
      </div>
    )
  }

  const activeStages = stageDrafts.filter((s) => !s._deleted)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'New Workflow' : 'Workflow'}
          </h1>
        </div>
        {!isNew && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" />Edit
          </Button>
        )}
      </div>

      {errorMessage && (
        <Card><CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent></Card>
      )}

      {/* Workflow info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <GitBranch className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              {editing ? (
                <span className="text-lg font-semibold">{name || 'Untitled Workflow'}</span>
              ) : (
                <>
                  <p className="text-lg font-semibold">{workflow?.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={workflow?.status === 'active' ? 'default' : 'secondary'}>{workflow?.status}</Badge>
                    <span>{items.length} items</span>
                  </div>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <EditableField label="Name" value={name} editing={editing} onChange={setName} required placeholder="Workflow name" />
            {!isNew && (
              <EditableField label="Status" value={status} editing={editing} onChange={setStatus} type="select" options={WF_STATUSES} />
            )}
          </div>
          <div className="mt-4">
            <EditableField label="Description" value={description} editing={editing} onChange={setDescription} type="textarea" placeholder="Describe this workflow..." />
          </div>
          {!isNew && !editing && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Workflow ID</dt>
                <dd className="font-mono text-xs break-all">{workflow?.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{workflow?.created_at ? new Date(workflow.created_at).toLocaleString() : '—'}</dd>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage builder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Stages</CardTitle>
          {editing && (
            <Button variant="outline" size="sm" onClick={addStage}>
              <Plus className="mr-1 h-4 w-4" />Add Stage
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {activeStages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {editing ? 'Add stages to define your pipeline.' : 'No stages defined.'}
            </p>
          ) : editing ? (
            activeStages.map((stage, idx) => {
              const realIndex = stageDrafts.indexOf(stage)
              return (
                <div key={realIndex} className="flex items-center gap-3 rounded-md border p-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground w-6">{idx + 1}</span>
                  <Input
                    className="flex-1"
                    value={stage.name}
                    onChange={(e) => updateStage(realIndex, { name: e.target.value })}
                    placeholder="Stage name"
                  />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={stage.is_initial}
                      onChange={(e) => updateStage(realIndex, { is_initial: e.target.checked })}
                    />
                    Initial
                  </label>
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={stage.is_terminal}
                      onChange={(e) => updateStage(realIndex, { is_terminal: e.target.checked })}
                    />
                    Terminal
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => removeStage(realIndex)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )
            })
          ) : (
            activeStages.map((stage, idx) => (
              <div key={stage.id || idx} className="flex items-center gap-3 rounded-md border p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm font-medium">{stage.name}</span>
                {stage.is_initial && <Badge variant="secondary" className="text-xs">Initial</Badge>}
                {stage.is_terminal && <Badge variant="secondary" className="text-xs">Terminal</Badge>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {editing && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />{saving ? 'Saving...' : 'Save'}
          </Button>
          {!isNew && (
            <Button variant="ghost" onClick={resetDraft}>
              <X className="mr-1 h-4 w-4" />Cancel
            </Button>
          )}
        </div>
      )}

      {/* Workflow items list */}
      {!isNew && !editing && items.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Workflow Items ({items.length})</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/workflows')}>
              View Kanban
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.slice(0, 10).map((item: any) => (
              <div
                key={item.id}
                className="rounded-md border p-3 cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => navigate(`/workflow-items/${item.id}`)}
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.stage_definitions?.name || 'No stage'} • {item.persons?.full_name || 'Unassigned'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">{item.priority}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
