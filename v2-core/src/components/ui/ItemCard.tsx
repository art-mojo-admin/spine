import React from 'react'
import { Item, ItemType } from '../../types/types'
import { Badge } from './Badge'
import { Button } from './Button'
import { 
  CubeIcon,
  DocumentTextIcon,
  CalendarIcon,
  UserIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline'
import { formatDateTime, truncateText } from '../../lib/utils'

interface ItemCardProps {
  item: Item & { item_type?: ItemType | string }
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  onView?: (item: Item) => void
  showActions?: boolean
  compact?: boolean
}

export function ItemCard({
  item,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  compact = false
}: ItemCardProps) {
  const getPrimaryValue = () => item.title || 'Untitled Item'

  const getSecondaryValue = () => {
    if (item.description) return truncateText(item.description, 100)
    return null
  }

  const getTypeIcon = () => {
    return <CubeIcon className="h-5 w-5 text-blue-500" />
  }

  const getTypeName = () => {
    if (!item.item_type) return item.item_type_slug || ''
    if (typeof item.item_type === 'string') return item.item_type
    return (item.item_type as ItemType).name || ''
  }

  const getTypeBadgeColor = () => {
    if (!item.item_type || typeof item.item_type === 'string') return 'info'
    return (item.item_type as ItemType).is_active ? 'success' : 'default'
  }

  if (compact) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className="flex-shrink-0">
              {getTypeIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-medium text-slate-900 truncate">
                  {getPrimaryValue()}
                </h3>
                <Badge variant={getTypeBadgeColor()} size="sm">
                  {getTypeName()}
                </Badge>
              </div>
              {getSecondaryValue() && (
                <p className="text-xs text-slate-500 mt-1">
                  {getSecondaryValue()}
                </p>
              )}
              <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                <span>Updated {formatDateTime(item.updated_at)}</span>
              </div>
            </div>
          </div>
          
          {showActions && (
            <div className="flex items-center space-x-1">
              {onView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onView(item)}
                >
                  View
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
              >
                <EllipsisVerticalIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4 flex-1">
          <div className="flex-shrink-0">
            {getTypeIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-lg font-medium text-slate-900 truncate">
                {getPrimaryValue()}
              </h3>
              <Badge variant={getTypeBadgeColor()}>
                {getTypeName()}
              </Badge>
            </div>
            
            {getSecondaryValue() && (
              <p className="text-sm text-slate-600 mb-3">
                {getSecondaryValue()}
              </p>
            )}

            {/* Additional data fields */}
            {Object.keys(item.data || {}).length > 0 && (
              <div className="space-y-2 mb-4">
                {Object.entries(item.data)
                  .filter(([, v]) => v !== undefined && v !== null && v !== '')
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-slate-500">{key}:</span>
                      <span className="text-xs text-slate-900">
                        {truncateText(typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value), 50)}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-4">
                <span className="flex items-center">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  Created {formatDateTime(item.created_at)}
                </span>
                <span className="flex items-center">
                  <UserIcon className="h-3 w-3 mr-1" />
                  ID: {item.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center space-x-2 ml-4">
            {onView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(item)}
              >
                View
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
              >
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
            >
              <EllipsisVerticalIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

interface ItemGridProps {
  items: (Item & { item_type: ItemType })[]
  loading?: boolean
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  onView?: (item: Item) => void
  compact?: boolean
  emptyMessage?: string
}

export function ItemGrid({
  items,
  loading = false,
  onEdit,
  onDelete,
  onView,
  compact = false,
  emptyMessage = 'No items found'
}: ItemGridProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-sm font-medium text-slate-900">{emptyMessage}</h3>
      </div>
    )
  }

  return (
    <div className={compact 
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    }>
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          compact={compact}
        />
      ))}
    </div>
  )
}
