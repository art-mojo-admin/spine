/**
 * @module src/components/ui/Popover
 * @audience installer
 * @layer frontend-component
 * @stability stable
 *
 * Lightweight click-triggered floating panel. Toggles open/closed on
 * trigger click and closes when a click is detected outside both the
 * trigger and the panel (via `mousedown` listener on `document`).
 *
 * **Placement options:** `bottom-right`, `bottom-left`, `bottom-center`,
 * `top-end`, `top-start`.
 *
 * **Usage note:** The panel is absolutely positioned relative to the
 * trigger wrapper. Ensure the parent has a non-`static` position or the
 * panel has sufficient `z-index` for your stacking context.
 *
 * @seeAlso src/lib/utils.ts (cn)
 * @seeAlso src/components/layout/Sidebar.tsx (primary consumer for sign-out menu)
 */

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'

/**
 * Props for `Popover`.
 *
 * @prop trigger - The element that toggles the panel when clicked
 * @prop children - Panel content
 * @prop placement - Anchor position of the floating panel (default: `'bottom-right'`)
 * @prop className - Additional Tailwind classes applied to the panel `<div>`
 */
interface PopoverProps {
  trigger: React.ReactNode
  children: React.ReactNode
  className?: string
  placement?: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-end' | 'top-start'
}

/**
 * Click-triggered floating popover panel.
 *
 * @param props - `PopoverProps`
 * @returns Wrapper div containing trigger + conditionally rendered panel
 * @sideEffects Adds/removes a `mousedown` listener on `document` while mounted
 */
export function Popover({ trigger, children, className, placement = 'bottom-right' }: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const placementClasses = {
    'bottom-right': 'right-0',
    'bottom-left': 'left-0',
    'bottom-center': 'left-1/2 transform -translate-x-1/2',
    'top-end': 'right-0 bottom-full mb-1 mt-0',
    'top-start': 'left-0 bottom-full mb-1 mt-0'
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={triggerRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      
      {isOpen && (
        <div
          ref={popoverRef}
          className={cn(
            'absolute z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg',
            placementClasses[placement],
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
