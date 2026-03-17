import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AccountNode {
  id: string
  display_name: string
  account_type: string
  status: string
  slug: string | null
  parent_account_id: string | null
}

interface AccountNodeResponse {
  node: AccountNode
  ancestors: AccountNode[]
  children: AccountNode[]
}

interface AccountNodePanelProps {
  className?: string
}

export function AccountNodePanel({ className }: AccountNodePanelProps) {
  const {
    currentAccountId,
    currentAccountNodeId,
    setCurrentAccountNodeId,
  } = useAuth()

  const effectiveNodeId = currentAccountNodeId || currentAccountId
  const [hierarchy, setHierarchy] = useState<AccountNodeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNode = useCallback(async (targetId: string) => {
    if (!currentAccountId) return
    setLoading(true)
    setError(null)
    try {
      const params = targetId === currentAccountId ? undefined : { node_id: targetId }
      const data = await apiGet<AccountNodeResponse>('account-nodes', params)
      setHierarchy(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load account nodes')
    } finally {
      setLoading(false)
    }
  }, [currentAccountId])

  useEffect(() => {
    if (!currentAccountId || !effectiveNodeId) return
    loadNode(effectiveNodeId)
  }, [currentAccountId, effectiveNodeId, loadNode])

  const isTenantNode = hierarchy?.node.id === currentAccountId

  const ancestorList = useMemo(() => {
    if (!hierarchy) return []
    return [...hierarchy.ancestors].reverse()
  }, [hierarchy])

  const handleSelect = useCallback((nodeId: string | null) => {
    if (!currentAccountId || !nodeId) return
    if (nodeId === currentAccountNodeId) return
    setCurrentAccountNodeId(nodeId)
  }, [currentAccountId, currentAccountNodeId, setCurrentAccountNodeId])

  const handleReset = useCallback(() => {
    if (!currentAccountId) return
    if (currentAccountNodeId === currentAccountId) return
    setCurrentAccountNodeId(currentAccountId)
  }, [currentAccountId, currentAccountNodeId, setCurrentAccountNodeId])

  if (!currentAccountId) return null

  return (
    <div className={cn('space-y-3 text-sm', className)}>
      <div className="rounded-md border bg-card px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Active node</p>
            <p className="text-sm font-medium">
              {loading && !hierarchy ? 'Loading…' : hierarchy?.node.display_name || '—'}
            </p>
            {hierarchy?.node.slug && (
              <p className="text-xs text-muted-foreground">{hierarchy.node.slug}</p>
            )}
          </div>
          {!isTenantNode && (
            <Button variant="outline" size="sm" className="h-7" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>
        {hierarchy && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px] capitalize">
              {hierarchy.node.account_type}
            </Badge>
            <span>·</span>
            <span className="capitalize">{hierarchy.node.status}</span>
          </div>
        )}
        {error && (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        )}
      </div>

      <div className="rounded-md border bg-background px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parent path</p>
        {loading && !hierarchy ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : ancestorList.length === 0 ? (
          <p className="text-xs text-muted-foreground">At top level</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {ancestorList.map((ancestor) => (
              <button
                key={ancestor.id}
                type="button"
                onClick={() => handleSelect(ancestor.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  ancestor.id === currentAccountNodeId
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                )}
              >
                {ancestor.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border bg-background px-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Child accounts</p>
          {loading && hierarchy && <p className="text-[11px] text-muted-foreground">Refreshing…</p>}
        </div>
        {loading && !hierarchy ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : hierarchy?.children.length ? (
          <div className="mt-2 space-y-2">
            {hierarchy.children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => handleSelect(child.id)}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-left transition-colors',
                  child.id === currentAccountNodeId
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                )}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-sm text-foreground">{child.display_name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {child.account_type}
                  </Badge>
                </div>
                {child.slug && (
                  <p className="text-[11px] text-muted-foreground">{child.slug}</p>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No child accounts</p>
        )}
      </div>
    </div>
  )
}
