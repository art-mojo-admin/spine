import { CustomFieldsRenderer } from '@/components/shared/CustomFieldsRenderer'

interface FieldsPanelProps {
  entityType: string
  metadata: Record<string, any>
  editing?: boolean
  onChange?: (metadata: Record<string, any>) => void
}

export function FieldsPanel({ entityType, metadata, editing, onChange }: FieldsPanelProps) {
  return (
    <CustomFieldsRenderer
      entityType={entityType}
      metadata={metadata}
      editing={editing || false}
      onChange={onChange || (() => {})}
    />
  )
}
