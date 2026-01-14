# RAG Documentation Index

**Quick Navigation**: All RAG-related documentation in Meowstik

---

## 🚀 Getting Started

**New to RAG ingestion? Start here:**

→ **[How to Initiate RAG Ingestion](./HOW_TO_INITIATE_RAG_INGESTION.md)** ⭐  
*Answers: "How do I initiate ingestion of repos and documents or directories of documents?"*

---

## 📚 Documentation Library

### Quick References

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [RAG Quick Reference](./RAG_QUICK_REFERENCE.md) | Commands and API examples | 5 min |
| [RAG Testing Guide](./RAG_TESTING.md) | Test procedures and validation | 10 min |

### Comprehensive Guides

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [RAG Ingestion Guide](./RAG_INGESTION_GUIDE.md) | Complete API reference and examples | 30 min |
| [RAG Analysis](./ragent/RAG-ANALYSIS.md) | Architecture analysis and improvements | 20 min |
| [RAG Pipeline](./RAG_PIPELINE.md) | Internal pipeline documentation | 15 min |

### Architecture & Design

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [Cognitive Architecture 2.0](./COGNITIVE_ARCHITECTURE_2.0.md) | Advanced retrieval features | 25 min |
| [Vector Store README](../server/services/vector-store/README.md) | Vector store implementation | 10 min |

---

## 🛠️ Quick Commands

### Ingestion

```bash
# Ingest a directory
npm run ingest:dir ./docs

# Ingest a Git repository
npm run ingest:repo https://github.com/user/repo.git main

# Ingest text via API
curl -X POST http://localhost:5000/api/knowledge/pipeline/ingest/text \
  -H "Content-Type: application/json" \
  -d '{"content": "...", "title": "..."}'
```

### Search & Retrieval

```bash
# Search ingested content
curl -X POST http://localhost:5000/api/knowledge/pipeline/search \
  -d '{"query": "search term", "limit": 10}'

# Retrieve context for prompts
curl -X POST http://localhost:5000/api/knowledge/pipeline/retrieve \
  -d '{"query": "...", "maxTokens": 4000}'

# Check pipeline stats
curl http://localhost:5000/api/knowledge/pipeline/stats
```

---

## 📍 UI Locations

| Feature | URL | Description |
|---------|-----|-------------|
| Knowledge Hub | `/knowledge` | Scan Gmail/Drive, manage ingestion jobs |
| RAG Debug | `/rag-debug` | View ingestion traces and search logs |
| Chat Interface | `/` | Upload files, auto-ingest messages |

---

## 🎯 Use Case Matrix

