# Vertex AI RAG Migration: Implementation Guide

> **Practical step-by-step guide for implementing the Vertex AI RAG migration**
>
> **Prerequisite**: Read [ARCHITECTURE.md](./ARCHITECTURE.md) first  
> **Author**: Meowstik Engineering Team  
> **Date**: January 15, 2026

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Setup and Configuration](#phase-1-setup-and-configuration)
3. [Phase 2: Vertex AI Adapter Implementation](#phase-2-vertex-ai-adapter-implementation)
4. [Phase 3: Service Integration](#phase-3-service-integration)
5. [Phase 4: Testing and Validation](#phase-4-testing-and-validation)
6. [Phase 5: Deployment and Migration](#phase-5-deployment-and-migration)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Tools and Access

- [ ] Google Cloud Platform (GCP) account with billing enabled
- [ ] GCP project created and configured
- [ ] `gcloud` CLI installed and authenticated
- [ ] Node.js 20+ and npm installed
- [ ] Access to Meowstik repository
- [ ] Vertex AI API enabled in GCP project

### GCP Setup

#### 1. Create GCP Project

```bash
# Set project name
export PROJECT_ID="meowstik-vertex-ai"
export PROJECT_NAME="Meowstik Vertex AI"

# Create project
gcloud projects create $PROJECT_ID --name="$PROJECT_NAME"

# Set as default project
gcloud config set project $PROJECT_ID

# Link billing account (get billing account ID from console)
export BILLING_ACCOUNT_ID="YOUR_BILLING_ACCOUNT_ID"
gcloud billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT_ID
```

#### 2. Enable Required APIs

```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Enable Cloud Resource Manager API
gcloud services enable cloudresourcemanager.googleapis.com

# Enable IAM API
gcloud services enable iam.googleapis.com

# Verify APIs are enabled
gcloud services list --enabled | grep -E "(aiplatform|iam|cloudresourcemanager)"
```

#### 3. Create Service Account

```bash
# Create service account
export SA_NAME="meowstik-vertex-ai"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create $SA_NAME \
  --display-name="Meowstik Vertex AI Service Account" \
  --description="Service account for Vertex AI RAG operations"

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/ml.developer"

# Create and download key
gcloud iam service-accounts keys create ~/meowstik-vertex-ai-key.json \
  --iam-account=$SA_EMAIL

echo "Service account key saved to: ~/meowstik-vertex-ai-key.json"
```

#### 4. Set Environment Variables

Create or update `.env` file:

```bash
# Add to .env file
cat >> .env << EOF

# Vertex AI Configuration
GOOGLE_CLOUD_PROJECT=${PROJECT_ID}
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=${HOME}/meowstik-vertex-ai-key.json
VERTEX_RAG_CORPUS=meowstik-knowledge-base

# Feature Flags
VECTOR_STORE_BACKEND=vertex
VERTEX_AI_ENABLED=true
MIGRATION_MODE=parallel
EOF
```

---

## Phase 1: Setup and Configuration

### Step 1.1: Install Dependencies

```bash
cd /home/runner/work/Meowstik/Meowstik

# Install Vertex AI SDK packages
npm install @google-cloud/aiplatform --save
npm install @google-cloud/vertexai --save
npm install google-auth-library --save

# Verify installation
npm list @google-cloud/aiplatform
```

### Step 1.2: Update Configuration Types

Add new configuration options to `server/services/vector-store/types.ts`:

```typescript
// Add to VectorStoreConfig interface
export interface VectorStoreConfig {
  // ... existing fields ...
  
  // Vertex AI specific
  vertexProjectId?: string;
  vertexLocation?: string;
  vertexCorpusName?: string;
  vertexEndpoint?: string;
  
  // Feature flags
  enableHybridSearch?: boolean;
  enableReranking?: boolean;
  fallbackToPgVector?: boolean;
}
```

### Step 1.3: Update Environment Configuration

Update `server/services/vector-store/config.ts`:

```typescript
export function loadConfigFromEnv(): VectorStoreConfig {
  const backend = (process.env.VECTOR_STORE_BACKEND || detectBackendFromEnv()) as VectorStoreConfig["backend"];

  return {
    backend,
    dimension: parseInt(process.env.VECTOR_DIMENSION || "768", 10),
    metric: (process.env.VECTOR_METRIC || "cosine") as VectorStoreConfig["metric"],

    // PostgreSQL/pgvector
    databaseUrl: process.env.DATABASE_URL,

    // Vertex AI - NEW
    vertexProjectId: process.env.GOOGLE_CLOUD_PROJECT,
    vertexLocation: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    vertexCorpusName: process.env.VERTEX_RAG_CORPUS || "meowstik-knowledge-base",
    
    // Feature flags
    enableHybridSearch: process.env.ENABLE_HYBRID_SEARCH === "true",
    enableReranking: process.env.ENABLE_RERANKING === "true",
    fallbackToPgVector: process.env.FALLBACK_TO_PGVECTOR !== "false", // default true
  };
}
```

---

## Phase 2: Vertex AI Adapter Implementation

### Step 2.1: Enhance Existing Vertex Adapter

The adapter already exists at `server/services/vector-store/vertex-adapter.ts`. We need to enhance it:

**File: `server/services/vector-store/vertex-adapter.ts`**

Update the import statements:

```typescript
import { GoogleAuth } from 'google-auth-library';
import { VertexAI } from '@google-cloud/vertexai';
```

Add improved authentication:

```typescript
/**
 * Enhanced authentication with multiple fallback mechanisms
 */
private async getAccessToken(): Promise<string> {
  // 1. Check for explicit token
  if (process.env.GOOGLE_ACCESS_TOKEN) {
    console.log("[vertex] Using GOOGLE_ACCESS_TOKEN from env");
    return process.env.GOOGLE_ACCESS_TOKEN;
  }

  // 2. Try Application Default Credentials
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (token.token) {
      console.log("[vertex] Using Application Default Credentials");
      return token.token;
    }
  } catch (error) {
    console.log("[vertex] ADC not available:", error.message);
  }

  // 3. Try metadata server (GCP environment)
  try {
    const response = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { 
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(2000), // 2s timeout
      }
    );
    if (response.ok) {
      const data = await response.json() as { access_token: string };
      console.log("[vertex] Using GCP metadata server token");
      return data.access_token;
    }
  } catch (error) {
    console.log("[vertex] Metadata server not available:", error.message);
  }

  // 4. Fall back to gcloud CLI (local development)
  try {
    const { execSync } = await import("child_process");
    const token = execSync("gcloud auth print-access-token", { 
      encoding: "utf-8",
      stdio: ['pipe', 'pipe', 'ignore'], // suppress stderr
    }).trim();
    console.log("[vertex] Using gcloud CLI token");
    return token;
  } catch (error) {
    console.log("[vertex] gcloud CLI not available:", error.message);
  }

  throw new Error(
    "[vertex] Unable to authenticate. Please set GOOGLE_APPLICATION_CREDENTIALS " +
    "or run 'gcloud auth application-default login'"
  );
}
```

Add batch operations support:

```typescript
/**
 * Optimized batch upsert using Vertex AI bulk import
 */
async upsertBatch(docs: VectorDocument[], options?: UpsertOptions): Promise<void> {
  await this.ensureInitialized();

  if (docs.length === 0) return;

  // Vertex AI supports batch import - use it for efficiency
  const ragFiles = docs.map(doc => ({
    displayName: doc.id,
    description: JSON.stringify(doc.metadata || {}),
    inlineContent: {
      mimeType: "text/plain",
      data: Buffer.from(doc.content).toString("base64"),
    },
  }));

  const response = await fetch(`${this.baseUrl}/${this.corpusName}/ragFiles:import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      importRagFilesConfig: {
        ragFileChunkingConfig: {
          chunkSize: options?.chunkSize || 512,
          chunkOverlap: options?.chunkOverlap || 100,
        },
        inlineSource: {
          ragFiles,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[vertex] Batch upsert failed: ${error}`);
    throw new Error(`[vertex] Failed to batch upsert ${docs.length} documents: ${error}`);
  }

  console.log(`[vertex] Successfully batch upserted ${docs.length} documents`);
}
```

### Step 2.2: Create Hybrid Vertex Adapter

Create a new hybrid adapter that can use both backends:

**File: `server/services/vector-store/hybrid-adapter.ts`**

```typescript
/**
 * =============================================================================
 * HYBRID ADAPTER - Uses both Vertex AI and pgvector for migration phase
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

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[hybrid] Initializing both adapters...");
    
    // Initialize both adapters
    await Promise.all([
      this.vertexAdapter.initialize(),
      this.pgVectorAdapter.initialize(),
    ]);

    this.initialized = true;
    console.log("[hybrid] Both adapters initialized successfully");
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
  }

  async upsertBatch(docs: VectorDocument[], options?: UpsertOptions): Promise<void> {
    await this.ensureInitialized();

    // Batch write to both backends
    const results = await Promise.allSettled([
      this.vertexAdapter.upsertBatch(docs, options),
      this.pgVectorAdapter.upsertBatch(docs, options),
    ]);

    const vertexResult = results[0];
    const pgResult = results[1];

    if (vertexResult.status === "rejected" && pgResult.status === "rejected") {
      throw new Error("[hybrid] Both batch upsert operations failed");
    }
  }

  /**
   * Read from Vertex AI, fallback to pgVector
   */
  async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.ensureInitialized();

    try {
      // Try Vertex AI first
      const results = await this.vertexAdapter.search(embedding, options);
      console.log(`[hybrid] Vertex AI search returned ${results.length} results`);
      return results;
    } catch (error) {
      console.warn("[hybrid] Vertex AI search failed, falling back to pgVector:", error);
      
      if (this.config.fallbackToPgVector !== false) {
        const results = await this.pgVectorAdapter.search(embedding, options);
        console.log(`[hybrid] pgVector fallback returned ${results.length} results`);
        return results;
      }
      
      throw error;
    }
  }

  async get(id: string): Promise<VectorDocument | null> {
    await this.ensureInitialized();

    // Try Vertex AI first, fallback to pgVector
    try {
      return await this.vertexAdapter.get(id);
    } catch {
      return await this.pgVectorAdapter.get(id);
    }
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    // Delete from both backends
    await Promise.allSettled([
      this.vertexAdapter.delete(id),
      this.pgVectorAdapter.delete(id),
    ]);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    await Promise.allSettled([
      this.vertexAdapter.deleteBatch(ids),
      this.pgVectorAdapter.deleteBatch(ids),
    ]);
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    await this.ensureInitialized();

    // Return count from Vertex AI (primary source of truth)
    try {
      return await this.vertexAdapter.count(filter);
    } catch {
      return await this.pgVectorAdapter.count(filter);
    }
  }

  async healthCheck(): Promise<boolean> {
    const [vertexHealth, pgHealth] = await Promise.all([
      this.vertexAdapter.healthCheck(),
      this.pgVectorAdapter.healthCheck(),
    ]);

    console.log(`[hybrid] Health: Vertex=${vertexHealth}, pgVector=${pgHealth}`);
    
    // At least one must be healthy
    return vertexHealth || pgHealth;
  }

  async close(): Promise<void> {
    await Promise.all([
      this.vertexAdapter.close(),
      this.pgVectorAdapter.close(),
    ]);
    this.initialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/**
 * Factory function
 */
export function createHybridAdapter(config: VectorStoreConfig): VectorStoreAdapter {
  return new HybridAdapter(config);
}
```

### Step 2.3: Update Factory Function

Update `server/services/vector-store/index.ts` to include hybrid adapter:

```typescript
// Add import
import { createHybridAdapter } from "./hybrid-adapter";

// Update createVectorStore function
export function createVectorStore(config?: Partial<VectorStoreConfig>): VectorStoreAdapter {
  const fullConfig: VectorStoreConfig = {
    ...getDefaultConfig(),
    ...config,
  };

  console.log(`[vector-store] Creating ${fullConfig.backend} adapter`);

  switch (fullConfig.backend) {
    case "pgvector":
      return createPgVectorAdapter(fullConfig);

    case "vertex":
      return createVertexAdapter(fullConfig);

    case "hybrid":  // NEW
      return createHybridAdapter(fullConfig);

    case "memory":
      return createMemoryAdapter(fullConfig);

    case "pinecone":
      console.warn("[vector-store] Pinecone adapter not yet implemented, using memory");
      return createMemoryAdapter(fullConfig);

    default:
      throw new Error(`Unknown vector store backend: ${fullConfig.backend}`);
  }
}

// Export new adapter
export { createHybridAdapter, HybridAdapter } from "./hybrid-adapter";
```

---

## Phase 3: Service Integration

### Step 3.1: Update RAG Service

No changes needed to `server/services/rag-service.ts` - it already uses the vector store abstraction via `getVectorStore()`.

### Step 3.2: Update Embedding Service (Optional)

If you want to use Vertex AI for embeddings (instead of direct Gemini API), update `server/services/embedding-service.ts`:

```typescript
/**
 * Optional: Use Vertex AI Embeddings API
 */
async embedViaVertex(text: string): Promise<EmbeddingResult> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  
  if (!projectId) {
    // Fallback to direct Gemini API
    return this.embed(text);
  }

  try {
    const vertexAI = new VertexAI({ project: projectId, location });
    const model = vertexAI.getGenerativeModel({ model: 'text-embedding-004' });
    
    const result = await model.embedContent(text);
    
    return {
      embedding: result.embeddings[0].values || [],
    };
  } catch (error) {
    console.error("Vertex AI embedding error, falling back to Gemini API:", error);
    return this.embed(text);
  }
}
```

---

## Phase 4: Testing and Validation

### Step 4.1: Create Test Script

**File: `scripts/test-vertex-ai-migration.ts`**

```typescript
#!/usr/bin/env tsx

import { createVectorStore } from '../server/services/vector-store';
import { embeddingService } from '../server/services/embedding-service';
import type { VectorDocument } from '../server/services/vector-store/types';

async function testVertexAIMigration() {
  console.log("=".repeat(60));
  console.log("VERTEX AI MIGRATION TEST");
  console.log("=".repeat(60));

  // Test 1: Create Vertex AI adapter
  console.log("\n[TEST 1] Creating Vertex AI adapter...");
  const store = createVectorStore({ backend: 'vertex' });
  
  // Test 2: Initialize
  console.log("\n[TEST 2] Initializing adapter...");
  await store.initialize();
  console.log("✅ Initialization successful");

  // Test 3: Health check
  console.log("\n[TEST 3] Health check...");
  const healthy = await store.healthCheck();
  console.log(`✅ Health check: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  if (!healthy) {
    throw new Error("Health check failed");
  }

  // Test 4: Upsert test document
  console.log("\n[TEST 4] Upserting test document...");
  const testDoc: VectorDocument = {
    id: `test-${Date.now()}`,
    content: "This is a test document for Vertex AI migration. It contains information about the Meowstik platform.",
    embedding: await embeddingService.embed("This is a test document for Vertex AI migration. It contains information about the Meowstik platform.").then(r => r.embedding),
    metadata: {
      source: "test",
      timestamp: new Date().toISOString(),
    },
  };
  
  await store.upsert(testDoc);
  console.log(`✅ Document upserted: ${testDoc.id}`);

  // Test 5: Search
  console.log("\n[TEST 5] Searching for similar documents...");
  const queryEmbedding = await embeddingService.embed("Tell me about Meowstik platform");
  const results = await store.search(queryEmbedding.embedding, {
    topK: 5,
    threshold: 0.1,
  });
  console.log(`✅ Search returned ${results.length} results`);
  
  if (results.length > 0) {
    console.log("\nTop result:");
    console.log(`  Score: ${results[0].score.toFixed(3)}`);
    console.log(`  Content: ${results[0].document.content.substring(0, 100)}...`);
  }

  // Test 6: Get document
  console.log("\n[TEST 6] Retrieving document by ID...");
  const retrieved = await store.get(testDoc.id);
  if (retrieved) {
    console.log(`✅ Document retrieved: ${retrieved.id}`);
  } else {
    console.log("⚠️ Document not found (may take time to index)");
  }

  // Test 7: Count documents
  console.log("\n[TEST 7] Counting documents...");
  const count = await store.count();
  console.log(`✅ Total documents: ${count}`);

  // Test 8: Delete test document
  console.log("\n[TEST 8] Deleting test document...");
  await store.delete(testDoc.id);
  console.log(`✅ Document deleted: ${testDoc.id}`);

  // Close adapter
  await store.close();
  
  console.log("\n" + "=".repeat(60));
  console.log("ALL TESTS PASSED ✅");
  console.log("=".repeat(60));
}

// Run tests
testVertexAIMigration().catch(error => {
  console.error("\n❌ TEST FAILED:", error);
  process.exit(1);
});
```

### Step 4.2: Run Tests

```bash
# Set environment for testing
export VECTOR_STORE_BACKEND=vertex

# Run test script
npx tsx scripts/test-vertex-ai-migration.ts
```

Expected output:
```
============================================================
VERTEX AI MIGRATION TEST
============================================================

[TEST 1] Creating Vertex AI adapter...
[vertex] Creating vertex adapter

[TEST 2] Initializing adapter...
[vertex] Initialized with corpus: projects/.../ragCorpora/...
✅ Initialization successful

[TEST 3] Health check...
✅ Health check: HEALTHY

[TEST 4] Upserting test document...
✅ Document upserted: test-1736925600000

[TEST 5] Searching for similar documents...
✅ Search returned 1 results

Top result:
  Score: 0.856
  Content: This is a test document for Vertex AI migration. It contains information about the Meowstik platf...

[TEST 6] Retrieving document by ID...
✅ Document retrieved: test-1736925600000

[TEST 7] Counting documents...
✅ Total documents: 1

[TEST 8] Deleting test document...
✅ Document deleted: test-1736925600000

============================================================
ALL TESTS PASSED ✅
============================================================
```

---

## Phase 5: Deployment and Migration

### Step 5.1: Gradual Rollout Strategy

#### Option A: Environment-Based Rollout

```bash
# Development: Use pgvector (no GCP needed)
VECTOR_STORE_BACKEND=pgvector npm run dev

# Staging: Use hybrid mode (both backends)
VECTOR_STORE_BACKEND=hybrid npm run dev

# Production: Use Vertex AI only
VECTOR_STORE_BACKEND=vertex npm run start
```

#### Option B: Percentage-Based Rollout

Implement feature flag logic in `server/services/vector-store/index.ts`:

```typescript
export function detectBackend(): VectorStoreConfig["backend"] {
  const backend = process.env.VECTOR_STORE_BACKEND;
  
  if (backend) {
    return backend as VectorStoreConfig["backend"];
  }

  // Percentage-based rollout
  const rolloutPercentage = parseInt(process.env.VERTEX_ROLLOUT_PERCENTAGE || "0", 10);
  const random = Math.random() * 100;
  
  if (random < rolloutPercentage) {
    console.log(`[vector-store] Using Vertex AI (rollout: ${rolloutPercentage}%)`);
    return "vertex";
  }
  
  // Fallback to pgvector
  return "pgvector";
}
```

### Step 5.2: Data Migration Script

**File: `scripts/migrate-to-vertex-ai.ts`**

```typescript
#!/usr/bin/env tsx

import { createVectorStore } from '../server/services/vector-store';
import { storage } from '../server/storage';

async function migrateToVertexAI() {
  console.log("Starting migration to Vertex AI...\n");

  // Create both adapters
  const pgVectorStore = createVectorStore({ backend: 'pgvector' });
  const vertexStore = createVectorStore({ backend: 'vertex' });

  await pgVectorStore.initialize();
  await vertexStore.initialize();

  // Get all document chunks from pgvector
  console.log("Fetching all document chunks from PostgreSQL...");
  const chunks = await storage.getAllDocumentChunks();
  console.log(`Found ${chunks.length} chunks to migrate\n`);

  // Migrate in batches
  const batchSize = 100;
  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    console.log(`Migrating batch ${Math.floor(i / batchSize) + 1} (${batch.length} chunks)...`);
    
    const docs = batch.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: {
        documentId: chunk.documentId,
        attachmentId: chunk.attachmentId,
        chunkIndex: chunk.chunkIndex,
        ...(chunk.metadata || {}),
      },
    }));

    try {
      await vertexStore.upsertBatch(docs);
      migrated += batch.length;
      console.log(`✅ Batch migrated successfully (${migrated}/${chunks.length})`);
    } catch (error) {
      failed += batch.length;
      console.error(`❌ Batch failed:`, error);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await pgVectorStore.close();
  await vertexStore.close();

  console.log("\n" + "=".repeat(60));
  console.log(`MIGRATION COMPLETE`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${chunks.length}`);
  console.log("=".repeat(60));
}

migrateToVertexAI().catch(error => {
  console.error("Migration failed:", error);
  process.exit(1);
});
```

Run migration:

```bash
export VECTOR_STORE_BACKEND=hybrid
npx tsx scripts/migrate-to-vertex-ai.ts
```

---

## Troubleshooting

### Issue: Authentication Failed

**Error**: `Unable to get access token`

**Solution**:
```bash
# Ensure you're authenticated
gcloud auth application-default login

# Or set service account key
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# Verify authentication
gcloud auth list
```

### Issue: API Not Enabled

**Error**: `API aiplatform.googleapis.com is not enabled`

**Solution**:
```bash
gcloud services enable aiplatform.googleapis.com
```

### Issue: Permission Denied

**Error**: `403 Forbidden`

**Solution**:
```bash
# Grant necessary roles to service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user"
```

### Issue: Corpus Not Found

**Error**: `Corpus not found`

**Solution**:
- Corpus is created automatically on first use
- Check project ID and location are correct
- Verify API is enabled

### Issue: High Latency

**Symptoms**: Queries taking >1 second

**Solution**:
1. Check network latency to GCP region
2. Use regional deployment (same region as Vertex AI)
3. Implement caching layer
4. Use batch operations

---

## Rollback Procedures

### Emergency Rollback

If critical issues arise, immediately rollback:

```bash
# 1. Update environment variable
export VECTOR_STORE_BACKEND=pgvector

# 2. Restart application
pm2 restart meowstik
# OR
npm run start

# 3. Verify health
curl http://localhost:5000/api/health
```

### Planned Rollback

For planned rollback during migration:

```bash
# 1. Switch to hybrid mode (safe)
export VECTOR_STORE_BACKEND=hybrid

# 2. Monitor both backends
npx tsx scripts/test-vertex-ai-migration.ts

# 3. If issues persist, switch to pgvector only
export VECTOR_STORE_BACKEND=pgvector
```

---

## Monitoring and Observability

### Health Check Endpoint

Add health check endpoint in `server/routes/index.ts`:

```typescript
app.get('/api/vector-store/health', async (req, res) => {
  try {
    const store = await getVectorStore();
    const healthy = await store.healthCheck();
    const count = await store.count();
    
    res.json({
      healthy,
      backend: store.name,
      documentCount: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message,
    });
  }
});
```

### Logging

Ensure comprehensive logging:

```typescript
// In vertex-adapter.ts, add structured logging
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  component: 'vertex-adapter',
  operation: 'upsert',
  documentId: doc.id,
  status: 'success',
  durationMs: Date.now() - startTime,
}));
```

---

## Performance Benchmarks

Run before and after migration:

**File: `scripts/benchmark-vector-store.ts`**

```typescript
#!/usr/bin/env tsx

import { createVectorStore } from '../server/services/vector-store';
import { embeddingService } from '../server/services/embedding-service';

async function benchmark(backend: 'pgvector' | 'vertex') {
  console.log(`\nBenchmarking ${backend}...`);
  
  const store = createVectorStore({ backend });
  await store.initialize();

  const testDoc = {
    id: `benchmark-${Date.now()}`,
    content: "Benchmark test document",
    embedding: await embeddingService.embed("test").then(r => r.embedding),
    metadata: {},
  };

  // Measure upsert
  const upsertStart = Date.now();
  await store.upsert(testDoc);
  const upsertTime = Date.now() - upsertStart;

  // Measure search
  const searchStart = Date.now();
  await store.search(testDoc.embedding, { topK: 5 });
  const searchTime = Date.now() - searchStart;

  // Cleanup
  await store.delete(testDoc.id);
  await store.close();

  return { upsertTime, searchTime };
}

async function runBenchmarks() {
  const pgResults = await benchmark('pgvector');
  const vertexResults = await benchmark('vertex');

  console.log("\n" + "=".repeat(60));
  console.log("BENCHMARK RESULTS");
  console.log("=".repeat(60));
  console.log(`pgvector - Upsert: ${pgResults.upsertTime}ms, Search: ${pgResults.searchTime}ms`);
  console.log(`Vertex AI - Upsert: ${vertexResults.upsertTime}ms, Search: ${vertexResults.searchTime}ms`);
  console.log("=".repeat(60));
}

runBenchmarks();
```

---

## Next Steps

After completing this implementation:

1. ✅ Run all tests and verify they pass
2. ✅ Deploy to staging environment in hybrid mode
3. ✅ Monitor performance and error rates
4. ✅ Gradually increase Vertex AI traffic (10% → 25% → 50% → 75% → 100%)
5. ✅ Migrate historical data using migration script
6. ✅ Update production environment configuration
7. ✅ Document lessons learned and update this guide

---

## References

- [Vertex AI RAG API Reference](https://cloud.google.com/vertex-ai/docs/reference/rest/v1beta1/projects.locations.ragCorpora)
- [Google Auth Library Documentation](https://github.com/googleapis/google-auth-library-nodejs)
- [Architecture Document](./ARCHITECTURE.md)

---

*This implementation guide is part of the Meowstik Vertex AI migration project.*  
*Version 1.0 - January 2026*
