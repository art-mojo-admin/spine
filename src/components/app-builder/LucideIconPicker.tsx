import { useState, useMemo, useRef, useEffect } from 'react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const CURATED_ICONS = [
  'Activity', 'AlertCircle', 'Archive', 'ArrowRight', 'BarChart3', 'Bell', 'Blocks',
  'BookOpen', 'Bookmark', 'Box', 'Briefcase', 'Bug', 'Building2', 'Calendar',
  'CalendarDays', 'Check', 'CheckCircle', 'ChevronRight', 'Circle', 'Clipboard',
  'Clock', 'Cloud', 'Code', 'Cog', 'Coins', 'Compass', 'Copy', 'CreditCard',
  'Database', 'Download', 'Edit', 'ExternalLink', 'Eye', 'File', 'FileText',
  'Filter', 'Flag', 'Folder', 'GitBranch', 'Globe', 'GraduationCap', 'Grid',
  'Grip', 'Hash', 'Headphones', 'Heart', 'HeartPulse', 'Home', 'Image', 'Inbox',
  'Info', 'KanbanSquare', 'Key', 'Layers', 'Layout', 'LayoutDashboard', 'LayoutGrid',
  'LayoutList', 'Library', 'Link', 'Link2', 'List', 'ListChecks', 'Lock', 'LogIn',
  'LogOut', 'Mail', 'Map', 'MapPin', 'Megaphone', 'MessageCircle', 'MessageSquare',
  'Mic', 'Monitor', 'Moon', 'MoreHorizontal', 'Mountain', 'MousePointer', 'Music',
  'Navigation', 'Network', 'Newspaper', 'Package', 'Palette', 'PanelLeft', 'Paperclip',
  'Pencil', 'Phone', 'PieChart', 'Pin', 'Play', 'Plug', 'PlugZap', 'Plus', 'PlusCircle',
  'Pocket', 'Power', 'Printer', 'QrCode', 'Radio', 'Receipt', 'RefreshCw', 'Repeat',
  'Rocket', 'RotateCw', 'Ruler', 'Save', 'Search', 'Send', 'Server', 'Settings',
  'Share', 'Shield', 'ShieldAlert', 'ShoppingBag', 'ShoppingCart', 'Signal', 'Slash',
  'SlidersHorizontal', 'Smartphone', 'Sparkles', 'Speaker', 'Square', 'Star', 'Store',
  'Sun', 'Table', 'Tag', 'Target', 'Terminal', 'ThumbsUp', 'Timer', 'ToggleLeft',
  'Tool', 'Trash2', 'TrendingUp', 'Trophy', 'Truck', 'Tv', 'Type', 'Umbrella',
  'Upload', 'User', 'UserPlus', 'Users', 'Video', 'Wallet', 'Wand2', 'Webhook',
  'Wifi', 'Wrench', 'X', 'Zap',
]

function kebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function pascalFromKebab(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

function getIcon(name: string): LucideIcon | null {
  const pascal = name.includes('-') ? pascalFromKebab(name) : name
  const icon = (LucideIcons as Record<string, any>)[pascal]
  if (icon && typeof icon === 'function') return icon as LucideIcon
  return null
}

interface LucideIconPickerProps {
  value: string | null
  onChange: (iconName: string) => void
}

export function LucideIconPicker({ value, onChange }: LucideIconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filteredIcons = useMemo(() => {
    const q = search.toLowerCase()
    return CURATED_ICONS.filter((name) => {
      const kebab = kebabCase(name)
      return name.toLowerCase().includes(q) || kebab.includes(q)
    })
  }, [search])

  const SelectedIcon = value ? getIcon(value) : null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch('') }}
        className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors w-full"
      >
        {SelectedIcon ? (
          <>
            <SelectedIcon className="h-4 w-4" />
            <span className="font-mono text-xs text-muted-foreground">{value}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Choose icon...</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-[320px] rounded-lg border bg-background shadow-lg">
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Search icons..."
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[240px] overflow-y-auto">
            {filteredIcons.map((name) => {
              const Icon = getIcon(name)
              if (!Icon) return null
              const kebab = kebabCase(name)
              const isSelected = value === kebab
              return (
                <button
                  key={name}
                  type="button"
                  title={kebab}
                  onClick={() => { onChange(kebab); setOpen(false) }}
                  className={`flex items-center justify-center rounded-md p-2 transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
            {filteredIcons.length === 0 && (
              <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">No icons match "{search}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function LucideIconDisplay({ name, className }: { name: string | null | undefined; className?: string }) {
  if (!name) return null
  const Icon = getIcon(name)
  if (!Icon) return null
  return <Icon className={className || 'h-4 w-4'} />
}
