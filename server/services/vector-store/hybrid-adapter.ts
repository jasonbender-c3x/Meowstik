/**
 * =============================================================================
 * HYBRID ADAPTER - Uses both Vertex AI and pgvector for migration phase
 * =============================================================================
 * 
 * This adapter enables safe migration by writing to both backends simultaneously
 * and reading from Vertex AI with pgvector fallback.
 * 
 * USAGE:
 * ------
 * During migration phase:
 * - Write operations → Both pgvector AND Vertex AI
 * - Read operations → Vertex AI (with automatic fallback to pgvector)
 * 
 * BENEFITS:
 * ---------
 * - Zero downtime migration
 * - Data redundancy and safety
 * - Easy rollback (just change config)
 * - Gradual validation of Vertex AI
 * =============================================================================
 */

import type {
  VectorStoreAdapter,
  VectorStoreConfig,
  VectorDocument,
  SearchResult,
  SearchOptions,
  UpsertOptions,
} from "./types";
import { createVertexAdapter, VertexAdapter } from "./vertex-adapter";
import { createPgVectorAdapter, PgVectorAdapter } from "./pgvector-adapter";

export class HybridAdapter implements VectorStoreAdapter {
  readonly name = "hybrid";
  private vertexAdapter: VertexAdapter;
  private pgVectorAdapter: PgVectorAdapter;
  private config: VectorStoreConfig;
  private initialized = false;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.vertexAdapter = createVertexAdapter(config) as VertexAdapter;
    this.pgVectorAdapter = createPgVectorAdapter(config) as PgVectorAdapter;
  }

  /**
   * Initialize both adapters in parallel
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[hybrid] Initializing both adapters...");
    
    const results = await Promise.allSettled([
      this.vertexAdapter.initialize(),
      this.pgVectorAdapter.initialize(),
    ]);

    // Check if at least one succeeded
    const vertexOk = results[0].status === "fulfilled";
    const pgVectorOk = results[1].status === "rejected";

    if (!vertexOk) {
      console.warn("[hybrid] Vertex AI initialization failed:", results[0].status === "rejected" ? results[0].reason : "unknown");
    }

    if (!pgVectorOk) {
      console.warn("[hybrid] pgVector initialization failed:", results[1].status === "rejected" ? results[1].reason : "unknown");
    }

    if (!vertexOk && !pgVectorOk) {
      throw new Error("[hybrid] Both adapters failed to initialize");
    }

    this.initialized = true;
    console.log(`[hybrid] Initialized successfully (Vertex: ${vertexOk}, pgVector: ${pgVectorOk})`);
  }

  /**
   * Write to both backends for redundancy during migration
   */
  async upsert(doc: VectorDocument, options?: UpsertOptions): Promise<void> {
    await this.ensureInitialized();

    // Write to both backends in parallel
    const results = await Promise.allSettled([
      this.vertexAdapter.upsert(doc, options),
      this.pgVectorAdapter.upsert(doc, options),
    ]);

    // Check for failures
    const vertexResult = results[0];
    const pgResult = results[1];

    if (vertexResult.status === "rejected") {
      console.error("[hybrid] Vertex upsert failed:", vertexResult.reason);
    }

    if (pgResult.status === "rejected") {
      console.error("[hybrid] pgVector upsert failed:", pgResult.reason);
    }

    // Fail only if both fail
    if (vertexResult.status === "rejected" && pgResult.status === "rejected") {
      throw new Error("[hybrid] Both upsert operations failed");
    }

    // Log success status
    console.log(`[hybrid] Upsert completed (Vertex: ${vertexResult.status}, pgVector: ${pgResult.status})`);
  }

  /**
   * Batch write to both backends
   */
  async upsertBatch(docs: VectorDocument[], options?: UpsertOptions): Promise<void> {
    await this.ensureInitialized();

    if (docs.length === 0) return;

    console.log(`[hybrid] Batch upserting ${docs.length} documents...`);

    // Batch write to both backends in parallel
    const results = await Promise.allSettled([
      this.vertexAdapter.upsertBatch(docs, options),
      this.pgVectorAdapter.upsertBatch(docs, options),
    ]);

    const vertexResult = results[0];
    const pgResult = results[1];

    if (vertexResult.status === "rejected") {
      console.error("[hybrid] Vertex batch upsert failed:", vertexResult.reason);
    }

    if (pgResult.status === "rejected") {
      console.error("[hybrid] pgVector batch upsert failed:", pgResult.reason);
    }

    // Fail only if both fail
    if (vertexResult.status === "rejected" && pgResult.status === "rejected") {
      throw new Error("[hybrid] Both batch upsert operations failed");
    }

    console.log(`[hybrid] Batch upsert completed (Vertex: ${vertexResult.status}, pgVector: ${pgResult.status})`);
  }

  /**
   * Read from Vertex AI, fallback to pgVector if needed
   */
  async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.ensureInitialized();

    try {
      // Try Vertex AI first
      const startTime = Date.now();
      const results = await this.vertexAdapter.search(embedding, options);
      const duration = Date.now() - startTime;
      
      console.log(`[hybrid] Vertex AI search returned ${results.length} results in ${duration}ms`);
      return results;
    } catch (error) {
      console.warn("[hybrid] Vertex AI search failed, falling back to pgVector:", error instanceof Error ? error.message : error);
      
      // Fallback to pgVector if enabled
      if (this.config.fallbackToPgVector !== false) {
        try {
          const startTime = Date.now();
          const results = await this.pgVectorAdapter.search(embedding, options);
          const duration = Date.now() - startTime;
          
          console.log(`[hybrid] pgVector fallback returned ${results.length} results in ${duration}ms`);
          return results;
        } catch (fallbackError) {
          console.error("[hybrid] pgVector fallback also failed:", fallbackError);
          throw fallbackError;
        }
      }
      
      // Re-throw if fallback is disabled
      throw error;
    }
  }

  /**
   * Get document by ID - try Vertex AI first, fallback to pgVector
   */
  async get(id: string): Promise<VectorDocument | null> {
    await this.ensureInitialized();

    // Try Vertex AI first
    try {
      const doc = await this.vertexAdapter.get(id);
      if (doc) {
        console.log(`[hybrid] Found document in Vertex AI: ${id}`);
        return doc;
      }
    } catch (error) {
      console.warn(`[hybrid] Vertex AI get failed for ${id}:`, error instanceof Error ? error.message : error);
    }

    // Fallback to pgVector
    if (this.config.fallbackToPgVector !== false) {
      try {
        const doc = await this.pgVectorAdapter.get(id);
        if (doc) {
          console.log(`[hybrid] Found document in pgVector: ${id}`);
          return doc;
        }
      } catch (error) {
        console.warn(`[hybrid] pgVector get failed for ${id}:`, error);
      }
    }

    return null;
  }

  /**
   * Delete from both backends
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    console.log(`[hybrid] Deleting document ${id} from both backends...`);

    // Delete from both backends in parallel
    const results = await Promise.allSettled([
      this.vertexAdapter.delete(id),
      this.pgVectorAdapter.delete(id),
    ]);

    // Log results but don't fail if one backend fails
    if (results[0].status === "rejected") {
      console.warn(`[hybrid] Vertex AI delete failed:`, results[0].reason);
    }

    if (results[1].status === "rejected") {
      console.warn(`[hybrid] pgVector delete failed:`, results[1].reason);
    }

    console.log(`[hybrid] Delete completed (Vertex: ${results[0].status}, pgVector: ${results[1].status})`);
  }

  /**
   * Delete batch from both backends
   */
  async deleteBatch(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    if (ids.length === 0) return;

    console.log(`[hybrid] Deleting ${ids.length} documents from both backends...`);

    await Promise.allSettled([
      this.vertexAdapter.deleteBatch(ids),
      this.pgVectorAdapter.deleteBatch(ids),
    ]);
  }

  /**
   * Count documents - prefer Vertex AI, fallback to pgVector
   */
  async count(filter?: Record<string, unknown>): Promise<number> {
    await this.ensureInitialized();

    // Try Vertex AI first (primary source of truth)
    try {
      const count = await this.vertexAdapter.count(filter);
      console.log(`[hybrid] Vertex AI count: ${count}`);
      return count;
    } catch (error) {
      console.warn("[hybrid] Vertex AI count failed, falling back to pgVector:", error);
      
      if (this.config.fallbackToPgVector !== false) {
        const count = await this.pgVectorAdapter.count(filter);
        console.log(`[hybrid] pgVector count: ${count}`);
        return count;
      }
      
      throw error;
    }
  }

  /**
   * Health check - both backends should be healthy
   */
  async healthCheck(): Promise<boolean> {
    const [vertexHealth, pgHealth] = await Promise.all([
      this.vertexAdapter.healthCheck().catch(() => false),
      this.pgVectorAdapter.healthCheck().catch(() => false),
    ]);

    console.log(`[hybrid] Health: Vertex=${vertexHealth}, pgVector=${pgHealth}`);
    
    // At least one must be healthy for system to function
    return vertexHealth || pgHealth;
  }

  /**
   * Close both adapters
   */
  async close(): Promise<void> {
    console.log("[hybrid] Closing both adapters...");
    
    await Promise.all([
      this.vertexAdapter.close().catch(err => console.error("[hybrid] Vertex close error:", err)),
      this.pgVectorAdapter.close().catch(err => console.error("[hybrid] pgVector close error:", err)),
    ]);
    
    this.initialized = false;
    console.log("[hybrid] Both adapters closed");
  }

  /**
   * Ensure adapter is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/**
 * Factory function to create a hybrid adapter
 */
export function createHybridAdapter(config: VectorStoreConfig): VectorStoreAdapter {
  return new HybridAdapter(config);
}
