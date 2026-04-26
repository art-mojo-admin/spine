import * as Icons from '@heroicons/react/24/outline'
import { EntityStat } from '../../types/types'

interface DataStatsProps {
  stats: EntityStat[]
  data: any[]
  loading?: boolean
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-purple-50 text-purple-600',
  gray: 'bg-gray-50 text-gray-600'
}

export function DataStats({ stats, data, loading }: DataStatsProps) {
  const calculateStat = (stat: EntityStat): number => {
    if (!data) return 0
    
    switch (stat.type) {
      case 'count':
        return data.length
      case 'filter_count':
        return data.filter(item => {
          if (!stat.filter) return true
          return Object.entries(stat.filter).every(([key, value]) => {
            const itemValue = key.includes('.') 
              ? key.split('.').reduce((obj, k) => obj?.[k], item)
              : item[key]
            return itemValue === value
          })
        }).length
      default:
        return 0
    }
  }
  
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const IconComponent = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[stat.icon] || Icons.CubeIcon
        const value = loading ? '-' : calculateStat(stat)
        
        return (
          <div 
            key={index}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-md p-3 ${colorMap[stat.color] || colorMap.gray}`}>
                  <IconComponent className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-slate-500 truncate">
                      {stat.title}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-slate-900">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
