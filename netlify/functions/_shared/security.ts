/**
 * Shared security utilities — SSRF protection, table/field allowlists, input sanitization.
 */

// ── SSRF Protection ───────────────────────────────────────────────────

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254',
])

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^127\./,
  /^0\./,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
  /^::1$/,
]

/**
 * Validates a URL is safe for outbound server-side fetch.
 * Blocks private IPs, metadata endpoints, non-HTTP(S) schemes.
 * Returns the validated URL string or throws an error.
 */
export function validateOutboundUrl(rawUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`)
  }

  // Only allow http and https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Blocked URL scheme: ${parsed.protocol}`)
  }

  // Block known dangerous hostnames
  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`)
  }

  // Block private/link-local IP ranges
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      throw new Error(`Blocked private IP: ${hostname}`)
    }
  }

  // Block AWS/GCP/Azure metadata endpoints via IP or hostname
  if (hostname === '169.254.169.254' || hostname.endsWith('.internal')) {
    throw new Error(`Blocked metadata endpoint: ${hostname}`)
  }

  return parsed.toString()
}

// ── Dynamic Table/Field Allowlists ────────────────────────────────────

const ALLOWED_ENTITY_TABLES = new Set([
  'workflow_items',
  'tickets',
  'knowledge_base_articles',
])

const BLOCKED_FIELDS = new Set([
  'id',
  'account_id',
  'auth_uid',
  'system_role',
  'account_role',
  'api_key',
  'token',
  'signing_secret',
  'created_at',
])

/**
 * Validates that a table name is in the allowlist for dynamic entity operations.
 * Returns the table name or throws.
 */
export function validateEntityTable(table: string | undefined, fallback = 'workflow_items'): string {
  const resolved = table || fallback
  if (!ALLOWED_ENTITY_TABLES.has(resolved)) {
    throw new Error(`Table "${resolved}" is not allowed for dynamic entity operations`)
  }
  return resolved
}

/**
 * Validates that a field name is safe for dynamic update operations.
 * Blocks sensitive/structural fields that should never be set via workflow actions.
 */
export function validateFieldName(field: string): string {
  if (BLOCKED_FIELDS.has(field.toLowerCase())) {
    throw new Error(`Field "${field}" is not allowed for dynamic updates`)
  }
  return field
}

// ── API Key Masking ───────────────────────────────────────────────────

/**
 * Masks an API key for display, showing only the prefix and last 4 characters.
 * e.g. "spn_abc123...ef01"
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) return '****'
  return key.slice(0, 8) + '...' + key.slice(-4)
}
