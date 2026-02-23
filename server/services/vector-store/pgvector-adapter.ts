import { sql } from "drizzle-orm";
import { db } from "../../db"; 
import { embeddings, knowledgeBuckets, type InsertEmbedding } from "../../../shared/schema";
import { VectorStoreAdapter, SearchResult } from "./types";

export class PgVectorAdapter implements VectorStoreAdapter {
  async initialize(): Promise<void> {
    // Ensure the vector extension exists in the Postgres DB
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
  }

  async storeEmbedding(embedding: InsertEmbedding): Promise<void> {
    await db.insert(embeddings).values(embedding);
  }

  async search(vector: number[], limit: number = 5, bucketId?: number): Promise<SearchResult[]> {
    // Use the cosine distance operator <=> for similarity search
    const similarity = sql<number>`1 - (${embeddings.vector} <=> ${JSON.stringify(vector)}::vector)`;
    
    let query = db.select({
      id: embeddings.id,
      content: embeddings.content,
      metadata: embeddings.metadata,
      similarity: similarity,
    })
    .from(embeddings)
    .orderBy(sql`${similarity} DESC`)
    .limit(limit);

    const results = await query;

    return results.map(row => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata as Record<string, any>,
      score: row.similarity
    }));
  }

  async delete(id: number): Promise<void> {
    await db.execute(sql`DELETE FROM embeddings WHERE id = ${id}`);
  }
  
  async createBucket(name: string, description?: string): Promise<number> {
      const [bucket] = await db.insert(knowledgeBuckets).values({
          name, 
          description,
          vectorStoreId: 'pgvector',
          config: {}
      }).returning();
      return bucket.id;
  }
}

export function createPgVectorAdapter(): VectorStoreAdapter {
  return new PgVectorAdapter();
}