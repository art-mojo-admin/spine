import { Button } from '../ui/Button'
import * as Icons from '@heroicons/react/24/outline'

interface DataHeaderProps {
  title: string
  icon: string
  description: string
  newButtonHref: string
}

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
