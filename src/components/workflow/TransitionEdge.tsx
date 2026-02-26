import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
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

  let sx = sourceX
  let sy = sourceY
  let tx = targetX
  let ty = targetY

  // Offset logic to avoid overlapping bidirectional or duplicate edges
  if (totalEdges > 1) {
    const offset = (edgeIndex - (totalEdges - 1) / 2) * 25 // 25px gap between parallel edges

    if (sourcePosition === Position.Top || sourcePosition === Position.Bottom) {
      sx += offset
    } else {
      sy += offset
    }

    if (targetPosition === Position.Top || targetPosition === Position.Bottom) {
      tx += offset
    } else {
      ty += offset
    }
  }

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition,
    targetX: tx,
    targetY: ty,
    targetPosition,
    borderRadius: 16,
    offset: 20, // distance from node to first bend
  })

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
