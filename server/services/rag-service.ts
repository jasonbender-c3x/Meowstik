import { db } from "../db"; 
import { 
  knowledgeBuckets, 
  embeddings, 
  type InsertEmbedding 
} from "../../shared/schema"; 
import { eq, sql } from "drizzle-orm";
import { createPgVectorAdapter } from "./vector-store/pgvector-adapter";
import { generateEmbedding } from "../embedding-service";

const SYSTEM_OWNER_ID = -1;

export class RagService {
  private vectorStore = createPgVectorAdapter();

  async initialize() {
    await this.vectorStore.initialize();
  }

  async createBucket(name: string, description?: string, userId?: number) {
    const [bucket] = await db.insert(knowledgeBuckets).values({
      name,
      description,
      vectorStoreId: 'pgvector',
      config: {},
      userId: userId || SYSTEM_OWNER_ID 
    }).returning();
    return bucket;
  }

  async addDocument(bucketId: number, content: string, metadata: Record<string, any> = {}) {
    const vector = await generateEmbedding(content);
    await this.vectorStore.storeEmbedding({
      bucketId,
      content,
      vector,
      metadata
    });
    return true;
  }

  async search(query: string, bucketId?: number, limit = 5) {
    const vector = await generateEmbedding(query);
    return await this.vectorStore.search(vector, limit, bucketId);
  }
}

export const ragService = new RagService();