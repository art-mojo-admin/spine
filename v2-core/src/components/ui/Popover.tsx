import React, { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'

interface PopoverProps {
  trigger: React.ReactNode
  children: React.ReactNode
  className?: string
  placement?: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-end' | 'top-start'
}

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
