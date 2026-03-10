# RAG System Architecture - Meowstik

> **Understanding the integrated RAG (Retrieval-Augmented Generation) system**

---

## Overview

**IMPORTANT**: Meowstik's RAG system is **fully integrated** into the application. There is **NO separate RAG service** or external service to configure. The RAG functionality is built directly into the Meowstik server.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MEOWSTIK SERVER                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │              RAG Service (Integrated)               │     │
│  │                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │     │
│  │  │ Ingestion    │  │ Chunking     │  │ Embedding│ │     │
│  │  │ Pipeline     │  │ Service      │  │ Service  │ │     │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │     │
│  │                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │     │
│  │  │ Retrieval    │  │ Hybrid       │  │ Context  │ │     │
│  │  │ Orchestrator │  │ Search       │  │ Synthesis│ │     │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │           Vector Store Adapter Layer                │     │
│  │  (Pluggable backends: pgvector/Vertex AI/memory)   │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
             ┌──────────────────────────────┐
             │   Storage Backend             │
             │  • PostgreSQL + pgvector      │
             │  • Google Vertex AI           │
             │  • In-Memory (testing)        │
             └──────────────────────────────┘
```

---

## Common Misconceptions

### ❌ MYTH: "RAG_URL, RAG_HOST, RAG_PORT environment variables are needed"

**Reality**: These variables **DO NOT EXIST** and are **NOT NEEDED**. The RAG system is integrated directly into the Meowstik server, not a separate service.

### ❌ MYTH: "RAG service is running on a separate container/server"

**Reality**: RAG is part of the Meowstik server process. No separate service, container, or server is required.

### ❌ MYTH: "I need to deploy a separate RAG service"

**Reality**: When you deploy Meowstik, the RAG system is automatically included and configured.

---

## How It Actually Works

### 1. Integrated Services

All RAG functionality is provided by TypeScript services within the Meowstik server:

| Service | Location | Purpose |
|---------|----------|---------|
| RAG Service | `server/services/rag-service.ts` | Main orchestrator |
| Ingestion Pipeline | `server/services/ingestion-pipeline.ts` | Document processing |
| Chunking Service | `server/services/chunking-service.ts` | Text splitting |
| Embedding Service | `server/services/embedding-service.ts` | Vector generation (via Gemini) |
| Hybrid Search | `server/services/hybrid-search.ts` | Semantic + keyword search |
| Retrieval Orchestrator | `server/services/retrieval-orchestrator.ts` | Query handling |

### 2. Vector Store Adapters

The system uses a pluggable adapter pattern for vector storage:

```typescript
// server/services/vector-store/index.ts
export async function getVectorStore(): Promise<VectorStoreAdapter> {
  const config = loadConfigFromEnv();
  
  switch (config.backend) {
    case 'pgvector':
      return createPgVectorAdapter(config);
    case 'vertex':
      return createVertexAdapter(config);
    case 'memory':
      return createMemoryAdapter(config);
    default:
      return createMemoryAdapter(config);
  }
}
```

### 3. No External Connectivity Needed

The RAG system does NOT require:
- ❌ Separate RAG service URL
- ❌ Docker containers for RAG
- ❌ External API endpoints
- ❌ Inter-service communication

It ONLY requires:
- ✅ Database connection (for pgvector backend)
- ✅ Gemini API key (for embeddings)
- ✅ Google Cloud credentials (for Vertex AI backend, optional)

---

## Configuration

### Required Environment Variables

```bash
# Required: Gemini API for embeddings
GEMINI_API_KEY=your_gemini_api_key

# Required: Database (if using pgvector)
DATABASE_URL=postgresql://user:password@localhost:5432/meowstik
```

### Optional Environment Variables

```bash
# Optional: Explicit backend selection (auto-detected if not set)
VECTOR_STORE_BACKEND=pgvector  # pgvector | vertex | memory | pinecone

# Optional: Vector configuration (defaults shown)
VECTOR_DIMENSION=768           # Gemini embedding dimension
VECTOR_METRIC=cosine           # cosine | euclidean | dot