| I want to... | Use this method | Documentation |
|-------------|----------------|---------------|
| Ingest emails/Drive docs | UI - Knowledge Hub | [How-To Guide](./HOW_TO_INITIATE_RAG_INGESTION.md#1-ui-knowledge-hub) |
| Upload docs while chatting | UI - File Upload | [How-To Guide](./HOW_TO_INITIATE_RAG_INGESTION.md#2-ui-file-upload) |
| Automate ingestion | API - Text Ingestion | [Ingestion Guide](./RAG_INGESTION_GUIDE.md#manual-text-ingestion) |
| Ingest all docs in folder | CLI - Directory Script | [How-To Guide](./HOW_TO_INITIATE_RAG_INGESTION.md#4-cli-directory-ingestion) |
| Ingest entire codebase | CLI - Repository Script | [How-To Guide](./HOW_TO_INITIATE_RAG_INGESTION.md#5-cli-repository-ingestion) |
| Have AI remember chats | Automatic | [How-To Guide](./HOW_TO_INITIATE_RAG_INGESTION.md#6-automatic-chat-message-ingestion) |

---

## 🧪 Testing & Validation

→ See [RAG Testing Guide](./RAG_TESTING.md) for:
- Manual API tests
- Directory ingestion tests
- Repository ingestion tests
- UI-based testing procedures

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Ingestion Methods                  │
├─────────────────────────────────────────────────────┤
│ UI      │ API       │ CLI       │ Auto              │
│ Gmail   │ Text      │ Directory │ Chat Messages     │
│ Drive   │ Endpoints │ Repos     │ (automatic)       │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│              Ingestion Pipeline                     │
│  (server/services/ingestion-pipeline.ts)            │
│                                                     │
│  • Text Extraction                                  │
│  • Chunking (paragraph/sentence/semantic)           │
│  • Embedding (Gemini text-embedding-004)            │
│  • Entity Extraction                                │
│  • Bucket Classification                            │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│                 Storage Layer                       │
├──────────────────────┬──────────────────────────────┤
│   Vector Store       │       PostgreSQL             │
│  (pgvector/Vertex)   │  (document_chunks, evidence) │
│  • Semantic Search   │  • Persistence               │
│  • Fast Retrieval    │  • Metadata                  │
└──────────────────────┴──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│                Retrieval & Search                   │
│                                                     │
│  • Semantic Search                                  │
│  • Hybrid Search (semantic + keyword/BM25)          │
│  • Re-ranking                                       │
│  • Context Synthesis                                │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Key Components

### Server Services

- **ingestion-pipeline.ts**: Main ingestion orchestration
- **rag-service.ts**: RAG operations (ingest documents, retrieve context)
- **chunking-service.ts**: Document chunking strategies
- **embedding-service.ts**: Gemini embedding generation
- **vector-store/**: Vector store adapters (pgvector, Vertex, memory)
- **retrieval-orchestrator.ts**: Advanced retrieval with hybrid search

### API Routes

- **/api/knowledge/**: Knowledge ingestion endpoints
- **/api/knowledge/pipeline/**: Pipeline operations (ingest, search, retrieve)
- **/api/debug/rag**: Debug traces and logs

### UI Pages

- **client/src/pages/knowledge-ingestion.tsx**: Knowledge Hub UI
- **client/src/pages/rag-debug.tsx**: RAG debugging interface

### Scripts

- **scripts/ingest-directory.ts**: Directory batch ingestion
- **scripts/ingest-repo.ts**: Repository cloning and ingestion

---

## 📦 Dependencies

### Core
- **@google/genai**: Gemini embeddings
- **drizzle-orm**: Database ORM
- **PostgreSQL**: Data persistence

### Vector Stores
- **pgvector**: PostgreSQL vector extension
- **@google-cloud/aiplatform**: Vertex AI (optional)

---

## 🔗 External Resources

- [Gemini API Documentation](https://ai.google.dev/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

---

## 📝 Contributing

When adding new RAG features:

1. Update relevant documentation in this directory
2. Add tests to [RAG_TESTING.md](./RAG_TESTING.md)
3. Update this index if adding new docs
4. Test all ingestion methods
5. Update architecture diagrams if needed

---

## 🆘 Support

### Common Questions

**Q: Which document should I read first?**  
A: Start with [How to Initiate RAG Ingestion](./HOW_TO_INITIATE_RAG_INGESTION.md)

**Q: I need API examples.**  
A: See [RAG Quick Reference](./RAG_QUICK_REFERENCE.md) or [RAG Ingestion Guide](./RAG_INGESTION_GUIDE.md)

**Q: How do I test my setup?**  
A: Follow [RAG Testing Guide](./RAG_TESTING.md)

**Q: I want to understand the architecture.**  
A: Read [RAG Analysis](./ragent/RAG-ANALYSIS.md) and [Cognitive Architecture 2.0](./COGNITIVE_ARCHITECTURE_2.0.md)

**Q: Something isn't working.**  
A: Check the Troubleshooting sections in [RAG Ingestion Guide](./RAG_INGESTION_GUIDE.md#troubleshooting)

---

*Last updated: January 14, 2026*  
*Documentation maintained by: Meowstik Development Team*
