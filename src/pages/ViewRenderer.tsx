import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LayoutGrid } from 'lucide-react'

interface ViewDefinition {
  id: string
  slug: string
  name: string
  view_type: string
  target_type: string | null
  target_filter: Record<string, any>
  config: Record<string, any>
  min_role: string
}

export function ViewRendererPage() {
  const { viewSlug } = useParams<{ viewSlug: string }>()
  const { currentAccountId } = useAuth()
  const navigate = useNavigate()

  const [viewDef, setViewDef] = useState<ViewDefinition | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!viewSlug || !currentAccountId) return

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const vd = await apiGet<ViewDefinition>('view-definitions', { slug: viewSlug! })
        setViewDef(vd)

        if (vd.target_type === 'item' || vd.view_type === 'list' || vd.view_type === 'board') {
          const params: Record<string, string> = {}
          if (vd.target_filter?.workflow_definition_id) {
            params.workflow_definition_id = vd.target_filter.workflow_definition_id
          }
          if (vd.target_filter?.item_type) {
            params.item_type = vd.target_filter.item_type
          }
          const data = await apiGet<any[]>('workflow-items', params)
          setItems(data || [])
        }
      } catch (err: any) {
        setError(err.message || 'View not found')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [viewSlug, currentAccountId])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading view...</p>
      </div>
    )
  }

  if (error || !viewDef) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">View Not Found</h1>
        <p className="text-muted-foreground">
          No view definition found for slug <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{viewSlug}</code>.
        </p>
        <Button variant="outline" onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    )
  }

  // Board view
  if (viewDef.view_type === 'board') {
    const stageGroups = new Map<string, any[]>()
    for (const item of items) {
      const stageName = item.stage_definitions?.name || 'Unknown'
      if (!stageGroups.has(stageName)) stageGroups.set(stageName, [])
      stageGroups.get(stageName)!.push(item)
    }

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{viewDef.name}</h1>
          <p className="mt-1 text-muted-foreground">Board view</p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from(stageGroups.entries()).map(([stageName, stageItems]) => (
            <div key={stageName} className="min-w-[280px] max-w-[320px] flex-shrink-0">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{stageName}</h3>
                <Badge variant="secondary" className="text-[10px]">{stageItems.length}</Badge>
              </div>
              <div className="space-y-2">
                {stageItems.map((item: any) => (
                  <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/workflow-items/${item.id}`)}>
                    <CardContent className="py-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.priority && (
                        <Badge variant="outline" className="mt-1 text-[10px]">{item.priority}</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {stageGroups.size === 0 && (
            <p className="text-sm text-muted-foreground">No items to display.</p>
          )}
        </div>
      </div>
    )
  }

  // List view (default for list + any item-based views)
  if (viewDef.view_type === 'list' || (viewDef.target_type === 'item' && items.length > 0)) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{viewDef.name}</h1>
          <p className="mt-1 text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items match this view.</p>
          ) : (
            items.map((item: any) => (
              <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/workflow-items/${item.id}`)}>
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.stage_definitions?.name && (
                        <Badge variant="secondary" className="text-[10px]">{item.stage_definitions.name}</Badge>
                      )}
                      {item.priority && (
                        <Badge variant="outline" className="text-[10px]">{item.priority}</Badge>
                      )}
                      {item.workflow_definitions?.name && (
                        <span className="text-[10px] text-muted-foreground">{item.workflow_definitions.name}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    )
  }

  // Dashboard / portal_page / detail / generic fallback
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{viewDef.name}</h1>
        <p className="mt-1 text-muted-foreground">{viewDef.view_type} view</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <LayoutGrid className="h-4 w-4" />
            {viewDef.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This view is configured as a <strong>{viewDef.view_type}</strong> view
            {viewDef.target_type ? ` targeting ${viewDef.target_type}` : ''}.
          </p>
          {viewDef.config?.panels && (
            <p className="text-sm text-muted-foreground mt-2">
              {viewDef.config.panels.length} panel{viewDef.config.panels.length !== 1 ? 's' : ''} configured.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
