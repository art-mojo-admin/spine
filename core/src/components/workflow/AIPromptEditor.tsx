import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
]

const FIELD_TOKENS = [
  '{{item.title}}',
  '{{item.description}}',
  '{{item.priority}}',
  '{{item.workflow_type}}',
  '{{item.due_date}}',
  '{{item.metadata}}',
  '{{transition.name}}',
  '{{transition_comment}}',
]

interface ResultAction {
  type: string
  field: string
  source: string
}

interface AIPromptConfig {
  system_prompt?: string
  user_prompt: string
  model?: string
  result_target?: string
  result_actions?: ResultAction[]
}

interface AIPromptEditorProps {
  config: AIPromptConfig
  onChange: (config: AIPromptConfig) => void
}

export function AIPromptEditor({ config, onChange }: AIPromptEditorProps) {
  function update(partial: Partial<AIPromptConfig>) {
    onChange({ ...config, ...partial })
  }

  function insertToken(field: 'system_prompt' | 'user_prompt', token: string) {
    const current = config[field] || ''
    update({ [field]: current + token })
  }

  function addResultAction() {
    const actions = config.result_actions || []
    update({ result_actions: [...actions, { type: 'update_field', field: '', source: '' }] })
  }

  function updateResultAction(idx: number, updates: Partial<ResultAction>) {
    const actions = (config.result_actions || []).map((a, i) =>
      i === idx ? { ...a, ...updates } : a,
    )
    update({ result_actions: actions })
  }

  function removeResultAction(idx: number) {
    update({ result_actions: (config.result_actions || []).filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Model</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={config.model || 'gpt-4o-mini'}
          onChange={(e) => update({ model: e.target.value })}
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">System Prompt</label>
        <Textarea
          rows={3}
          value={config.system_prompt || ''}
          onChange={(e) => update({ system_prompt: e.target.value })}
          placeholder="You are a helpful assistant..."
        />
        <div className="flex flex-wrap gap-1 mt-1">
          {FIELD_TOKENS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => insertToken('system_prompt', t)}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">User Prompt</label>
        <Textarea
          rows={4}
          value={config.user_prompt || ''}
          onChange={(e) => update({ user_prompt: e.target.value })}
          placeholder="Classify this ticket: {{item.title}}..."
        />
        <div className="flex flex-wrap gap-1 mt-1">
          {FIELD_TOKENS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => insertToken('user_prompt', t)}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Store Result In</label>
        <Input
          value={config.result_target || ''}
          onChange={(e) => update({ result_target: e.target.value })}
          placeholder="e.g. ai_classification"
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Path in metadata where AI result is stored
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Result Actions</label>
          <Button variant="ghost" size="sm" onClick={addResultAction}>
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Map AI result fields to entity field updates
        </p>
        {(config.result_actions || []).map((ra, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              className="flex-1 h-8 text-xs font-mono"
              placeholder="result.field"
              value={ra.source}
              onChange={(e) => updateResultAction(idx, { source: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              className="flex-1 h-8 text-xs font-mono"
              placeholder="entity field"
              value={ra.field}
              onChange={(e) => updateResultAction(idx, { field: e.target.value })}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive"
              onClick={() => removeResultAction(idx)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
