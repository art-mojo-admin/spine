import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link2, ExternalLink } from 'lucide-react'
import type { WidgetConfig } from '@/lib/widgetRegistry'

interface LinkListWidgetProps {
  config: WidgetConfig
}

export function LinkListWidget({ config }: LinkListWidgetProps) {
  const navigate = useNavigate()
  const items = config.nav_config?.items || []

  return (
    <Card className="h-full flex flex-col">
      {config.title && (
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Link2 className="h-4 w-4" />
            {config.title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex-1 min-h-0 overflow-auto space-y-1">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No links configured</p>
        ) : (
          items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => {
                if (item.view_slug) navigate(`/v/${item.view_slug}`)
                else if (item.url) window.open(item.url, '_blank')
              }}
            >
              <span className="truncate flex-1">{item.label}</span>
              {item.url && <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
