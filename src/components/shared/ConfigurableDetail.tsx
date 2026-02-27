import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { FieldsPanel } from './panels/FieldsPanel'
import { WorkflowPanel } from './panels/WorkflowPanel'
import { ActivityPanel } from './panels/ActivityPanel'
import { ChildrenPanel } from './panels/ChildrenPanel'
import { ThreadPanel } from './ThreadPanel'
import { EntityLinksPanel } from './EntityLinksPanel'
import { EntityAttachmentsPanel } from './EntityAttachmentsPanel'

interface PanelConfig {
  type: string
  position: number
  config?: Record<string, any>
}

interface ViewDefinition {
  id: string
  slug: string
  name: string
  view_type: string
  target_type: string | null
  target_filter: Record<string, any>
  config: {
    panels?: PanelConfig[]
  }
}

interface ConfigurableDetailProps {
  entityType: string
  entityId: string
  item?: any
  stages?: any[]
  transitions?: any[]
  metadata?: Record<string, any>
  editing?: boolean
  onMetadataChange?: (metadata: Record<string, any>) => void
  onItemUpdate?: (updated: any) => void
  fallback?: React.ReactNode
}

export function ConfigurableDetail({
  entityType,
  entityId,
  item,
  stages = [],
  transitions = [],
  metadata = {},
  editing = false,
  onMetadataChange,
  onItemUpdate,
  fallback,
}: ConfigurableDetailProps) {
  const [viewDef, setViewDef] = useState<ViewDefinition | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadViewDef() {
      try {
        const views = await apiGet<ViewDefinition[]>('view-definitions', {
          view_type: 'detail',
          target_type: entityType,
        })

        if (views && views.length > 0) {
          // If item has an item_type, try to find a view that matches its target_filter
          const itemType = item?.item_type
          let match = views[0]

          if (itemType) {
            const specific = views.find(
              (v) => v.target_filter?.item_type === itemType
            )
            if (specific) match = specific
          }

          setViewDef(match)
        }
      } catch {
        // No view definition found — will render fallback
      } finally {
        setLoading(false)
      }
    }

    loadViewDef()
  }, [entityType, item?.item_type])

  if (loading) return null

  // No view definition found — render fallback (hardcoded layout)
  if (!viewDef || !viewDef.config?.panels) {
    return <>{fallback}</>
  }

  const panels = [...viewDef.config.panels].sort((a, b) => a.position - b.position)

  return (
    <div className="space-y-4">
      {panels.map((panel, idx) => (
        <PanelRenderer
          key={`${panel.type}-${idx}`}
          panel={panel}
          entityType={entityType}
          entityId={entityId}
          item={item}
          stages={stages}
          transitions={transitions}
          metadata={metadata}
          editing={editing}
          onMetadataChange={onMetadataChange}
          onItemUpdate={onItemUpdate}
        />
      ))}
    </div>
  )
}

interface PanelRendererProps {
  panel: PanelConfig
  entityType: string
  entityId: string
  item?: any
  stages: any[]
  transitions: any[]
  metadata: Record<string, any>
  editing: boolean
  onMetadataChange?: (metadata: Record<string, any>) => void
  onItemUpdate?: (updated: any) => void
}

function PanelRenderer({
  panel,
  entityType,
  entityId,
  item,
  stages,
  transitions,
  metadata,
  editing,
  onMetadataChange,
  onItemUpdate,
}: PanelRendererProps) {
  switch (panel.type) {
    case 'workflow':
      if (!item || stages.length === 0) return null
      return (
        <WorkflowPanel
          item={item}
          stages={stages}
          transitions={transitions}
          onUpdate={onItemUpdate || (() => {})}
        />
      )

    case 'fields':
      return (
        <FieldsPanel
          entityType={entityType}
          metadata={metadata}
          editing={editing}
          onChange={onMetadataChange}
        />
      )

    case 'threads':
      return (
        <ThreadPanel
          targetType={entityType}
          targetId={entityId}
          threadType={panel.config?.thread_type || 'discussion'}
          title={panel.config?.title || 'Discussion'}
        />
      )

    case 'relationships':
      return <EntityLinksPanel entityType={entityType} entityId={entityId} />

    case 'attachments':
      return <EntityAttachmentsPanel entityType={entityType} entityId={entityId} />

    case 'activity':
      return <ActivityPanel entityType={entityType} entityId={entityId} />

    case 'children':
      if (entityType !== 'item') return null
      return <ChildrenPanel itemId={entityId} />

    case 'documents':
      // Future: render linked documents panel
      return null

    default:
      return null
  }
}
