/**
 * @module src/components/ui/Badge
 * @audience installer
 * @layer frontend-component
 * @stability stable
 *
 * Inline badge and status label primitives.
 *
 * **`Badge`** — general-purpose pill with `variant` and `size` props.
 * Variants: `default`, `success`, `warning`, `error`, `info`, `primary`,
 * `secondary`. Accepts an optional `className` override.
 *
 * **`StatusBadge`** — convenience wrapper that maps a named `status` string
 * (`'active'` | `'inactive'` | `'pending'` | `'success'` | `'error'` |
 * `'warning'`) to the appropriate `Badge` variant and default label text.
 * The label can be overridden via `children`.
 *
 * @seeAlso src/lib/utils.ts (cn)
 */

import React from 'react'
import { cn } from '../../lib/utils'

/**
 * Props for `Badge`.
 *
 * @prop variant - Colour scheme (default: `'default'`)
 * @prop size - `'sm'` | `'md'` (default: `'md'`)
 * @prop className - Additional Tailwind classes
 */
interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary'
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Inline pill badge.
 *
 * @param props - `BadgeProps`
 * @returns `<span>` with appropriate colour and size classes
 * @sideEffects none (pure rendering)
 */
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
    info: 'bg-[#f8fafc] text-[#5b7bb5]',
    primary: 'bg-blue-100 text-blue-700',
    secondary: 'bg-slate-100 text-slate-600'
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

/**
 * Props for `StatusBadge`.
 *
 * @prop status - Named status value that maps to a variant + default label
 * @prop children - Optional label override
 * @prop className - Additional Tailwind classes
 */
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'success' | 'error' | 'warning'
  children?: React.ReactNode
  className?: string
}

/**
 * Status-aware badge with sensible defaults per status value.
 *
 * @param props - `StatusBadgeProps`
 * @returns `<Badge>` with variant and text resolved from `status`
 * @sideEffects none (pure rendering)
 */
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