# Optional: For Vertex AI backend
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_RAG_CORPUS=my-corpus
```

### Backend Auto-Detection

If `VECTOR_STORE_BACKEND` is not explicitly set:

```typescript
function detectBackendFromEnv(): string {
  if (process.env.PINECONE_API_KEY) return "pinecone";
  if (process.env.GOOGLE_CLOUD_PROJECT) return "vertex";
  if (process.env.DATABASE_URL) return "pgvector";
  return "memory";
}
```

---

## RAG Pipeline Flow

### Ingestion (file_ingest tool)

```
file_ingest tool call
        │
        ▼
RAGDispatcher.executeFileOperation()
        │
        ▼
RAGService.ingestDocument()
        │
        ├─► ChunkingService.chunkDocument()
        │   (Split into semantically meaningful pieces)
        │
        ├─► EmbeddingService.embedBatch()
        │   (Convert chunks to 768-dim vectors via Gemini)
        │
        └─► VectorStore.upsertBatch()
            (Store in PostgreSQL/Vertex AI/Memory)
```

### Retrieval (automatic during chat)

```
User query
        │
        ▼
EmbeddingService.embed()
(Convert query to vector)
        │
        ▼
HybridSearch.search()
(Semantic + keyword search)
        │
        ▼
RerankerService.rerank()
(Optimize results)
        │
        ▼
ContextSynthesis.augment()
(Inject into prompt)
        │
        ▼
LLM receives enriched prompt
```

---

## Storage Backends

### 1. pgvector (Recommended for Production)

**Uses**: PostgreSQL with pgvector extension

**Configuration**:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/meowstik
VECTOR_STORE_BACKEND=pgvector
```

**Advantages**:
- ✅ Production-ready
- ✅ Persistent storage
- ✅ Efficient similarity search
- ✅ Works with Replit, Supabase, Neon

**Requirements**:
- PostgreSQL 12+ with pgvector extension
- Run: `CREATE EXTENSION IF NOT EXISTS vector;`

### 2. Vertex AI (Google Cloud)

**Uses**: Google Cloud Vertex AI RAG Engine

**Configuration**:
```bash
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VECTOR_STORE_BACKEND=vertex
```

**Advantages**:
- ✅ Fully managed by Google
- ✅ Automatic scaling
- ✅ No database management

**Requirements**:
- Google Cloud project
- Vertex AI API enabled
- Service account credentials

### 3. In-Memory (Development/Testing)

**Uses**: JavaScript Map in server memory

**Configuration**:
```bash
VECTOR_STORE_BACKEND=memory
```

**Advantages**:
- ✅ No external dependencies
- ✅ Fast for testing
- ✅ Zero configuration

**Limitations**:
- ❌ Data lost on server restart
- ❌ Not suitable for production

---

## Debug and Monitoring

### RAG Debug Endpoints

The server provides debug endpoints to inspect RAG operations:

```
GET  /api/rag-debug/trace/:traceId    # Get trace details
GET  /api/rag-debug/recent            # Recent operations
GET  /api/rag-debug/stats             # System statistics
POST /api/rag-debug/clear             # Clear debug buffer
```

### Debug Tracing

All RAG operations are traced:

```typescript
// Each operation gets a trace ID
const traceId = ragDebugBuffer.generateTraceId();

// Operations are logged
ragDebugBuffer.logIngestStart(traceId, documentId, filename, size, type);
ragDebugBuffer.logChunk(traceId, documentId, chunkCount, ...);
ragDebugBuffer.logEmbed(traceId, documentId, vectorCount, duration);
ragDebugBuffer.logStore(traceId, documentId, vectorsStored, duration);
```

See: `docs/exhibit/03-advanced-ai/RAG_TRACEABILITY_IMPLEMENTATION.md`

---

## Troubleshooting

### Issue: "Vector store not initialized"

**Cause**: Database or embedding service not configured

**Solution**:
1. Check `GEMINI_API_KEY` is set
2. Verify database connection (if using pgvector)
3. Check server logs for initialization errors

### Issue: "Embedding failed"

**Cause**: Gemini API issues

**Solution**:
1. Verify `GEMINI_API_KEY` is valid
2. Check internet connectivity
3. Check Gemini API quotas

### Issue: "No chunks created"

**Cause**: Content too short or invalid

**Solution**:
1. Ensure content has substantial text (>50 characters)
2. Check content is not empty or whitespace only

### Issue: "Database connection failed"

**Cause**: PostgreSQL not accessible (pgvector backend)

**Solution**:
1. Verify `DATABASE_URL` is correct
2. Check PostgreSQL is running
3. Verify pgvector extension is installed: `CREATE EXTENSION IF NOT EXISTS vector;`

