import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import { useCustomFields } from '@/hooks/useCustomFields'

const OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '≠' },
  { value: 'contains', label: 'contains' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'not exists' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
  { value: 'in', label: 'in' },
]

interface Condition {
  field: string
  operator: string
  value?: any
}

interface ConditionEditorProps {
  conditions: Condition[]
  onChange: (conditions: Condition[]) => void
  entityType?: string
}

export function ConditionEditor({ conditions, onChange, entityType }: ConditionEditorProps) {
  const { fieldPaths } = useCustomFields(entityType)
  function addCondition() {
    onChange([...conditions, { field: '', operator: 'equals', value: '' }])
  }

  function updateCondition(index: number, updates: Partial<Condition>) {
    const updated = conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    onChange(updated)
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index))
  }

  const noValueOps = ['exists', 'not_exists']

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Conditions</p>
        <Button variant="ghost" size="sm" onClick={addCondition}>
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      {entityType && fieldPaths.length > 0 && (
        <datalist id={`cond-fields-${entityType}`}>
          {fieldPaths.map((fp) => (
            <option key={fp.path} value={fp.path}>{fp.label}</option>
          ))}
        </datalist>
      )}

      {conditions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No conditions — always passes</p>
      ) : (
        conditions.map((cond, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <>
              <Input
                className="flex-1 h-8 text-xs"
                placeholder="field.path"
                value={cond.field}
                onChange={(e) => updateCondition(idx, { field: e.target.value })}
                list={entityType ? `cond-fields-${entityType}` : undefined}
              />
            </>
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={cond.operator}
              onChange={(e) => updateCondition(idx, { operator: e.target.value })}
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            {!noValueOps.includes(cond.operator) && (
              <Input
                className="flex-1 h-8 text-xs"
                placeholder="value"
                value={cond.value ?? ''}
                onChange={(e) => updateCondition(idx, { value: e.target.value })}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive"
              onClick={() => removeCondition(idx)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))
      )}
    </div>
  )
}
