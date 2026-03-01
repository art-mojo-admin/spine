import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenantSettings } from '@/hooks/useTenantSettings'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, Building2, Users, ChevronRight, Loader2, Info } from 'lucide-react'

interface PackSummary {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
}

const archetypes = [
  {
    key: 'single' as const,
    title: 'Direct customers',
    subtitle: 'Tenant → Users → Customers',
    description: 'Best for SMBs who work directly with individual customers. Simplest hierarchy.',
    diagram: ['Tenant', 'Internal Users', 'Customers'],
    recommendedPacks: ['support_core', 'crm_core'],
    orgModel: 'single' as const,
  },
  {
    key: 'multi-partner' as const,
    title: 'Partner companies',
    subtitle: 'Tenant → Companies → Users',
    description: 'For businesses whose customers are companies with their own staff.',
    diagram: ['Tenant', 'Partner Companies', 'Company Users'],
    recommendedPacks: ['partner_portal', 'crm_core'],
    orgModel: 'multi' as const,
  },
  {
    key: 'multi-customer' as const,
    title: 'Companies with customers',
    subtitle: 'Tenant → Companies → Users → Customers',
    description: 'For networks where partner companies also serve their own customers.',
    diagram: ['Tenant', 'Companies', 'Company Users', 'Customers'],
    recommendedPacks: ['partner_portal', 'support_core', 'crm_core'],
    orgModel: 'multi' as const,
  },
]

type ArchetypeKey = typeof archetypes[number]['key']

const modernPackSlugs = new Set(['support-csm', 'sales', 'operations', 'marketing'])

export function SetupWizardPage() {
  const navigate = useNavigate()
  const { settings, loading, error, save, canConfigure } = useTenantSettings()
  const [selected, setSelected] = useState<ArchetypeKey | null>(null)
  const [packs, setPacks] = useState<PackSummary[]>([])
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(new Set())
  const [packsDirty, setPacksDirty] = useState(false)

  useEffect(() => {
    apiGet<PackSummary[]>('config-packs')
      .then((data) => {
        const filtered = (data || [])
          .filter((p) => modernPackSlugs.has(p.slug))
          .map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, category: p.category }))
        setPacks(filtered)
      })
      .catch(() => setPacks([]))
  }, [])

  useEffect(() => {
    if (!settings) return

    const metadataKey = settings.metadata?.org_archetype as ArchetypeKey | undefined
    let arc = metadataKey ? archetypes.find((candidate) => candidate.key === metadataKey) : undefined
    if (!arc && settings.org_model) {
      arc = archetypes.find((candidate) => candidate.orgModel === settings.org_model)
    }
    if (arc) setSelected(arc.key)

    if (settings.installed_packs) {
      setSelectedPacks(new Set(settings.installed_packs))
      setPacksDirty(false)
    }
  }, [settings])

  const selectedArchetype = useMemo(() => archetypes.find((a) => a.key === selected) || null, [selected])
  const recommendedPackSet = useMemo(() => new Set(selectedArchetype?.recommendedPacks || []), [selectedArchetype])
  const sortedPacks = useMemo(() => {
    if (!packs.length) return []
    if (!selectedArchetype) return [...packs]
    return [...packs].sort((a, b) => {
      const aRec = recommendedPackSet.has(a.slug) ? 0 : 1
      const bRec = recommendedPackSet.has(b.slug) ? 0 : 1
      if (aRec !== bRec) return aRec - bRec
      return a.name.localeCompare(b.name)
    })
  }, [packs, recommendedPackSet, selectedArchetype])
  const selectedPackCount = selectedPacks.size

  function handleSelectArchetype(key: ArchetypeKey) {
    setSelected(key)
  }

  function togglePack(slug: string) {
    setSelectedPacks((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
    setPacksDirty(true)
  }

  function applyRecommended() {
    if (!selectedArchetype) return
    setSelectedPacks(new Set(selectedArchetype.recommendedPacks))
    setPacksDirty(true)
  }

  if (!canConfigure) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workspace Setup</CardTitle>
          <CardDescription>Only tenant or system admins can configure setup.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  async function handleApply() {
    if (!selectedArchetype) return
    if (selectedPackCount === 0) {
      setMessage('Select at least one pack to continue.')
      return
    }
    setWorking(true)
    setMessage(null)
    try {
      const payloadPacks = Array.from(selectedPacks)
      await save({
        org_model: selectedArchetype.orgModel,
        installed_packs: payloadPacks,
        metadata: {
          ...(settings?.metadata || {}),
          org_archetype: selectedArchetype.key,
        },
      })
      setMessage('Configuration saved. Install packs from Templates when ready.')
      setPacksDirty(false)
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save configuration')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspace Setup</h1>
        <p className="mt-1 text-muted-foreground">
          Choose how your tenant is structured and which packs to start with. This controls account hierarchy defaults and recommended installs.
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          {settings?.configured_at ? (
            <span>
              Last configured {new Date(settings.configured_at).toLocaleString()} by{' '}
              {settings.configured_by_person?.full_name || settings.configured_by_person?.email || 'system admin'}
            </span>
          ) : (
            <span>No configuration saved yet.</span>
          )}
        </div>
      </div>

      {error && (
        <Card><CardContent className="py-3 text-sm text-destructive">{error}</CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {archetypes.map((arc) => {
          const isSelected = selected === arc.key
          return (
            <Card
              key={arc.key}
              className={isSelected ? 'border-primary ring-1 ring-primary/20 cursor-pointer' : 'cursor-pointer'}
              onClick={() => handleSelectArchetype(arc.key)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{arc.title}</CardTitle>
                    <CardDescription>{arc.subtitle}</CardDescription>
                  </div>
                  {isSelected && <Badge>Selected</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{arc.description}</p>
                <div className="rounded-md border p-3 text-xs">
                  <p className="font-semibold mb-2">Hierarchy</p>
                  <div className="space-y-1">
                    {arc.diagram.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {idx === 0 ? <Building2 className="h-3 w-3" /> : idx === arc.diagram.length - 1 ? <Users className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Recommended packs</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {arc.recommendedPacks.map((slug) => (
                      <Badge key={slug} variant="outline" className="text-[11px]">
                        <Package className="mr-1 h-3 w-3" />
                        {slug.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Select initial packs</CardTitle>
              <CardDescription>Each pack clones workflows, fields, and views scoped to this tenant.</CardDescription>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {selectedPackCount} selected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedArchetype && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyRecommended}
              disabled={working}
            >
              Use {selectedArchetype.title} recommended packs
            </Button>
          )}

          {packs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading packs...</p>
          ) : (
            <ul className="space-y-3">
              {sortedPacks.map((pack) => {
                const isSelected = selectedPacks.has(pack.slug)
                const isRecommended = recommendedPackSet.has(pack.slug)
                return (
                  <li
                    key={pack.id}
                    className={`flex items-start justify-between gap-3 rounded-md border p-3 ${isSelected ? 'border-primary/60' : ''}`}
                  >
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {pack.name}
                        {isRecommended && <Badge variant="outline" className="text-[10px]">Recommended</Badge>}
                      </p>
                      {pack.description && <p className="text-xs text-muted-foreground">{pack.description}</p>}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={isSelected}
                        onChange={() => togglePack(pack.slug)}
                        disabled={working}
                      />
                      {isSelected ? 'Selected' : 'Select'}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleApply} disabled={!selectedArchetype || working || loading || selectedPackCount === 0}>
          {working ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Configuration'}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/admin/packs')}>
          Manage Packs
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  )
}

export default SetupWizardPage
