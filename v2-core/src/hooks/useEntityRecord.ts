import { useCallback } from 'react'
import { useApi, useMutation } from './useApi'
import { apiFetch } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface FieldPermissions {
  [key: string]: { read: boolean; write: boolean }
}

interface MinimalEntityConfig {
  entity: string
  typeSlug?: string
  icon: string
  displayField: string
  api: {
    endpoint: string
    getAction?: string
    createAction?: string
    updateAction?: string
    deleteAction?: string
  }
  softDelete?: boolean
}

interface UseEntityRecordReturn {
  record: any
  schema: any
  fieldPermissions: FieldPermissions
  loading: boolean
  error: string | null
  refetch: () => void
  save: (data: any) => Promise<void>
  delete: () => Promise<void>
  saving: boolean
  deleting: boolean
}

export function useEntityRecord(
  entity: string,
  id: string | undefined,
  config: MinimalEntityConfig | null
): UseEntityRecordReturn {
  const { user } = useAuth()
  
  // Get API configuration with safe defaults
  const endpoint = config?.api?.endpoint || entity
  const getAction = config?.api?.getAction || 'get'
  const createAction = config?.api?.createAction || 'create'
  const updateAction = config?.api?.updateAction || 'update'
  const deleteAction = config?.api?.deleteAction || 'delete'
  
  // Fetch record - always call useCallback to maintain hook order
  const fetchRecord = useCallback(async () => {
    if (!id) return null
    
    const params = new URLSearchParams()
    params.append('action', getAction)
    params.append('entity', entity)
    params.append('id', id)
    
    const response = await apiFetch(`/api/${endpoint}?${params.toString()}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${entity}: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result.data || result
  }, [entity, id, endpoint, getAction])
  
  const { data: record, loading, error, refetch } = useApi<any>(fetchRecord, {
    immediate: !!id
  })
  
  // Extract schema from record (accounts have it at root level, items/types have it nested)
  const schema = record?.design_schema || record?.type?.design_schema || {}
  
  // Calculate field permissions from record's schema
  const calculatePermissions = (): FieldPermissions => {
    const permissions: FieldPermissions = {}
    
    // System admin gets full access
    const isSystemAdmin = user?.roles?.includes('system_admin')
    
    // Get all fields from record's schema
    const recordSchema = record?.design_schema?.fields
    if (!recordSchema) return permissions
    
    Object.entries(recordSchema).forEach(([fieldName, fieldSchema]: [string, any]) => {
      if (isSystemAdmin) {
        permissions[fieldName] = { read: true, write: true }
      } else {
        // Check field-level permissions from schema
        const fieldPerms = fieldSchema?.permissions || {}
        
        const canRead = fieldPerms.read?.some((role: string) => 
          user?.roles?.includes(role)
        ) ?? true
        
        const canWrite = fieldPerms.write?.some((role: string) => 
          user?.roles?.includes(role)
        ) ?? true
        
        permissions[fieldName] = { read: canRead, write: canWrite }
      }
    })
    
    return permissions
  }
  
  const fieldPermissions = calculatePermissions()
  
  // Save mutation
  const saveMutation = useMutation(
    async (data: any) => {
      // Separate system fields from custom fields
      const systemData: Record<string, any> = {}
      const customData: Record<string, any> = {}
      
      Object.entries(data).forEach(([key, value]) => {
        const fieldDef = record?.design_schema?.fields?.[key]
        if (fieldDef?.system) {
          systemData[key] = value
        } else {
          customData[key] = value
        }
      })
      
      // Combine system fields with custom data in data field
      const saveData = {
        ...systemData,
        data: Object.keys(customData).length > 0 ? customData : undefined
      }
      
      if (id) {
        // Update
        const params = new URLSearchParams()
        params.append('action', updateAction)
        params.append('entity', entity)
        params.append('id', id)
        
        const response = await apiFetch(
          `/api/${endpoint}?${params.toString()}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saveData)
          }
        )
        
        if (!response.ok) {
          throw new Error(`Failed to update ${entity}: ${response.statusText}`)
        }
        
        return response.json()
      } else {
        // Create
        const createData = { entity, ...saveData }
        
        const params = new URLSearchParams()
        params.append('action', createAction)
        params.append('entity', entity)
        
        const response = await apiFetch(
          `/api/${endpoint}?${params.toString()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createData)
          }
        )
        
        if (!response.ok) {
          throw new Error(`Failed to create ${entity}: ${response.statusText}`)
        }
        
        return response.json()
      }
    },
    {
      onSuccess: () => {
        if (id) {
          refetch()
        }
      }
    }
  )
  
  // Delete mutation
  const deleteMutation = useMutation(
    async () => {
      if (!id) throw new Error('Cannot delete: no ID provided')
      
      const params = new URLSearchParams()
      params.append('action', deleteAction)
      params.append('entity', entity)
      params.append('id', id)
      
      const response = await apiFetch(
        `/api/${endpoint}?${params.toString()}`,
        {
          method: 'DELETE'
        }
      )
      
      if (!response.ok) {
        throw new Error(`Failed to delete ${entity}: ${response.statusText}`)
      }
      
      return response.json()
    }
  )
  
  return {
    record,
    schema,
    fieldPermissions,
    loading,
    error,
    refetch,
    save: saveMutation.mutate,
    delete: deleteMutation.mutate,
    saving: saveMutation.loading,
    deleting: deleteMutation.loading
  }
}
