import { useMemo } from 'react'
import { marked } from 'marked'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectNative } from '@/components/ui/select-native'
import { RichTextEditor } from '@/components/shared/RichTextEditor'

interface EditableFieldProps {
  label: string
  value: string | undefined | null
  editing: boolean
  onChange?: (value: string) => void
  type?: 'text' | 'textarea' | 'select' | 'date' | 'richtext'
  options?: { value: string; label: string }[]
  placeholder?: string
  mono?: boolean
  required?: boolean
}

export function EditableField({
  label,
  value,
  editing,
  onChange,
  type = 'text',
  options,
  placeholder,
  mono,
  required,
}: EditableFieldProps) {
  const renderedHtml = useMemo(() => {
    if (type === 'richtext' && value) {
      return marked.parse(value, { async: false }) as string
    }
    return ''
  }, [type, value])

  if (!editing) {
    return (
      <div>
        <dt className="text-muted-foreground text-sm">{label}</dt>
        {type === 'richtext' && value ? (
          <dd
            className="mt-0.5 prose prose-sm max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <dd className={`mt-0.5 ${mono ? 'font-mono text-xs break-all' : 'text-sm'}`}>
            {value || '—'}
          </dd>
        )}
      </div>
    )
  }

  return (
    <div>
      <label className="text-muted-foreground text-sm block mb-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {type === 'richtext' ? (
        <RichTextEditor
          value={value || ''}
          onChange={(html) => onChange?.(html)}
          placeholder={placeholder}
        />
      ) : type === 'textarea' ? (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          rows={4}
        />
      ) : type === 'select' && options ? (
        <SelectNative
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          options={options}
          placeholder={placeholder}
        />
      ) : type === 'date' ? (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : (
        <Input
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          required={required}
        />
      )}
    </div>
  )
}
