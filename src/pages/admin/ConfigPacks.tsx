import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Briefcase, Headphones, Users, GraduationCap, Bug, LayoutGrid, ChevronDown, ChevronUp, Download, Check, Trash2, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createConfigPack, isTenantAuthoredPack } from '@/lib/packs'

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
  owner_account_id: string | null
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
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newPackName, setNewPackName] = useState('')
  const [newPackSlug, setNewPackSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [newPackCategory, setNewPackCategory] = useState('')
  const [newPackIcon, setNewPackIcon] = useState('')
  const [newPackDescription, setNewPackDescription] = useState('')

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

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  useEffect(() => {
    if (!newPackName.trim()) {
      if (!slugTouched) setNewPackSlug('')
      return
    }
    if (!slugTouched) {
      setNewPackSlug(slugify(newPackName))
    }
  }, [newPackName, slugTouched])

  async function handleCreatePack() {
    if (!newPackName.trim()) {
      setCreateError('Name is required')
      return
    }
    setCreateError(null)
    setCreating(true)
    try {
      await createConfigPack({
        name: newPackName.trim(),
        slug: newPackSlug.trim() || slugify(newPackName),
        icon: newPackIcon.trim() || null,
        category: newPackCategory.trim() || null,
        description: newPackDescription.trim() || null,
      })
      setShowCreate(false)
      setNewPackName('')
      setNewPackSlug('')
      setSlugTouched(false)
      setNewPackIcon('')
      setNewPackCategory('')
      setNewPackDescription('')
      await loadPacks()
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create pack')
    } finally {
      setCreating(false)
    }
  }

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

  const sortedPacks = useMemo(() => {
    const tenantOwned = [] as ConfigPack[]
    const templates = [] as ConfigPack[]
    for (const pack of packs) {
      if (isTenantAuthoredPack(pack, currentAccountId)) tenantOwned.push(pack)
      else templates.push(pack)
    }
    return [...tenantOwned, ...templates]
  }, [packs, currentAccountId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Packs</h1>
          <p className="mt-1 text-muted-foreground">
            Install Spine templates or create your own packs to bundle apps and their assets.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((prev) => !prev)}>
          <Plus className="mr-1 h-4 w-4" /> {showCreate ? 'Hide form' : 'New Pack'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Tenant Pack</CardTitle>
            <CardDescription>
              New packs start empty with ownership tied to this tenant. You can add apps, views, workflows, and export them later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input value={newPackName} onChange={(e) => setNewPackName(e.target.value)} placeholder="e.g. Customer Training" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={newPackSlug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setNewPackSlug(slugify(e.target.value))
                  }}
                  placeholder="auto-generated"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Category</label>
                <Input value={newPackCategory} onChange={(e) => setNewPackCategory(e.target.value)} placeholder="sales, service…" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Icon (lucide slug)</label>
                <Input value={newPackIcon} onChange={(e) => setNewPackIcon(e.target.value)} placeholder="layout-grid" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={newPackDescription} onChange={(e) => setNewPackDescription(e.target.value)} placeholder="What is included in this pack?" rows={3} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreatePack} disabled={creating}>
                {creating ? 'Creating…' : 'Create Pack'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreate(false)
                  setCreateError(null)
                  setSlugTouched(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading packs...</p>
      ) : sortedPacks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No template packs available.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPacks.map((pack) => {
            const tenantOwned = isTenantAuthoredPack(pack, currentAccountId)
            const Icon = pack.icon && ICON_MAP[pack.icon] ? ICON_MAP[pack.icon] : <Package className="h-5 w-5" />
            const isExpanded = expanded.has(pack.id)

            return (
              <Card key={pack.id} className={pack.config_active ? 'ring-1 ring-primary/20' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">{Icon}</div>
                      <div>
                        <CardTitle className="text-base">{pack.name}</CardTitle>
                        <code className="text-[10px] font-mono text-muted-foreground">{pack.slug}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={pack.is_system ? 'secondary' : 'default'} className="text-[10px]">
                        {pack.is_system ? 'Template' : tenantOwned ? 'Your Pack' : 'Installed'}
                      </Badge>
                      {pack.category && (
                        <Badge className={`text-[10px] ${CATEGORY_COLORS[pack.category] || ''}`}>{pack.category}</Badge>
                      )}
                    </div>
                  </div>
                  {pack.description && <CardDescription className="text-xs mt-1">{pack.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{pack.config_active ? 'Config active' : 'Config inactive'}</span>
                      <span className="text-border">•</span>
                      <span>{pack.test_data_active ? 'Test data active' : 'Test data inactive'}</span>
                    </div>
                    <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => toggleExpanded(pack.id)}>
                      {isExpanded ? (
                        <>
                          Hide
                          <ChevronUp className="h-3 w-3" />
                        </>
                      ) : (
                        <>
                          Details
                          <ChevronDown className="h-3 w-3" />
                        </>
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>Created {new Date(pack.created_at).toLocaleDateString()}</p>
                      {pack.description && <p>{pack.description}</p>}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {tenantOwned ? (
                      <Badge variant="outline" className="text-[11px]">
                        Authoring Surface
                      </Badge>
                    ) : pack.config_active ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={working === pack.id}
                        onClick={() => {
                          setConfirmUninstall(pack.id)
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Uninstall
                      </Button>
                    ) : (
                      <Button size="sm" disabled={working === pack.id} onClick={() => handleInstall(pack.id)}>
                        {working === pack.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                        Install
                      </Button>
                    )}

                    <Button variant="outline" size="sm" className="h-8" onClick={() => handleExport(pack.id)}>
                      <Download className="mr-1 h-3 w-3" /> Export
                    </Button>

                    {!pack.config_active && !tenantOwned && (
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => toggleTestDataOption(pack.id)}>
                        <Check className={`mr-1 h-3 w-3 ${includeTestData.has(pack.id) ? '' : 'opacity-0'}`} />
                        Include test data
                      </Button>
                    )}
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
