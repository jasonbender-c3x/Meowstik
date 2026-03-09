/**
 * =============================================================================
 * PINECONE ADAPTER - Vector Store Implementation
 * =============================================================================
 * 
 * Implements the VectorStoreAdapter interface for Pinecone.
 * Uses the official @pinecone-database/pinecone SDK.
 * 
 * =============================================================================
 */

import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone';
import type { 
  VectorStoreAdapter, 
  VectorStoreConfig, 
  VectorDocument, 
  SearchResult,
  SearchOptions,
  UpsertOptions
} from './types';

export class PineconeAdapter implements VectorStoreAdapter {
  public readonly name = 'pinecone';
  private client: Pinecone | null = null;
  private index: Index | null = null;
  private config: VectorStoreConfig;
  private initialized = false;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.config.pineconeApiKey) {
      throw new Error('Pinecone API key is required');
    }

    try {
      this.client = new Pinecone({
        apiKey: this.config.pineconeApiKey,
      });

      const indexName = this.config.pineconeIndex || 'meowstik-knowledge';
      
      // Check if index exists, if not we might need to create it (or error out)
      // For now, we assume the index exists to avoid complex management logic
      // But we'll list indexes to verify connectivity
      const indexes = await this.client.listIndexes();
      const indexExists = indexes.indexes?.some(idx => idx.name === indexName);
      
      if (!indexExists) {
        console.warn(`[Pinecone] Index '${indexName}' not found. Ensure it is created in the Pinecone console.`);
        // In a real prod app, we might auto-create:
        // await this.client.createIndex({
        //   name: indexName,
        //   dimension: this.config.dimension || 768,
        //   metric: 'cosine',
        //   spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
        // });
      }

      this.index = this.client.index(indexName);
      this.initialized = true;
      console.log(`[Pinecone] Connected to index: ${indexName}`);
    } catch (error) {
      console.error('[Pinecone] Initialization failed:', error);
      throw error;
    }
  }

  private ensureInitialized() {
    if (!this.initialized || !this.index) {
      throw new Error('Pinecone adapter not initialized. Call initialize() first.');
    }
  }

  async upsert(doc: VectorDocument, options?: UpsertOptions): Promise<void> {
    this.ensureInitialized();
    await this.upsertBatch([doc], options);
  }

  async upsertBatch(docs: VectorDocument[], options?: UpsertOptions): Promise<void> {
    this.ensureInitialized();
    
    // Pinecone expects metadata to be Record<string, string | number | boolean | string[]>
    // We need to ensure our metadata fits this
    const records = docs.map(doc => ({
      id: doc.id,
      values: doc.embedding,
      metadata: {
        ...doc.metadata as RecordMetadata,
        content: doc.content, // Store content in metadata for retrieval
      },
    }));

    // Pinecone recommends batch sizes of ~100-500
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await this.index!.upsert(batch);
    }
  }

  async search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]> {
    this.ensureInitialized();

    const topK = options?.topK || 5;
    const filter = options?.filter as Record<string, any> | undefined;

    const results = await this.index!.query({
      vector: embedding,
      topK,
      filter,
      includeMetadata: true,
      includeValues: options?.includeEmbeddings,
    });

    return (results.matches || []).map(match => ({
      document: {
        id: match.id,
        content: (match.metadata?.content as string) || '',
        embedding: match.values || [], // Only present if includeValues was true
        metadata: match.metadata as any,
      },
      score: match.score || 0,
    }));
  }

  async get(id: string): Promise<VectorDocument | null> {
    this.ensureInitialized();
    
    const results = await this.index!.fetch([id]);
    const record = results.records[id];

    if (!record) return null;

    return {
      id: record.id,
      content: (record.metadata?.content as string) || '',
      embedding: record.values,
      metadata: record.metadata as any,
    };
  }

  async delete(id: string): Promise<void> {
    this.ensureInitialized();
    await this.index!.deleteOne(id);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    this.ensureInitialized();
    await this.index!.deleteMany(ids);
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    this.ensureInitialized();
    // Pinecone stats are approximate and don't support arbitrary filters for counting
    // describeIndexStats() gives total count + per-namespace count
    const stats = await this.index!.describeIndexStats();
    return stats.totalRecordCount || 0;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.initialized) return false;
      await this.index!.describeIndexStats();
      return true;
    } catch (e) {
      return false;
    }
  }

  async close(): Promise<void> {
    this.client = null;
    this.index = null;
    this.initialized = false;
  }
}

export function createPineconeAdapter(config: VectorStoreConfig): VectorStoreAdapter {
  return new PineconeAdapter(config);
}
