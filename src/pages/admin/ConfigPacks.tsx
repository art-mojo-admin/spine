import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Briefcase, Headphones, Users, GraduationCap, Bug, LayoutGrid, ChevronDown, ChevronUp, Download, Check, Trash2, Loader2 } from 'lucide-react'
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
  const [working, setWorking] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [includeTestData, setIncludeTestData] = useState<Set<string>>(new Set())
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null)

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

  async function handleInstall(packId: string) {
    setWorking(packId)
    setErrorMessage(null)
    try {
      await apiPost('config-packs', {
        action: 'install_pack',
        pack_id: packId,
        include_test_data: includeTestData.has(packId),
      })
      await loadPacks()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Install failed')
    } finally {
      setWorking(null)
    }
  }

  async function handleUninstall(packId: string) {
    setWorking(packId)
    setErrorMessage(null)
    setConfirmUninstall(null)
    try {
      await apiPost('config-packs', {
        action: 'uninstall_pack',
        pack_id: packId,
      })
      await loadPacks()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Uninstall failed')
    } finally {
      setWorking(null)
    }
  }

  function toggleTestDataOption(packId: string) {
    setIncludeTestData((prev) => {
      const next = new Set(prev)
      if (next.has(packId)) next.delete(packId)
      else next.add(packId)
      return next
    })
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
          Install pre-built configurations to add workflows, fields, views, and apps to your workspace. Everything installed becomes yours to customize.
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
            const isWorking = working === pack.id
            const isInstalled = pack.config_active
            const isExpanded = expanded.has(pack.id)
            const features = pack.pack_data?.features || []
            const icon = pack.icon ? ICON_MAP[pack.icon] : <Package className="h-5 w-5" />
            const categoryColor = pack.category ? CATEGORY_COLORS[pack.category] || 'bg-gray-100 text-gray-700' : null

            return (
              <Card key={pack.id} className={isInstalled ? 'ring-1 ring-primary/20' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-primary">{icon}</div>
                      <CardTitle className="text-lg">{pack.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isInstalled && (
                        <Badge variant="default" className="text-[10px]">
                          <Check className="mr-0.5 h-2.5 w-2.5" /> Installed
                        </Badge>
                      )}
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

                  {/* Install / Uninstall Actions */}
                  {!isInstalled ? (
                    <div className="space-y-3 pt-1 border-t">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeTestData.has(pack.id)}
                          onChange={() => toggleTestDataOption(pack.id)}
                          className="rounded border-border"
                        />
                        <span className="text-xs text-muted-foreground">Include test data (sample items, people)</span>
                      </label>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleInstall(pack.id)}
                        disabled={isWorking}
                      >
                        {isWorking ? (
                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Installing...</>
                        ) : (
                          <><Package className="mr-1 h-3 w-3" /> Install Pack</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1 border-t">
                      {pack.activated_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Installed {new Date(pack.activated_at).toLocaleDateString()}
                          {pack.test_data_active && ' · includes test data'}
                        </p>
                      )}

                      {confirmUninstall === pack.id ? (
                        <div className="space-y-2">
                          <p className="text-xs text-destructive font-medium">
                            This will remove all cloned workflows, views, fields, and data from this pack.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => handleUninstall(pack.id)}
                              disabled={isWorking}
                            >
                              {isWorking ? (
                                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Removing...</>
                              ) : (
                                'Confirm Uninstall'
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmUninstall(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-destructive hover:text-destructive"
                          onClick={() => setConfirmUninstall(pack.id)}
                          disabled={isWorking}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Uninstall
                        </Button>
                      )}
                    </div>
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
