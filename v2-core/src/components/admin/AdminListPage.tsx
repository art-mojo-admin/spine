import React, { ReactNode } from 'react'
import { Button } from '../ui/Button'
import { LucideIcon } from 'lucide-react'
import { AdminStatsCard } from './AdminStatsCard'

interface AdminListPageProps {
  title: string
  description: string
  newButtonText?: string
  newButtonHref?: string
  statsCards: Array<{
    title: string
    value: string | number
    icon: LucideIcon
    iconColor?: string
  }>
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  filters?: Array<{
    label: string
    value: string
    options: Array<{ value: string; label: string }>
    onChange: (value: string) => void
  }>
  children: ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyMessage?: string
  emptyIcon?: LucideIcon
}

export function AdminListPage({
  title,
  description,
  newButtonText,
  newButtonHref = '#',
  statsCards,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  filters = [],
  children,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = "No items found",
  emptyIcon: EmptyIcon
}: AdminListPageProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        
        {newButtonText && (
          <Button onClick={() => window.location.href = newButtonHref!}>
            {newButtonText}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <AdminStatsCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            iconColor={stat.iconColor}
          />
        ))}
      </div>

      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          {onSearchChange && (
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Filters */}
          {filters.map((filter, index) => (
            <div key={index} className="sm:w-40">
              <select
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {filter.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-slate-600">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">Error: {error}</p>
            {onRetry && (
              <Button onClick={onRetry} className="mt-4">
                Retry
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
