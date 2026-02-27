import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ConditionEditor } from './ConditionEditor'
import { ActionEditor } from './ActionEditor'
import { X, Plus, Trash2, Zap, Pencil } from 'lucide-react'

interface BuilderSidePanelProps {
  type: 'stage' | 'transition' | null
  data: any
  workflowId: string
  onClose: () => void
  onStageUpdated: () => void
  onTransitionUpdated: () => void
}

type Tab = 'properties' | 'on_enter' | 'on_exit' | 'conditions' | 'actions'

export function BuilderSidePanel({
  type,
  data,
  workflowId,
  onClose,
  onStageUpdated,
  onTransitionUpdated,
}: BuilderSidePanelProps) {
  const [tab, setTab] = useState<Tab>('properties')
  const [actions, setActions] = useState<any[]>([])
  const [editingAction, setEditingAction] = useState<any | null>(null)
  const [showNewAction, setShowNewAction] = useState(false)

  // Stage properties
  const [stageName, setStageName] = useState('')
  const [stageDesc, setStageDesc] = useState('')
  const [isInitial, setIsInitial] = useState(false)
  const [isTerminal, setIsTerminal] = useState(false)
  const [isPublic, setIsPublic] = useState(false)

  // Transition properties
  const [transName, setTransName] = useState('')
  const [requireComment, setRequireComment] = useState(false)
  const [requireFields, setRequireFields] = useState('')
  const [transConditions, setTransConditions] = useState<any[]>([])

  useEffect(() => {
    if (!data) return
    if (type === 'stage') {
      setStageName(data.name || '')
      setStageDesc(data.description || '')
      setIsInitial(data.is_initial || false)
      setIsTerminal(data.is_terminal || false)
      setIsPublic(data.is_public || false)
    } else if (type === 'transition') {
      setTransName(data.name || '')
      setRequireComment(data.require_comment || false)
      setRequireFields((data.require_fields || []).join(', '))
      setTransConditions(data.conditions || [])
    }
    setTab('properties')
    setEditingAction(null)
    setShowNewAction(false)
    loadActions()
  }, [type, data?.id])

  async function loadActions() {
    if (!data?.id || !workflowId) return
    try {
      const triggerType =
        tab === 'on_enter' ? 'on_enter_stage' :
        tab === 'on_exit' ? 'on_exit_stage' :
        type === 'transition' ? 'on_transition' : null

      const allActions = await apiGet<any[]>('workflow-actions', {
        workflow_definition_id: workflowId,
      })
      setActions(allActions || [])
    } catch {
      setActions([])
    }
  }

  function getFilteredActions(triggerType: string): any[] {
    return actions.filter(
      (a) => a.trigger_type === triggerType && a.trigger_ref_id === data?.id,
    )
  }

  async function saveStage() {
    if (!data?.id) return
    await apiPatch('stage-definitions', {
      name: stageName,
      description: stageDesc || null,
      is_initial: isInitial,
      is_terminal: isTerminal,
      is_public: isPublic,
    }, { id: data.id })
    onStageUpdated()
  }

  async function saveTransition() {
    if (!data?.id) return
    const fields = requireFields.split(',').map((f) => f.trim()).filter(Boolean)
    await apiPatch('transition-definitions', {
      name: transName,
      require_comment: requireComment,
      require_fields: fields,
      conditions: transConditions,
    }, { id: data.id })
    onTransitionUpdated()
  }

  async function deleteTransition() {
    if (!data?.id) return
    await apiDelete('transition-definitions', { id: data.id })
    onTransitionUpdated()
    onClose()
  }

  async function saveAction(actionData: any) {
    const triggerType =
      tab === 'on_enter' ? 'on_enter_stage' :
      tab === 'on_exit' ? 'on_exit_stage' :
      'on_transition'

    if (actionData.id) {
      await apiPatch('workflow-actions', {
        name: actionData.name,
        action_type: actionData.action_type,
        action_config: actionData.action_config,
        conditions: actionData.conditions,
        enabled: actionData.enabled,
      }, { id: actionData.id })
    } else {
      await apiPost('workflow-actions', {
        workflow_definition_id: workflowId,
        name: actionData.name,
        trigger_type: triggerType,
        trigger_ref_id: data.id,
        action_type: actionData.action_type,
        action_config: actionData.action_config,
        conditions: actionData.conditions,
        enabled: actionData.enabled,
        position: getFilteredActions(triggerType).length,
      })
    }
    setEditingAction(null)
    setShowNewAction(false)
    await loadActions()
    
    if (tab === 'on_enter' || tab === 'on_exit') {
      onStageUpdated()
    } else if (tab === 'actions' && type === 'transition') {
      onTransitionUpdated()
    }
  }

  async function deleteAction(actionId: string) {
    await apiDelete('workflow-actions', { id: actionId })
    await loadActions()

    if (tab === 'on_enter' || tab === 'on_exit') {
      onStageUpdated()
    } else if (tab === 'actions' && type === 'transition') {
      onTransitionUpdated()
    }
  }

  if (!type || !data) return null

  const stageTabs: Tab[] = ['properties', 'on_enter', 'on_exit']
  const transitionTabs: Tab[] = ['properties', 'conditions', 'actions']
  const tabs = type === 'stage' ? stageTabs : transitionTabs

  return (
    <div className="w-[380px] flex-shrink-0 border-l bg-background overflow-y-auto">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">
            {type === 'stage' ? 'Stage' : 'Transition'}
          </p>
          <p className="text-xs text-muted-foreground">{data.name || 'Untitled'}</p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex border-b">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'on_enter' ? 'On Enter' :
             t === 'on_exit' ? 'On Exit' :
             t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* Stage Properties */}
        {type === 'stage' && tab === 'properties' && (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={stageName} onChange={(e) => setStageName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input value={stageDesc} onChange={(e) => setStageDesc(e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isInitial} onChange={(e) => setIsInitial(e.target.checked)} />
                Initial
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isTerminal} onChange={(e) => setIsTerminal(e.target.checked)} />
                Terminal
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Public
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">Public stages are visible on the public listing page.</p>
            <Button size="sm" onClick={saveStage}>Save Stage</Button>
          </>
        )}

        {/* Transition Properties */}
        {type === 'transition' && tab === 'properties' && (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={transName} onChange={(e) => setTransName(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requireComment} onChange={(e) => setRequireComment(e.target.checked)} />
              Require Comment
            </label>
            <div className="space-y-1">
              <label className="text-sm font-medium">Required Fields</label>
              <Input
                value={requireFields}
                onChange={(e) => setRequireFields(e.target.value)}
                placeholder="comma-separated: owner_person_id, priority"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveTransition}>Save Transition</Button>
              <Button size="sm" variant="destructive" onClick={deleteTransition}>
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            </div>
          </>
        )}

        {/* Transition Conditions */}
        {type === 'transition' && tab === 'conditions' && (
          <>
            <ConditionEditor conditions={transConditions} onChange={setTransConditions} entityType="workflow_item" />
            <Button size="sm" onClick={saveTransition}>Save Conditions</Button>
          </>
        )}

        {/* Actions tabs (on_enter, on_exit, or transition actions) */}
        {(tab === 'on_enter' || tab === 'on_exit' || (type === 'transition' && tab === 'actions')) && (
          <>
            {editingAction || showNewAction ? (
              <ActionEditor
                action={editingAction}
                onSave={saveAction}
                onCancel={() => { setEditingAction(null); setShowNewAction(false) }}
                entityType="workflow_item"
              />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {tab === 'on_enter' ? 'On Enter Actions' :
                     tab === 'on_exit' ? 'On Exit Actions' :
                     'Transition Actions'}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setShowNewAction(true)}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                </div>

                {(() => {
                  const triggerType =
                    tab === 'on_enter' ? 'on_enter_stage' :
                    tab === 'on_exit' ? 'on_exit_stage' :
                    'on_transition'
                  const filtered = getFilteredActions(triggerType)

                  if (filtered.length === 0) {
                    return <p className="text-xs text-muted-foreground">No actions configured</p>
                  }

                  return filtered.map((action: any) => (
                    <Card key={action.id} className={!action.enabled ? 'opacity-60' : ''}>
                      <CardContent className="flex items-center gap-3 py-3">
                        <Zap className={`h-4 w-4 ${action.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{action.name}</p>
                          <p className="text-[10px] text-muted-foreground">{action.action_type}</p>
                        </div>
                        <Badge variant={action.enabled ? 'default' : 'secondary'} className="text-[10px]">
                          {action.enabled ? 'On' : 'Off'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setEditingAction(action)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => deleteAction(action.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                })()}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
