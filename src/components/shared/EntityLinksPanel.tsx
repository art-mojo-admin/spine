import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Link2, Plus, X, Trash2, Search } from 'lucide-react'

const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: 'Person',
  account: 'Account',
  workflow_item: 'Workflow Item',
  ticket: 'Ticket',
  kb_article: 'KB Article',
}

const ENTITY_TYPE_ROUTES: Record<string, string> = {
  person: '/persons',
  account: '/accounts',
  workflow_item: '/workflow-items',
  ticket: '/tickets',
  kb_article: '/kb',
}

interface EntityLinksPanelProps {
  entityType: string
  entityId: string
}

interface EntityLink {
  id: string
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  link_type: string
  metadata: Record<string, any>
  created_at: string
  _direction: 'outgoing' | 'incoming'
}

interface LinkTypeDef {
  id: string
  name: string
  slug: string
  source_entity_type: string | null
  target_entity_type: string | null
  color: string | null
}

export function EntityLinksPanel({ entityType, entityId }: EntityLinksPanelProps) {
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()

  const [links, setLinks] = useState<EntityLink[]>([])
  const [linkTypeDefs, setLinkTypeDefs] = useState<LinkTypeDef[]>([])
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  // Add form state
  const [targetType, setTargetType] = useState('person')
  const [linkType, setLinkType] = useState('related')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!currentAccountId || !entityId) return
    loadLinks()
    loadLinkTypeDefs()
  }, [currentAccountId, entityId])

  async function loadLinks() {
    setLoading(true)
    try {
      const data = await apiGet<EntityLink[]>('entity-links', {
        entity_type: entityType,
        entity_id: entityId,
      })
      setLinks(data || [])
      // Resolve display names for linked entities
      await resolveNames(data || [])
    } catch (err) {
      console.error('Failed to load entity links', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadLinkTypeDefs() {
    try {
      const data = await apiGet<LinkTypeDef[]>('link-type-definitions')
      setLinkTypeDefs(data || [])
    } catch {
      // Link type defs are optional
    }
  }

  async function resolveNames(linkList: EntityLink[]) {
    const toResolve: { type: string; id: string }[] = []

    for (const link of linkList) {
      // The "other" entity is the one that isn't the current entity
      if (link._direction === 'outgoing') {
        toResolve.push({ type: link.target_type, id: link.target_id })
      } else {
        toResolve.push({ type: link.source_type, id: link.source_id })
      }
    }

    const names: Record<string, string> = {}
    const byType = new Map<string, string[]>()

    for (const item of toResolve) {
      const key = `${item.type}:${item.id}`
      if (names[key]) continue
      if (!byType.has(item.type)) byType.set(item.type, [])
      byType.get(item.type)!.push(item.id)
    }

    const tableMap: Record<string, { table: string; nameField: string }> = {
      person: { table: 'persons', nameField: 'full_name' },
      account: { table: 'accounts', nameField: 'display_name' },
      workflow_item: { table: 'workflow-items', nameField: 'title' },
      ticket: { table: 'tickets', nameField: 'subject' },
      kb_article: { table: 'kb-articles', nameField: 'title' },
    }

    for (const [type, ids] of byType.entries()) {
      const mapping = tableMap[type]
      if (!mapping) continue

      for (const id of ids) {
        try {
          const record = await apiGet<any>(mapping.table, { id })
          if (record) {
            names[`${type}:${id}`] = record[mapping.nameField] || id
          }
        } catch {
          names[`${type}:${id}`] = id.slice(0, 8) + '...'
        }
      }
    }

    setResolvedNames((prev) => ({ ...prev, ...names }))
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const tableMap: Record<string, string> = {
        person: 'persons',
        account: 'accounts',
        workflow_item: 'workflow-items',
        ticket: 'tickets',
        kb_article: 'kb-articles',
      }
      const endpoint = tableMap[targetType]
      if (!endpoint) return

      const results = await apiGet<any[]>(endpoint)
      const nameField = targetType === 'person' ? 'full_name'
        : targetType === 'account' ? 'display_name'
        : targetType === 'ticket' ? 'subject'
        : 'title'

      const filtered = (results || []).filter((r: any) => {
        const name = (r[nameField] || '').toLowerCase()
        return name.includes(searchQuery.toLowerCase())
      }).slice(0, 10)

      setSearchResults(filtered.map((r: any) => ({
        id: r.id,
        name: r[nameField] || r.id,
      })))
    } catch (err) {
      console.error('Search failed', err)
    } finally {
      setSearching(false)
    }
  }

  async function handleAddLink(targetId: string) {
    setAdding(true)
    try {
      await apiPost('entity-links', {
        source_type: entityType,
        source_id: entityId,
        target_type: targetType,
        target_id: targetId,
        link_type: linkType,
      })
      setShowAddForm(false)
      setSearchQuery('')
      setSearchResults([])
      await loadLinks()
    } catch (err: any) {
      console.error('Failed to create link', err)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemoveLink(linkId: string) {
    try {
      await apiDelete('entity-links', { id: linkId })
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    } catch (err) {
      console.error('Failed to remove link', err)
    }
  }

  function getLinkedEntity(link: EntityLink) {
    if (link._direction === 'outgoing') {
      return { type: link.target_type, id: link.target_id }
    }
    return { type: link.source_type, id: link.source_id }
  }

  function navigateToEntity(type: string, id: string) {
    const route = ENTITY_TYPE_ROUTES[type]
    if (route) navigate(`${route}/${id}`)
  }

  // Group links by link_type
  const groupedLinks = links.reduce<Record<string, EntityLink[]>>((acc, link) => {
    const key = link.link_type
    if (!acc[key]) acc[key] = []
    acc[key].push(link)
    return acc
  }, {})

  // Available link types for the dropdown
  const availableLinkTypes = linkTypeDefs.length > 0
    ? linkTypeDefs.map((d) => ({ value: d.slug, label: d.name }))
    : [
        { value: 'related', label: 'Related' },
        { value: 'parent', label: 'Parent' },
        { value: 'child', label: 'Child' },
        { value: 'participant', label: 'Participant' },
        { value: 'contact', label: 'Contact' },
        { value: 'assignee', label: 'Assignee' },
        { value: 'candidate', label: 'Candidate' },
      ]

  const entityTypeOptions = Object.entries(ENTITY_TYPE_LABELS)
    .filter(([key]) => key !== entityType)
    .map(([value, label]) => ({ value, label }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-4 w-4" />
          Linked Entities
          {links.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">{links.length}</Badge>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <X className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
          {showAddForm ? 'Cancel' : 'Add Link'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Link Form */}
        {showAddForm && (
          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Entity Type</label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={targetType}
                  onChange={(e) => { setTargetType(e.target.value); setSearchResults([]) }}
                >
                  {entityTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Link Type</label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                >
                  {availableLinkTypes.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={`Search ${ENTITY_TYPE_LABELS[targetType] || targetType}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button size="sm" onClick={handleSearch} disabled={searching}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                    onClick={() => !adding && handleAddLink(result.id)}
                  >
                    <span>{result.name}</span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Links List */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading links...</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked entities yet.</p>
        ) : (
          Object.entries(groupedLinks).map(([type, typeLinks]) => {
            const typeDef = linkTypeDefs.find((d) => d.slug === type)
            return (
              <div key={type}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {typeDef?.name || type.replace(/_/g, ' ')}
                </p>
                <div className="space-y-1">
                  {typeLinks.map((link) => {
                    const linked = getLinkedEntity(link)
                    const name = resolvedNames[`${linked.type}:${linked.id}`] || linked.id.slice(0, 8) + '...'
                    return (
                      <div
                        key={link.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        <div
                          className="flex items-center gap-2 cursor-pointer flex-1"
                          onClick={() => navigateToEntity(linked.type, linked.id)}
                        >
                          <Badge variant="outline" className="text-[10px]">
                            {ENTITY_TYPE_LABELS[linked.type] || linked.type}
                          </Badge>
                          <span className="font-medium">{name}</span>
                          {link._direction === 'incoming' && (
                            <span className="text-xs text-muted-foreground">(incoming)</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveLink(link.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
