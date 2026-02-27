import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const entityType = params.get('entity_type')
    const entityId = params.get('entity_id')

    if (!entityType || !entityId) {
      return error('entity_type and entity_id are required')
    }

    const { data } = await db
      .from('entity_attachments')
      .select('*, uploader:uploaded_by(id, full_name)')
      .eq('account_id', ctx.accountId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })

    // Generate signed URLs for each attachment
    const attachments = await Promise.all(
      (data || []).map(async (att: any) => {
        const { data: urlData } = await db.storage
          .from('attachments')
          .createSignedUrl(att.storage_path, 3600)
        return { ...att, signed_url: urlData?.signedUrl || null }
      }),
    )

    return json(attachments)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      entity_type: string
      entity_id: string
      filename: string
      mime_type?: string
      size_bytes?: number
      metadata?: Record<string, any>
    }>(req)

    if (!body.entity_type || !body.entity_id || !body.filename) {
      return error('entity_type, entity_id, and filename are required')
    }

    // Generate a unique storage path
    const ext = body.filename.split('.').pop() || 'bin'
    const storagePath = `${ctx.accountId}/${body.entity_type}/${body.entity_id}/${crypto.randomUUID()}.${ext}`

    // Create a signed upload URL for the client
    const { data: uploadData, error: uploadErr } = await db.storage
      .from('attachments')
      .createSignedUploadUrl(storagePath)

    if (uploadErr) return error(`Storage error: ${uploadErr.message}`, 500)

    // Record the attachment metadata
    const { data, error: dbErr } = await db
      .from('entity_attachments')
      .insert({
        account_id: ctx.accountId,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        filename: body.filename,
        mime_type: body.mime_type || null,
        size_bytes: body.size_bytes || null,
        storage_path: storagePath,
        uploaded_by: ctx.personId,
        metadata: body.metadata || {},
      })
      .select('*, uploader:uploaded_by(id, full_name)')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'entity_attachment', data.id, null, data)
    await emitActivity(
      ctx,
      'entity_attachment.created',
      `Uploaded "${body.filename}" to ${body.entity_type}`,
      body.entity_type,
      body.entity_id,
      { attachment_id: data.id, filename: body.filename },
    )

    return json({
      ...data,
      upload_url: uploadData?.signedUrl || null,
      upload_token: uploadData?.token || null,
    }, 201)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('entity_attachments')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    // Only the uploader or admins can delete
    if (before.uploaded_by !== ctx.personId && ctx.accountRole !== 'admin') {
      return error('Only the uploader or admins can delete attachments', 403)
    }

    // Delete from storage
    await db.storage.from('attachments').remove([before.storage_path])

    // Delete metadata row
    await db.from('entity_attachments').delete().eq('id', id)

    await emitAudit(ctx, 'delete', 'entity_attachment', id, before, null)
    await emitActivity(
      ctx,
      'entity_attachment.deleted',
      `Deleted "${before.filename}" from ${before.entity_type}`,
      before.entity_type,
      before.entity_id,
    )

    return json({ success: true })
  },
})
