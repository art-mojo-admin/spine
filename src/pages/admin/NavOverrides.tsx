import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SelectNative } from '@/components/ui/select-native'
import { PanelLeftDashed, Save, Trash2, RotateCcw } from 'lucide-react'

const CORE_NAV_KEYS = [
  { key: 'dashboard', defaultLabel: 'Dashboard' },
  { key: 'accounts', defaultLabel: 'Accounts' },
  { key: 'persons', defaultLabel: 'Persons' },
  { key: 'workflows', defaultLabel: 'Workflows' },
  { key: 'documents', defaultLabel: 'Documents' },
  { key: 'activity', defaultLabel: 'Activity' },
  { key: 'search', defaultLabel: 'Search' },
]

const ROLE_OPTIONS = [
  { value: 'portal', label: 'Portal' },
  { value: 'member', label: 'Member' },
  { value: 'operator', label: 'Operator' },
  { value: 'admin', label: 'Admin' },
]

interface NavOverride {
  id: string
  nav_key: string
  label: string | null
  hidden: boolean
  min_role: string
  default_entity_id: string | null
  position: number
}

interface DraftOverride {
  label: string
  hidden: boolean
  min_role: string
  position: number
}

export function NavOverridesPage() {
  const { currentAccountId } = useAuth()
  const [overrides, setOverrides] = useState<NavOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, DraftOverride>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!currentAccountId) return
    setLoading(true)
    apiGet<NavOverride[]>('nav-overrides')
      .then((data) => {
        setOverrides(data)
        // Initialize drafts from existing overrides
        const d: Record<string, DraftOverride> = {}
        for (const o of data) {
          d[o.nav_key] = {
            label: o.label || '',
            hidden: o.hidden,
            min_role: o.min_role,
            position: o.position,
          }
        }
        setDrafts(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId])

  function getDraft(key: string): DraftOverride {
    const coreItem = CORE_NAV_KEYS.find((c) => c.key === key)
    return drafts[key] || {
      label: '',
      hidden: false,
      min_role: 'member',
      position: CORE_NAV_KEYS.indexOf(coreItem!) ?? 0,
    }
  }

  function updateDraft(key: string, updates: Partial<DraftOverride>) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...getDraft(key), ...updates },
    }))
  }

  async function saveOverride(key: string) {
    const draft = getDraft(key)
    setSaving(key)
    try {
      const result = await apiPost<NavOverride>('nav-overrides', {
        nav_key: key,
        label: draft.label || null,
        hidden: draft.hidden,
        min_role: draft.min_role,
        position: draft.position,
      })
      setOverrides((prev) => {
        const existing = prev.findIndex((o) => o.nav_key === key)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = result
          return updated
        }
        return [...prev, result]
      })
    } catch {
      // Silently fail
    } finally {
      setSaving(null)
    }
  }

  async function resetOverride(key: string) {
    const existing = overrides.find((o) => o.nav_key === key)
    if (!existing) return
    try {
      await apiDelete('nav-overrides', { id: existing.id })
      setOverrides((prev) => prev.filter((o) => o.nav_key !== key))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nav Overrides</h1>
        <p className="mt-1 text-muted-foreground">
          Rename, hide, or restrict sidebar navigation items per account
        </p>
      </div>

      {loading ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {CORE_NAV_KEYS.map(({ key, defaultLabel }) => {
            const draft = getDraft(key)
            const hasOverride = overrides.some((o) => o.nav_key === key)
            return (
              <Card key={key}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{defaultLabel}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{key}</Badge>
                      {hasOverride && <Badge variant="secondary" className="text-[10px]">Customized</Badge>}
                      {draft.hidden && <Badge variant="destructive" className="text-[10px]">Hidden</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving === key}
                        onClick={() => saveOverride(key)}
                      >
                        <Save className="mr-1 h-3 w-3" />
                        {saving === key ? 'Saving...' : 'Save'}
                      </Button>
                      {hasOverride && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetOverride(key)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />Reset
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Custom Label</label>
                      <Input
                        value={draft.label}
                        onChange={(e) => updateDraft(key, { label: e.target.value })}
                        placeholder={defaultLabel}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Min Role</label>
                      <SelectNative
                        value={draft.min_role}
                        onChange={(e) => updateDraft(key, { min_role: e.target.value })}
                        className="mt-1"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </SelectNative>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Position</label>
                      <Input
                        type="number"
                        value={draft.position}
                        onChange={(e) => updateDraft(key, { position: parseInt(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.hidden}
                          onChange={(e) => updateDraft(key, { hidden: e.target.checked })}
                          className="rounded border"
                        />
                        Hidden
                      </label>
                    </div>
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
