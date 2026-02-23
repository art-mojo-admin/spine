import { db } from './db'

function stubEmbed(text: string): number[] {
  const vec = new Array(1536).fill(0)
  for (let i = 0; i < text.length && i < 1536; i++) {
    vec[i] = (text.charCodeAt(i) % 100) / 100
  }
  return vec
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
    const embedding = stubEmbed(content)

    await db
      .from('embeddings')
      .upsert({
        account_id: accountId,
        entity_type: entityType,
        entity_id: entityId,
        vector_type: 'content',
        embedding: JSON.stringify(embedding),
        metadata,
        model: 'stub-embedder',
      }, {
        onConflict: 'account_id,entity_type,entity_id,vector_type',
      })

    console.log(`[embed] Indexed ${entityType}/${entityId}`)
  } catch (err: any) {
    console.error(`[embed] Failed to index ${entityType}/${entityId}:`, err.message)
  }
}
