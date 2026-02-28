import { db } from './db'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const EMBED_MODEL = 'text-embedding-3-small'
const EMBED_DIMENSIONS = 1536

function stubEmbed(text: string): number[] {
  const vec = new Array(EMBED_DIMENSIONS).fill(0)
  for (let i = 0; i < text.length && i < EMBED_DIMENSIONS; i++) {
    vec[i] = (text.charCodeAt(i) % 100) / 100
  }
  return vec
}

async function openaiEmbed(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text.slice(0, 8000),
      dimensions: EMBED_DIMENSIONS,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI embeddings API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.data[0].embedding
}

async function getEmbedding(text: string): Promise<{ embedding: number[]; model: string }> {
  if (OPENAI_API_KEY) {
    try {
      const embedding = await openaiEmbed(text)
      return { embedding, model: EMBED_MODEL }
    } catch (err: any) {
      console.warn(`[embed] OpenAI failed, falling back to stub: ${err.message}`)
    }
  }
  return { embedding: stubEmbed(text), model: 'stub-embedder' }
}

export async function autoEmbed(
  accountId: string,
  entityType: string,
  entityId: string,
  content: string,
  metadata: Record<string, any> = {},
): Promise<void> {
  if (!content?.trim()) return

  try {
    const { embedding, model } = await getEmbedding(content)

    await db
      .from('embeddings')
      .upsert({
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

    console.log(`[embed] Indexed ${entityType}/${entityId} via ${model}`)
  } catch (err: any) {
    console.error(`[embed] Failed to index ${entityType}/${entityId}:`, err.message)
  }
}

export { getEmbedding }
