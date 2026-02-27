import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { EditableField } from '@/components/shared/EditableField'
import { CustomFieldsRenderer } from '@/components/shared/CustomFieldsRenderer'
import { EntityLinksPanel } from '@/components/shared/EntityLinksPanel'
import { ThreadPanel } from '@/components/shared/ThreadPanel'
import { WatchButton } from '@/components/shared/WatchButton'
import { EntityAttachmentsPanel } from '@/components/shared/EntityAttachmentsPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Pencil, Save, X, KanbanSquare, ArrowRight, MessageSquare, GitFork } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export function WorkflowItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const isNew = itemId === 'new'

  const [item, setItem] = useState<any>(null)
  const [workflows, setWorkflows] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [people, setPeople] = useState<any[]>([])
  const [transitions, setTransitions] = useState<any[]>([])
  const [editing, setEditing] = useState(isNew)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [commentTransition, setCommentTransition] = useState<any>(null)
  const [transitionComment, setTransitionComment] = useState('')
  const [parentItem, setParentItem] = useState<any>(null)
  const [childItems, setChildItems] = useState<any[]>([])

  // Draft fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [workflowDefId, setWorkflowDefId] = useState('')
  const [stageDefId, setStageDefId] = useState('')
  const [ownerPersonId, setOwnerPersonId] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [workflowType, setWorkflowType] = useState('deal')
  const [metadata, setMetadata] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!currentAccountId) return

    async function load() {
      try {
        const [wfRes, pplRes] = await Promise.all([
          apiGet<any[]>('workflow-definitions'),
          apiGet<any[]>('persons'),
        ])
        setWorkflows(wfRes || [])
        setPeople(pplRes || [])

        if (isNew) {
          const preselect = searchParams.get('workflow')
          if (preselect) setWorkflowDefId(preselect)
        }

        if (!isNew && itemId) {
          setLoading(true)
          const itemRes = await apiGet<any>('workflow-items', { id: itemId })
          setItem(itemRes)
          setTitle(itemRes.title || '')
          setDescription(itemRes.description || '')
          setWorkflowDefId(itemRes.workflow_definition_id || '')
          setStageDefId(itemRes.stage_definition_id || '')
          setOwnerPersonId(itemRes.owner_person_id || '')
          setPriority(itemRes.priority || 'medium')
          setDueDate(itemRes.due_date ? itemRes.due_date.split('T')[0] : '')
          setWorkflowType(itemRes.workflow_type || 'deal')
          setMetadata(itemRes.metadata || {})

          if (itemRes.workflow_definition_id) {
            const [stageRes, transRes] = await Promise.all([
              apiGet<any[]>('stage-definitions', { workflow_definition_id: itemRes.workflow_definition_id }),
              apiGet<any[]>('transition-definitions', { workflow_definition_id: itemRes.workflow_definition_id }),
            ])
            setStages(stageRes || [])
            setTransitions(transRes || [])
          }

          // Load parent item if exists
          if (itemRes.parent_item_id) {
            apiGet<any>('workflow-items', { id: itemRes.parent_item_id })
              .then(setParentItem)
              .catch(() => {})
          } else {
            setParentItem(null)
          }

          // Load child items
          apiGet<any[]>('workflow-items', { parent_id: itemRes.id })
            .then(setChildItems)
            .catch(() => setChildItems([]))
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentAccountId, itemId, isNew])

  useEffect(() => {
    if (!workflowDefId || !currentAccountId) {
      setStages([])
      return
    }
    apiGet<any[]>('stage-definitions', { workflow_definition_id: workflowDefId })
      .then((res) => setStages(res || []))
      .catch(() => setStages([]))
  }, [workflowDefId, currentAccountId])

  function resetDraft() {
    if (item) {
      setTitle(item.title || '')
      setDescription(item.description || '')
      setWorkflowDefId(item.workflow_definition_id || '')
      setStageDefId(item.stage_definition_id || '')
      setOwnerPersonId(item.owner_person_id || '')
      setPriority(item.priority || 'medium')
      setDueDate(item.due_date ? item.due_date.split('T')[0] : '')
      setWorkflowType(item.workflow_type || 'deal')
      setMetadata(item.metadata || {})
    }
    setEditing(false)
  }

  async function handleSave() {
    if (!title.trim() || !workflowDefId) {
      setErrorMessage('Title and workflow are required.')
      return
    }
    setSaving(true)
    setErrorMessage(null)
    try {
      if (isNew) {
        const created = await apiPost<any>('workflow-items', {
          title,
          description,
          workflow_definition_id: workflowDefId,
          stage_definition_id: stageDefId || undefined,
          owner_person_id: ownerPersonId || undefined,
          priority,
          due_date: dueDate || undefined,
          workflow_type: workflowType,
        })
        navigate(`/workflow-items/${created.id}`, { replace: true })
      } else {
        const updated = await apiPatch<any>('workflow-items', {
          title,
          description,
          stage_definition_id: stageDefId || undefined,
          owner_person_id: ownerPersonId || undefined,
          priority,
          due_date: dueDate || undefined,
          metadata,
        }, { id: itemId! })
        setItem(updated)
        setEditing(false)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Available transitions from current stage
  const availableTransitions = item
    ? transitions.filter((t: any) => t.from_stage_id === item.stage_definition_id)
    : []

  async function executeTransition(transition: any, comment?: string) {
    if (!item || !itemId) return
    setTransitioning(true)
    setErrorMessage(null)
    try {
      const updated = await apiPatch<any>('workflow-items', {
        stage_definition_id: transition.to_stage_id,
        transition_id: transition.id,
        transition_comment: comment || undefined,
      }, { id: itemId })
      setItem(updated)
      setStageDefId(updated.stage_definition_id)
      setCommentTransition(null)
      setTransitionComment('')
    } catch (err: any) {
      setErrorMessage(err?.message || 'Transition failed')
    } finally {
      setTransitioning(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Item</h1>
        </div>
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
      </div>
    )
  }

  const workflowOpts = workflows.map((w) => ({ value: w.id, label: w.name }))
  const stageOpts = stages.map((s) => ({ value: s.id, label: s.name }))
  const personOpts = [{ value: '', label: '— Unassigned —' }, ...people.map((p) => ({ value: p.id, label: p.full_name }))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'New Workflow Item' : 'Workflow Item'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && !editing && itemId && itemId !== 'new' && (
            <WatchButton entityType="item" entityId={itemId} />
          )}
          {!isNew && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" />Edit
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <Card><CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <KanbanSquare className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              {editing ? (
                <span className="text-lg font-semibold">{title || 'Untitled'}</span>
              ) : (
                <>
                  <p className="text-lg font-semibold">{item?.title}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{item?.workflow_definitions?.name}</span>
                    <Badge variant="secondary">{item?.stage_definitions?.name}</Badge>
                    <Badge>{item?.priority}</Badge>
                  </div>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <EditableField label="Title" value={title} editing={editing} onChange={setTitle} required placeholder="Item title" />
            <EditableField label="Priority" value={priority} editing={editing} onChange={setPriority} type="select" options={PRIORITIES} />
            <EditableField
              label="Workflow"
              value={editing ? workflowDefId : item?.workflow_definitions?.name}
              editing={editing && isNew}
              onChange={setWorkflowDefId}
              type="select"
              options={workflowOpts}
              placeholder="Select workflow"
              required
            />
            <EditableField
              label="Stage"
              value={editing ? stageDefId : item?.stage_definitions?.name}
              editing={editing}
              onChange={setStageDefId}
              type="select"
              options={stageOpts}
              placeholder="Select stage"
            />
            <EditableField
              label="Owner"
              value={editing ? ownerPersonId : item?.persons?.full_name}
              editing={editing}
              onChange={setOwnerPersonId}
              type="select"
              options={personOpts}
            />
            <EditableField label="Due Date" value={dueDate} editing={editing} onChange={setDueDate} type="date" />
            {isNew && (
              <EditableField label="Workflow Type" value={workflowType} editing={editing} onChange={setWorkflowType} placeholder="e.g. deal, task, lead" />
            )}
          </div>
          <div className="mt-4">
            <EditableField label="Description" value={description} editing={editing} onChange={setDescription} type="textarea" placeholder="Describe this item..." />
          </div>

          {!isNew && !editing && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{item?.created_at ? new Date(item.created_at).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Item ID</dt>
                <dd className="font-mono text-xs break-all">{item?.id}</dd>
              </div>
            </div>
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

      {!isNew && (
        <CustomFieldsRenderer
          entityType="item"
          metadata={metadata}
          editing={editing}
          onChange={setMetadata}
        />
      )}

      {/* Parent Breadcrumb */}
      {!isNew && !editing && parentItem && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Parent Item</p>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/workflow-items/${parentItem.id}`)}>
              {parentItem.title}
            </Button>
            {parentItem.stage_definitions && (
              <Badge variant="secondary" className="ml-2 text-[10px]">{parentItem.stage_definitions.name}</Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Child Items */}
      {!isNew && !editing && childItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitFork className="h-4 w-4" />
              Sub-Items ({childItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {childItems.map((child: any) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                  onClick={() => navigate(`/workflow-items/${child.id}`)}
                >
                  <span className="font-medium">{child.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{child.stage_definitions?.name}</Badge>
                    <Badge className="text-[10px]">{child.priority}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isNew && !editing && itemId && itemId !== 'new' && (
        <EntityLinksPanel entityType="item" entityId={itemId} />
      )}

      {!isNew && !editing && itemId && itemId !== 'new' && (
        <ThreadPanel targetType="item" targetId={itemId} />
      )}

      {!isNew && !editing && itemId && itemId !== 'new' && (
        <EntityAttachmentsPanel entityType="item" entityId={itemId} />
      )}

      {/* Transition Buttons */}
      {!isNew && !editing && availableTransitions.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Transitions</p>
            <div className="flex flex-wrap gap-2">
              {availableTransitions.map((t: any) => {
                const targetStage = stages.find((s: any) => s.id === t.to_stage_id)
                return (
                  <Button
                    key={t.id}
                    size="sm"
                    variant="outline"
                    disabled={transitioning}
                    onClick={() => {
                      if (t.require_comment) {
                        setCommentTransition(t)
                      } else {
                        executeTransition(t)
                      }
                    }}
                  >
                    <ArrowRight className="mr-1 h-3 w-3" />
                    {t.name}
                    {targetStage && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {targetStage.name}
                      </Badge>
                    )}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comment Dialog for transitions that require it */}
      {commentTransition && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Comment required for: {commentTransition.name}
              </p>
            </div>
            <Textarea
              rows={3}
              value={transitionComment}
              onChange={(e) => setTransitionComment(e.target.value)}
              placeholder="Add a comment explaining this transition..."
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={!transitionComment.trim() || transitioning}
                onClick={() => executeTransition(commentTransition, transitionComment)}
              >
                {transitioning ? 'Processing...' : 'Confirm Transition'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setCommentTransition(null); setTransitionComment('') }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
