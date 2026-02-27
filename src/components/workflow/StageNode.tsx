import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Badge } from '@/components/ui/badge'
import { Zap, LogIn, LogOut } from 'lucide-react'

export interface StageNodeData {
  label: string
  isInitial?: boolean
  isTerminal?: boolean
  actionCount?: number
  enterActionCount?: number
  exitActionCount?: number
  color?: string
  [key: string]: unknown
}

function StageNodeComponent({ data, selected }: NodeProps) {
  const d = data as StageNodeData
  const borderColor = selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
  const bgColor = d.color || 'bg-card'

  const handleClasses = "!w-3 !h-3 !border-2 !border-background hover:!w-4 hover:!h-4 hover:!bg-primary transition-all"
  const sourceHandleColor = "!bg-primary/80"
  const targetHandleColor = "!bg-muted-foreground/40"

  return (
    <div
      className={`rounded-lg border-2 ${borderColor} ${bgColor} px-4 py-3 shadow-sm min-w-[160px] transition-all relative group`}
    >
      {/* Top Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`${handleClasses} ${targetHandleColor} z-0`}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className={`${handleClasses} ${sourceHandleColor} z-10 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto`}
      />

      {/* Right Handles */}
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className={`${handleClasses} ${targetHandleColor} z-0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto`}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`${handleClasses} ${sourceHandleColor} z-10`}
      />

      {/* Bottom Handles */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className={`${handleClasses} ${targetHandleColor} z-0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`${handleClasses} ${sourceHandleColor} z-10`}
      />

      {/* Left Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={`${handleClasses} ${targetHandleColor} z-0`}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className={`${handleClasses} ${sourceHandleColor} z-10 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto`}
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
          <div className="flex items-center gap-1.5 ml-auto">
            {(d.enterActionCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title="On Enter Actions">
                <LogIn className="h-3 w-3" />
                {d.enterActionCount}
              </span>
            )}
            {(d.exitActionCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title="On Exit Actions">
                <LogOut className="h-3 w-3" />
                {d.exitActionCount}
              </span>
            )}
            {/* Fallback if actions exist but not specifically enter/exit (e.g. legacy) */}
            {(d.enterActionCount ?? 0) === 0 && (d.exitActionCount ?? 0) === 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title="Actions">
                <Zap className="h-3 w-3" />
                {d.actionCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const StageNode = memo(StageNodeComponent)
