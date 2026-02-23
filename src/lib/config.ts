// Centralised app branding — driven by VITE_APP_NAME env var.
// Import this wherever you need the app name or derived strings.

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Spine'

// localStorage key prefix (lowercase, dot-separated)
export const STORAGE_PREFIX = APP_NAME.toLowerCase().replace(/\s+/g, '-')

// Webhook header prefix (e.g. X-Spine-Signature)
export const WEBHOOK_HEADER_PREFIX = `X-${APP_NAME.replace(/\s+/g, '-')}`
