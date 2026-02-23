import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Badge } from '@/components/ui/badge'
import { Zap } from 'lucide-react'

export interface StageNodeData {
  label: string
  isInitial?: boolean
  isTerminal?: boolean
  actionCount?: number
  color?: string
  [key: string]: unknown
}

function StageNodeComponent({ data, selected }: NodeProps) {
  const d = data as StageNodeData
  const borderColor = selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
  const bgColor = d.color || 'bg-card'

  return (
    <div
      className={`rounded-lg border-2 ${borderColor} ${bgColor} px-4 py-3 shadow-sm min-w-[160px] transition-all`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-muted-foreground/40 !border-2 !border-background"
      />

      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground">{d.label}</p>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        {d.isInitial && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            Start
          </Badge>
        )}
        {d.isTerminal && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            End
          </Badge>
        )}
        {(d.actionCount ?? 0) > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Zap className="h-3 w-3" />
            {d.actionCount}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  )
}

export const StageNode = memo(StageNodeComponent)
