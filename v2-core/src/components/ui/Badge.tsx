import React from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className
}: BadgeProps) {
  const variantClasses = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-[#f8fafc] text-[#5b7bb5]',
    warning: 'bg-[#f8fafc] text-[#7ba0d4]',
    error: 'bg-[#f8fafc] text-slate-600',
    info: 'bg-[#f8fafc] text-[#5b7bb5]'
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  )
}

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'success' | 'error' | 'warning'
  children?: React.ReactNode
  className?: string
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const statusConfig = {
    active: { variant: 'info' as const, text: 'Active' },
    inactive: { variant: 'default' as const, text: 'Inactive' },
    pending: { variant: 'warning' as const, text: 'Pending' },
    success: { variant: 'info' as const, text: 'Success' },
    error: { variant: 'error' as const, text: 'Error' },
    warning: { variant: 'warning' as const, text: 'Warning' }
  }

  const config = statusConfig[status]

  return (
    <Badge variant={config.variant} className={className}>
      {children || config.text}
    </Badge>
  )
}
