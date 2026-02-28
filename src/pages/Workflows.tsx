import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, GitBranch, Settings2, ArrowRight, Pencil, Workflow } from 'lucide-react'

export function WorkflowsPage() {
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const [definitions, setDefinitions] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [selectedDef, setSelectedDef] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'stages'>('kanban')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  // Stage builder state
  const [showAddStage, setShowAddStage] = useState(false)
  const [stageName, setStageName] = useState('')
  const [stageIsInitial, setStageIsInitial] = useState(false)
  const [stageIsTerminal, setStageIsTerminal] = useState(false)

  // Item composer state
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemTitle, setItemTitle] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemPriority, setItemPriority] = useState('medium')

  // Transition state
  const [transitionItem, setTransitionItem] = useState<any>(null)

  useEffect(() => {
    if (!currentAccountId) return
    apiGet<any[]>('workflow-definitions')
      .then(setDefinitions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId])

  async function loadWorkflow(defId: string) {
    const [itemsData, stagesData] = await Promise.all([
      apiGet<any[]>('workflow-items', { workflow_definition_id: defId }),
      apiGet<any[]>('stage-definitions', { workflow_definition_id: defId }),
    ])
    setItems(itemsData)
    setStages(stagesData)
  }

  async function selectDef(def: any) {
    setSelectedDef(def)
    await loadWorkflow(def.id)
  }

  async function createDef() {
    if (!newName.trim()) return
    await apiPost('workflow-definitions', { name: newName })
    setNewName('')
    setShowCreate(false)
    setDefinitions(await apiGet<any[]>('workflow-definitions'))
  }

  async function addStage() {
    if (!stageName.trim() || !selectedDef) return
    await apiPost('stage-definitions', {
      workflow_definition_id: selectedDef.id,
      name: stageName,
      position: stages.length,
      is_initial: stageIsInitial,
      is_terminal: stageIsTerminal,
      allowed_transitions: [],
    })
    setStageName('')
    setStageIsInitial(false)
    setStageIsTerminal(false)
    setShowAddStage(false)
    await loadWorkflow(selectedDef.id)
  }

  async function updateTransitions(stageId: string, transitions: string[]) {
    await apiPatch('stage-definitions', { allowed_transitions: transitions }, { id: stageId })
    await loadWorkflow(selectedDef.id)
  }

  async function addItem() {
    if (!itemTitle.trim() || !selectedDef) return
    await apiPost('workflow-items', {
      workflow_definition_id: selectedDef.id,
      title: itemTitle,
      description: itemDescription || null,
      priority: itemPriority,
      workflow_type: selectedDef.name,
    })
    setItemTitle('')
    setItemDescription('')
    setItemPriority('medium')
    setShowAddItem(false)
    await loadWorkflow(selectedDef.id)
  }

  async function moveItem(itemId: string, targetStageId: string) {
    await apiPatch('workflow-items', { stage_definition_id: targetStageId }, { id: itemId })
    setTransitionItem(null)
    await loadWorkflow(selectedDef.id)
  }

  function getAllowedTargets(item: any): any[] {
    const currentStage = stages.find((s: any) => s.id === item.stage_definition_id)
    if (!currentStage?.allowed_transitions?.length) return stages.filter((s: any) => s.id !== item.stage_definition_id)
    return stages.filter((s: any) => currentStage.allowed_transitions.includes(s.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="mt-1 text-muted-foreground">Manage workflow definitions and items</p>
        </div>
        {!selectedDef && (
          <Button onClick={() => navigate('/admin/workflows/new')} size="sm">
            <Plus className="mr-2 h-4 w-4" /> New Workflow
          </Button>
        )}
      </div>

      {!selectedDef ? (
        <div className="grid gap-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : definitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workflows defined</p>
          ) : (
            definitions.map((def: any) => (
              <Card key={def.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => selectDef(def)}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{def.name}</p>
                    <p className="text-sm text-muted-foreground">{def.description || 'No description'}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/admin/workflows/${def.id}/builder`) }} title="Visual Builder">
                    <Workflow className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/admin/workflows/${def.id}`) }} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Badge variant={def.status === 'active' ? 'default' : 'secondary'}>{def.status}</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedDef(null); setItems([]); setStages([]) }}>
              ← Back
            </Button>
            <h2 className="text-xl font-semibold">{selectedDef.name}</h2>
            <div className="ml-auto flex gap-2">
              <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('kanban')}>Kanban</Button>
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>List</Button>
              <Button variant={viewMode === 'stages' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('stages')}>
                <Settings2 className="mr-1 h-3 w-3" /> Stages
              </Button>
              <Button size="sm" onClick={() => navigate(`/workflow-items/new?workflow=${selectedDef.id}`)}>
                <Plus className="mr-1 h-3 w-3" /> Add Item
              </Button>
            </div>
          </div>

          {/* Stage Builder View */}
          {viewMode === 'stages' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">Stage Definitions</h3>
                <Button size="sm" variant="outline" onClick={() => setShowAddStage(true)}>
                  <Plus className="mr-1 h-3 w-3" /> Add Stage
                </Button>
              </div>

              {showAddStage && (
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <Input placeholder="Stage name" value={stageName} onChange={e => setStageName(e.target.value)} />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={stageIsInitial} onChange={e => setStageIsInitial(e.target.checked)} />
                        Initial stage
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={stageIsTerminal} onChange={e => setStageIsTerminal(e.target.checked)} />
                        Terminal stage
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addStage}>Add Stage</Button>
                      <Button variant="ghost" onClick={() => setShowAddStage(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stages defined. Add stages to build your workflow pipeline.</p>
              ) : (
                <div className="grid gap-3">
                  {stages.map((stage: any, idx: number) => (
                    <Card key={stage.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{stage.name}</p>
                            <div className="flex gap-2 mt-1">
                              {stage.is_initial && <Badge variant="default" className="text-xs">Initial</Badge>}
                              {stage.is_terminal && <Badge variant="secondary" className="text-xs">Terminal</Badge>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-1">Transitions to:</p>
                            <div className="flex flex-wrap gap-1 justify-end">
                              {stages.filter((s: any) => s.id !== stage.id).map((target: any) => {
                                const isAllowed = stage.allowed_transitions?.includes(target.id)
                                return (
                                  <button
                                    key={target.id}
                                    onClick={() => {
                                      const current = stage.allowed_transitions || []
                                      const updated = isAllowed
                                        ? current.filter((id: string) => id !== target.id)
                                        : [...current, target.id]
                                      updateTransitions(stage.id, updated)
                                    }}
                                    className={`rounded px-2 py-0.5 text-xs border transition-colors ${
                                      isAllowed
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background text-muted-foreground border-border hover:border-primary'
                                    }`}
                                  >
                                    {target.name}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            stages.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground mb-3">No stages defined yet.</p>
                  <Button size="sm" onClick={() => setViewMode('stages')}>
                    <Settings2 className="mr-2 h-4 w-4" /> Set Up Stages
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {stages.map((stage: any) => {
                  const stageItems = items.filter((i: any) => i.stage_definition_id === stage.id)
                  return (
                    <div key={stage.id} className="min-w-[280px] flex-shrink-0">
                      <div className="mb-3 flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{stage.name}</h3>
                        <Badge variant="secondary" className="text-xs">{stageItems.length}</Badge>
                        {stage.is_initial && <Badge variant="outline" className="text-xs">Start</Badge>}
                        {stage.is_terminal && <Badge variant="outline" className="text-xs">End</Badge>}
                      </div>
                      <div className="space-y-2">
                        {stageItems.map((item: any) => (
                          <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTransitionItem(transitionItem?.id === item.id ? null : item)}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">{item.title}</p>
                                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={(e) => { e.stopPropagation(); navigate(`/workflow-items/${item.id}`) }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                              {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                              <div className="mt-2 flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{item.priority}</Badge>
                                {item.persons && <span className="text-xs text-muted-foreground">{item.persons.full_name}</span>}
                              </div>
                              {transitionItem?.id === item.id && (
                                <div className="mt-3 border-t pt-3 space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground">Move to:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {getAllowedTargets(item).map((target: any) => (
                                      <button
                                        key={target.id}
                                        onClick={(e) => { e.stopPropagation(); moveItem(item.id, target.id) }}
                                        className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                                      >
                                        <ArrowRight className="h-3 w-3" /> {target.name}
                                      </button>
                                    ))}
                                    {getAllowedTargets(item).length === 0 && (
                                      <span className="text-xs text-muted-foreground">No transitions available</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="grid gap-3">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items</p>
              ) : (
                items.map((item: any) => (
                  <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/workflow-items/${item.id}`)}>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.description || ''}</p>
                        </div>
                        <Badge variant="secondary">{item.stage_definitions?.name || '—'}</Badge>
                        <Badge variant="outline">{item.priority}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
