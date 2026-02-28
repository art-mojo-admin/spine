import { Reorder } from 'framer-motion'
import { ChevronDown, ChevronRight, Plus, Settings, Navigation, Database, Zap } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LucideIconDisplay } from './LucideIconPicker'
import type { AppDef, NavItem, Selection } from '@/pages/admin/AppBuilder'

interface AppTreeProps {
  app: AppDef
  selection: Selection
  onSelect: (s: Selection) => void
  onReorderNav: (items: NavItem[]) => void
  onAddNavItem: () => void
  customFieldCount: number
  automationCount: number
}

export function AppTree({
  app,
  selection,
  onSelect,
  onReorderNav,
  onAddNavItem,
  customFieldCount,
  automationCount,
}: AppTreeProps) {
  const [navExpanded, setNavExpanded] = useState(true)
  const [dataExpanded, setDataExpanded] = useState(false)
  const [logicExpanded, setLogicExpanded] = useState(false)

  const isSelected = (type: Selection['type'], index?: number) => {
    if (selection.type !== type) return false
    if (index !== undefined && selection.index !== index) return false
    return true
  }

  const itemClass = (active: boolean) =>
    `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors ${
      active
        ? 'bg-primary/10 text-primary font-medium'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
    }`

  const sectionClass = (expanded: boolean) =>
    `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors hover:bg-accent`

  return (
    <div className="w-[240px] flex-shrink-0 border-r bg-background overflow-y-auto">
      <div className="p-3 space-y-1">
        {/* General */}
        <div
          className={itemClass(isSelected('general'))}
          onClick={() => onSelect({ type: 'general' })}
        >
          <Settings className="h-3.5 w-3.5" />
          General
        </div>

        {/* Navigation Section */}
        <div>
          <div
            className={sectionClass(navExpanded)}
            onClick={() => setNavExpanded(!navExpanded)}
          >
            {navExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Navigation className="h-3.5 w-3.5" />
            <span className="flex-1">Navigation</span>
            <span className="text-[10px] text-muted-foreground">{app.nav_items.length}</span>
          </div>

          {navExpanded && (
            <div className="ml-3 mt-1 space-y-0.5">
              <Reorder.Group
                axis="y"
                values={app.nav_items}
                onReorder={onReorderNav}
                className="space-y-0.5"
              >
                {app.nav_items.map((item, index) => (
                  <Reorder.Item
                    key={`${item.label}-${index}`}
                    value={item}
                    className={`${itemClass(isSelected('nav_item', index))} ml-2`}
                    onClick={() => onSelect({ type: 'nav_item', index })}
                    whileDrag={{ scale: 1.02, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                  >
                    <LucideIconDisplay name={item.icon} className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate flex-1 text-xs">{item.label}</span>
                    {item.view_slug && (
                      <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[60px]">
                        {item.view_slug}
                      </span>
                    )}
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start text-xs ml-2 text-muted-foreground"
                onClick={onAddNavItem}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Nav Item
              </Button>
            </div>
          )}
        </div>

        {/* Data Section */}
        <div>
          <div
            className={sectionClass(dataExpanded)}
            onClick={() => setDataExpanded(!dataExpanded)}
          >
            {dataExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Database className="h-3.5 w-3.5" />
            <span className="flex-1">Data</span>
            <span className="text-[10px] text-muted-foreground">{customFieldCount}</span>
          </div>

          {dataExpanded && (
            <div className="ml-3 mt-1">
              <div
                className={`${itemClass(isSelected('fields'))} ml-2`}
                onClick={() => onSelect({ type: 'fields' })}
              >
                Custom Fields
              </div>
            </div>
          )}
        </div>

        {/* Logic Section */}
        <div>
          <div
            className={sectionClass(logicExpanded)}
            onClick={() => setLogicExpanded(!logicExpanded)}
          >
            {logicExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Zap className="h-3.5 w-3.5" />
            <span className="flex-1">Logic</span>
            <span className="text-[10px] text-muted-foreground">{automationCount}</span>
          </div>

          {logicExpanded && (
            <div className="ml-3 mt-1">
              <div
                className={`${itemClass(isSelected('automations'))} ml-2`}
                onClick={() => onSelect({ type: 'automations' })}
              >
                Automations
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
