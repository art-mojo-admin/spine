# Spine — AI & Embeddings

Spine includes multi-vector semantic storage via pgvector, auto-embedding on write, semantic search, and AI-powered workflow actions.

---

## Embeddings

### Architecture

```
Entity write (KB article, item, etc.)
      │
      ▼  autoEmbed()
OpenAI text-embedding-3-small (or stub fallback)
      │
      ▼  1536-dimension vector
embeddings table (pgvector)
      │
      ▼  Semantic search query
Ranked results by cosine similarity
```

### Storage

Embeddings are stored in the `embeddings` table using pgvector's `vector(1536)` type:

| Column | Description |
|---|---|
| `account_id` | Tenant scope |
| `entity_type` | e.g., `'item'` |
| `entity_id` | The source entity |
| `vector_type` | e.g., `'content'`, `'title'` |
| `embedding` | 1536-dimension vector |
| `model` | Model used (e.g., `'text-embedding-3-small'` or `'stub-embedder'`) |
| `metadata` | Additional context |

Unique constraint: `(account_id, entity_type, entity_id, vector_type)` — upsert on conflict.

### Auto-Embedding

The `autoEmbed()` function is called automatically when certain entities are created or updated:

```typescript
// In workflow-items.ts POST handler:
await autoEmbed(ctx.accountId!, 'item', item.id, item.title)
```

### Embedding Pipeline

```typescript
// core/functions/_shared/embed.ts

async function autoEmbed(
  accountId: string,
  entityType: string,
  entityId: string,
  content: string,
  metadata: Record<string, any> = {},
): Promise<void> {
  if (!content?.trim()) return

  const { embedding, model } = await getEmbedding(content)

  await db.from('embeddings').upsert({
    account_id: accountId,
    entity_type: entityType,
    entity_id: entityId,
    vector_type: 'content',
    embedding: JSON.stringify(embedding),
    metadata,
    model,
  }, {
    onConflict: 'account_id,entity_type,entity_id,vector_type',
  })
}
```

### Model Selection

| Condition | Model | Dimensions |
|---|---|---|
| `OPENAI_API_KEY` set | `text-embedding-3-small` | 1536 |
| No API key | `stub-embedder` (deterministic hash) | 1536 |

The stub embedder generates a deterministic vector from the input text. It's useful for development but produces meaningless similarity scores.

---

## Semantic Search

### API

```
POST /api/embeddings?action=search
{
  "query": "how to reset password",
  "entity_type": "item",
  "vector_type": "content",
  "limit": 10
}
```

### Flow

1. Embed the query text using the same model
2. Find the nearest vectors using cosine similarity (`<=>` operator in pgvector)
3. Return ranked results with similarity scores

### Response

```json
[
  {
    "entity_type": "item",
    "entity_id": "uuid",
    "similarity": 0.87,
    "metadata": { "title": "Password Reset Guide" }
  },
  ...
]
```

### Manual Embedding

You can also manually create/update embeddings:

```
POST /api/embeddings
{
  "entity_type": "item",
  "entity_id": "uuid",
  "vector_type": "content",
  "content": "Text to embed",
  "metadata": { "title": "My Article" }
}
```

Or provide a pre-computed embedding:

```
POST /api/embeddings
{
  "entity_type": "item",
  "entity_id": "uuid",
  "vector_type": "title",
  "embedding": [0.1, 0.2, ...],
  "model": "custom-model"
}
```

---

## AI Prompt Action

The `ai_prompt` action type is available in workflow actions and scheduled triggers.

### Configuration

```json
{
  "action_type": "ai_prompt",
  "action_config": {
    "system_prompt": "You are a deal scoring assistant for a sales team.",
    "user_prompt": "Score this deal on a 1-100 scale:\nTitle: {{title}}\nAmount: ${{metadata.amount}}\nCompany: {{metadata.company}}",
    "model": "gpt-4o-mini",
    "result_target": "ai_score",
    "entity_table": "items",
    "result_actions": [
      { "type": "update_field", "field": "priority", "source": "priority" },
      { "type": "update_field", "field": "metadata", "source": "tags" }
    ]
  }
}
```

