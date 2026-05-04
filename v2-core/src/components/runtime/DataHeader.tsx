/**
 * @module src/components/runtime/DataHeader
 * @audience installer
 * @layer frontend-component
 * @stability stable
 *
 * Title bar for entity list pages. Renders an entity icon, title,
 * description, and a "New" button that navigates to the create route.
 * The icon name is resolved dynamically from `@heroicons/react`; falls
 * back to `CubeIcon` if the name is unrecognised.
 *
 * @seeAlso src/components/runtime/DataListPage.tsx (mounts this component)
 */

import React from 'react'
import { Button } from '../ui/Button'
import * as Icons from '@heroicons/react/24/outline'

/**
 * Props for `DataHeader`.
 *
 * @prop title - Entity name (displayed capitalised)
 * @prop icon - Heroicon name string (e.g. `'UserIcon'`)
 * @prop description - Short subtitle text
 * @prop newButtonHref - URL to navigate to when "New" is clicked
 */
interface DataHeaderProps {
  title: string
  icon: string
  description: string
  newButtonHref: string
}

/**
 * Entity list page header with title, description, and new-record button.
 *
 * @param props - `DataHeaderProps`
 * @returns Header bar JSX
 * @sideEffects Navigates via `window.location.href` on button click
 */
export function DataHeader({ title, icon, description, newButtonHref }: DataHeaderProps) {
  // Dynamically get the icon component
  const IconComponent = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[icon] || Icons.CubeIcon
  
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <IconComponent className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 capitalize">
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      
      <Button 
        onClick={() => window.location.href = newButtonHref}
        className="flex items-center gap-2"
      >
        <Icons.PlusIcon className="h-4 w-4" />
        New {title.slice(0, -1)}
      </Button>
    </div>
  )
}
