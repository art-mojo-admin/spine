# Spine MVP — Task Checklist

## Phase 1: Foundation
- [x] Project scaffolding (package.json, vite, tailwind, postcss, netlify.toml, tsconfig)
- [x] Database migration 001: Extensions (uuid-ossp, pgvector, pg_trgm)
- [x] Database migration 002: Accounts table
- [x] Database migration 003: Persons table
- [x] Database migration 004: Profiles table
- [x] Database migration 005: Memberships table
- [x] Shared API middleware (db client, auth resolver, tenant resolver, RBAC, request_id)
- [x] Audit + activity emit helpers
- [x] API: me, accounts, persons, memberships
- [x] Frontend: Auth (Supabase login/signup)
- [x] Frontend: Shell layout with sidebar navigation
- [x] Frontend: Accounts list/detail
- [x] Frontend: Persons list/detail with membership info

## Phase 2: Audit & Activity
- [x] Database migration 006: audit_log table
- [x] Database migration 007: activity_events table
- [x] Every API write emits audit_log + activity_event
- [x] API: activity-events (GET, filterable)
- [x] API: audit-log (GET, filterable, admin-only)
- [x] Frontend: Activity feed page with filter

## Phase 3: Workflow Engine
- [x] Database migration 008: workflow_definitions + stage_definitions
- [x] Database migration 009: workflow_items + automation_rules
- [x] API: workflow-definitions (CRUD)
- [x] API: stage-definitions (CRUD)
- [x] API: workflow-items (CRUD + stage transition validation)
- [x] Frontend: Workflow definitions list
- [x] Frontend: Workflow items list + kanban view

## Phase 4: Support & Knowledge Base
- [x] Database migration 010: tickets + ticket_messages
- [x] Database migration 011: knowledge_base_articles
- [x] API: tickets (CRUD)
- [x] API: ticket-messages (GET + POST)
- [x] API: kb-articles (CRUD + publish/unpublish)
- [x] Frontend: Tickets list/detail with threaded messages + reply
- [x] Frontend: KB list/editor with publish toggle

## Phase 5: Theming
- [x] Database migration 012: tenant_themes
- [x] API: themes (GET + POST/upsert)
- [x] Frontend: Theme editor with 3 presets (Clean, Bold, Muted)
- [x] Runtime CSS variable injection from DB tokens
- [x] Live preview in theme editor

## Phase 6: Integrations
- [x] Database migration 013: outbox_events, webhook_subscriptions, webhook_deliveries
- [x] API: webhook-subscriptions (CRUD)
- [x] API: webhook-deliveries (GET + replay)
- [x] Scheduled function: webhook-deliver (outbox processing, HMAC signing, retry/backoff, dead-letter)
- [x] Frontend: Webhook subscriptions management
- [x] Frontend: Deliveries list with status + replay action

## Phase 7: Embeddings & Search
- [x] Database migration 014: embeddings table with pgvector index
- [x] API: embeddings upsert (with stub embedder)
- [x] API: semantic search (scoped by tenant + entity_type + vector_type)

## Phase 8: Polish & Docs
- [x] Seed data (tenant, users, workflows, tickets, KB article, theme)
- [x] .env.example
- [x] .gitignore
- [x] README.md (setup, env vars, local dev, architecture)
- [x] planning.md (decisions, tenancy, RBAC model)
- [x] API.md (endpoint list + examples)
- [x] task.md (this file)
- [x] npm install verified
