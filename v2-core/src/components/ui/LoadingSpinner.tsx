/**
 * @module src/components/ui/LoadingSpinner
 * @audience installer
 * @layer frontend-component
 * @stability stable
 *
 * Animated CSS spinner used to indicate loading state inline or as a
 * centred overlay. Uses `border-t-blue-600` as the active segment colour
 * and `border-slate-200` for the track.
 *
 * @seeAlso src/lib/utils.ts (cn)
 */

import React from 'react'
import { cn } from '../../lib/utils'

/**
 * Props for `LoadingSpinner`.
 *
 * @prop size - Diameter: `'sm'` (16px), `'md'` (24px), `'lg'` (32px)
 * @prop className - Additional Tailwind classes
 */
interface LoadingSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Inline animated spinner.
 *
 * @param props - `LoadingSpinnerProps`
 * @returns `<div>` styled as a spinning ring
 * @sideEffects none (pure rendering)
 */
export function LoadingSpinner({ className, size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-slate-200 border-t-blue-600',
        sizeClasses[size],
        className
      )}
    />
  )
}
