import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { DesignSchema, View } from '../types/types'

interface UseListSchemaOptions {
  entity: string
  viewSlug?: string
}

interface UseListSchemaResult {
  schema: DesignSchema | null
  view: View | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook for fetching list schema from a sample record
 * Uses the first record's design_schema to determine list structure
 */
export function useListSchema(options: UseListSchemaOptions): UseListSchemaResult {
  const { entity, viewSlug = 'default_list' } = options
  
  const [schema, setSchema] = useState<DesignSchema | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSchema = async () => {
    let cancelled = false
    
    try {
      setLoading(true)
      setError(null)

      // Fetch a sample record to get its design_schema
      const response = await apiFetch(`/api/admin-data?action=list&entity=${entity}&limit=1`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sample record: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error || 'Failed to fetch records')
      }

      // No records yet — use a minimal fallback schema so the list page still renders
      if (!data.data || data.data.length === 0) {
        if (cancelled) return
        const fallback: DesignSchema = {
          fields: {},
          record_permissions: {},
          views: {
            [viewSlug]: {
              type: 'list',
              label: 'Default List',
              fields: {
                id: { sortable: false, display_type: 'text' },
                created_at: { sortable: true, display_type: 'timestamp' }
              },
              display: 'table',
              default_sort: { field: 'created_at', direction: 'desc' }
            }
          }
        }
        setSchema(fallback)
        setView(fallback.views![viewSlug]!)
        setLoading(false)
        return
      }

      const sampleRecord = data.data[0]
      
      if (!sampleRecord.design_schema) {
        throw new Error('Sample record does not have a design_schema')
      }

      const designSchema = sampleRecord.design_schema as DesignSchema
      
      if (cancelled) return

      setSchema(designSchema)
      
      // Extract the requested view
      const requestedView = designSchema.views?.[viewSlug]
      if (requestedView) {
        setView(requestedView)
      } else {
        setError(`View '${viewSlug}' not found in design_schema`)
      }

    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load schema')
        setSchema(null)
        setView(null)
      }
    } finally {
      if (!cancelled) {
        setLoading(false)
      }
    }

    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    if (entity) {
      fetchSchema()
    } else {
      setError('Entity is required')
      setLoading(false)
    }
  }, [entity, viewSlug])

  return {
    schema,
    view,
    loading,
    error,
    refetch: fetchSchema
  }
}
