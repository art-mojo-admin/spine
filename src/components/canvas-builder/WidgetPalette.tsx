import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { WIDGET_TYPES, WIDGET_CATEGORIES } from '@/lib/widgetRegistry'
import { LucideIconDisplay } from '@/components/app-builder/LucideIconPicker'
import { Search } from 'lucide-react'

interface WidgetPaletteProps {
  onAddWidget: (widgetType: string) => void
}

export function WidgetPalette({ onAddWidget }: WidgetPaletteProps) {
  const [search, setSearch] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>('data')

  const filtered = search
    ? WIDGET_TYPES.filter((w) => w.label.toLowerCase().includes(search.toLowerCase()))
    : WIDGET_TYPES

  return (
    <div className="w-[200px] flex-shrink-0 border-r bg-background overflow-y-auto">
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search widgets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      <div className="p-2 space-y-1">
        {search ? (
          // Flat search results
          filtered.length === 0 ? (
            <p className="text-[10px] text-muted-foreground px-2 py-4 text-center">No widgets match "{search}"</p>
          ) : (
            filtered.map((w) => (
              <WidgetItem key={w.type} widget={w} onClick={() => onAddWidget(w.type)} />
            ))
          )
        ) : (
          // Categorized
          WIDGET_CATEGORIES.map((cat) => {
            const items = WIDGET_TYPES.filter((w) => w.category === cat.key)
            if (items.length === 0) return null
            const isExpanded = expandedCategory === cat.key

            return (
              <div key={cat.key}>
                <button
                  className="flex items-center gap-1 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                >
                  <span className={`transition-transform text-[10px] ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                  {cat.label}
                  <span className="ml-auto text-[9px] font-normal">{items.length}</span>
                </button>
                {isExpanded && (
                  <div className="space-y-0.5 ml-1">
                    {items.map((w) => (
                      <WidgetItem key={w.type} widget={w} onClick={() => onAddWidget(w.type)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function WidgetItem({ widget, onClick }: { widget: typeof WIDGET_TYPES[number]; onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      onClick={onClick}
    >
      <LucideIconDisplay name={widget.icon} className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{widget.label}</span>
    </button>
  )
}
