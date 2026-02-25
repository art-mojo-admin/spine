import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Package, Briefcase, Headphones, Users, GraduationCap, Bug, LayoutGrid, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfigPack {
  id: string
  name: string
  slug: string
  icon: string | null
  category: string | null
  description: string | null
  is_system: boolean
  pack_data: { features?: string[] } | null
  config_active: boolean
  test_data_active: boolean
  activated_by: string | null
  activated_at: string | null
  created_at: string
}

const ICON_MAP: Record<string, React.ReactNode> = {
  'briefcase': <Briefcase className="h-5 w-5" />,
  'headphones': <Headphones className="h-5 w-5" />,
  'users': <Users className="h-5 w-5" />,
  'graduation-cap': <GraduationCap className="h-5 w-5" />,
  'bug': <Bug className="h-5 w-5" />,
  'layout-grid': <LayoutGrid className="h-5 w-5" />,
}

const CATEGORY_COLORS: Record<string, string> = {
  'sales': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'service': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'community': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'education': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'engineering': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'operations': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

export function ConfigPacksPage() {
  const { currentAccountId } = useAuth()
  const [packs, setPacks] = useState<ConfigPack[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadPacks() {
    try {
      const data = await apiGet<ConfigPack[]>('config-packs')
      setPacks(data || [])
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!currentAccountId) return
    setLoading(true)
    loadPacks()
  }, [currentAccountId])

  async function handleToggleConfig(packId: string, active: boolean) {
    setToggling(packId)
    setErrorMessage(null)
    try {
      await apiPost('config-packs', {
        action: 'toggle_config',
        pack_id: packId,
        active,
      })
      await loadPacks()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Toggle failed')
    } finally {
      setToggling(null)
    }
  }

  async function handleToggleTestData(packId: string, active: boolean) {
    setToggling(packId)
    setErrorMessage(null)
    try {
      await apiPost('config-packs', {
        action: 'toggle_test_data',
        pack_id: packId,
        active,
      })
      await loadPacks()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Toggle failed')
    } finally {
      setToggling(null)
    }
  }

  function toggleExpanded(packId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(packId)) next.delete(packId)
      else next.add(packId)
      return next
    })
  }

  function handleExport(packId: string) {
    window.open(`/.netlify/functions/config-packs?id=${packId}&action=export`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Template Packs</h1>
        <p className="mt-1 text-muted-foreground">
          Pre-built configurations for common use cases. Toggle templates on to add workflows, fields, link types, and documentation to your workspace.
        </p>
      </div>

      {errorMessage && (
        <Card><CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent></Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading packs...</p>
      ) : packs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No template packs available.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => {
            const isToggling = toggling === pack.id
            const isExpanded = expanded.has(pack.id)
            const features = pack.pack_data?.features || []
            const icon = pack.icon ? ICON_MAP[pack.icon] : <Package className="h-5 w-5" />
            const categoryColor = pack.category ? CATEGORY_COLORS[pack.category] || 'bg-gray-100 text-gray-700' : null

            return (
              <Card key={pack.id} className={pack.config_active ? 'ring-1 ring-primary/20' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-primary">{icon}</div>
                      <CardTitle className="text-lg">{pack.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {pack.is_system && (
                        <Badge variant="secondary" className="text-[10px]">Built-in</Badge>
                      )}
                      {categoryColor && (
                        <Badge className={`text-[10px] ${categoryColor} border-0`}>
                          {pack.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {pack.description && (
                    <CardDescription className="text-xs mt-1">{pack.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Features (expandable) */}
                  {features.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleExpanded(pack.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? 'Hide' : 'Show'} included features
                      </button>
                      {isExpanded && (
                        <ul className="mt-2 space-y-1">
                          {features.map((f, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">•</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Toggle: Template Config */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Template Config</p>
                      <p className="text-[11px] text-muted-foreground">Workflows, fields, link types, docs</p>
                    </div>
                    <Switch
                      checked={pack.config_active}
                      onCheckedChange={(checked) => handleToggleConfig(pack.id, checked)}
                      disabled={isToggling}
                    />
                  </div>

                  {/* Toggle: Test Data */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${!pack.config_active ? 'text-muted-foreground' : ''}`}>Test Data</p>
                      <p className="text-[11px] text-muted-foreground">Sample items, people, accounts</p>
                    </div>
                    <Switch
                      checked={pack.test_data_active}
                      onCheckedChange={(checked) => handleToggleTestData(pack.id, checked)}
                      disabled={isToggling || !pack.config_active}
                    />
                  </div>

                  {/* Activation info */}
                  {pack.activated_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Activated {new Date(pack.activated_at).toLocaleDateString()}
                    </p>
                  )}

                  {/* Export button */}
                  <div className="pt-1 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => handleExport(pack.id)}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Export JSON
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
