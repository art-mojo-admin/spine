export interface User {
  id: string
  email: string
  full_name: string
  account_id: string
  account?: Account
  roles: string[] // Simplified for now
  permissions: string[] // Simplified for now
  is_system_admin?: boolean
  accessible_accounts?: Account[]
}

export interface Account {
  id: string
  slug: string
  display_name: string
  name?: string
  account_type?: string
  owner_account_id?: string
  metadata?: Record<string, any>
}

export interface Role {
  id: string
  slug: string
  name: string
  description?: string
  permissions: Permission[]
}

export interface Permission {
  id: string
  resource: string
  action: string
  scope?: string
}

export interface AuthResponse {
  user: User
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  full_name: string
  account_name?: string
}
