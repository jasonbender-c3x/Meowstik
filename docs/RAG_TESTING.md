# Testing RAG Ingestion

This document provides simple tests to verify RAG ingestion is working correctly.

## Prerequisites

1. Start the Meowstik server:
```bash
npm run dev
```

2. Ensure PostgreSQL is running and configured

3. Set `GEMINI_API_KEY` environment variable

---

## Test 1: Text Ingestion via API

```bash
# Test ingesting plain text
curl -X POST http://localhost:5000/api/knowledge/pipeline/ingest/text \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Meowstik is an AI assistant platform built with React, Express, and Google Gemini. It supports RAG for document ingestion and semantic search.",
    "title": "About Meowstik",
    "sourceType": "upload"
  }'

# Expected response:
# {"success":true,"evidenceId":"evidence-uuid-here"}
```

---

## Test 2: Search Ingested Content

```bash
# Wait a few seconds for processing, then search
curl -X POST http://localhost:5000/api/knowledge/pipeline/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is Meowstik?",
    "limit": 5,
    "threshold": 0.25
  }'

# Expected response:
# {"results":[{"evidenceId":"...","content":"...","score":0.87}]}
```

---

## Test 3: Retrieve Context for Prompt

```bash
curl -X POST http://localhost:5000/api/knowledge/pipeline/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Tell me about the tech stack",
    "maxTokens": 2000,
    "includeEntities": true
  }'

# Expected response includes:
# - items: Array of retrieved chunks
# - formatted: Markdown-formatted context
# - stats: Token usage and timing
```

---

## Test 4: Check Pipeline Stats

```bash
curl http://localhost:5000/api/knowledge/pipeline/stats

# Expected response:
# {
#   "totalEvidence": 1,
#   "byStatus": {"indexed": 1, "pending": 0, ...},
#   "byBucket": {"PERSONAL_LIFE": 0, "CREATOR": 1, ...},
#   "totalEntities": 3,
#   "recentlyProcessed": 1
# }
```

---

## Test 5: Directory Ingestion

Create a test directory with sample files:

```bash
# Create test directory
mkdir -p /tmp/test-docs
echo "# Document 1\nThis is a test document about TypeScript." > /tmp/test-docs/doc1.md
echo "# Document 2\nThis covers React and component design." > /tmp/test-docs/doc2.md
echo "const hello = 'world';" > /tmp/test-docs/test.js

# Ingest directory
npm run ingest:dir /tmp/test-docs

# Expected output:
# ✓ Ingested: /tmp/test-docs/doc1.md (50 chars) -> evidence-uuid-1
# ✓ Ingested: /tmp/test-docs/doc2.md (48 chars) -> evidence-uuid-2
# ✓ Ingested: /tmp/test-docs/test.js (22 chars) -> evidence-uuid-3
```

---

## Test 6: Repository Ingestion (Optional)

Test with a small public repository:

```bash
# Clone and ingest a small repo (replace with your own test repo)
npm run ingest:repo https://github.com/octocat/Hello-World.git main

# Expected output:
# Cloning repository...
# ✓ Repository cloned successfully
# Found X source files to ingest
# ✓ Ingested: README.md (123 chars) -> evidence-uuid
# ...
```

---

## Test 7: UI-Based Ingestion

1. Navigate to `http://localhost:5000/knowledge`
2. Click "Scan Sources" button
3. Wait for Gmail/Drive sources to appear
4. Click "Ingest All" or select individual sources
5. Monitor progress in "Jobs" tab

---

## Verification Checklist

- [ ] Text ingestion succeeds and returns `evidenceId`
- [ ] Search returns relevant results with scores
- [ ] Retrieve returns formatted context and stats
- [ ] Pipeline stats show correct counts
- [ ] Directory ingestion processes all supported files
- [ ] Repository ingestion clones and ingests successfully
- [ ] UI shows sources and jobs correctly
- [ ] Chat messages are auto-ingested (check by asking AI to recall earlier conversation)

---

## Troubleshooting

### No search results
- Check if content was actually ingested: `GET /api/knowledge/pipeline/stats`
- Lower threshold to 0.25 or 0.15
- Increase topK to 20

### Ingestion fails
- Check server logs for errors
- Verify `GEMINI_API_KEY` is set
- Ensure PostgreSQL is running
- Check vector store is initialized

### Scripts fail
- Ensure `tsx` is installed: `npm install -g tsx`
- Run from project root directory
- Check file permissions

---

*Last updated: January 14, 2026*
