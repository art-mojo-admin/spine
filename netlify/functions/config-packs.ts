import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db.from('config_packs').select('*').eq('id', id).single()
      if (!data) return error('Not found', 404)
      return json(data)
    }

    const { data } = await db
      .from('config_packs')
      .select('id, name, description, is_system, created_at')
      .order('name')

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    const action = body.action

    if (action === 'install') {
      // Install a pack into the current account
      const packId = body.pack_id
      if (!packId) return error('pack_id required')

      const { data: pack } = await db.from('config_packs').select('*').eq('id', packId).single()
      if (!pack) return error('Pack not found', 404)

      const packData = pack.pack_data
      const accountId = ctx.accountId!
      const results: string[] = []

      // Install workflows + stages + transitions
      if (packData.workflows) {
        for (const wfDef of packData.workflows) {
          const { data: wf } = await db
            .from('workflow_definitions')
            .insert({
              account_id: accountId,
              name: wfDef.name,
              description: wfDef.description || null,
              config: wfDef.config || {},
              public_config: wfDef.public_config || {},
            })
            .select()
            .single()

          if (!wf) continue
          results.push(`Workflow: ${wf.name}`)

          const stageIdMap: Record<string, string> = {}

          if (wfDef.stages) {
            for (const stageDef of wfDef.stages) {
              const { data: stage } = await db
                .from('stage_definitions')
                .insert({
                  workflow_definition_id: wf.id,
                  name: stageDef.name,
                  description: stageDef.description || null,
                  position: stageDef.position ?? 0,
                  is_initial: stageDef.is_initial || false,
                  is_terminal: stageDef.is_terminal || false,
                  is_public: stageDef.is_public || false,
                  config: stageDef.config || {},
                })
                .select()
                .single()

              if (stage && stageDef._ref) {
                stageIdMap[stageDef._ref] = stage.id
              }
              if (stage) results.push(`  Stage: ${stage.name}`)
            }
          }

          if (wfDef.transitions) {
            for (const transDef of wfDef.transitions) {
              const fromId = stageIdMap[transDef._from_ref] || transDef.from_stage_id
              const toId = stageIdMap[transDef._to_ref] || transDef.to_stage_id
              if (!fromId || !toId) continue

              await db.from('transition_definitions').insert({
                workflow_definition_id: wf.id,
                name: transDef.name,
                from_stage_id: fromId,
                to_stage_id: toId,
                conditions: transDef.conditions || [],
                require_comment: transDef.require_comment || false,
                config: transDef.config || {},
              })
              results.push(`  Transition: ${transDef.name}`)
            }
          }
        }
      }

      // Install custom fields
      if (packData.custom_fields) {
        for (const fieldDef of packData.custom_fields) {
          const { data: existing } = await db
            .from('custom_field_definitions')
            .select('id')
            .eq('account_id', accountId)
            .eq('entity_type', fieldDef.entity_type)
            .eq('field_key', fieldDef.field_key)
            .single()

          if (!existing) {
            await db.from('custom_field_definitions').insert({
              account_id: accountId,
              entity_type: fieldDef.entity_type,
              name: fieldDef.name,
              field_key: fieldDef.field_key,
              field_type: fieldDef.field_type,
              options: fieldDef.options || [],
              required: fieldDef.required || false,
              is_public: fieldDef.is_public || false,
              position: fieldDef.position ?? 0,
            })
            results.push(`Field: ${fieldDef.name} (${fieldDef.entity_type})`)
          }
        }
      }

      // Install link type definitions
      if (packData.link_types) {
        for (const ltDef of packData.link_types) {
          const { data: existing } = await db
            .from('link_type_definitions')
            .select('id')
            .eq('account_id', accountId)
            .eq('slug', ltDef.slug)
            .single()

          if (!existing) {
            await db.from('link_type_definitions').insert({
              account_id: accountId,
              name: ltDef.name,
              slug: ltDef.slug,
              source_entity_type: ltDef.source_entity_type || null,
              target_entity_type: ltDef.target_entity_type || null,
              color: ltDef.color || null,
            })
            results.push(`Link Type: ${ltDef.name}`)
          }
        }
      }

      // Install automation rules
      if (packData.automations) {
        for (const autoDef of packData.automations) {
          await db.from('automation_rules').insert({
            account_id: accountId,
            name: autoDef.name,
            description: autoDef.description || null,
            trigger_event: autoDef.trigger_event,
            conditions: autoDef.conditions || [],
            action_type: autoDef.action_type,
            action_config: autoDef.action_config || {},
            enabled: true,
          })
          results.push(`Automation: ${autoDef.name}`)
        }
      }

      // Install modules
      if (packData.modules) {
        for (const modDef of packData.modules) {
          const { data: existing } = await db
            .from('account_modules')
            .select('id')
            .eq('account_id', accountId)
            .eq('module_slug', modDef.module_slug)
            .single()

          if (!existing) {
            await db.from('account_modules').insert({
              account_id: accountId,
              module_slug: modDef.module_slug,
              label: modDef.label,
              description: modDef.description || null,
              enabled: true,
              config: modDef.config || {},
            })
            results.push(`Module: ${modDef.label}`)
          }
        }
      }

      // Install nav extensions
      if (packData.nav_extensions) {
        for (const navDef of packData.nav_extensions) {
          const { data: existing } = await db
            .from('nav_extensions')
            .select('id')
            .eq('account_id', accountId)
            .eq('label', navDef.label)
            .single()

          if (!existing) {
            await db.from('nav_extensions').insert({
              account_id: accountId,
              label: navDef.label,
              icon: navDef.icon || null,
              url: navDef.url,
              location: navDef.location || 'sidebar',
              position: navDef.position ?? 0,
              min_role: navDef.min_role || 'member',
              module_slug: navDef.module_slug || null,
            })
            results.push(`Nav Extension: ${navDef.label}`)
          }
        }
      }

      await emitActivity(
        ctx,
        'config_pack.installed',
        `Installed config pack "${pack.name}"`,
        'config_pack',
        pack.id,
        { items_created: results.length },
      )

      return json({ success: true, installed: results })
    }

    return error('Unknown action. Use { action: "install", pack_id: "..." }')
  },
})
