/**
 * @module src/components/runtime/DataDetailHeader
 * @audience installer
 * @layer frontend-component
 * @stability stable
 *
 * Title bar for entity detail/create/edit pages. Shows the record title
 * and a contextual action bar that switches between:
 * - **Read mode:** Edit + Delete buttons
 * - **Edit/Create mode:** Cancel + Save/Create buttons
 *
 * The icon name is resolved dynamically from `@heroicons/react`; falls
 * back to `CubeIcon` if unrecognised.
 *
 * @seeAlso src/components/runtime/DataDetailPage.tsx (mounts this component)
 */

import React from 'react'
import { Button } from '../ui/Button'
import * as Icons from '@heroicons/react/24/outline'

/**
 * Props for `DataDetailHeader`.
 *
 * @prop entity - Entity name (shown below the title)
 * @prop icon - Heroicon name string
 * @prop title - Record display title
 * @prop isEditing - True in edit mode (shows Save/Cancel)
 * @prop isCreating - True in create mode (button label becomes "Create")
 * @prop onEdit / onSave / onCancel / onDelete - Action callbacks
 * @prop saving / deleting - Loading state for mutation buttons
 */
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

/**
 * Detail page header with record title and contextual edit/save/delete actions.
 *
 * @param props - `DataDetailHeaderProps`
 * @returns Header bar JSX
 * @sideEffects none (delegates actions to callbacks)
 */
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
