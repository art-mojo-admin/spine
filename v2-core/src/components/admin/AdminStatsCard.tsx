import React from 'react'
import { LucideIcon } from 'lucide-react'

interface AdminStatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
}

export function AdminStatsCard({ title, value, icon: Icon, iconColor = "text-blue-500" }: AdminStatsCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-slate-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-semibold text-slate-900">
                {value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
