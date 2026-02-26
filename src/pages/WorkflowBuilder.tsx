import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Plus } from 'lucide-react'
import { StageNode } from '@/components/workflow/StageNode'
import { TransitionEdge } from '@/components/workflow/TransitionEdge'
import { BuilderSidePanel } from '@/components/workflow/BuilderSidePanel'

const nodeTypes = { stage: StageNode }
const edgeTypes = { transition: TransitionEdge }

export function WorkflowBuilderPage() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()

  const [workflow, setWorkflow] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const [transitions, setTransitions] = useState<any[]>([])
  const [allActions, setAllActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const [panelType, setPanelType] = useState<'stage' | 'transition' | null>(null)
  const [panelData, setPanelData] = useState<any>(null)

  const [showNewStage, setShowNewStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')

  async function loadAll() {
    if (!workflowId || !currentAccountId) return
    setLoading(true)
    try {
      const [wf, stagesRes, transRes, actionsRes] = await Promise.all([
        apiGet<any>('workflow-definitions', { id: workflowId }),
        apiGet<any[]>('stage-definitions', { workflow_definition_id: workflowId }),
        apiGet<any[]>('transition-definitions', { workflow_definition_id: workflowId }),
        apiGet<any[]>('workflow-actions', { workflow_definition_id: workflowId }),
      ])
      setWorkflow(wf)
      setStages(stagesRes || [])
      setTransitions(transRes || [])
      setAllActions(actionsRes || [])
    } catch (err) {
      console.error('Failed to load workflow builder data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [workflowId, currentAccountId])

  useEffect(() => {
    if (loading) return

    const actionCountByRef = new Map<string, number>()
    const enterActionCountByRef = new Map<string, number>()
    const exitActionCountByRef = new Map<string, number>()

    for (const a of allActions) {
      if (a.trigger_ref_id) {
        actionCountByRef.set(a.trigger_ref_id, (actionCountByRef.get(a.trigger_ref_id) || 0) + 1)
        if (a.trigger_type === 'on_enter_stage') {
          enterActionCountByRef.set(a.trigger_ref_id, (enterActionCountByRef.get(a.trigger_ref_id) || 0) + 1)
        } else if (a.trigger_type === 'on_exit_stage') {
          exitActionCountByRef.set(a.trigger_ref_id, (exitActionCountByRef.get(a.trigger_ref_id) || 0) + 1)
        }
      }
    }

    const newNodes: Node[] = stages.map((stage, idx) => ({
      id: stage.id,
      type: 'stage',
      position: {
        x: stage.config?.position_x ?? 100 + (idx % 4) * 220,
        y: stage.config?.position_y ?? 80 + Math.floor(idx / 4) * 160,
      },
      data: {
        label: stage.name,
        isInitial: stage.is_initial,
        isTerminal: stage.is_terminal,
        actionCount: actionCountByRef.get(stage.id) || 0,
        enterActionCount: enterActionCountByRef.get(stage.id) || 0,
        exitActionCount: exitActionCountByRef.get(stage.id) || 0,
      },
    }))

    const newEdges: Edge[] = transitions.map((t) => ({
      id: t.id,
      source: t.from_stage_id,
      target: t.to_stage_id,
      type: 'transition',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      data: { 
        label: t.name,
        hasConditions: Array.isArray(t.conditions) && t.conditions.length > 0,
        actionCount: actionCountByRef.get(t.id) || 0,
      },
    }))

    setNodes(newNodes)
    setEdges(newEdges)
  }, [stages, transitions, allActions, loading])

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || !workflowId) return
      const sourceStage = stages.find((s) => s.id === connection.source)
      const targetStage = stages.find((s) => s.id === connection.target)
      if (!sourceStage || !targetStage) return

      try {
        await apiPost('transition-definitions', {
          workflow_definition_id: workflowId,
          name: sourceStage.name + ' \u2192 ' + targetStage.name,
          from_stage_id: connection.source,
          to_stage_id: connection.target,
        })
        await loadAll()
      } catch (err) {
        console.error('Failed to create transition', err)
      }
    },
    [workflowId, stages],
  )

  const onNodeDragStop = useCallback(
    async (_: any, node: Node) => {
      const stage = stages.find((s) => s.id === node.id)
      if (!stage) return
      const config = { ...(stage.config || {}), position_x: node.position.x, position_y: node.position.y }
      await apiPatch('stage-definitions', { config }, { id: node.id }).catch(() => {})
    },
    [stages],
  )

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      const stage = stages.find((s) => s.id === node.id)
      if (stage) { setPanelType('stage'); setPanelData(stage) }
    },
    [stages],
  )

  const onEdgeClick = useCallback(
    (_: any, edge: Edge) => {
      const transition = transitions.find((t) => t.id === edge.id)
      if (transition) { setPanelType('transition'); setPanelData(transition) }
    },
    [transitions],
  )

  const onPaneClick = useCallback(() => {
    setPanelType(null)
    setPanelData(null)
  }, [])

  async function addStage() {
    if (!newStageName.trim() || !workflowId) return
    await apiPost('stage-definitions', {
      workflow_definition_id: workflowId,
      name: newStageName,
      position: stages.length,
      is_initial: stages.length === 0,
      is_terminal: false,
      config: { position_x: 100 + (stages.length % 4) * 220, position_y: 80 + Math.floor(stages.length / 4) * 160 },
    })
    setNewStageName('')
    setShowNewStage(false)
    await loadAll()
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading builder...</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="text-lg font-semibold">{workflow?.name || 'Workflow'} Builder</h1>
        <div className="ml-auto flex items-center gap-2">
          {showNewStage ? (
            <div className="flex items-center gap-2">
              <Input
                className="h-8 w-48"
                placeholder="Stage name"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addStage()}
                autoFocus
              />
              <Button size="sm" onClick={addStage} disabled={!newStageName.trim()}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowNewStage(false); setNewStageName('') }}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowNewStage(true)}>
              <Plus className="mr-1 h-3 w-3" /> Add Stage
            </Button>
          )}
        </div>
      </div>

      {/* Canvas + Side Panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{
              type: 'transition',
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-muted/50"
            />
          </ReactFlow>
        </div>

        {panelType && panelData && (
          <BuilderSidePanel
            type={panelType}
            data={panelData}
            workflowId={workflowId!}
            onClose={() => { setPanelType(null); setPanelData(null) }}
            onStageUpdated={loadAll}
            onTransitionUpdated={loadAll}
          />
        )}
      </div>
    </div>
  )
}
