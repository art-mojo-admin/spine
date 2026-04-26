import React from 'react'
import { FieldDefinition } from '../../types/types'
import { FieldRenderer } from '../shared/FieldRenderer'
import { Button } from './Button'
import { cn } from '../../lib/utils'

interface FormProps {
  fields: FieldDefinition[]
  data: Record<string, any>
  errors: Record<string, string>
  touched: Record<string, boolean>
  onChange: (field: string, value: any) => void
  onBlur?: (field: string) => void
  onSubmit?: (e: React.FormEvent) => void
  isSubmitting?: boolean
  submitText?: string
  cancelText?: string
  onCancel?: () => void
  showCancel?: boolean
  disabled?: boolean
  className?: string
}

export function Form({
  fields,
  data,
  errors,
  touched,
  onChange,
  onBlur,
  onSubmit,
  isSubmitting = false,
  submitText = 'Submit',
  cancelText = 'Cancel',
  onCancel,
  showCancel = false,
  disabled = false,
  className
}: FormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(e)
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    onChange(fieldName, value)
  }

  const handleFieldBlur = (fieldName: string) => {
    onBlur?.(fieldName)
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {fields.filter(f => !!f.name).map((field) => {
        const name = field.name!
        return (
          <FieldRenderer
            key={name}
            field={field}
            value={data[name]}
            onChange={(value) => handleFieldChange(name, value)}
            error={touched[name] ? errors[name] : undefined}
            onBlur={() => handleFieldBlur(name)}
            readonly={disabled}
          />
        )
      })}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        {showCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelText}
          </Button>
        )}
        
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={disabled}
        >
          {submitText}
        </Button>
      </div>
    </form>
  )
}

interface FormFieldProps {
  field: FieldDefinition
  value: any
  error?: string
  touched?: boolean
  onChange: (value: any) => void
  onBlur?: () => void
  readonly?: boolean
}

export function FormField({
  field,
  value,
  error,
  touched,
  onChange,
  onBlur,
  readonly = false
}: FormFieldProps) {
  return (
    <FieldRenderer
      field={field}
      value={value}
      onChange={onChange}
      error={touched ? error : undefined}
      onBlur={onBlur}
      readonly={readonly}
    />
  )
}

interface FormSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div>
          {title && (
            <h3 className="text-lg font-medium text-slate-900">{title}</h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

interface FormRowProps {
  children: React.ReactNode
  className?: string
}

export function FormRow({ children, className }: FormRowProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', className)}>
      {children}
    </div>
  )
}

interface FormColumnProps {
  children: React.ReactNode
  span?: 1 | 2
  className?: string
}

export function FormColumn({ children, span = 1, className }: FormColumnProps) {
  const spanClasses = {
    1: 'col-span-1',
    2: 'col-span-2'
  }

  return (
    <div className={cn(spanClasses[span], className)}>
      {children}
    </div>
  )
}
