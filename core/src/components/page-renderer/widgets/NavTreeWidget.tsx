import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronRight, ChevronDown, Navigation } from 'lucide-react'
import type { WidgetConfig, NavConfigItem } from '@/lib/widgetRegistry'

interface NavTreeWidgetProps {
  config: WidgetConfig
}

export function NavTreeWidget({ config }: NavTreeWidgetProps) {
  const items = config.nav_config?.items || []

  return (
    <Card className="h-full flex flex-col">
      {config.title && (
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Navigation className="h-4 w-4" />
            {config.title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex-1 min-h-0 overflow-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No nav items configured</p>
        ) : (
          <div className="space-y-0.5">
            {items.map((item, i) => (
              <NavTreeItem key={i} item={item} depth={0} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NavTreeItem({ item, depth }: { item: NavConfigItem; depth: number }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(true)
  const hasChildren = item.children && item.children.length > 0

  function handleClick() {
    if (hasChildren) {
      setExpanded(!expanded)
    } else if (item.view_slug) {
      navigate(`/v/${item.view_slug}`)
    } else if (item.url) {
      window.open(item.url, '_blank')
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <span className="w-3.5" />
        )}
        <span className="truncate">{item.label}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {item.children!.map((child, i) => (
            <NavTreeItem key={i} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
