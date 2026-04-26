import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useEntityRecord } from '../../hooks/useEntityRecord'
import { DataDetailHeader } from './DataDetailHeader'
import { SchemaDetailForm } from './SchemaDetailForm'
import { Button } from '../ui/Button'
import * as Icons from '@heroicons/react/24/outline'

export function DataDetailPage() {
  const { entity, id, typeSlug } = useParams<{ entity: string; id: string; typeSlug?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const isCreating = !id
  const isEditing = searchParams.get('edit') === 'true' || isCreating
  
  // Create a minimal config for useEntityRecord
  const config = {
    entity: entity || '',
    typeSlug: typeSlug || undefined,
    icon: 'database',
    displayField: 'display_name',
    api: {
      endpoint: 'admin-data',
      getAction: 'get',
      createAction: 'create',
      updateAction: 'update'
    }
  }
  
  const { 
    record, 
    fieldPermissions,
    loading, 
    error, 
    refetch,
    save,
    delete: deleteRecord,
    saving,
    deleting
  } = useEntityRecord(entity!, id, config)
  
  // Extract schema and view from the record itself
  const schema = record?.design_schema || null
  const view = schema?.views?.default_detail || null

  // Lifted form state - managed here so both header and form can access it
  const [formData, setFormData] = useState<Record<string, any>>({})

  // Initialize form data when record loads
  useEffect(() => {
    if (record && view) {
      const initialData: Record<string, any> = {}
      view.sections?.forEach((section: any) => {
        Object.entries(section.fields || {}).forEach(([fieldName]) => {
          const fieldDef = schema?.fields?.[fieldName]
          if (fieldDef?.system) {
            initialData[fieldName] = record[fieldName]
          } else {
            initialData[fieldName] = record.data?.[fieldName]
          }
        })
      })
      setFormData(initialData)
    } else if (isCreating) {
      setFormData({})
    }
  }, [record, isCreating, view, schema])
  
  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }
  
  const handleEdit = () => {
    setSearchParams({ edit: 'true' })
  }
  
  const handleCancel = () => {
    if (isCreating) {
      window.location.href = `/admin/runtime/${entity}`
    } else {
      setSearchParams({})
      // Reset form data to original record values
      if (record && view) {
        const initialData: Record<string, any> = {}
        view.sections?.forEach((section: any) => {
          Object.entries(section.fields || {}).forEach(([fieldName]) => {
            const fieldDef = schema?.fields?.[fieldName]
            if (fieldDef?.system) {
              initialData[fieldName] = record[fieldName]
            } else {
              initialData[fieldName] = record.data?.[fieldName]
            }
          })
        })
        setFormData(initialData)
      }
    }
  }
  
  const handleSave = async () => {
    await save(formData)
    if (!isCreating) {
      setSearchParams({})
    } else {
      window.location.href = `/admin/runtime/${entity}`
    }
  }
  
  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete this ${config?.entity?.slice(0, -1) || 'record'}?`)) {
      await deleteRecord()
      window.location.href = `/admin/runtime/${entity}`
    }
  }
  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (error || !schema || !view) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error: {error || 'Failed to load record or schema'}</p>
        <Button onClick={refetch} className="mt-4">Retry</Button>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <DataDetailHeader
        entity={config.entity}
        icon={config.icon}
        title={isCreating ? `New ${config.entity.slice(0, -1)}` : record?.[config.displayField] || 'Untitled'}
        isEditing={isEditing}
        isCreating={isCreating}
        onEdit={handleEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        onDelete={!isCreating ? handleDelete : undefined}
        saving={saving}
        deleting={deleting}
      />
      
      <SchemaDetailForm
        schema={schema}
        view={view}
        record={record}
        isEditing={isEditing}
        isCreating={isCreating}
        permissions={fieldPermissions}
        formData={formData}
        onFieldChange={handleFieldChange}
      />
    </div>
  )
}
