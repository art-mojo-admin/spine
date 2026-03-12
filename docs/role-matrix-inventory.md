# Pack-Aware Role Matrix Inventory & Modeling

This document captures the current entity surface area for per-role visibility/editability controls, metadata gaps, and modeling considerations for draft vs. promoted pack states. It supports Section 1 of the Pack-Aware Role Matrix Plan.

## 1. Entity Catalog

| Entity Type | Table | Account Scope | Pack Scope | Ownership Column | Notes |
|-------------|-------|---------------|------------|------------------|-------|
| workflow_definition | workflow_definitions | `account_id` | `pack_id` | `ownership` | Already has `status`, `is_active`, configs; role policies should map to workflow + pack or tenant clone. |
| stage_definition | stage_definitions | via parent workflow | `pack_id` | `ownership` | Dependent rows; need inheritance from workflow unless overridden. |
| transition_definition | transition_definitions | via parent workflow | `pack_id` | `ownership` | Similar inheritance; capture conditions metadata for editors. |
| workflow_action | workflow_actions | via parent workflow | `pack_id` | `ownership` | Field-level controls mostly target `action_config`. |
| automation_rule | automation_rules | `account_id` | `pack_id` | `ownership` | Includes `workflow_definition_id` FK; policies may link to workflow context. |
| custom_field_definition | custom_field_definitions | `account_id` | `pack_id` | `ownership` | Field-level policies use `field_key`; also includes `section`, `position`. |
| link_type_definition | link_type_definitions | `account_id` | `pack_id` | `ownership` | Includes metadata schema + icon; may need per-role visibility for link creation. |
| entity_link | entity_links | `account_id` | `pack_id` | `ownership` | Represents actual relationship instances; may inherit from definition policies. |
| view_definition | view_definitions | `account_id` | `pack_id` | `ownership` | Already has `min_role`; role matrix should supersede/minimize dual controls. |
| app_definition | app_definitions | `account_id` | `pack_id` | `ownership` | Includes `nav_items` and `min_role`; matrix should surface nav permissions. |
| account_module | account_modules | `account_id` | `pack_id` | `ownership` | Modules gate app bundles; policies determine module visibility per role. |
| custom_action_type | custom_action_types | `account_id` | `pack_id` | `ownership` | Used by automations/actions; role matrix to restrict invocation. |
| thread | threads | `account_id` | `pack_id` | `ownership` | For pack-provided discussion templates; mostly tenant-owned. |
| message | messages | `account_id` | `pack_id` | `ownership` | Rarely controlled directly; may inherit from thread/app. |
| item | items | `account_id` | `pack_id` | `ownership` | Core records (requests/tasks). Policies may need state-aware metadata. |
| entity_link (instance) | entity_links | `account_id` | `pack_id` | `ownership` | Already listed; include because runtime visibility could differ from definition. |
| package_scope | package_scopes | pack-only | `pack_id` | `ownership` (pack) | Connects packs to `auth_scopes`; vital for scope metadata enrichment. |
| account_scope | account_scopes | `account_id` | derived via `source` | `ownership` | Captures tenant enablement of scopes; role matrix should display scope inheritance. |

_Reference sources: migrations `003_workflows.sql`, `006_relationships.sql`, `009_views_apps.sql`, `011_packs.sql`, `029_scope_authorization.sql`, `031_role_matrix_metadata.sql`, and `netlify/functions/config-packs.ts` CLONE sequence._

## 2. Metadata & Column Gaps

1. **Dual visibility/editability JSON vs. legacy columns**
   - Several tables already expose `min_role` (views/apps) or `visibility` (threads/messages). Need guidance on whether to deprecate or synchronize with `role_policies.visibility`.
   - For workflow components (stages/transitions/actions), there is no column describing role-based access; rely entirely on `role_policies` plus structured metadata (e.g., default min role, required scopes).

2. **Template ↔ Tenant Mapping**
   - `role_policies.template_entity_id` requires stable linkage between pack templates and tenant clones. Current `pack_entity_mappings` table provides `template_id` → `cloned_id`; modeling should leverage this mapping when cloning policies or displaying packs.
   - Need explicit metadata on whether a role policy represents a **draft** or **promoted** template. Proposal: extend `role_policies.metadata` with `{ version: 'draft' | 'promoted', promoted_at, promoted_by }`.

3. **Field granularity**
   - `field_role_policies` currently only stores `field_path`. For custom fields, we should standardize on `field_key` to avoid ambiguous nested JSON paths.
   - Need UI-friendly metadata (display label, field type) derived from `custom_field_definitions` or `entity_schema` references; include `metadata` payload with `field_type`, `section`, `options` for quick rendering.

4. **Scope + Action Bindings**
   - Packs can attach `auth_scopes` via `package_scopes`; tenants enable them via `account_scopes`. Role matrix should surface which scopes are implied by each policy. Consider augmenting `role_policies.metadata.assigned_scopes` array.

5. **Audit & Versioning**
   - `role_policies` lacks history columns beyond timestamps. Need an auxiliary `role_policy_versions` table (or event log) to satisfy plan requirements for audit/version stamps when promoting/downgrading permissions.

## 3. Draft vs. Promoted Modeling

- **Pack state inputs**: `pack_activations` differentiates `config_active` (promoted) vs. `test_data_active` (draft installs). However, drafts currently live inside the same tables flagged via `is_test_data`.
- **Proposed modeling**:
  1. Treat pack templates under account `000...001` as canonical source. Each template entity carries `is_test_data` to separate draft vs. production seed data.
  2. Introduce a `packs.promoted_version` + `packs.draft_version` metadata object stored in `config_packs.pack_data` to track version IDs (semver or timestamp) and notes. Role policies inherit the same version tags inside `metadata`.
  3. When a tenant clones a pack, `pack_entity_mappings` should store both template IDs so the role matrix can pivot between current tenant state and the source template (promoted or draft) for delta visualization.

## 4. Outstanding Questions / Next Steps

1. **Entity coverage completeness**: Do we need to include additional entities (knowledge_base_articles, integrations) that also carry `pack_id`/`ownership`? They currently fall outside the `config-packs` CLONE sequence.
2. **Portal roles**: ROLE_RANK defines `portal`, but portal data often lives in `view_definitions` or `app_definitions`. Need clarity on whether portal policies are stored separately or via the same entities.
3. **System-owned packs**: For `config_packs.is_system = true`, should tenants be allowed to override role policies, or only copy? This impacts duplication rules in `role_policies` (maybe enforce `ownership='pack'`).
4. **Test data propagation**: Determine whether test (draft) packs require separate role policies or can share with promoted versions flagged by metadata.

---
**Next**: finalize decisions on metadata extensions and version tracking, then proceed to backend enhancements (exposing pack statuses and mutation endpoints).
