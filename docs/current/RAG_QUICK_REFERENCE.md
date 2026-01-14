# RAG Ingestion Quick Reference

## 🚀 Quick Start

### Via UI
1. Navigate to `/knowledge` in the app
2. Click "Scan Sources" to find Gmail/Drive conversations
3. Click "Ingest All" or select individual sources

### Via API
```bash
# Ingest text directly
curl -X POST http://localhost:5000/api/knowledge/pipeline/ingest/text \
  -H "Content-Type: application/json" \
  -d '{"content": "Your text here", "title": "Doc Title"}'

# Search ingested content
curl -X POST http://localhost:5000/api/knowledge/pipeline/search \
  -H "Content-Type: application/json" \
  -d '{"query": "search term", "limit": 10}'
```

### Via Scripts
```bash
# Ingest a directory
npm run ingest:dir ./docs

# Ingest a Git repository
npm run ingest:repo https://github.com/user/repo.git main
```

---

## 📋 All Ingestion Methods

| Method | Use Case | Command/Action |
|--------|----------|----------------|
| **Gmail/Drive Scan** | LLM conversations from Google | UI: `/knowledge` → "Scan Sources" |
| **Text API** | Direct text content | `POST /api/knowledge/pipeline/ingest/text` |
| **File Upload** | Documents via chat | Click 📎 in chat → upload files |
| **Auto Message** | Chat memory (automatic) | Happens on every message > 20 chars |
| **Directory Batch** | Bulk file ingestion | `npm run ingest:dir <path>` |
| **Repository Clone** | Entire codebase | `npm run ingest:repo <url> [branch]` |

---

## 🔍 Search & Retrieval

### Basic Search
```bash
curl -X POST http://localhost:5000/api/knowledge/pipeline/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is RAG?",
    "limit": 10,
    "threshold": 0.25
  }'
```

### Advanced Retrieval (with context synthesis)
```bash
curl -X POST http://localhost:5000/api/knowledge/pipeline/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Explain the architecture",
    "maxTokens": 4000,
    "includeEntities": true
  }'
```

---

## 📊 Monitoring

### Check Pipeline Stats
```bash
curl http://localhost:5000/api/knowledge/pipeline/stats
```

### Get Recent Evidence
```bash
curl http://localhost:5000/api/knowledge/pipeline/evidence?limit=20
```

### Get Entities
```bash
curl http://localhost:5000/api/knowledge/pipeline/entities?limit=50
```

### Debug Interface
Navigate to `/rag-debug` for detailed traces

---

## 🎯 Knowledge Buckets

| Bucket | Content Type | Example |
|--------|-------------|---------|
| `PERSONAL_LIFE` | Personal facts, preferences | "I live in Seattle", "My favorite color is blue" |
| `CREATOR` | Technical work, coding, research | Code snippets, technical docs, research papers |
| `PROJECTS` | Project work, tasks, deadlines | "Project X deadline is Friday", "Bug in module Y" |

Filter by bucket in searches:
```bash
curl -X POST http://localhost:5000/api/knowledge/pipeline/search \
  -d '{"query": "...", "bucket": "CREATOR"}'
```

---

## 🔧 Configuration

### Vector Store Types
Set via `VECTOR_STORE_TYPE` environment variable:
- `pgvector` - PostgreSQL with pgvector (production)
- `vertex` - Google Vertex AI (Google Cloud)
- `memory` - In-memory (development/testing)

### Chunking Parameters
```typescript
{
  strategy: 'paragraph' | 'sentence' | 'fixed' | 'semantic',
  maxChunkSize: 1000,
  minChunkSize: 25,
  overlap: 50
}
```

### Retrieval Parameters
```typescript
{
  topK: 20,           // Number of results
  threshold: 0.25,    // Similarity threshold (0-1)
  useHybridSearch: true,
  useReranking: true,
  useContextSynthesis: true
}
```

---

## 📁 Supported File Types

### Documents
- `.md` - Markdown
- `.txt` - Plain text
- `.pdf` - PDF (with text extraction)

### Code
- `.js`, `.ts`, `.tsx`, `.jsx` - JavaScript/TypeScript
- `.py` - Python
- `.java` - Java
- `.c`, `.cpp`, `.h`, `.hpp` - C/C++
- `.go` - Go
- `.rs` - Rust
- `.rb` - Ruby
- `.php` - PHP
- `.sh`, `.bash` - Shell scripts

### Data
- `.json` - JSON
- `.yaml`, `.yml` - YAML
- `.xml` - XML
- `.csv` - CSV

### Web
- `.html` - HTML
- `.css`, `.scss`, `.less` - Stylesheets

---

## ⚙️ Advanced Features

### Hybrid Search
Combines semantic similarity + keyword matching (BM25)
```typescript
const result = await ragService.retrieveAdvanced(query, userId, {
  useHybridSearch: true,
  topK: 20
});
```

### Re-ranking
Improves relevance of retrieved results
```typescript
const reranked = await rerankerService.rerank(query, chunks, {
  strategy: 'hybrid',
  topK: 10
});
```

### Context Synthesis
Compresses and synthesizes retrieved chunks
```typescript
const synthesis = await contextSynthesisService.synthesize(
  query,
  chunks,
  { maxTokens: 4000, strategy: 'hybrid', deduplicate: true }
);
```

---

## 🐛 Common Issues

### No Search Results
- Lower threshold: Try `0.25` instead of `0.5`
- Increase topK: Try `20` instead of `5`
- Check if content was ingested: `GET /api/knowledge/pipeline/stats`

### Ingestion Failed
- Check server logs
- Verify Gemini API key
- Check PostgreSQL connection
- Ensure file is text-based (not binary)

### Vector Store Error
- Check `VECTOR_STORE_TYPE` environment variable
- For pgvector: Verify `CREATE EXTENSION vector;` in PostgreSQL
- Fallback to memory: `VECTOR_STORE_TYPE=memory`

---

## 📖 Full Documentation

See [RAG_INGESTION_GUIDE.md](./RAG_INGESTION_GUIDE.md) for complete documentation.

---

*Last updated: January 14, 2026*
