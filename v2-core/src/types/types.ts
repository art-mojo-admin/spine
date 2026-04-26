export interface FieldDefinition {
  data_type: 'text' | 'textarea' | 'rich_text' | 'email' | 'phone' | 'url' | 
             'number' | 'currency' | 'range' | 'date' | 'datetime' | 'boolean' | 
             'checkbox' | 'select' | 'multiselect' | 'radio' | 'color' | 
             'file' | 'image' | 'json' | 'reference' | 'address'
  label: string
  required: boolean
  system?: boolean // true = DB column, false/absent = custom field in .data
  // Runtime identity — populated by SchemaFields when building field arrays from schema
  name?: string
  // UI hints — informational only, do not affect data contract or permissions
  placeholder?: string
  description?: string
  rows?: number
  min?: number
  max?: number
  step?: number
  readonly?: boolean
  disabled?: boolean
  validation?: {
    pattern?: string
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    step?: number
    integer?: boolean
    precision?: number
    maxSize?: number
    allowedTypes?: string[]
    maxWidth?: number
    maxHeight?: number
    currency_code?: string
    reference_kind?: string
    reference_type?: string
  }
  // Type-specific constraint properties (move out of validation for clarity)
  options?: (string | { value: string; label: string })[] // For select/multiselect/radio
  permissions?: {
    [role: string]: string[] // Array of actions: ["read", "write"]
  }
}

export interface ViewFieldConfig {
  display_type: 'input' | 'textarea' | 'rich_text' | 'select' | 'multiselect' | 
                 'radio' | 'checkbox' | 'switch' | 'date_picker' | 'datetime_picker' | 
                 'color_picker' | 'file_upload' | 'image_upload' | 'range_slider' | 
                 'rating' | 'autocomplete' | 'address_form' | 'reference_picker' |
                 'text' | 'badge' | 'timestamp' | 'currency' | 'number'
  sortable?: boolean
  searchable?: boolean
}

export interface ListView {
  type: 'list'
  display: 'table' | 'card' | 'board'
  label: string
  fields: Record<string, ViewFieldConfig>
  default_sort?: {
    field: string
    direction: 'asc' | 'desc'
  }
  filters?: string[]
  stats?: Array<{
    title: string
    type: 'count' | 'filter_count'
    icon?: string
    color?: string
    filter?: Record<string, any>
  }>
  group_by?: string // For board display
}

export interface DetailViewSection {
  title: string
  fields: Record<string, ViewFieldConfig>
  // Note: No view-level permissions - field permissions from schema apply
}

export interface DetailView {
  type: 'detail'
  label: string
  sections: DetailViewSection[]
}

export type View = ListView | DetailView

export interface FunctionalityBindings {
  pipelines?: Array<{
    pipeline_id: string
    trigger: 'manual' | 'on_create' | 'on_update' | 'on_field_change' | 'on_delete' | 'scheduled'
    field?: string // For on_field_change
    condition?: string // Expression string
    roles: string[]
  }>
  ai_agents?: Array<{
    agent_id: string
    capabilities: ('read' | 'summarize' | 'suggest' | 'update')[]
    trigger: 'manual' | 'on_create' | 'on_update' | 'on_field_change'
    roles: string[]
  }>
  embeddings?: Array<{
    slug: string
    fields: string[]
    model: string
    vector_column: string
    trigger: 'on_create' | 'on_update' | 'on_create_or_update'
  }>
  integrations?: Array<{
    integration_id: string
    sync: 'bidirectional' | 'inbound' | 'outbound'
    field_map: Record<string, {
      external_field: string
      direction: 'both' | 'inbound' | 'outbound' | 'none'
      transform?: string
    }>
    trigger: 'on_create' | 'on_update' | 'on_create_or_update'
  }>
  constraints?: Array<{
    type: 'unique' | 'conditional_required' | 'immutable'
    fields?: string[] // For unique
    field?: string // For conditional_required and immutable
    condition?: string // For conditional_required
    message: string
    after?: 'create' | 'update' // For immutable
  }>
}

export interface DesignSchema {
  record_permissions: {
    [role: string]: string[] // Array of actions: ["create", "read", "update", "delete"]
  }
  fields: Record<string, FieldDefinition>
  views: Record<string, View>
  functionality?: FunctionalityBindings
}

export interface ItemType {
  id: string
  name: string
  slug: string
  kind: string
  description?: string
  icon?: string
  color?: string
  design_schema: DesignSchema
  validation_schema: {
    fields: Record<string, {
      data_type: string
      required?: boolean
      [key: string]: any // Type-specific validation properties
    }>
  }
  ownership: string
  is_active: boolean
  app_id?: string
  app?: any
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  item_type_id: string
  item_type_slug?: string
  title: string
  description?: string
  status: string
  is_active: boolean
  data: Record<string, any>
  created_at: string
  updated_at: string
  created_by?: string
  account_id: string
  app_id?: string
  design_schema?: Record<string, any> // Schema snapshot at creation time
  validation_schema?: Record<string, any> // Validation schema snapshot at creation time
}

export interface ValidationError {
  field: string
  message: string
}

export interface FormState {
  data: Record<string, any>
  errors: Record<string, string>
  touched: Record<string, boolean>
  isSubmitting: boolean
  isValid: boolean
}

export interface PaginationParams {
  limit?: number
  offset?: number
  page?: number
}

export interface SortParams {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilterParams {
  [key: string]: any
}

export interface SearchParams extends PaginationParams {
  search?: string
  sort?: SortParams
  filters?: FilterParams
}

export interface EntityColumn {
  key: string
  label: string
  sortable?: boolean
  type?: string
  display_type?: string
  badgeColors?: Record<string, string>
  maxLength?: number
}

export interface EntityStat {
  title: string
  type: 'count' | 'filter_count'
  icon: string
  color: string
  filter?: Record<string, any>
}

export interface EntityFilter {
  key: string
  label: string
  type: 'search' | 'enum' | 'boolean'
  options?: string[]
}
