# Meowstik RAG Stack Analysis & Improvement Plan

**Date:** January 7, 2026  
**Status:** Critical Issues Identified  
**Priority:** High - Memory System Broken

---

## Executive Summary

Meowstik's RAG (Retrieval-Augmented Generation) system is experiencing severe "memory loss" issues. The AI forgets conversations because, while messages are being sent to the ingestion pipeline, they are being **filtered out** before reaching the vector store due to overly aggressive chunk size thresholds.

**Root Cause:** `minChunkSize=100` chars filters out most chat messages before they can be stored.

---

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [Data Flow Analysis](#data-flow-analysis)
3. [Critical Issues Found](#critical-issues-found)
4. [Proposed Solutions](#proposed-solutions)
5. [Implementation Plan](#implementation-plan)
6. [New Features: Tags Replace Buckets](#new-features-tags-replace-buckets)
7. [RAG Debug Page Design](#rag-debug-page-design)
8. [Testing & Validation](#testing--validation)

---

## Current Architecture

### File Structure

```
server/services/
├── chunking-service.ts      # Document chunking strategies
├── embedding-service.ts     # Gemini text-embedding-004
├── ingestion-pipeline.ts    # Evidence table ingestion (legacy)
├── rag-service.ts           # Main RAG orchestration
├── retrieval-orchestrator.ts # Query & context assembly
└── vector-store/
    ├── index.ts             # Adapter factory
    ├── config.ts            # Store configuration
    ├── memory-adapter.ts    # In-memory fallback
    └── pgvector-adapter.ts  # PostgreSQL pgvector
```

### Component Responsibilities

| Component | Purpose | Status |
|-----------|---------|--------|
| **ChunkingService** | Split documents into semantic chunks | ⚠️ minChunkSize too high |
| **EmbeddingService** | Generate vector embeddings via Gemini | ✅ Working |
| **RAGService** | Ingest docs/messages, retrieve context | ⚠️ Chunks filtered out |
| **IngestionPipeline** | Legacy evidence table storage | ⚠️ Separate from vector store |
| **RetrievalOrchestrator** | Semantic + keyword search | ⚠️ Threshold too strict |
| **VectorStore** | Store/query embeddings | ✅ Working |

---

## Data Flow Analysis

### Ingestion Flow (Current)

```
User Message
    │
    ▼
routes.ts: ragService.ingestMessage()
    │
    ▼
rag-service.ts: chunkDocument()
    │
    ▼
chunking-service.ts: Filter chunks < 100 chars  ◀── PROBLEM: Most messages filtered!
    │
    ▼
[If chunks remain] → embedBatch() → vectorStore.upsertBatch()
    │
    ▼
[If no chunks] → Return null (message forgotten)
```

### Query Flow (Current)

```
User Query
    │
    ▼
rag-service.ts: retrieve()
    │
    ▼
vectorStore.search(topK=5, threshold=0.5)  ◀── PROBLEM: Threshold too strict
    │
    ▼
[Few/no results] → LLM has no context → Appears to "forget"
```

---

## Critical Issues Found

### Issue 1: Minimum Chunk Size Too High

**File:** `server/services/chunking-service.ts`  
**Line:** 47-48

```typescript
const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  strategy: "paragraph",
  maxChunkSize: 1000,
  minChunkSize: 100,  // ◀── PROBLEM: 100 chars is too high
  overlap: 50,
};
```

**Impact:**
- Average chat message: 50-80 characters
- Threshold: 100 characters minimum
- Result: **~70% of messages are filtered out and never stored**

**Evidence:**
```typescript
// Line 108 - the killer filter
return chunks.filter((c) => c.content.length >= opts.minChunkSize);
```

### Issue 2: Retrieval Threshold Too Strict

**File:** `server/services/retrieval-orchestrator.ts`  
**Line:** 48-51

```typescript
const semanticResults = await ingestionPipeline.semanticSearch(context.query, {
  limit: 20,
  threshold: 0.4,  // ◀── PROBLEM: Too strict for conversational recall
});
```

**File:** `server/services/rag-service.ts`  
**Line:** 170-174

```typescript
async retrieve(
  query: string,
  topK: number = 5,      // ◀── PROBLEM: Only 5 results
  threshold: number = 0.5  // ◀── PROBLEM: 0.5 is too strict
)
```

**Impact:**
- Semantic similarity for conversational context often scores 0.3-0.5
- With threshold at 0.4-0.5, marginal but useful context is excluded
- Result: **RAG returns empty or near-empty context**

### Issue 3: No Message Aging/Expiry Protection

**Current State:**
- Messages are stored if they pass the 100-char filter
- No mechanism to preserve "important" messages
- No recency weighting in retrieval

**Impact:**
- Old but important facts can be buried by newer trivial content
- No way to "pin" critical memories

### Issue 4: Knowledge Buckets Broken

**File:** `server/services/ingestion-pipeline.ts`  
**Line:** 16

```typescript
export type KnowledgeBucket = 'PERSONAL_LIFE' | 'CREATOR' | 'PROJECTS';
```

**Current State:**
- Buckets exist in the type system
- Default assignment is `PERSONAL_LIFE`
- No intelligent bucket assignment for new content
- Bucket filtering in retrieval is rarely used

**Impact:**
- All content piles into one bucket
- No semantic organization of memories
- Cross-domain confusion in retrieval

### Issue 5: Two Separate Ingestion Paths

**Path 1:** `ingestionPipeline.ingestText()` → `evidence` table only  
**Path 2:** `ragService.ingestDocument()` → `document_chunks` table + vector store

**Impact:**
- Evidence table has content NOT in vector store
- Vector store has content NOT in evidence table
- Inconsistent retrieval depending on which path was used

### Issue 6: No Debug Visibility

**Current State:**
- No tracing of ingestion events
- No visibility into why chunks are filtered
- No way to see what context reaches the LLM

**Impact:**
- Debugging requires reading logs manually
- No correlation between ingestion and query events

---

## Proposed Solutions

### Solution 1: Lower Chunk Minimum

**Change `minChunkSize` from 100 to 25 characters:**

```typescript
const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  strategy: "paragraph",
  maxChunkSize: 1000,
  minChunkSize: 25,  // ◀── Allow short messages
  overlap: 50,
};
```

**Rationale:**
- 25 chars = ~5 words minimum
- Filters truly trivial content ("ok", "thanks")
- Preserves meaningful short messages ("I live in Seattle")

### Solution 2: Relax Retrieval Thresholds

**Update `rag-service.ts`:**
```typescript
async retrieve(
  query: string,
  topK: number = 20,      // ◀── More candidates
  threshold: number = 0.25  // ◀── Lower threshold
)
```

**Update `retrieval-orchestrator.ts`:**
```typescript
const semanticResults = await ingestionPipeline.semanticSearch(context.query, {
  limit: 50,       // ◀── More candidates
  threshold: 0.25,  // ◀── Lower threshold
});
```

### Solution 3: Add Adaptive Chunking

**Implement content-aware strategy selection:**

```typescript
function selectChunkingStrategy(content: string, mimeType?: string): ChunkingStrategy {
  // Short content (< 500 chars) - don't split
  if (content.length < 500) return "fixed";
  
  // Markdown/docs - use semantic (headers)
  if (mimeType === "text/markdown" || content.includes("# ")) return "semantic";
  
  // Code - use fixed with overlap
  if (mimeType?.includes("javascript") || mimeType?.includes("python")) return "fixed";
  
  // Conversations - use sentence
  if (content.includes(": ") || content.includes("said")) return "sentence";
  
  // Default - paragraph
  return "paragraph";
}
```

### Solution 4: Replace Buckets with Tags

**New Tag-Based System:**

```typescript
interface MemoryTag {
  id: string;
  name: string;           // "projects", "preferences", "people", "code"
  confidence: number;     // 0-1 how confident the assignment
  source: "auto" | "user"; // Was it auto-assigned or user-pinned
}

interface TaggedChunk {
  chunkId: string;
  tags: MemoryTag[];
  importance: number;     // 0-1, user can boost
  lastAccessed: Date;     // For recency
  accessCount: number;    // For popularity
}
```

**Auto-Tagging Process:**
1. On ingestion, run lightweight LLM classification
2. Assign 1-3 relevant tags with confidence scores
3. Store tags in metadata
4. Use tags for filtered retrieval

**Tag Categories:**
- `preferences` - User likes, dislikes, settings
- `people` - Names, relationships, contacts
- `projects` - Work, code, tasks
- `facts` - General knowledge, definitions
- `events` - Dates, meetings, appointments
- `instructions` - How-tos, procedures
- `code` - Code snippets, technical content

### Solution 5: Add Recency Weighting

**Modify retrieval scoring:**

```typescript
function calculateScore(
  semanticScore: number,
  timestamp: Date,
  accessCount: number,
  importance: number
): number {
  const recencyDays = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
  const recencyBoost = Math.exp(-recencyDays / 30); // Decay over 30 days
  const popularityBoost = Math.log(accessCount + 1) / 10;
  
  return semanticScore * 0.6 + 
         recencyBoost * 0.2 + 
         popularityBoost * 0.1 + 
         importance * 0.1;
}
```

### Solution 6: RAG Debug Buffer & Page

**Create `server/services/rag-debug-buffer.ts`:**

```typescript
export interface RagTraceEvent {
  traceId: string;
  timestamp: string;
  stage: "ingest" | "chunk" | "embed" | "store" | "query" | "search" | "retrieve" | "inject";
  
  // Ingestion data
  documentId?: string;
  filename?: string;
  contentLength?: number;
  chunksCreated?: number;
  chunksFiltered?: number;
  
  // Query data
  query?: string;
  searchResults?: number;
  threshold?: number;
  topK?: number;
  
  // Results
  scores?: number[];
  chunkIds?: string[];
  
  // Timing
  durationMs: number;
  
  // Errors
  error?: string;
}
```

---

## Implementation Plan

### Phase 1: Critical Fixes (Immediate)

| Task | File | Change |
|------|------|--------|
| 1.1 | chunking-service.ts | Lower minChunkSize to 25 |
| 1.2 | rag-service.ts | Lower threshold to 0.25, raise topK to 20 |
| 1.3 | retrieval-orchestrator.ts | Lower threshold to 0.25, raise limit to 50 |

### Phase 2: Enhanced Chunking (Day 1)

| Task | File | Change |
|------|------|--------|
| 2.1 | chunking-service.ts | Add adaptive strategy selection |
| 2.2 | chunking-service.ts | Improve sentence boundary detection |
| 2.3 | rag-service.ts | Use adaptive chunking for messages |

### Phase 3: Tag System (Day 2)

| Task | File | Change |
|------|------|--------|
| 3.1 | shared/schema.ts | Add memory_tags table |
| 3.2 | server/services/tag-service.ts | Create auto-tagger |
| 3.3 | rag-service.ts | Integrate tags on ingestion |
| 3.4 | retrieval-orchestrator.ts | Filter by tags |

### Phase 4: Debug Infrastructure (Day 2-3)

| Task | File | Change |
|------|------|--------|
| 4.1 | server/services/rag-debug-buffer.ts | Create trace buffer |
| 4.2 | server/routes.ts | Add /api/debug/rag endpoints |
| 4.3 | client/src/pages/rag-debug.tsx | Build debug UI |

---

## New Features: Tags Replace Buckets

### Migration Path

```
Old Buckets          New Tags (Multiple Allowed)
───────────────────────────────────────────────
PERSONAL_LIFE   →    preferences, people, events
CREATOR         →    projects, code, instructions
PROJECTS        →    projects, tasks, deadlines
```

### Tag Assignment Flow

```
New Content
    │
    ▼
Lightweight LLM Classification (gemini-3-flash-preview-lite)
    │
    ├── Extract entities (people, places, dates)
    ├── Classify topic (1-3 tags)
    └── Assess importance (0-1)
    │
    ▼
Store with metadata: { tags: [...], importance: 0.7, ... }
    │
    ▼
On Query: Filter by relevant tags OR boost tag-matching results
```

### User Controls

- **Pin Memory:** User can mark content as important (importance = 1.0)
- **Forget:** User can request specific content be removed
- **Tag Override:** User can manually add/remove tags

---

## RAG Debug Page Design

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ RAG Debug Console                              [Refresh] [Clear] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Ingestion Timeline      │ │ Query Traces                │ │
│ │                         │ │                             │ │
│ │ ▼ msg-abc123 (2 chunks) │ │ ▼ "What's my name?"         │ │
│ │   ├ chunk: 45 chars     │ │   ├ embed: 234ms            │ │
│ │   ├ embed: 156ms        │ │   ├ search: 89ms            │ │
│ │   └ store: 23ms         │ │   ├ results: 5 chunks       │ │
│ │                         │ │   │  ├ chunk-1 (0.87)       │ │
│ │ ▼ msg-def456 (0 chunks) │ │   │  ├ chunk-2 (0.72)       │ │
│ │   └ FILTERED: < 25 char │ │   │  └ ...                  │ │
│ │                         │ │   └ context: 1.2k tokens    │ │
│ └─────────────────────────┘ └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Statistics                                                   │
│ Total Chunks: 1,234 │ Avg Score: 0.67 │ Cache Hit: 45%      │
└─────────────────────────────────────────────────────────────┘
```

### Features

1. **Ingestion Timeline**
   - Real-time display of incoming content
   - Show chunk count vs filtered count
   - Timing breakdown per stage
   - Click to expand chunk content

2. **Query Traces**
   - Each user query with full trace
   - Search results with scores
   - Final context token count
   - Link to corresponding LLM debug entry

3. **Statistics Panel**
   - Total chunks in store
   - Average similarity scores
   - Hit/miss rates
   - Tag distribution

---

## Testing & Validation

### Test Cases

1. **Short Message Ingestion**
   - Send: "I live in Seattle"
   - Verify: Chunk created and stored
   - Query: "Where do I live?"
   - Expect: Seattle mentioned in context

2. **Multi-Turn Memory**
   - Send: "My cat's name is Whiskers"
   - Send: (other messages)
   - Query: "What's my cat's name?"
   - Expect: Whiskers in context

3. **Recency Weighting**
   - Ingest old fact: "I work at Google" (30 days ago)
   - Ingest new fact: "I now work at Apple" (today)
   - Query: "Where do I work?"
   - Expect: Apple ranked higher than Google

4. **Tag Filtering**
   - Ingest code snippet tagged "code"
   - Ingest personal fact tagged "preferences"
   - Query about code
   - Expect: Code snippet prioritized

### Metrics to Track

- **Ingestion Rate:** Chunks created per message
- **Filter Rate:** % of content filtered out
- **Retrieval Precision:** Relevant chunks / total returned
- **Retrieval Recall:** Relevant chunks returned / total relevant
- **Context Utilization:** Tokens used / max tokens

---

## Appendix: Quick Reference

### Current vs Proposed Settings

| Setting | Current | Proposed | Rationale |
|---------|---------|----------|-----------|
| minChunkSize | 100 | 25 | Allow short messages |
| maxChunkSize | 1000 | 1000 | Keep as-is |
| overlap | 50 | 50 | Keep as-is |
| retrieval threshold | 0.4-0.5 | 0.25 | Better recall |
| retrieval topK | 5-20 | 20-50 | More candidates |
| recency weight | None | 0.2 | Prefer recent |

### Key Files to Modify

```
server/services/chunking-service.ts   # minChunkSize
server/services/rag-service.ts        # retrieve() params
server/services/retrieval-orchestrator.ts  # search params
shared/schema.ts                      # memory_tags table
server/services/rag-debug-buffer.ts   # NEW: trace buffer
client/src/pages/rag-debug.tsx        # NEW: debug UI
```

---

*Document generated by RAG Stack Analysis Tool*  
*Last updated: January 7, 2026*
