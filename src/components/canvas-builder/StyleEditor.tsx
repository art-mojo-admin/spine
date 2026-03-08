import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { StyleConfig } from '@/lib/widgetRegistry'

const PADDING_OPTIONS = [
  { value: 'none', label: 'None (0px)' },
  { value: 'xs', label: 'XS (8px)' },
  { value: 'sm', label: 'Small (12px)' },
  { value: 'md', label: 'Medium (16px)' },
  { value: 'lg', label: 'Large (24px)' },
]

const RADIUS_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'full', label: 'Full' },
]

interface StyleEditorProps {
  value?: StyleConfig
  onChange: (value?: StyleConfig) => void
}

function cleanStyle(style: StyleConfig): StyleConfig | undefined {
  const entries = Object.entries(style).filter(([, val]) => val !== undefined && val !== '')
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries) as StyleConfig
}

export function StyleEditor({ value, onChange }: StyleEditorProps) {
  const current = value || {}

  function updateStyle(patch: Partial<StyleConfig>) {
    const next = { ...current, ...patch }
    onChange(cleanStyle(next))
  }

  return (
    <div className="space-y-4">
      {/* Background Color */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Background</label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={current.bg_color || '#ffffff'}
            onChange={(e) => updateStyle({ bg_color: e.target.value })}
            className="h-9 w-12 p-1"
          />
          <Input
            type="text"
            value={current.bg_color || ''}
            onChange={(e) => updateStyle({ bg_color: e.target.value || undefined })}
            placeholder="#ffffff"
            className="text-xs font-mono"
          />
          {current.bg_color && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateStyle({ bg_color: undefined })}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Padding */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Padding</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={current.padding || ''}
          onChange={(e) => updateStyle({ padding: e.target.value || undefined })}
        >
          <option value="">Default</option>
          {PADDING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Border Radius */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Border Radius</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={current.border_radius || ''}
          onChange={(e) => updateStyle({ border_radius: e.target.value || undefined })}
        >
          <option value="">Default</option>
          {RADIUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Border Toggle */}
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <input
          type="checkbox"
          className="h-3 w-3"
          checked={!!current.border}
          onChange={(e) => updateStyle({ border: e.target.checked ? true : undefined })}
        />
        Show border
      </label>
    </div>
  )
}
