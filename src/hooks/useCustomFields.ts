import { useEffect, useState, useRef } from 'react'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export interface CustomFieldDef {
  id: string
  account_id: string
  entity_type: string
  name: string
  field_key: string
  field_type: string
  options: { value: string; label: string }[]
  required: boolean
  default_value: string | null
  section: string | null
  position: number
  enabled: boolean
}

interface FieldPath {
  path: string
  label: string
  fieldType: string
}

const CORE_FIELDS: Record<string, FieldPath[]> = {
  account: [
    { path: 'display_name', label: 'Display Name', fieldType: 'text' },
    { path: 'account_type', label: 'Account Type', fieldType: 'text' },
    { path: 'status', label: 'Status', fieldType: 'text' },
  ],
  person: [
    { path: 'full_name', label: 'Full Name', fieldType: 'text' },
    { path: 'email', label: 'Email', fieldType: 'email' },
    { path: 'status', label: 'Status', fieldType: 'text' },
  ],
  workflow_item: [
    { path: 'title', label: 'Title', fieldType: 'text' },
    { path: 'description', label: 'Description', fieldType: 'text' },
    { path: 'priority', label: 'Priority', fieldType: 'text' },
    { path: 'status', label: 'Status', fieldType: 'text' },
    { path: 'stage_definition_id', label: 'Stage ID', fieldType: 'text' },
    { path: 'owner_person_id', label: 'Owner Person ID', fieldType: 'text' },
    { path: 'due_date', label: 'Due Date', fieldType: 'date' },
  ],
  ticket: [
    { path: 'subject', label: 'Subject', fieldType: 'text' },
    { path: 'status', label: 'Status', fieldType: 'text' },
    { path: 'priority', label: 'Priority', fieldType: 'text' },
    { path: 'category', label: 'Category', fieldType: 'text' },
    { path: 'assigned_to_person_id', label: 'Assigned To', fieldType: 'text' },
  ],
  kb_article: [
    { path: 'title', label: 'Title', fieldType: 'text' },
    { path: 'slug', label: 'Slug', fieldType: 'text' },
    { path: 'status', label: 'Status', fieldType: 'text' },
    { path: 'category', label: 'Category', fieldType: 'text' },
  ],
}

// Simple in-memory cache keyed by accountId + entityType
const cache = new Map<string, { fields: CustomFieldDef[]; ts: number }>()
const CACHE_TTL = 60_000

export function useCustomFields(entityType?: string) {
  const { currentAccountId } = useAuth()
  const [fields, setFields] = useState<CustomFieldDef[]>([])
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!currentAccountId || !entityType) {
      setFields([])
      return
    }

    const cacheKey = `${currentAccountId}:${entityType}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setFields(cached.fields)
      return
    }

    setLoading(true)
    apiGet<CustomFieldDef[]>('custom-field-definitions', { entity_type: entityType })
      .then((data) => {
        const enabled = data.filter((f) => f.enabled)
        cache.set(cacheKey, { fields: enabled, ts: Date.now() })
        if (mountedRef.current) setFields(enabled)
      })
      .catch(() => {
        if (mountedRef.current) setFields([])
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
  }, [currentAccountId, entityType])

  const fieldPaths: FieldPath[] = [
    ...(CORE_FIELDS[entityType || ''] || []),
    ...fields.map((f) => ({
      path: `metadata.${f.field_key}`,
      label: `${f.name} (custom)`,
      fieldType: f.field_type,
    })),
  ]

  function invalidate() {
    if (currentAccountId && entityType) {
      cache.delete(`${currentAccountId}:${entityType}`)
    }
  }

  return { fields, fieldPaths, loading, invalidate }
}

export function useAllCustomFields() {
  const { currentAccountId } = useAuth()
  const [fields, setFields] = useState<CustomFieldDef[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentAccountId) return
    setLoading(true)
    apiGet<CustomFieldDef[]>('custom-field-definitions')
      .then((data) => setFields(data.filter((f) => f.enabled)))
      .catch(() => setFields([]))
      .finally(() => setLoading(false))
  }, [currentAccountId])

  return { fields, loading }
}
