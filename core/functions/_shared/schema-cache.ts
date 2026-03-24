/**
 * Schema Cache for Performance Optimization
 * Caches item type schemas to reduce database lookups
 */

import { db } from './db'
import type { ItemTypeSchema } from './items-dal'

interface CacheEntry {
  schema: ItemTypeSchema
  timestamp: number
  ttl: number
}

class SchemaCache {
  private cache = new Map<string, CacheEntry>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000

  /**
   * Get schema from cache or database
   */
  async getItemTypeSchema(itemType: string): Promise<ItemTypeSchema | null> {
    const cacheKey = `item_type:${itemType}`
    
    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && this.isValid(cached)) {
      return cached.schema
    }

    // Cache miss or expired, fetch from database
    try {
      const { data } = await db
        .from('item_type_registry')
        .select('schema')
        .eq('slug', itemType)
        .single()

      if (!data?.schema) {
        return null
      }

      const schema: ItemTypeSchema = data.schema
      
      // Cache the result
      this.set(cacheKey, schema)
      
      return schema
    } catch (error) {
      console.error(`Failed to fetch schema for ${itemType}:`, error)
      return null
    }
  }

  /**
   * Get multiple schemas in parallel
   */
  async getItemTypeSchemas(itemTypes: string[]): Promise<Map<string, ItemTypeSchema | null>> {
    const results = new Map<string, ItemTypeSchema | null>()
    const uncachedTypes: string[] = []

    // Check cache for each type
    for (const itemType of itemTypes) {
      const cacheKey = `item_type:${itemType}`
      const cached = this.cache.get(cacheKey)
      
      if (cached && this.isValid(cached)) {
        results.set(itemType, cached.schema)
      } else {
        uncachedTypes.push(itemType)
      }
    }

    // Fetch uncached types in parallel
    if (uncachedTypes.length > 0) {
      try {
        const { data } = await db
          .from('item_type_registry')
          .select('slug, schema')
          .in('slug', uncachedTypes)

        if (data) {
          for (const row of data) {
            const schema: ItemTypeSchema = row.schema
            results.set(row.slug, schema)
            
            // Cache the result
            this.set(`item_type:${row.slug}`, schema)
          }
        }

        // Set null for types that weren't found
        for (const itemType of uncachedTypes) {
          if (!results.has(itemType)) {
            results.set(itemType, null)
            this.set(`item_type:${itemType}`, null as any, 60 * 1000) // Cache null for 1 minute
          }
        }
      } catch (error) {
        console.error('Failed to fetch schemas in batch:', error)
        // Set null for all uncached types on error
        for (const itemType of uncachedTypes) {
          results.set(itemType, null)
        }
      }
    }

    return results
  }

  /**
   * Get view definition schema
   */
  async getViewDefinition(viewSlug: string): Promise<any | null> {
    const cacheKey = `view:${viewSlug}`
    
    const cached = this.cache.get(cacheKey)
    if (cached && this.isValid(cached)) {
      return cached.schema
    }

    try {
      const { data } = await db
        .from('view_definitions')
        .select('*')
        .eq('slug', viewSlug)
        .single()

      if (data) {
        this.set(cacheKey, data)
        return data
      }
      
      return null
    } catch (error) {
      console.error(`Failed to fetch view definition ${viewSlug}:`, error)
      return null
    }
  }

  /**
   * Get app definition schema
   */
  async getAppDefinition(appSlug: string): Promise<any | null> {
    const cacheKey = `app:${appSlug}`
    
    const cached = this.cache.get(cacheKey)
    if (cached && this.isValid(cached)) {
      return cached.schema
    }

    try {
      const { data } = await db
        .from('app_definitions')
        .select('*')
        .eq('slug', appSlug)
        .single()

      if (data) {
        this.set(cacheKey, data)
        return data
      }
      
      return null
    } catch (error) {
      console.error(`Failed to fetch app definition ${appSlug}:`, error)
      return null
    }
  }

  /**
   * Get multiple app definitions
   */
  async getAppDefinitions(appSlugs: string[]): Promise<Map<string, any | null>> {
    const results = new Map<string, any | null>()
    const uncachedApps: string[] = []

    // Check cache first
    for (const appSlug of appSlugs) {
      const cacheKey = `app:${appSlug}`
      const cached = this.cache.get(cacheKey)
      
      if (cached && this.isValid(cached)) {
        results.set(appSlug, cached.schema)
      } else {
        uncachedApps.push(appSlug)
      }
    }

    // Fetch uncached apps
    if (uncachedApps.length > 0) {
      try {
        const { data } = await db
          .from('app_definitions')
          .select('*')
          .in('slug', uncachedApps)

        if (data) {
          for (const row of data) {
            results.set(row.slug, row)
            this.set(`app:${row.slug}`, row)
          }
        }

        // Set null for apps not found
        for (const appSlug of uncachedApps) {
          if (!results.has(appSlug)) {
            results.set(appSlug, null)
            this.set(`app:${appSlug}`, null as any, 60 * 1000)
          }
        }
      } catch (error) {
        console.error('Failed to fetch app definitions in batch:', error)
        for (const appSlug of uncachedApps) {
          results.set(appSlug, null)
        }
      }
    }

    return results
  }

  /**
   * Preload commonly used schemas
   */
  async preloadCommonSchemas(accountId: string): Promise<void> {
    const commonItemTypes = [
      'task', 'ticket', 'support_case', 'knowledge_article', 
      'deal', 'contact', 'company', 'lead', 'campaign'
    ]

    const commonViews = [
      'task_list', 'ticket_queue', 'support_dashboard', 
      'deal_pipeline', 'contact_list'
    ]

    const commonApps = [
      'support', 'crm', 'projects', 'sales'
    ]

    // Load in parallel
    await Promise.all([
      this.getItemTypeSchemas(commonItemTypes),
      Promise.all(commonViews.map(view => this.getViewDefinition(view))),
      this.getAppDefinitions(commonApps)
    ])
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    entries: Array<{ key: string; age: number; ttl: number }>
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      ttl: entry.ttl
    }))

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: 0, // Would need to track hits/misses for this
      entries
    }
  }

  /**
   * Set cache entry with TTL
   */
  private set(key: string, schema: ItemTypeSchema | any, ttl?: number): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      schema,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    })
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let cleaned = 0
    const now = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }

    return cleaned
  }
}

