import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import { Zap, Filter } from 'lucide-react'

function TransitionEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const edgeIndex = (data as any)?.edgeIndex || 0
  const totalEdges = (data as any)?.totalEdges || 1

  // Use SmoothStep by default.
  // If there are overlapping/bidirectional edges, SmoothStep draws them on top of each other.
  // To work around this, we can curve them slightly differently using a bezier or offset.
  // We'll use getBezierPath with an offset control point for overlapping lines, and smoothstep for singles.

  let edgePath = ''
  let labelX = 0
  let labelY = 0

  if (totalEdges > 1) {
    // If multiple edges exist between these two nodes (e.g., A->B and B->A),
    // use a bezier curve to bow them outwards based on their index.
    const curvature = 0.3 + (edgeIndex * 0.2) // increase curvature for each additional edge
    
    // We can just rely on the default xyflow getBezierPath which has an internal curvature
    // But since they would still overlap if exact same nodes but opposite direction, 
    // we manually bow them out.
    const path = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature,
    })
    edgePath = path[0]
    labelX = path[1]
    labelY = path[2]
  } else {
    const path = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 16,
    })
    edgePath = path[0]
    labelX = path[1]
    labelY = path[2]
  }

  const label = (data as any)?.label || ''
  const hasConditions = (data as any)?.hasConditions || false
  const actionCount = (data as any)?.actionCount || 0

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium shadow-sm transition-colors cursor-pointer ${
            selected
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
          }`}
        >
          {label && <span>{label}</span>}
          {(hasConditions || actionCount > 0) && (
            <div className="flex items-center gap-1 opacity-80">
              {hasConditions && <Filter className="h-3 w-3" />}
              {actionCount > 0 && <Zap className="h-3 w-3" />}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const TransitionEdge = memo(TransitionEdgeComponent)
