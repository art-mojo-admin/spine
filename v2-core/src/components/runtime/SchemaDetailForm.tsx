import { DesignSchema, DetailView, DetailViewSection, FieldDefinition } from '../../types/types'
import { SchemaFields } from '../shared/SchemaFields'

interface SchemaDetailFormProps {
  schema: DesignSchema
  view: DetailView
  record: any
  isEditing: boolean
  isCreating: boolean
  permissions: Record<string, string[]>
  formData: Record<string, any>
  onFieldChange: (key: string, value: any) => void
}

export function SchemaDetailForm({
  schema,
  view,
  record,
  isEditing,
  isCreating,
  permissions,
  formData,
  onFieldChange
}: SchemaDetailFormProps) {
  
  const renderSection = (section: DetailViewSection, sectionIndex: number) => {
    const sectionFields = Object.entries(section.fields || {}).map(([fieldName]) => {
      const fieldDef = schema.fields[fieldName]
      if (!fieldDef) return null

      return {
        name: fieldName,
        label: fieldDef.label,
        data_type: fieldDef.data_type,
        required: fieldDef.required,
        validation: fieldDef.validation,
        options: fieldDef.options,
        permissions: fieldDef.permissions,
        system: fieldDef.system
      } as FieldDefinition
    }).filter((field): field is NonNullable<typeof field> => field !== null)

    // Build display_type map from view config — keeps field definitions clean
    const displayTypes: Record<string, string> = {}
    Object.entries(section.fields || {}).forEach(([fieldName, viewConfig]) => {
      if (viewConfig.display_type) {
        displayTypes[fieldName] = viewConfig.display_type
      }
    })

    if (sectionFields.length === 0) return null

    return (
      <div key={sectionIndex} className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-slate-900 mb-4">
          {section.title}
        </h3>
        
        <SchemaFields
          fields={sectionFields}
          data={isCreating || isEditing ? formData : (record || {})}
          readonly={!isEditing}
          twoColumn={false}
          onChange={onFieldChange}
          displayTypes={displayTypes}
        />
      </div>
    )
  }

  if (!view.sections || view.sections.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-8">
          <p className="text-slate-500">No fields configured for this view</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {view.sections.map((section, index) => renderSection(section, index))}
    </div>
  )
}