// Global cache instance
export const schemaCache = new SchemaCache()

// Auto-cleanup every 5 minutes
setInterval(() => {
  const cleaned = schemaCache.cleanup()
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired cache entries`)
  }
}, 5 * 60 * 1000)

// Enhanced ItemsDAL with caching
export class CachedItemsDAL {
  /**
   * Get item type schema with caching
   */
  static async getItemTypeSchema(itemType: string): Promise<ItemTypeSchema | null> {
    return await schemaCache.getItemTypeSchema(itemType)
  }

  /**
   * Get multiple item type schemas efficiently
   */
  static async getItemTypeSchemas(itemTypes: string[]): Promise<Map<string, ItemTypeSchema | null>> {
    return await schemaCache.getItemTypeSchemas(itemTypes)
  }

  /**
   * Batch evaluate record access for multiple item types
   */
  static async batchEvaluateRecordAccess(
    itemTypeRoles: Array<{ itemType: string; userRole: string; action: 'create' | 'read' | 'update' | 'delete' }>
  ): Promise<Map<string, boolean>> {
    const itemTypes = [...new Set(itemTypeRoles.map(r => r.itemType))]
    const schemas = await this.getItemTypeSchemas(itemTypes)
    const results = new Map<string, boolean>()

    for (const { itemType, userRole, action } of itemTypeRoles) {
      const schema = schemas.get(itemType)
      if (!schema) {
        results.set(`${itemType}:${userRole}:${action}`, false)
        continue
      }

      // Import evaluateRecordAccess from original ItemsDAL
      const { ItemsDAL } = await import('./items-dal')
      const access = ItemsDAL.evaluateRecordAccess(schema, userRole, action)
      results.set(`${itemType}:${userRole}:${action}`, Boolean(access))
    }

    return results
  }
}

export default schemaCache
