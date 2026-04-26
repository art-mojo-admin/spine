import { Button } from '../ui/Button'
import * as Icons from '@heroicons/react/24/outline'

interface DataDetailHeaderProps {
  entity: string
  icon: string
  title: string
  isEditing: boolean
  isCreating: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  saving?: boolean
  deleting?: boolean
}

export function DataDetailHeader({
  entity,
  icon,
  title,
  isEditing,
  isCreating,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  saving,
  deleting
}: DataDetailHeaderProps) {
  const IconComponent = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[icon] || Icons.CubeIcon
  
  return (
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <IconComponent className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 capitalize">
            {isCreating ? `Create new ${entity.slice(0, -1)}` : entity}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSave} loading={saving}>
              {isCreating ? 'Create' : 'Save'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onEdit}>
              <Icons.PencilIcon className="h-4 w-4 mr-1" />
              Edit
            </Button>
            {onDelete && (
              <Button variant="danger" onClick={onDelete} loading={deleting}>
                <Icons.TrashIcon className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
