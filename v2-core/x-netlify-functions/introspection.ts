import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Get schema metadata
export const getSchemaMetadata = createHandler(async (ctx, body) => {
  const { schema_name, object_type, object_name, include_deprecated } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('v2_get_schema_metadata', {
      schema_name,
      object_type,
      object_name,
      include_deprecated: include_deprecated === 'true'
    })

  if (err) throw err
  return data
})

// Update schema metadata
export const updateSchemaMetadata = requireAuth(createHandler(async (ctx, body) => {
  const { schema_name, object_type, object_name, display_name, description, object_definition, field_definitions, relationships, permissions, tags, is_public, is_deprecated, metadata } = body

  if (!schema_name || !object_type || !object_name) {
    throw new Error('schema_name, object_type, and object_name are required')
  }

  const { data, error: err } = await db
    .rpc('update_schema_metadata', {
      schema_name,
      object_type,
      object_name,
      display_name,
      description,
      object_definition,
      field_definitions,
      relationships,
      permissions,
      tags,
      is_public,
      is_deprecated,
      metadata
    })

  if (err) throw err

  await emitLog(ctx, 'schema_metadata.updated', 
    { type: 'schema_metadata', id: `${schema_name}.${object_type}.${object_name}` }, 
    { after: { display_name, is_public } }
  )

  return { success: data }
}))

// Get API endpoints
export const getApiEndpoints = createHandler(async (ctx, body) => {
  const { path, method, handler_function, include_deprecated, include_private } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('v2_get_api_endpoints', {
      path,
      method,
      handler_function,
      include_deprecated: include_deprecated === 'true',
      include_private: include_private === 'true'
    })

  if (err) throw err
  return data
})

// Generate OpenAPI specification
export const generateOpenApiSpec = createHandler(async (ctx, body) => {
  const { base_url, version } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('v2_generate_openapi_spec', {
      base_url: base_url || 'https://api.spine.dev',
      version: version || 'v1'
    })

  if (err) throw err
  return data
})

// Get database schema
export const getDatabaseSchema = createHandler(async (ctx, body) => {
  const { schema_name } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('v2_get_database_schema', {
      schema_name: schema_name || 'v2'
    })

  if (err) throw err
  return data
})

// Get function metadata
export const getFunctionMetadata = createHandler(async (ctx, body) => {
  const { schema_name } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('v2_get_function_metadata', {
      schema_name: schema_name || 'v2'
    })

  if (err) throw err
  return data
})

// Validate API documentation
export const validateApiDocumentation = createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .rpc('v2_validate_api_documentation')

  if (err) throw err
  return data
})

// Sync database schema to metadata
export const syncSchemaMetadata = requireAuth(createHandler(async (ctx, body) => {
  const { schema_name } = body

  const { data, error: err } = await db
    .rpc('v2_sync_schema_metadata', {
      schema_name: schema_name || 'v2'
    })

  if (err) throw err

  await emitLog(ctx, 'schema_metadata.synced', 
    { type: 'system', id: 'schema_sync' }, 
    { after: { schema_name: schema_name || 'v2', synced_count: data[0]?.synced_count } }
  )

  return data
}))

// Get system overview
export const getSystemOverview = createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .rpc('v2_get_system_overview')

  if (err) throw err
  return data
})

// Validate advanced features
export const validateAdvancedFeatures = createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .rpc('v2_validate_advanced_features')

  if (err) throw err
  return data
})

// Get advanced features health
export const getAdvancedFeaturesHealth = createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .rpc('v2_get_advanced_features_health')

  if (err) throw err
  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'schema':
      if (method === 'GET') {
        return await getSchemaMetadata(ctx, body)
      } else if (method === 'PATCH') {
        return await updateSchemaMetadata(ctx, body)
      }
      break
    case 'endpoints':
      if (method === 'GET') {
        return await getApiEndpoints(ctx, body)
      }
      break
    case 'openapi':
      if (method === 'GET') {
        return await generateOpenApiSpec(ctx, body)
      }
      break
    case 'database':
      if (method === 'GET') {
        return await getDatabaseSchema(ctx, body)
      }
      break
    case 'functions':
      if (method === 'GET') {
        return await getFunctionMetadata(ctx, body)
      }
      break
    case 'validate-api':
      if (method === 'GET') {
        return await validateApiDocumentation(ctx, body)
      }
      break
    case 'sync':
      if (method === 'POST') {
        return await syncSchemaMetadata(ctx, body)
      }
      break
    case 'overview':
      if (method === 'GET') {
        return await getSystemOverview(ctx, body)
      }
      break
    case 'validate-features':
      if (method === 'GET') {
        return await validateAdvancedFeatures(ctx, body)
      }
      break
    case 'health':
      if (method === 'GET') {
        return await getAdvancedFeaturesHealth(ctx, body)
      }
      break
    default:
      if (method === 'GET') {
        return await getSystemOverview(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
