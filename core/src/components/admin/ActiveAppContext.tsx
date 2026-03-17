import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutGrid, Layers, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useActiveApp } from '@/hooks/useActiveApp'
import { useAuth } from '@/hooks/useAuth'
import { apiGet } from '@/lib/api'
import { listConfigPacks, type ConfigPack } from '@/lib/packs'
import { cn } from '@/lib/utils'

interface AppSummary {
  id: string
  name: string
  slug: string
  pack_id: string | null
  ownership: string | null
  is_active: boolean
}

interface ActiveAppSwitcherProps {
  mode?: 'pill' | 'ghost' | 'link'
  size?: 'sm' | 'default'
  label?: string
  className?: string
  fullWidth?: boolean
}

export function ActiveAppSwitcher({
  mode = 'pill',
  size = 'default',
  label,
  className,
  fullWidth,
}: ActiveAppSwitcherProps) {
  const { currentAccountId } = useAuth()
  const { activeApp, setActiveApp, clearActiveApp } = useActiveApp()

  const [open, setOpen] = useState(false)
  const [apps, setApps] = useState<AppSummary[]>([])
  const [packs, setPacks] = useState<ConfigPack[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const packLookup = useMemo(() => {
    const map: Record<string, ConfigPack> = {}
    for (const pack of packs) {
      map[pack.id] = pack
    }
    return map
  }, [packs])

  const selectableApps = useMemo(() => {
    return apps.filter(app => !!app.pack_id)
  }, [apps])

  const groupedApps = useMemo(() => {
    const groups: Record<string, { packId: string; packName: string; apps: AppSummary[] }> = {}
    for (const app of selectableApps) {
      const packId = app.pack_id!
      const packName = packLookup[packId]?.name ?? 'Unlabeled Pack'
      if (!groups[packId]) {
        groups[packId] = { packId, packName, apps: [] }
      }
      groups[packId].apps.push(app)
    }

    return Object.values(groups)
      .map(group => ({
        ...group,
        apps: group.apps.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.packName.localeCompare(b.packName))
  }, [selectableApps, packLookup])

  const loadDirectory = useCallback(async () => {
    if (!currentAccountId) return
    setLoading(true)
    setError(null)
    try {
      const [appList, packList] = await Promise.all([
        apiGet<AppSummary[]>('app-definitions', { include_inactive: 'true' }),
        listConfigPacks(),
      ])
      setApps(appList || [])
      setPacks(packList)
      setLoaded(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to load apps')
    } finally {
      setLoading(false)
    }
  }, [currentAccountId])

  useEffect(() => {
    if (open && !loaded) {
      loadDirectory()
    }
  }, [open, loaded, loadDirectory])

  const handleSelect = (app: AppSummary) => {
    if (!app.pack_id) return
    setActiveApp({
      packId: app.pack_id,
      packName: packLookup[app.pack_id]?.name ?? null,
      appId: app.id,
      appName: app.name,
    })
    setOpen(false)
  }

  const buttonVariant = mode === 'pill' ? 'outline' : mode === 'link' ? 'link' : 'ghost'
  const buttonSize = size === 'sm' ? 'sm' : 'default'
  const buttonClasses = cn(
    mode === 'pill' && 'flex min-w-[220px] flex-col items-start gap-0.5 text-left',
    fullWidth && 'w-full',
    className,
  )

  const buttonContent = mode === 'pill'
    ? (
      <>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Active App Context</span>
        <span className="flex items-center gap-1 text-sm font-medium">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" />
          {activeApp?.appName ?? 'Select app'}
        </span>
        <span className="text-xs text-muted-foreground">
          {activeApp?.packName ?? (activeApp ? activeApp.packId : 'No pack selected')}
        </span>
      </>
    )
    : (
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4" />
        <span className="text-sm font-medium">
          {label ?? (activeApp ? 'Change app' : 'Select app')}
        </span>
      </div>
    )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={buttonVariant as any}
          size={buttonSize as any}
          className={buttonClasses}
        >
          <div className="flex w-full items-center justify-between gap-3">
            <div className={mode === 'pill' ? 'min-w-0' : 'flex-1'}>{buttonContent}</div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="border-b px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tenant packs & apps</p>
          <p className="text-xs text-muted-foreground">Pick an app to route all admin edits through that context.</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Layers className="h-4 w-4 animate-spin" />
              Loading apps…
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-sm text-destructive">{error}</div>
          ) : groupedApps.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No tenant-authored apps with packs yet. Create one from the Apps page.
            </div>
          ) : (
            <div className="divide-y">
              {groupedApps.map(group => (
                <div key={group.packId} className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">{group.packName}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {group.apps.length} app{group.apps.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {group.apps.map(app => (
                      <button
                        key={app.id}
                        onClick={() => handleSelect(app)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-primary/5',
                          activeApp?.appId === app.id ? 'border-primary bg-primary/5' : 'border-border',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{app.name}</span>
                          {!app.is_active && (
                            <Badge variant="secondary" className="text-[10px]">Draft</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{app.slug}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => loadDirectory()} disabled={loading}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { clearActiveApp(); setOpen(false) }}>
            Clear selection
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ActiveAppContextBar() {
  const { isHydrated, activeApp } = useActiveApp()

  if (!isHydrated) return null

  return (
    <div className="mb-6 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Editing Context</p>
          {activeApp ? (
            <p className="text-lg font-semibold leading-tight">{activeApp.appName ?? 'Untitled app'}</p>
          ) : (
            <p className="text-lg font-semibold leading-tight">Select an app to edit</p>
          )}
          <p className="text-sm text-muted-foreground">
            {activeApp?.packName ?? (activeApp ? activeApp.packId : 'No pack selected yet')}
          </p>
        </div>
        <div className="flex-1" />
        <ActiveAppSwitcher />
      </div>
    </div>
  )
}

export function ActiveAppNotice({ className }: { className?: string }) {
  const { activeApp, isHydrated } = useActiveApp()

  if (!isHydrated) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm', className)}>
      <div>
        {activeApp ? (
          <>
            <p className="font-semibold">Editing {activeApp.appName ?? 'Untitled app'}</p>
            <p className="text-xs text-muted-foreground">
              Pack: {activeApp.packName ?? activeApp.packId ?? 'Unknown pack'}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">No active app selected</p>
            <p className="text-xs text-muted-foreground">Choose an app to unlock create/update controls.</p>
          </>
        )}
      </div>
      <ActiveAppSwitcher
        mode={activeApp ? 'ghost' : 'pill'}
        size="sm"
        label={activeApp ? 'Change' : 'Select app'}
      />
    </div>
  )
}
