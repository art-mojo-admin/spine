import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { callAI, interpolateTemplate } from './_shared/workflow-engine'

export default createHandler({
  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      system_prompt?: string
      user_prompt: string
      model?: string
      context?: Record<string, any>
    }>(req)

    if (!body.user_prompt) return error('user_prompt required')

    const context = body.context || {}
    const systemPrompt = body.system_prompt
      ? interpolateTemplate(body.system_prompt, context)
      : undefined
    const userPrompt = interpolateTemplate(body.user_prompt, context)

    try {
      const result = await callAI(systemPrompt, userPrompt, body.model)
      return json({ result, model: body.model || 'gpt-4o-mini' })
    } catch (err: any) {
      return error(err.message || 'AI invocation failed', 500)
    }
  },
})
