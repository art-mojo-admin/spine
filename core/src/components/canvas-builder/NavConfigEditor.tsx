import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import type { NavConfig, NavConfigItem } from '@/lib/widgetRegistry'

interface NavConfigEditorProps {
  value: NavConfig
  onChange: (nc: NavConfig) => void
}

export function NavConfigEditor({ value, onChange }: NavConfigEditorProps) {
  function addItem() {
    onChange({ items: [...value.items, { label: 'New Link', view_slug: '' }] })
  }

  function updateItem(index: number, updates: Partial<NavConfigItem>) {
    const newItems = value.items.map((item, i) => i === index ? { ...item, ...updates } : item)
    onChange({ items: newItems })
  }

  function removeItem(index: number) {
    onChange({ items: value.items.filter((_, i) => i !== index) })
  }

  function addChild(index: number) {
    const item = value.items[index]
    const children = [...(item.children || []), { label: 'Sub Link', view_slug: '' }]
    updateItem(index, { children })
  }

  function updateChild(parentIndex: number, childIndex: number, updates: Partial<NavConfigItem>) {
    const item = value.items[parentIndex]
    const children = (item.children || []).map((c, i) => i === childIndex ? { ...c, ...updates } : c)
    updateItem(parentIndex, { children })
  }

  function removeChild(parentIndex: number, childIndex: number) {
    const item = value.items[parentIndex]
    const children = (item.children || []).filter((_, i) => i !== childIndex)
    updateItem(parentIndex, { children: children.length > 0 ? children : undefined })
  }

  return (
    <div className="space-y-2">
      {value.items.length === 0 && (
        <p className="text-[10px] text-muted-foreground">No items. Add one below.</p>
      )}

      {value.items.map((item, i) => (
        <NavItemRow
          key={i}
          item={item}
          onUpdate={(updates) => updateItem(i, updates)}
          onRemove={() => removeItem(i)}
          onAddChild={() => addChild(i)}
          onUpdateChild={(ci, updates) => updateChild(i, ci, updates)}
          onRemoveChild={(ci) => removeChild(i, ci)}
        />
      ))}

      <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={addItem}>
        <Plus className="mr-1 h-3 w-3" /> Add Item
      </Button>
    </div>
  )
}

function NavItemRow({
  item,
  onUpdate,
  onRemove,
  onAddChild,
  onUpdateChild,
  onRemoveChild,
}: {
  item: NavConfigItem
  onUpdate: (updates: Partial<NavConfigItem>) => void
  onRemove: () => void
  onAddChild: () => void
  onUpdateChild: (index: number, updates: Partial<NavConfigItem>) => void
  onRemoveChild: (index: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div className="rounded-md border p-2 space-y-1.5">
      <div className="flex items-center gap-1">
        {hasChildren ? (
          <button className="h-4 w-4 flex-shrink-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Input
          value={item.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="h-6 text-xs flex-1"
          placeholder="Label"
        />
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground" onClick={onAddChild} title="Add child">
          <Plus className="h-2.5 w-2.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={onRemove}>
          <Trash2 className="h-2.5 w-2.5" />
        </Button>
      </div>

      <div className="flex gap-1 pl-4">
        <Input
          value={item.view_slug || ''}
          onChange={(e) => onUpdate({ view_slug: e.target.value || undefined })}
          className="h-6 text-[10px] font-mono flex-1"
          placeholder="view slug"
        />
        <Input
          value={item.url || ''}
          onChange={(e) => onUpdate({ url: e.target.value || undefined })}
          className="h-6 text-[10px] font-mono flex-1"
          placeholder="or URL"
        />
      </div>

      {hasChildren && expanded && (
        <div className="pl-4 space-y-1 border-l ml-2">
          {item.children!.map((child, ci) => (
            <div key={ci} className="flex items-center gap-1">
              <Input
                value={child.label}
                onChange={(e) => onUpdateChild(ci, { label: e.target.value })}
                className="h-6 text-xs flex-1"
                placeholder="Label"
              />
              <Input
                value={child.view_slug || ''}
                onChange={(e) => onUpdateChild(ci, { view_slug: e.target.value || undefined })}
                className="h-6 text-[10px] font-mono w-20"
                placeholder="slug"
              />
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => onRemoveChild(ci)}>
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
