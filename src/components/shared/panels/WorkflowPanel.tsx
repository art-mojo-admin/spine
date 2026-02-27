import { useState } from 'react'
import { apiPatch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface WorkflowPanelProps {
  item: any
  stages: any[]
  transitions: any[]
  onUpdate: (updated: any) => void
}

export function WorkflowPanel({ item, stages, transitions, onUpdate }: WorkflowPanelProps) {
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  const currentStage = stages.find((s: any) => s.id === item.stage_definition_id)
  const availableTransitions = transitions.filter(
    (t: any) => t.from_stage_id === item.stage_definition_id
  )

  async function handleTransition(transition: any) {
    if (transition.require_comment && !comment.trim()) {
      setTransitioning(transition.id)
      return
    }

    try {
      const updated = await apiPatch<any>('workflow-items', {
        stage_definition_id: transition.to_stage_id,
        transition_id: transition.id,
        transition_comment: comment || undefined,
      }, { id: item.id })
      onUpdate(updated)
      setTransitioning(null)
      setComment('')
    } catch (err: any) {
      console.error('Transition failed:', err.message)
    }
  }

  if (!currentStage) return null

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">Stage</p>
          <Badge variant={currentStage.is_terminal ? 'default' : 'secondary'}>
            {currentStage.name}
          </Badge>
        </div>

        {availableTransitions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Transitions</p>
            <div className="flex flex-wrap gap-2">
              {availableTransitions.map((t: any) => {
                const targetStage = stages.find((s: any) => s.id === t.to_stage_id)
                return (
                  <Button
                    key={t.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleTransition(t)}
                  >
                    {t.name}
                    <ArrowRight className="ml-1 h-3 w-3" />
                    <span className="ml-1 text-muted-foreground text-xs">
                      {targetStage?.name}
                    </span>
                  </Button>
                )
              })}
            </div>

            {transitioning && (
              <div className="mt-2 space-y-2">
                <Textarea
                  placeholder="Comment required for this transition..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const t = transitions.find((t: any) => t.id === transitioning)
                      if (t) handleTransition(t)
                    }}
                    disabled={!comment.trim()}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setTransitioning(null); setComment('') }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