---

## Migration Guide

### From External RAG Service to Integrated

If you were expecting an external RAG service:

**Before (External Service - NOT USED)**:
```bash
# These variables DO NOT EXIST in Meowstik
RAG_URL=http://rag-service:8080      # ❌ Not used
RAG_HOST=rag-service                 # ❌ Not used
RAG_PORT=8080                        # ❌ Not used
```

**After (Integrated - ACTUAL)**:
```bash
# Correct configuration for integrated RAG
GEMINI_API_KEY=your_gemini_api_key    # ✅ Required
DATABASE_URL=postgresql://...         # ✅ Required (for pgvector)
VECTOR_STORE_BACKEND=pgvector         # ✅ Optional (auto-detected)
```

---

## File Ingestion

### Using the file_ingest Tool

```json
{
  "type": "file_ingest",
  "id": "ingest1",
  "parameters": {
    "content": "Your content here...",
    "filename": "document.txt",
    "mimeType": "text/plain"
  }
}
```

See: `docs/FILE_INGEST_GUIDE.md` for complete documentation.

### Implementation

```typescript
// server/services/rag-dispatcher.ts
private async executeFileOperation(toolCall: ToolCall, messageId: string) {
  // Extract parameters
  const params = toolCall.parameters as {
    content: string;
    filename: string;
    mimeType?: string;
  };

  // Get userId for data isolation
  const message = await storage.getMessageById(messageId);
  const chat = await storage.getChatById(message.chatId);
  const userId = chat?.userId || null;

  // Ingest into RAG system
  const result = await ragService.ingestDocument(
    params.content,
    null,
    params.filename,
    params.mimeType || 'text/plain',
    undefined,
    userId
  );

  return result;
}
```

---

## Data Isolation

### User-Specific Data

All RAG data is isolated by user:

```typescript
// During ingestion
const enhancedMetadata = {
  ...chunks[i].metadata,
  userId: userId || GUEST_USER_ID,
  isVerified: !!userId,
  source: "document",
};

// During retrieval
const results = await vectorStore.search(queryEmbedding, {
  topK: 5,
  filter: { userId: currentUserId } // Only retrieve user's data
});
```

### Guest vs. Authenticated

| User Type | Data Isolation | Persistence |
|-----------|---------------|-------------|
| **Authenticated** | Isolated by user ID | Permanent |
| **Guest** | Isolated by guest session | Temporary (can be cleaned up) |

---

## Performance

### Optimization Features

1. **Batch Embedding**: Multiple chunks embedded in single API call
2. **Batch Upsert**: Vectors inserted in batches
3. **Lazy Initialization**: Vector store initialized on first use
4. **Connection Pooling**: Database connections reused

### Benchmarks

Typical performance (pgvector backend):

| Operation | Time |
|-----------|------|
| Chunk 1KB document | ~10ms |
| Embed 10 chunks | ~500ms (Gemini API) |
| Store 10 vectors | ~50ms |
| Search query | ~100ms |

---

## Related Documentation

- [File Ingest Guide](./FILE_INGEST_GUIDE.md) - Complete guide to using file_ingest
- [RAG Pipeline](./exhibit/03-advanced-ai/RAG_PIPELINE.md) - Pipeline architecture
- [Vector Store](../server/services/vector-store/README.md) - Vector store system
- [Hybrid Search](./RAG_HYBRID_SEARCH_ENHANCEMENT.md) - Search implementation
- [Traceability](./exhibit/03-advanced-ai/RAG_TRACEABILITY_IMPLEMENTATION.md) - Debug tracing

---

## Summary

**Key Takeaways**:

1. ✅ RAG is **fully integrated** into Meowstik server
2. ✅ No separate RAG service or container needed
3. ✅ No RAG_URL, RAG_HOST, or RAG_PORT variables
4. ✅ Configure only: `GEMINI_API_KEY` + `DATABASE_URL`
5. ✅ Use `file_ingest` tool to add content
6. ✅ Content is automatically retrieved when relevant

**To get started**:

1. Set `GEMINI_API_KEY` in `.env`
2. Set `DATABASE_URL` (for production) or use memory backend (for testing)
3. Start using `file_ingest` tool to build your knowledge base

---

**Last Updated**: January 2024  
**Version**: 1.0