### Fields

| Field | Description |
|---|---|
| `system_prompt` | System message for the AI (supports `{{}}` templates) |
| `user_prompt` | User message (supports `{{}}` templates) — **required** |
| `model` | OpenAI model (default: `gpt-4o-mini`) |
| `result_target` | Key to store the result in entity `metadata` |
| `entity_table` | Which table to update (default: `items`) |
| `result_actions` | Array of follow-up actions based on structured AI output |

### Execution

1. Interpolate templates in prompts using the trigger payload
2. Call OpenAI `chat/completions` API
3. Parse the response (try JSON first, fall back to raw string)
4. If `result_target` is set: store in entity's `metadata[result_target]`
5. If `result_actions` is set: extract values from the AI's JSON response and update entity fields

### Result Actions

If the AI returns structured JSON (e.g., `{ "priority": "high", "tags": ["urgent", "vip"] }`), `result_actions` can extract and apply values:

```json
{
  "result_actions": [
    { "type": "update_field", "field": "priority", "source": "priority" },
    { "type": "update_field", "field": "status", "source": "recommended_status" }
  ]
}
```

Each result action:
- `type`: currently only `"update_field"` is supported
- `field`: the database column to update
- `source`: the key in the AI's JSON response to read from

### Security

- Fields are validated against the blocked list (can't update `id`, `account_id`, etc.)
- Tables are validated against the allowed list (`items`, `threads`, `entity_links`)
- API calls have a 30-second timeout
- Requires `OPENAI_API_KEY` environment variable

---

## AI Invoke Endpoint

A standalone endpoint for ad-hoc AI calls:

```
POST /api/ai-invoke
{
  "system_prompt": "You are a helpful assistant.",
  "user_prompt": "Summarize this ticket: ...",
  "model": "gpt-4o-mini"
}
```

Returns the AI response directly. Requires authentication.

---

## Search UI

The Search page (`/search`) provides a unified search interface:

- Text search across items, KB articles, persons
- Semantic search using embeddings (when available)
- Results ranked by relevance
- Filter by entity type

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | No | Enables real embeddings and AI actions |

Without the API key:
- Embeddings use the stub model (deterministic but meaningless similarity)
- AI prompt actions fail with "No OPENAI_API_KEY"
- The search page still works for text-based search

### Embedding Model

Currently hardcoded to `text-embedding-3-small` with 1536 dimensions. To change the model, modify `core/functions/_shared/embed.ts` (or create an override in `custom/functions/_shared/`).

---

## Extending

### Custom Embedding Triggers

To auto-embed custom entity types, call `autoEmbed()` in your custom function:

```typescript
import { autoEmbed } from '../../netlify/functions/_shared/embed'

// After creating/updating your entity:
await autoEmbed(ctx.accountId!, 'my_entity', entity.id, entity.content)
```

### Multiple Vector Types

You can store multiple embeddings per entity using different `vector_type` values:

```typescript
await autoEmbed(accountId, 'item', itemId, item.title, { field: 'title' })
// vector_type defaults to 'content', but you can call the embeddings API directly for other types
```

### Custom AI Actions

For complex AI workflows, create a custom action type that calls your own AI service:

```json
{
  "slug": "custom-ai-analysis",
  "handler_url": "https://your-service.com/analyze",
  "config_schema": {
    "analysis_type": { "type": "string", "required": true }
  }
}
```

---

## Related Documentation

- [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md) — AI prompt action in workflow context
- [AUTOMATION.md](AUTOMATION.md) — AI actions in scheduled triggers
- [EXTENDING.md](EXTENDING.md) — Custom action types
- [ENVIRONMENT.md](ENVIRONMENT.md) — OPENAI_API_KEY configuration
