# RAG Traceability UI Components - Visual Guide

## Overview
This document describes the UI components implemented for RAG traceability.

## 1. RAG Debug Page - Enhanced View

### Live Mode (In-Memory Traces)
```
┌─────────────────────────────────────────────────────────────────┐
│ RAG Debug Console                    [Refresh] [Clear]          │
│ Monitor ingestion and retrieval pipeline events                 │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ Total    │ │ Ingestion│ │  Queries │ │  Errors  │          │
│ │  Events  │ │    10    │ │    25    │ │    0     │          │
│ │   35     │ │ Avg: 2.5s│ │ Avg: 245ms│ │          │          │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├─────────────────────────────────────────────────────────────────┤
│ [All (35)] [Ingestion (10)] [Queries (25)] [Errors (0)]        │
│                                 [Live (Memory)] [Persistent (DB)]│
├─────────────────────────────────────────────────────────────────┤
│ ▶ [🔍] query "What is RAG?"                 5 results  245ms ✓ │
│ ▶ [📄] ingestion document.pdf              10 chunks  2.5s  ✓ │
│ ▼ [🔍] query "How does it work?"           3 results  189ms ✓ │
│   ├─ query_start                                          0ms   │
│   ├─ query_embed                                         15ms   │
│   ├─ search            [3 results]                       45ms   │
│   └─ query_complete    [1,234 tokens]                   189ms   │
│                                    [View Full Details]          │
└─────────────────────────────────────────────────────────────────┘
```

### Persistent Mode (Database Traces)
```
┌─────────────────────────────────────────────────────────────────┐
│ [All] [Ingestion] [Queries] [Errors]                            │
│                                 [Live (Memory)] [Persistent (DB)]│
├─────────────────────────────────────────────────────────────────┤
│ 📊 Viewing persistent traces from database                      │
├─────────────────────────────────────────────────────────────────┤
│ ▶ [🔍] query "What is RAG?"           [query] 5 🔍 245ms ✓     │
│ ▶ [📄] ingestion doc-123              [ingestion] 10 📄 2.5s ✓  │
│ ▼ [🔍] query "advanced features"      [query] 8 🔍 312ms ✓     │
│   Pipeline Events:                                               │
│   query_embed                                [2 chunks]    15ms  │
│   search                                    [8 results]    87ms  │
│   retrieve                                  [5 results]    45ms  │
│   inject                                [2,456 tokens]   165ms  │
│                                    [View Full Details]          │
└─────────────────────────────────────────────────────────────────┘
```

### Metrics Dashboard (Persistent Mode Only)
```
┌─────────────────────────────────────────────────────────────────┐
│ Performance Metrics                                              │
├───────────────┬───────────────┬───────────────┬─────────────────┤
│ 📄 Documents  │ 🔍 Queries    │ ⏱️ Avg Query  │ 📊 Avg Similar  │
│   Ingested    │   Processed   │     Time      │      ity        │
│      15       │      128      │    245ms      │      87%        │
│ 45 chunks     │ 5.2 avg res   │ Ingest: 2.5s  │ 3 empty results │
└───────────────┴───────────────┴───────────────┴─────────────────┘
├───────────────┬───────────────┬───────────────┐
│ 🗄️ Embedding  │ 📝 Avg Context│ ⚠️ Error Rate │
│   API Calls   │    Tokens     │               │
│      163      │     1,234     │     1.2%      │
│ Total requests│ Tokens/query  │ 2 errors ▲    │
└───────────────┴───────────────┴───────────────┘
```

## 2. Chat Message - Source Citations

### AI Response with Sources
```
┌─────────────────────────────────────────────────────────────────┐
│ ✨ Meowstic AI [Model 2.0]                                        │
│                                                                  │
│ RAG (Retrieval-Augmented Generation) is a technique that        │
│ combines information retrieval with text generation. It          │
│ retrieves relevant documents and uses them as context...         │
│                                                                  │
│ 📄 Sources (3)                                                   │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ [1] rag-documentation.md      [87% confidence] 👍 👎      │   │
│ │ [2] knowledge-base.pdf        [82% confidence] 👍 👎      │   │
│ │ [3] technical-guide.md        [78% confidence] 👍 👎      │   │
│ │                           [▼ Show All (5 more)]           │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ [📋] [🔄]                                          [👍] [👎]    │
└─────────────────────────────────────────────────────────────────┘
```

### Source Detail Modal (Click on Source)
```
┌─────────────────────────────────────────────────────────────────┐
│ 📄 rag-documentation.md                                      ╳  │
├─────────────────────────────────────────────────────────────────┤
│ [Rank #1] [87% confidence]                                      │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ RAG combines information retrieval with large language   │    │
│ │ models. The system first retrieves relevant documents    │    │
│ │ from a knowledge base using semantic search, then        │    │
│ │ provides them as context to the LLM. This approach       │    │
│ │ grounds the AI's responses in actual source material,    │    │
│ │ reducing hallucinations and improving accuracy...        │    │
│ │                                                           │    │
│ │ [Full content scrollable...]                             │    │
│ └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│ Was this source helpful?                                         │
│ [👍 Yes] [👎 No]                                                │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Component Features

### TraceList Component
- ✓ Expandable/collapsible trace cards
- ✓ Color-coded icons (blue=query, green=ingestion, red=error)
- ✓ Summary metrics (results count, duration, timestamp)
- ✓ Event timeline with stage durations
- ✓ Badge indicators for chunks, results, errors
- ✓ "View Full Details" button for deep dive

### SourceCitation Component
- ✓ Compact display (shows top 3 sources)
- ✓ Confidence score badges (color-coded by percentage)
- ✓ Expand to show all sources
- ✓ Click source to view full content in modal
- ✓ Thumbs up/down feedback per source
- ✓ Automatic API submission on feedback

### MetricsDashboard Component
- ✓ Grid layout of metric cards
- ✓ Documents ingested with chunk count
- ✓ Queries processed with average results
- ✓ Average query and ingestion durations
- ✓ Average similarity scores
- ✓ Embedding API call tracking
- ✓ Error rate with trend indicators
- ✓ Chunk filtering statistics

## User Flows

### Developer Debugging
1. Navigate to RAG Debug Console
2. Switch to "Persistent (DB)" mode
3. Filter traces by type (ingestion/query/errors)
4. Expand trace to see pipeline stages
5. View metrics dashboard for trends
6. Click "View Full Details" for deep analysis

### End User Transparency
1. Ask question in chat
2. AI responds with answer
3. Sources section appears below response
4. User sees confidence scores
5. Click source to read full content
6. Provide feedback (thumbs up/down)

## Responsive Design

All components are responsive:
- Mobile: Stacked layout, touch-friendly
- Tablet: 2-column grid for metrics
- Desktop: 4-column grid, side-by-side views

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Focus indicators on interactive elements
- Color is not the only indicator (icons + text)
