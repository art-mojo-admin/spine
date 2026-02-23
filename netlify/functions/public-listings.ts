import type { Context } from '@netlify/functions'
import { db } from './_shared/db'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS })
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: CORS_HEADERS })
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405)
  }

  const url = new URL(req.url)
  const params = url.searchParams
  const accountSlug = params.get('account_slug')

  if (!accountSlug) {
    return errorResponse('account_slug is required')
  }

  try {
    // Resolve account by slug
    const { data: account } = await db
      .from('accounts')
      .select('id, display_name, slug, settings')
      .eq('slug', accountSlug)
      .eq('status', 'active')
      .single()

    if (!account) {
      return errorResponse('Account not found', 404)
    }

    const workflowId = params.get('workflow_id')
    const itemId = params.get('item_id')

    // Single item detail
    if (itemId) {
      return await getPublicItem(account.id, itemId)
    }

    // Workflow item listing
    if (workflowId) {
      return await getPublicItems(account.id, workflowId, params)
    }

    // Account overview: list public-enabled workflows
    return await getPublicWorkflows(account)
  } catch (err: any) {
    console.error('[public-listings] Error:', err.message)
    return errorResponse('Internal server error', 500)
  }
}

async function getPublicWorkflows(account: any) {
  const { data: workflows } = await db
    .from('workflow_definitions')
    .select('id, name, description, public_config')
    .eq('account_id', account.id)
    .eq('status', 'active')

  const publicWorkflows = (workflows || []).filter(
    (w: any) => w.public_config?.enabled === true,
  )

  // Get item counts for each public workflow
  const result = []
  for (const wf of publicWorkflows) {
    // Get public stage IDs
    const { data: publicStages } = await db
      .from('stage_definitions')
      .select('id')
      .eq('workflow_definition_id', wf.id)
      .eq('is_public', true)

    const stageIds = (publicStages || []).map((s: any) => s.id)
    let itemCount = 0

    if (stageIds.length > 0) {
      const { count } = await db
        .from('workflow_items')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', account.id)
        .eq('workflow_definition_id', wf.id)
        .in('stage_definition_id', stageIds)

      itemCount = count || 0
    }

    result.push({
      id: wf.id,
      name: wf.public_config?.listing_title || wf.name,
      description: wf.description,
      item_count: itemCount,
    })
  }

  return jsonResponse({
    account: {
      display_name: account.display_name,
      slug: account.slug,
    },
    workflows: result,
  })
}

async function getPublicItems(accountId: string, workflowId: string, params: URLSearchParams) {
  // Verify workflow is public
  const { data: workflow } = await db
    .from('workflow_definitions')
    .select('id, name, description, public_config')
    .eq('id', workflowId)
    .eq('account_id', accountId)
    .eq('status', 'active')
    .single()

  if (!workflow || workflow.public_config?.enabled !== true) {
    return errorResponse('Workflow not found or not public', 404)
  }

  // Get public stages
  const { data: publicStages } = await db
    .from('stage_definitions')
    .select('id, name')
    .eq('workflow_definition_id', workflowId)
    .eq('is_public', true)

  const stageIds = (publicStages || []).map((s: any) => s.id)
  if (stageIds.length === 0) {
    return jsonResponse({ workflow: { id: workflow.id, name: workflow.public_config?.listing_title || workflow.name }, items: [] })
  }

  // Get public custom fields for this entity type
  const { data: publicFields } = await db
    .from('custom_field_definitions')
    .select('field_key, name, field_type')
    .eq('account_id', accountId)
    .eq('entity_type', 'workflow_item')
    .eq('is_public', true)
    .eq('enabled', true)

  // Fetch items in public stages
  const limit = Math.min(parseInt(params.get('limit') || '50', 10), 100)
  const offset = parseInt(params.get('offset') || '0', 10)

  const { data: items } = await db
    .from('workflow_items')
    .select('id, title, description, priority, due_date, metadata, created_at, stage_definition_id')
    .eq('account_id', accountId)
    .eq('workflow_definition_id', workflowId)
    .in('stage_definition_id', stageIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Filter visible fields based on public_config
  const visibleFields = workflow.public_config?.visible_fields || ['title', 'description']
  const stageMap = Object.fromEntries((publicStages || []).map((s: any) => [s.id, s.name]))

  const sanitizedItems = (items || []).map((item: any) => {
    const result: Record<string, any> = { id: item.id }

    if (visibleFields.includes('title')) result.title = item.title
    if (visibleFields.includes('description')) result.description = item.description
    if (visibleFields.includes('priority')) result.priority = item.priority
    if (visibleFields.includes('due_date')) result.due_date = item.due_date
    if (visibleFields.includes('created_at')) result.created_at = item.created_at

    result.stage = stageMap[item.stage_definition_id] || null

    // Include public custom fields from metadata
    if (publicFields && publicFields.length > 0 && item.metadata) {
      result.custom_fields = {}
      for (const field of publicFields) {
        if (item.metadata[field.field_key] !== undefined) {
          result.custom_fields[field.field_key] = {
            label: field.name,
            value: item.metadata[field.field_key],
          }
        }
      }
    }

    return result
  })

  return jsonResponse({
    workflow: {
      id: workflow.id,
      name: workflow.public_config?.listing_title || workflow.name,
      description: workflow.description,
    },
    stages: publicStages,
    items: sanitizedItems,
    total: sanitizedItems.length,
  })
}

async function getPublicItem(accountId: string, itemId: string) {
  const { data: item } = await db
    .from('workflow_items')
    .select('*, stage_definitions(id, name, is_public), workflow_definitions(id, name, public_config)')
    .eq('id', itemId)
    .eq('account_id', accountId)
    .single()

  if (!item) return errorResponse('Item not found', 404)

  // Verify the item is in a public stage and the workflow is public
  if (!item.stage_definitions?.is_public) {
    return errorResponse('Item not found', 404)
  }
  if (item.workflow_definitions?.public_config?.enabled !== true) {
    return errorResponse('Item not found', 404)
  }

  const visibleFields = item.workflow_definitions.public_config?.visible_fields || ['title', 'description']

  // Get public custom fields
  const { data: publicFields } = await db
    .from('custom_field_definitions')
    .select('field_key, name, field_type')
    .eq('account_id', accountId)
    .eq('entity_type', 'workflow_item')
    .eq('is_public', true)
    .eq('enabled', true)

  const result: Record<string, any> = {
    id: item.id,
    stage: item.stage_definitions?.name,
    workflow: item.workflow_definitions?.name,
  }

  if (visibleFields.includes('title')) result.title = item.title
  if (visibleFields.includes('description')) result.description = item.description
  if (visibleFields.includes('priority')) result.priority = item.priority
  if (visibleFields.includes('due_date')) result.due_date = item.due_date
  if (visibleFields.includes('created_at')) result.created_at = item.created_at

  if (publicFields && publicFields.length > 0 && item.metadata) {
    result.custom_fields = {}
    for (const field of publicFields) {
      if (item.metadata[field.field_key] !== undefined) {
        result.custom_fields[field.field_key] = {
          label: field.name,
          value: item.metadata[field.field_key],
        }
      }
    }
  }

  return jsonResponse(result)
}
