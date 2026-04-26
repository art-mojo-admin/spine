import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { FieldDefinition, ItemType } from '../types/types'

export interface SchemaType {
  id: string
  name: string
  slug: string
  kind?: string
  icon?: string
  color?: string
  app_id?: string
  design_schema: ItemType['design_schema']
}

export interface SchemaRecord {
  id: string
  type_id?: string
  type?: SchemaType
  data: Record<string, any>
  [key: string]: any
}

export interface UseSchemaRecordOptions {
  typeApiKind: string // e.g. 'account', 'person', 'item'
}

export interface UseSchemaRecordResult {
  fields: FieldDefinition[]
  data: Record<string, any>
  setData: (data: Record<string, any>) => void
  setField: (name: string, value: any) => void
  schemaType: SchemaType | null
  loading: boolean
  error: string | null
}

/**
 * Given a record that has already been fetched and a pre-loaded schema type,
 * returns structured field definitions and a data accessor/mutator for the
 * record's `.data` JSONB column, with defaults seeded from the schema.
 */
export function useSchemaRecord(
  record: SchemaRecord | null,
  schemaType: SchemaType | null
): UseSchemaRecordResult {
  const [data, setDataState] = useState<Record<string, any>>({})

  // Re-seed data state only when the record id or schema type id changes
  const recordId = record?.id ?? null
  const schemaTypeId = schemaType?.id ?? null

  useEffect(() => {
    if (!record) return

    const base = record.data ? { ...record.data } : {}

    // Seed defaults for fields that have no value
    if (schemaType?.design_schema?.fields) {
      for (const [name, field] of Object.entries(schemaType.design_schema.fields)) {
        if (base[name] === undefined && (field as any).defaultValue !== undefined) {
          base[name] = (field as any).defaultValue
        }
      }
    }

    setDataState(base)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, schemaTypeId])

  const setData = useCallback((newData: Record<string, any>) => {
    setDataState(newData)
  }, [])

  const setField = useCallback((name: string, value: any) => {
    setDataState(prev => ({ ...prev, [name]: value }))
  }, [])

  const fields: FieldDefinition[] = schemaType?.design_schema?.fields
    ? Object.entries(schemaType.design_schema.fields).map(([name, field]) => ({ ...field, name }))
    : []

  return {
    fields,
    data,
    setData,
    setField,
    schemaType,
    loading: false,
    error: null
  }
}

/**
 * Hook that fetches types list for a given kind and exposes type-selection
 * state. Used on create pages for the type-first flow.
 */
export interface UseTypeSelectionResult {
  types: SchemaType[]
  selectedType: SchemaType | null
  selectedTypeId: string
  setSelectedTypeId: (id: string) => void
  loading: boolean
  error: string | null
}

export function useTypeSelection(kind: string): UseTypeSelectionResult {
  const [types, setTypes] = useState<SchemaType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch(`/api/types?action=list&kind=${kind}&is_active=true`)
      .then(r => r.json())
      .then(result => {
        if (!cancelled) {
          setTypes(result.data || [])
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to load types')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [kind])

  const selectedType = types.find(t => t.id === selectedTypeId) ?? null

  return { types, selectedType, selectedTypeId, setSelectedTypeId, loading, error }
}
