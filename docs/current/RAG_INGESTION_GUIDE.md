# RAG Ingestion Guide

**Last Updated:** January 14, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Ingestion Methods](#ingestion-methods)
   - [Gmail & Google Drive Scanning](#gmail--google-drive-scanning)
   - [Manual Text Ingestion](#manual-text-ingestion)
   - [File Upload Ingestion](#file-upload-ingestion)
   - [Conversation Message Ingestion](#conversation-message-ingestion)
   - [Directory Batch Ingestion](#directory-batch-ingestion)
   - [Repository Ingestion](#repository-ingestion)
4. [API Reference](#api-reference)
5. [UI Guide](#ui-guide)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Meowstik's RAG (Retrieval-Augmented Generation) system allows you to ingest and index various types of content for intelligent retrieval during AI conversations. The system supports:

- **Email & Drive Documents**: Automatically scan and ingest from Gmail and Google Drive
- **Manual Text**: Directly submit text content via API
- **File Uploads**: Upload documents (PDF, markdown, text, code files)
- **Conversations**: Auto-ingest chat messages for memory recall
- **Directories**: Batch ingest multiple files from a directory
- **Repositories**: Ingest entire codebases for code-aware assistance

### Key Features

- ✅ **Multiple Vector Stores**: pgvector (PostgreSQL), Vertex AI, or in-memory
- ✅ **Semantic Search**: Google's text-embedding-004 embeddings
- ✅ **Hybrid Search**: Combines semantic similarity with keyword matching (BM25)
- ✅ **Re-ranking**: Improves relevance of retrieved results
- ✅ **Context Synthesis**: Intelligent summarization of retrieved chunks
- ✅ **Knowledge Buckets**: Organized storage (PERSONAL_LIFE, CREATOR, PROJECTS)
- ✅ **Entity Extraction**: Automatically identifies people, places, concepts
- ✅ **User Isolation**: Separate data stores for authenticated vs guest users

---

## Architecture

### Data Flow

```
┌─────────────────┐
│   Data Source   │  (Gmail, Drive, Upload, Chat, Directory, Repo)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Text Extraction│  (Parse PDF, markdown, code, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Chunking     │  (Split into semantic chunks)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Embedding     │  (Generate 768-dim vectors via Gemini)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vector Store   │  (pgvector / Vertex AI / Memory)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL DB  │  (document_chunks, evidence, entities)
└─────────────────┘
```

### Storage Layers

1. **Vector Store**: Fast semantic search (pgvector, Vertex AI, or in-memory)
2. **PostgreSQL**: Persistent storage of chunks, metadata, entities
3. **Knowledge Buckets**: Organized categories for filtering

---

## Ingestion Methods

### Gmail & Google Drive Scanning

**What it does**: Scans your Gmail and Google Drive for LLM conversations and relevant documents.

#### UI Method

1. Navigate to `/knowledge` or click "Knowledge Hub" from the sidebar
2. Click "Scan Sources" button
3. Review discovered conversation sources
4. Click "Ingest All" or select individual sources to ingest

#### API Method

```bash
# Scan for sources
curl -X POST http://localhost:5000/api/knowledge/scan

# Response:
{
  "success": true,
  "newSourcesFound": 5,
  "totalSources": 12,
  "sources": [...]
}

# Ingest a specific source
curl -X POST http://localhost:5000/api/knowledge/ingest/{sourceId}

# Ingest all pending sources
curl -X POST http://localhost:5000/api/knowledge/ingest-all

# Response:
{
  "success": true,
  "jobsStarted": 5,
  "jobIds": ["job-id-1", "job-id-2", ...]
}
```

#### What Gets Scanned

**Gmail searches:**
- `from:gemini`
- `from:aistudio`
- `from:txt.voice.google.com`
- `subject:AI conversation`

**Drive searches:**
- `name contains 'conversation'`
- `name contains 'chat'`
- `name contains 'message-export'`
- `fullText contains 'Gemini'`

---

### Manual Text Ingestion

**What it does**: Directly ingest text content via API (ideal for scripts, automation).

```bash
curl -X POST http://localhost:5000/api/knowledge/pipeline/ingest/text \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Your text content here...",
    "title": "My Important Document",
    "sourceType": "upload"
  }'

# Response:
{
  "success": true,
  "evidenceId": "evidence-id-123"
}
```

#### Node.js Example

```javascript
const response = await fetch('http://localhost:5000/api/knowledge/pipeline/ingest/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Your text content here...',
    title: 'My Important Document',
    sourceType: 'upload'
  })
});

const result = await response.json();
console.log('Evidence ID:', result.evidenceId);
```

---

### File Upload Ingestion

**What it does**: Upload and ingest documents through the chat interface.

#### Supported File Types

- **Documents**: PDF, TXT, Markdown (`.md`)
- **Code**: JavaScript, TypeScript, Python, Java, C++, etc.
- **Data**: JSON, CSV, XML, YAML
- **Office**: (via text extraction)

#### UI Method

1. In any chat conversation, click the attachment icon (📎)
2. Select files to upload
3. Files are automatically ingested into RAG if they contain text content
4. Use RAG-enhanced responses by mentioning uploaded documents

#### How It Works

When you upload a file:
1. File content is extracted (PDF text extraction for PDFs)
2. Content is chunked based on file type (semantic chunking)
3. Chunks are embedded using Gemini text-embedding-004
4. Embeddings are stored in vector store + PostgreSQL
5. File is available for retrieval in future queries

---

### Conversation Message Ingestion

**What it does**: Automatically ingests chat messages for long-term memory and recall.

#### Automatic Ingestion

- Enabled by default for all chat conversations
- Messages > 20 characters are ingested
- Trivial messages ("hi", "thanks", "ok") are filtered
- Both user and AI messages are ingested

#### How It Works

```typescript
// This happens automatically on every message
await ragService.ingestMessage(
  content,
  chatId,
  messageId,
  role, // "user" or "ai"
  timestamp,
  userId // for data isolation
);
```

#### Data Isolation

- **Guest users**: Messages stored in GUEST_USER_ID bucket (no cross-user access)
- **Authenticated users**: Messages stored with userId for privacy
- Retrieval automatically filters by userId to prevent data leakage

#### Querying Past Conversations

```bash
curl -X POST http://localhost:5000/api/knowledge/pipeline/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What did I say about my project?",
    "maxTokens": 4000,
    "includeEntities": true
  }'

# Response includes relevant past messages
```

---

### Directory Batch Ingestion

**What it does**: Ingest all files from a directory recursively.

#### Using the Ingestion Pipeline

```javascript
import { ingestionPipeline } from './server/services/ingestion-pipeline';
import fs from 'fs';
import path from 'path';

async function ingestDirectory(dirPath: string) {
  const files = fs.readdirSync(dirPath, { recursive: true });
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file.toString());
    const stat = fs.statSync(fullPath);
    
    if (stat.isFile()) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const result = await ingestionPipeline.ingestText({
        sourceType: 'upload',
        modality: 'document',
        title: path.basename(fullPath),
        rawContent: content,
        extractedText: content,
      });
      
      console.log(`Ingested: ${fullPath} -> ${result.id}`);
    }
  }
}

// Usage
await ingestDirectory('./docs');
```

#### CLI Script

Create `scripts/ingest-directory.ts`:

```typescript
import { ingestionPipeline } from '../server/services/ingestion-pipeline';
import fs from 'fs';
import path from 'path';

const dirPath = process.argv[2];
if (!dirPath) {
  console.error('Usage: node ingest-directory.js <directory-path>');
  process.exit(1);
}

async function ingestDirectory(dir: string) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      await ingestDirectory(fullPath); // Recursive
    } else if (file.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        await ingestionPipeline.ingestText({
          sourceType: 'upload',
          modality: 'document',
          title: file.name,
          rawContent: content,
          extractedText: content,
        });
        console.log(`✓ ${fullPath}`);
      } catch (error) {
        console.error(`✗ ${fullPath}:`, error.message);
      }
    }
  }
}

await ingestDirectory(dirPath);
console.log('Directory ingestion complete!');
```

Run with:
```bash
npm run build
node dist/scripts/ingest-directory.js ./my-docs
```

---

### Repository Ingestion

**What it does**: Clone and ingest entire Git repositories for code-aware assistance.

#### Using the Ingestion Pipeline

```javascript
import { execSync } from 'child_process';
import { ingestionPipeline } from './server/services/ingestion-pipeline';
import fs from 'fs';
import path from 'path';

async function ingestRepository(repoUrl: string, branch = 'main') {
  const tempDir = `/tmp/repo-${Date.now()}`;
  
  // Clone repository
  execSync(`git clone --depth 1 --branch ${branch} ${repoUrl} ${tempDir}`);
  
  // Get all source files (customize extensions as needed)
  const extensions = ['.js', '.ts', '.tsx', '.py', '.java', '.md', '.txt'];
  const files = getAllFiles(tempDir, extensions);
  
  console.log(`Found ${files.length} files to ingest`);
  
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(tempDir, filePath);
      
      await ingestionPipeline.ingestText({
        sourceType: 'web', // or create a new 'repository' source type
        modality: 'document',
        title: relativePath,
        rawContent: content,
        extractedText: content,
      });
      
      console.log(`✓ Ingested: ${relativePath}`);
    } catch (error) {
      console.error(`✗ Failed: ${filePath}`, error.message);
    }
  }
  
  // Cleanup
  execSync(`rm -rf ${tempDir}`);
  console.log('Repository ingestion complete!');
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    // Skip common directories that shouldn't be ingested
    if (item.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(item.name)) {
        files.push(...getAllFiles(fullPath, extensions));
      }
    } else if (extensions.some(ext => item.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Usage
await ingestRepository('https://github.com/user/repo.git', 'main');
```

#### CLI Script

Create `scripts/ingest-repo.ts`:

```typescript
import { execSync } from 'child_process';
import { ingestionPipeline } from '../server/services/ingestion-pipeline';
import fs from 'fs';
import path from 'path';

const repoUrl = process.argv[2];
const branch = process.argv[3] || 'main';

if (!repoUrl) {
  console.error('Usage: node ingest-repo.js <repo-url> [branch]');
  process.exit(1);
}

// [Include getAllFiles function from above]

await ingestRepository(repoUrl, branch);
```

Run with:
```bash
npm run build
node dist/scripts/ingest-repo.js https://github.com/user/repo.git main
```

---

## API Reference

### Knowledge Ingestion Endpoints

#### Scan Sources
```
POST /api/knowledge/scan
```
Scans Gmail and Google Drive for conversation sources.

**Response:**
```json
{
  "success": true,
  "newSourcesFound": 5,
  "totalSources": 12,
  "sources": [...]
}
```

---

#### Ingest Source
```
POST /api/knowledge/ingest/:sourceId
```
Ingests a specific conversation source.

**Response:**
```json
{
  "success": true,
  "jobId": "job-uuid"
}
```

---

#### Ingest All Sources
```
POST /api/knowledge/ingest-all
```
Ingests all pending conversation sources.

**Response:**
```json
{
  "success": true,
  "jobsStarted": 5,
  "jobIds": ["job-1", "job-2", ...]
}
```

---

#### Ingest Text
```
POST /api/knowledge/pipeline/ingest/text
```
Directly ingest text content.

**Request Body:**
```json
{
  "content": "Your text content here...",
  "title": "Document Title",
  "sourceType": "upload"
}
```

**Response:**
```json
{
  "success": true,
  "evidenceId": "evidence-uuid"
}
```

---

#### Search Knowledge
```
POST /api/knowledge/pipeline/search
```
Perform semantic search on ingested content.

**Request Body:**
```json
{
  "query": "What is the main theme?",
  "bucket": "CREATOR",
  "limit": 10,
  "threshold": 0.5
}
```

**Response:**
```json
{
  "results": [
    {
      "evidenceId": "uuid",
      "content": "Relevant chunk...",
      "score": 0.87
    }
  ]
}
```

---

#### Retrieve Context
```
POST /api/knowledge/pipeline/retrieve
```
Retrieve formatted context for prompt augmentation.

**Request Body:**
```json
{
  "query": "Tell me about my projects",
  "maxTokens": 4000,
  "includeEntities": true
}
```

**Response:**
```json
{
  "items": [...],
  "formatted": "## Retrieved Context\n...",
  "stats": {
    "totalTokensUsed": 1234,
    "searchTime": 45,
    "queryEmbeddingTime": 23
  }
}
```

---

### Pipeline Stats & Evidence

#### Get Pipeline Stats
```
GET /api/knowledge/pipeline/stats
```
Returns ingestion pipeline statistics.

**Response:**
```json
{
  "totalEvidence": 1234,
  "byStatus": {
    "pending": 5,
    "processing": 2,
    "indexed": 1200,
    "failed": 27
  },
  "byBucket": {
    "PERSONAL_LIFE": 300,
    "CREATOR": 700,
    "PROJECTS": 234
  },
  "totalEntities": 567,
  "recentlyProcessed": 23
}
```

---

#### Get Recent Evidence
```
GET /api/knowledge/pipeline/evidence?limit=20
```
Returns recently ingested evidence items.

---

#### Get Evidence by Bucket
```
GET /api/knowledge/pipeline/evidence?bucket=CREATOR&limit=50
```
Filter evidence by knowledge bucket.

---

#### Get Entities
```
GET /api/knowledge/pipeline/entities?limit=50
```
Returns extracted entities (people, places, concepts).

**Query Params:**
- `type`: Filter by entity type (person, place, organization, etc.)
- `q`: Search entities by name

---

## UI Guide

### Knowledge Hub (`/knowledge`)

1. **Navigation**: Click "Knowledge Hub" in the sidebar or navigate to `/knowledge`

2. **Scan Sources**:
   - Click "Scan Sources" button
   - System searches Gmail and Drive for LLM conversations
   - Results appear in the "Sources" tab

3. **Review Sources**:
   - Each source shows:
     - Title (email subject or document name)
     - Participants
     - Message count
     - Date range
     - Status (pending, processing, completed, failed)

4. **Ingest Sources**:
   - **Single**: Click play button (▶) on individual source
   - **Batch**: Click "Ingest All" to process all pending sources

5. **Monitor Jobs**:
   - Switch to "Jobs" tab
   - View real-time progress of ingestion jobs
   - See messages processed, progress percentage, and errors

### Chat Interface

1. **Upload Documents**:
   - Click attachment icon (📎) in message input
   - Select files (PDF, markdown, code, etc.)
   - Files are auto-ingested into RAG

2. **Query Uploaded Documents**:
   - Ask questions about uploaded content
   - AI retrieves relevant chunks automatically
   - Context is included in AI response

---

## Best Practices

### Chunking Strategies

- **Short Messages**: Use sentence-based chunking (automatically applied)
- **Long Documents**: Use paragraph or semantic chunking
- **Code Files**: Use fixed-size chunks with overlap
- **Markdown**: Use semantic chunking by headers

### Retrieval Thresholds

- **Strict Relevance**: threshold = 0.5-0.7 (fewer, more relevant results)
- **Better Recall**: threshold = 0.25-0.4 (more results, some less relevant)
- **Default**: 0.25 (balanced)

### Knowledge Buckets

Organize content into buckets for better filtering:

- **PERSONAL_LIFE**: Personal facts, preferences, relationships
- **CREATOR**: Technical content, coding, research, creative work
- **PROJECTS**: Specific project work, tasks, deadlines

### Entity Extraction

Automatically extracts:
- **People**: Names, relationships
- **Places**: Locations, addresses
- **Organizations**: Companies, teams
- **Concepts**: Technologies, methodologies
- **Projects**: Project names, codenames
- **Technologies**: Languages, frameworks, tools

### Data Isolation

- **Guest Users**: All data stored in GUEST_USER_ID bucket
- **Authenticated Users**: Data scoped to userId
- Retrieval automatically filters by userId to prevent data leakage

---

## Troubleshooting

### No Results from Retrieval

**Problem**: Queries return empty or few results.

**Solutions**:
1. Lower threshold: Try 0.25 instead of 0.5
2. Increase topK: Try 20 instead of 5
3. Check if content was actually ingested:
   ```bash
   curl http://localhost:5000/api/knowledge/pipeline/stats
   ```
4. Verify chunks weren't filtered:
   - Minimum chunk size is 25 characters
   - Check chunking service logs

### Ingestion Jobs Stuck

**Problem**: Jobs remain in "running" status indefinitely.

**Solutions**:
1. Check server logs for errors
2. Verify Gemini API key is valid
3. Check PostgreSQL connection
4. Restart the server to clear stuck jobs

### Vector Store Errors

**Problem**: "Vector store not initialized" or similar errors.

**Solutions**:
1. Check `VECTOR_STORE_TYPE` environment variable
2. If using pgvector:
   - Verify PostgreSQL has pgvector extension
   - Run: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Fallback to memory adapter by setting:
   ```bash
   VECTOR_STORE_TYPE=memory
   ```

### PDF Extraction Failures

**Problem**: PDF files fail to ingest or extract no text.

**Solutions**:
1. Ensure PDF contains actual text (not scanned images)
2. Check file size (very large PDFs may timeout)
3. Try manual text extraction first
4. Use OCR for scanned PDFs before ingestion

### Out of Memory

**Problem**: Server crashes during bulk ingestion.

**Solutions**:
1. Ingest in smaller batches
2. Add delay between ingestions
3. Increase Node.js memory:
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 npm start
   ```

---

## Advanced Topics

### Custom Chunking Strategy

```typescript
import { chunkingService } from './server/services/chunking-service';

const chunks = await chunkingService.chunkDocument(
  content,
  documentId,
  filename,
  mimeType,
  {
    strategy: 'semantic', // paragraph | sentence | fixed | semantic
    maxChunkSize: 1000,
    minChunkSize: 25,
    overlap: 50
  }
);
```

### Hybrid Search

Combine semantic and keyword search for better results:

```typescript
import { ragService } from './server/services/rag-service';

const result = await ragService.retrieveAdvanced(
  query,
  userId,
  {
    topK: 20,
    useHybridSearch: true,
    useReranking: true,
    useContextSynthesis: true,
    maxTokens: 4000
  }
);
```

### Context Synthesis

Intelligently compress and synthesize retrieved chunks:

```typescript
import { contextSynthesisService } from './server/services/context-synthesis';

const synthesis = await contextSynthesisService.synthesize(
  query,
  chunks.map((chunk, i) => ({ chunk, relevance: scores[i] })),
  {
    maxTokens: 4000,
    strategy: 'hybrid',
    deduplicate: true
  }
);

console.log(synthesis.content); // Synthesized context
console.log(synthesis.compressionRatio); // e.g., 0.65 (35% reduction)
```

---

## Performance Optimization

### Batch Operations

Use batch operations for better performance:

```typescript
// Bad: Multiple individual ingests
for (const content of contents) {
  await ingestionPipeline.ingestText(...);
}

// Good: Batch processing
const results = await Promise.all(
  contents.map(content => ingestionPipeline.ingestText(...))
);
```

### Vector Store Selection

- **pgvector**: Best for production (persistent, fast, scalable)
- **Vertex AI**: Best for Google Cloud deployments
- **Memory**: Best for development/testing (fast, non-persistent)

### Embedding Caching

Embeddings are automatically cached in PostgreSQL. No additional configuration needed.

---

## Monitoring & Debugging

### RAG Debug Page

Navigate to `/rag-debug` for detailed ingestion and retrieval traces.

### Check Ingestion Pipeline

```bash
curl http://localhost:5000/api/knowledge/pipeline/stats
```

### Check Retrieval Stats

```bash
curl http://localhost:5000/api/knowledge/pipeline/retrieval-stats
```

---

## Related Documentation

- [RAG Analysis & Improvements](./ragent/RAG-ANALYSIS.md)
- [Cognitive Architecture 2.0](./COGNITIVE_ARCHITECTURE_2.0.md)
- [Database Schemas](./01-database-schemas.md)
- [Vector Store README](../server/services/vector-store/README.md)

---

*Last updated: January 14, 2026*
