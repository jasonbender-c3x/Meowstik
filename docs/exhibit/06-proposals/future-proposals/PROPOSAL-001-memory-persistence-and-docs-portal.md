# PROPOSAL-001: Bot Memory Persistence & Documentation Portal

**Date:** January 16, 2026  
**Status:** Draft  
**Author:** Replit Agent  
**Scope:** Database storage for bot memory, documentation reorganization, SPA docs portal

---

## Executive Summary

This proposal addresses three interconnected challenges:

1. **Bot memory loss in production** - Memory files (`short_term_memory.md`, `cache.md`, etc.) are lost on deployment restarts
2. **Documentation sprawl** - Legacy, redundant, and outdated docs clutter the repository
3. **Documentation accessibility** - Need a polished, interactive documentation portal

---

## Part 1: Database Storage for Bot Memory

### 1.1 Problem Statement

Currently, the bot stores its "memory" in flat markdown files under `logs/`:

```
logs/
├── Short_Term_Memory.md   (27KB - conversation context)
├── cache.md               (551B - cached responses)
├── execution.md           (179KB - execution history)
├── personal.md            (27KB - learned preferences)
├── replit.md              (1KB - environment context)
└── tool_transactions.jsonl (audit log)
```

**Issue:** Replit deployments use stateless containers. When the published app restarts, all filesystem changes are lost, causing the bot to "forget" everything.

### 1.2 Proposed Solution: PostgreSQL Memory Storage

#### Schema Design

```sql
-- Core memory file storage
CREATE TABLE memory_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(64) DEFAULT 'default',
  file_key VARCHAR(128) NOT NULL,          -- e.g., 'short_term_memory', 'cache'
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,       -- SHA-256 for change detection
  metadata JSONB DEFAULT '{}',             -- flexible metadata (tokens, tags, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, file_key)
);

-- Append-only event log for audit/debugging
CREATE TABLE memory_file_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_file_id UUID REFERENCES memory_files(id) ON DELETE CASCADE,
  event_type VARCHAR(32) NOT NULL,         -- 'create', 'update', 'append', 'truncate'
  diff JSONB,                               -- delta for incremental updates
  actor VARCHAR(64),                        -- who/what made the change
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_memory_files_agent_key ON memory_files(agent_id, file_key);
CREATE INDEX idx_memory_events_file_time ON memory_file_events(memory_file_id, created_at DESC);
```

#### Storage Layer API

Add to `server/storage.ts`:

```typescript
// Memory file operations
getMemoryFile: async (fileKey: string, agentId = 'default') => {
  return db.query.memoryFiles.findFirst({
    where: and(
      eq(schema.memoryFiles.fileKey, fileKey),
      eq(schema.memoryFiles.agentId, agentId)
    ),
  });
},

upsertMemoryFile: async (data: {
  fileKey: string;
  content: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}) => {
  const hash = crypto.createHash('sha256').update(data.content).digest('hex');
  
  return db.insert(schema.memoryFiles)
    .values({
      agentId: data.agentId || 'default',
      fileKey: data.fileKey,
      content: data.content,
      contentHash: hash,
      metadata: data.metadata || {},
    })
    .onConflictDoUpdate({
      target: [schema.memoryFiles.agentId, schema.memoryFiles.fileKey],
      set: {
        content: data.content,
        contentHash: hash,
        metadata: data.metadata || {},
        version: sql`${schema.memoryFiles.version} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning();
},

appendToMemoryFile: async (fileKey: string, appendContent: string, agentId = 'default') => {
  // Atomic append operation
  return db.execute(sql`
    UPDATE memory_files 
    SET content = content || ${appendContent},
        content_hash = encode(sha256(content || ${appendContent}), 'hex'),
        version = version + 1,
        updated_at = NOW()
    WHERE file_key = ${fileKey} AND agent_id = ${agentId}
    RETURNING *
  `);
},

getAllMemoryFiles: async (agentId = 'default') => {
  return db.query.memoryFiles.findMany({
    where: eq(schema.memoryFiles.agentId, agentId),
  });
},

logMemoryEvent: async (event: {
  memoryFileId: string;
  eventType: 'create' | 'update' | 'append' | 'truncate';
  diff?: Record<string, unknown>;
  actor?: string;
}) => {
  return db.insert(schema.memoryFileEvents).values(event).returning();
},
```

#### File Key Mapping

| Current File | Database Key | Purpose |
|-------------|--------------|---------|
| `Short_Term_Memory.md` | `short_term_memory` | Recent conversation context |
| `cache.md` | `cache` | LLM response cache |
| `execution.md` | `execution_log` | Tool execution history |
| `personal.md` | `personal_context` | Learned user preferences |
| `replit.md` | `environment_context` | Environment state |
| `tool_transactions.jsonl` | `tool_transactions` | Audit log (JSONL in content) |

### 1.3 Migration Strategy

1. **Phase 1: Schema Addition**
   - Add Drizzle schema for `memoryFiles` and `memoryFileEvents`
   - Run `drizzle-kit push` to create tables

2. **Phase 2: Migration Script**
   ```typescript
   // scripts/migrate-memory-to-db.ts
   import { storage } from '../server/storage';
   import fs from 'fs/promises';
   import path from 'path';

   const LOGS_DIR = './logs';
   const FILE_MAPPINGS = {
     'Short_Term_Memory.md': 'short_term_memory',
     'cache.md': 'cache',
     'execution.md': 'execution_log',
     'personal.md': 'personal_context',
     'replit.md': 'environment_context',
     'tool_transactions.jsonl': 'tool_transactions',
   };

   async function migrateMemoryFiles() {
     for (const [filename, fileKey] of Object.entries(FILE_MAPPINGS)) {
       const filepath = path.join(LOGS_DIR, filename);
       try {
         const content = await fs.readFile(filepath, 'utf-8');
         await storage.upsertMemoryFile({
           fileKey,
           content,
           metadata: { 
             migratedFrom: filename,
             migratedAt: new Date().toISOString(),
             originalSize: content.length,
           },
         });
         console.log(`✓ Migrated ${filename} → ${fileKey}`);
       } catch (err) {
         console.warn(`⚠ Skipped ${filename}: ${err.message}`);
       }
     }
   }
   ```

3. **Phase 3: Runtime Integration**
   - Update `prompt-composer.ts` and related services to read/write via storage layer
   - Keep local file writes as fallback/cache for development
   - Production mode: DB-only

4. **Phase 4: Retention Policy**
   - Implement TTL job to prune old events (keep last 30 days)
   - Version compaction for memory files (keep last 10 versions)

### 1.4 Hybrid Read/Write Pattern

```typescript
// MemoryManager class
class MemoryManager {
  private cache: Map<string, string> = new Map();
  
  async read(fileKey: string): Promise<string> {
    // Check in-memory cache first
    if (this.cache.has(fileKey)) {
      return this.cache.get(fileKey)!;
    }
    
    // Try database
    const dbFile = await storage.getMemoryFile(fileKey);
    if (dbFile) {
      this.cache.set(fileKey, dbFile.content);
      return dbFile.content;
    }
    
    // Fallback to local file (development only)
    if (process.env.NODE_ENV === 'development') {
      const localPath = this.getLocalPath(fileKey);
      if (await fileExists(localPath)) {
        const content = await fs.readFile(localPath, 'utf-8');
        this.cache.set(fileKey, content);
        return content;
      }
    }
    
    return '';
  }
  
  async write(fileKey: string, content: string): Promise<void> {
    // Update cache
    this.cache.set(fileKey, content);
    
    // Write to database (production-safe)
    await storage.upsertMemoryFile({ fileKey, content });
    
    // Also write to local file in development
    if (process.env.NODE_ENV === 'development') {
      const localPath = this.getLocalPath(fileKey);
      await fs.writeFile(localPath, content, 'utf-8');
    }
  }
}
```

---

## Part 2: Documentation Cleanup & Reorganization

### 2.1 Current State Analysis

Documentation is scattered and contains outdated material. Proposed taxonomy:

```
docs/
├── index.md                    # Main entry point
├── current/                    # Active, relevant documentation
│   ├── architecture/
│   ├── api/
│   ├── guides/
│   └── integrations/
├── historical/                 # Archive (pre-December 2025, implemented, obsolete)
│   ├── exhibit/               # Completed milestones, legacy decisions
│   ├── deprecated/            # No longer applicable
│   └── superseded/            # Replaced by newer docs
├── forward-looking/           # Future vision, aspirational
│   ├── roadmap/
│   ├── research/
│   └── proposals/
└── _catalog.json              # Machine-readable doc inventory
```

### 2.2 Classification Criteria

| Category | Criteria | Action |
|----------|----------|--------|
| **Current** | Active, maintained, <6 months old | Keep in `docs/current/` |
| **Historical/Exhibit** | Completed features, pre-Dec 2025 | Move to `docs/historical/exhibit/` |
| **Historical/Deprecated** | Obsolete, no longer relevant | Move to `docs/historical/deprecated/` |
| **Historical/Superseded** | Replaced by newer docs | Move to `docs/historical/superseded/` |
| **Forward-Looking** | Future plans, out of scope now | Move to `docs/forward-looking/` |

### 2.3 Audit Script

```typescript
// scripts/audit-docs.ts
import { glob } from 'glob';
import { execSync } from 'child_process';
import matter from 'gray-matter';

interface DocMeta {
  path: string;
  title: string;
  lastModified: Date;
  status: 'current' | 'historical' | 'forward';
  reason: string;
  tags: string[];
}

async function auditDocs(): Promise<DocMeta[]> {
  const docs = await glob('**/*.md', { ignore: ['node_modules/**', 'docs/historical/**'] });
  const cutoffDate = new Date('2025-12-01');
  const catalog: DocMeta[] = [];
  
  for (const docPath of docs) {
    // Get last git commit date
    const lastModified = new Date(
      execSync(`git log -1 --format=%cI -- "${docPath}"`).toString().trim()
    );
    
    // Parse frontmatter
    const content = await fs.readFile(docPath, 'utf-8');
    const { data: frontmatter } = matter(content);
    
    // Classify
    let status: DocMeta['status'] = 'current';
    let reason = 'Active documentation';
    
    if (lastModified < cutoffDate) {
      status = 'historical';
      reason = 'Last modified before December 2025';
    } else if (frontmatter.status === 'deprecated') {
      status = 'historical';
      reason = 'Marked as deprecated';
    } else if (frontmatter.status === 'implemented') {
      status = 'historical';
      reason = 'Feature fully implemented';
    } else if (frontmatter.status === 'roadmap' || frontmatter.status === 'future') {
      status = 'forward';
      reason = 'Future/aspirational content';
    }
    
    catalog.push({
      path: docPath,
      title: frontmatter.title || path.basename(docPath, '.md'),
      lastModified,
      status,
      reason,
      tags: frontmatter.tags || [],
    });
  }
  
  return catalog;
}
```

### 2.4 Catalog Schema

`docs/_catalog.json`:
```json
{
  "generated": "2026-01-16T18:00:00Z",
  "version": 1,
  "documents": [
    {
      "slug": "architecture-overview",
      "path": "docs/current/architecture/overview.md",
      "title": "System Architecture Overview",
      "status": "current",
      "category": "architecture",
      "tags": ["core", "infrastructure"],
      "lastModified": "2026-01-10T12:00:00Z",
      "summary": "High-level overview of system components..."
    }
  ]
}
```

---

## Part 3: SPA Documentation Portal

### 3.1 Architecture Overview

```
docs-portal/
├── src/
│   ├── pages/
│   │   ├── index.tsx           # Main landing with curated cards
│   │   ├── explore.tsx         # All docs browser
│   │   └── [slug].tsx          # Individual doc view
│   ├── components/
│   │   ├── DocCard.tsx         # Curated doc card
│   │   ├── DocGrid.tsx         # Fluid grid layout
│   │   ├── DocViewer.tsx       # Markdown renderer
│   │   ├── TableOfContents.tsx # Interactive TOC
│   │   └── SearchBar.tsx       # Full-text search
│   └── lib/
│       ├── catalog.ts          # Load _catalog.json
│       └── search.ts           # Client-side search
├── scripts/
│   ├── build-catalog.ts        # Parse docs with Cheerio
│   └── process-doc.ts          # Convert MD to interactive SPA
├── public/
│   └── docs/                   # Generated HTML per doc
└── vite.config.ts
```

### 3.2 Build Pipeline with Cheerio

```typescript
// scripts/build-catalog.ts
import * as cheerio from 'cheerio';
import { marked } from 'marked';
import matter from 'gray-matter';
import { glob } from 'glob';

interface ProcessedDoc {
  slug: string;
  title: string;
  summary: string;
  headings: { level: number; text: string; id: string }[];
  content: string;
  wordCount: number;
  readingTime: number;
  tags: string[];
}

async function processDoc(mdPath: string): Promise<ProcessedDoc> {
  const raw = await fs.readFile(mdPath, 'utf-8');
  const { data: frontmatter, content: markdown } = matter(raw);
  
  // Convert to HTML
  const html = await marked(markdown);
  
  // Parse with Cheerio
  const $ = cheerio.load(html);
  
  // Extract headings for TOC
  const headings: ProcessedDoc['headings'] = [];
  $('h1, h2, h3, h4').each((i, el) => {
    const $el = $(el);
    const level = parseInt(el.tagName.replace('h', ''));
    const text = $el.text();
    const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    $el.attr('id', id);
    headings.push({ level, text, id });
  });
  
  // Extract summary (first paragraph)
  const summary = $('p').first().text().slice(0, 200) + '...';
  
  // Word count and reading time
  const textContent = $.text();
  const wordCount = textContent.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200);
  
  // Add interactive elements
  $('pre code').each((i, el) => {
    $(el).parent().addClass('code-block').attr('data-copy', 'true');
  });
  
  return {
    slug: path.basename(mdPath, '.md'),
    title: frontmatter.title || $('h1').first().text() || 'Untitled',
    summary,
    headings,
    content: $.html(),
    wordCount,
    readingTime,
    tags: frontmatter.tags || [],
  };
}

async function buildCatalog() {
  const docs = await glob('docs/current/**/*.md');
  const catalog = await Promise.all(docs.map(processDoc));
  
  await fs.writeFile(
    'docs-portal/public/catalog.json',
    JSON.stringify(catalog, null, 2)
  );
  
  // Generate individual doc pages
  for (const doc of catalog) {
    await generateDocPage(doc);
  }
}
```

### 3.3 GitHub Actions Workflow

```yaml
# .github/workflows/docs-portal.yml
name: Build Docs Portal

on:
  push:
    paths:
      - 'docs/**'
      - 'docs-portal/**'
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
        working-directory: docs-portal
      
      - name: Parse and catalog docs
        run: npm run build:catalog
        working-directory: docs-portal
      
      - name: LLM Enhancement Pass
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          # Optional: Use Gemini to enhance doc summaries and suggest layout
          npm run enhance:llm
        working-directory: docs-portal
      
      - name: Build portal
        run: npm run build
        working-directory: docs-portal
      
      - name: Deploy to Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs-portal/dist
```

### 3.4 LLM Enhancement Step

```typescript
// scripts/enhance-with-llm.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function enhanceDoc(doc: ProcessedDoc): Promise<ProcessedDoc> {
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  
  const prompt = `You are an expert technical writer and web designer.
  
Given this documentation:
Title: ${doc.title}
Content Summary: ${doc.summary}
Headings: ${doc.headings.map(h => h.text).join(', ')}

Please provide:
1. A better 1-sentence summary (max 150 chars)
2. 3-5 relevant tags
3. A "hero" description for the card (max 50 chars)
4. Suggested visual style: "technical", "tutorial", "reference", or "overview"

Respond in JSON format.`;

  const result = await model.generateContent(prompt);
  const enhancement = JSON.parse(result.response.text());
  
  return {
    ...doc,
    summary: enhancement.summary,
    tags: [...new Set([...doc.tags, ...enhancement.tags])],
    hero: enhancement.hero,
    style: enhancement.style,
  };
}
```

### 3.5 UI Components

#### Curated Cards Section

```tsx
// src/components/DocCard.tsx
interface DocCardProps {
  doc: ProcessedDoc;
  featured?: boolean;
}

export function DocCard({ doc, featured }: DocCardProps) {
  return (
    <a 
      href={`/docs/${doc.slug}`}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-6",
        "transition-all hover:shadow-lg hover:border-primary/50",
        featured && "md:col-span-2 md:row-span-2"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
            {doc.title}
          </h3>
          <p className="text-muted-foreground text-sm mt-1">{doc.summary}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {doc.readingTime} min read
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-4">
        {doc.tags.slice(0, 3).map(tag => (
          <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-primary/10">
            {tag}
          </span>
        ))}
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}
```

#### Fluid Explorer Grid

```tsx
// src/pages/explore.tsx
import Masonry from 'react-masonry-css';

export function ExplorePage() {
  const [docs, setDocs] = useState<ProcessedDoc[]>([]);
  const [filter, setFilter] = useState<string>('all');
  
  const filteredDocs = useMemo(() => {
    if (filter === 'all') return docs;
    return docs.filter(d => d.tags.includes(filter) || d.status === filter);
  }, [docs, filter]);
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'current', 'historical', 'forward-looking'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "px-4 py-2 rounded-full text-sm whitespace-nowrap",
              filter === cat ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>
      
      <Masonry
        breakpointCols={{ default: 4, 1024: 3, 768: 2, 480: 1 }}
        className="flex gap-4"
        columnClassName="flex flex-col gap-4"
      >
        {filteredDocs.map(doc => (
          <DocCard key={doc.slug} doc={doc} />
        ))}
      </Masonry>
    </div>
  );
}
```

### 3.6 Open Source Libraries

| Library | Purpose |
|---------|---------|
| **cheerio** | Parse/transform HTML, extract metadata |
| **marked** | Markdown to HTML conversion |
| **gray-matter** | Parse frontmatter from markdown |
| **react-masonry-css** | Fluid masonry grid layout |
| **fuse.js** | Client-side fuzzy search |
| **prism-react-renderer** | Syntax highlighting |
| **framer-motion** | Smooth animations |
| **@radix-ui** | Accessible UI primitives |

---

## Part 4: Implementation Roadmap

### Phase 1: Database Memory (Week 1)
- [ ] Add Drizzle schema for `memory_files` and `memory_file_events`
- [ ] Implement storage layer methods
- [ ] Create migration script for existing logs
- [ ] Update runtime services to use database
- [ ] Test persistence across restarts

### Phase 2: Documentation Cleanup (Week 1-2)
- [ ] Run audit script to classify all docs
- [ ] Review classification with stakeholder
- [ ] Execute moves to historical/forward-looking folders
- [ ] Generate `_catalog.json`
- [ ] Update any broken cross-references

### Phase 3: Docs Portal MVP (Week 2-3)
- [ ] Scaffold Vite project in `docs-portal/`
- [ ] Implement Cheerio build pipeline
- [ ] Create core UI components (DocCard, Grid, Viewer)
- [ ] Build index page with curated section
- [ ] Deploy to GitHub Pages or Replit static hosting

### Phase 4: Automation & Polish (Week 3-4)
- [ ] Set up GitHub Actions workflow
- [ ] Integrate LLM enhancement pass
- [ ] Add search functionality
- [ ] Responsive design polish
- [ ] Documentation for the documentation system

---

## Appendix A: Estimated Effort

| Component | Effort | Priority |
|-----------|--------|----------|
| Memory DB schema | 2-4 hours | High |
| Storage layer methods | 2-3 hours | High |
| Migration script | 1-2 hours | High |
| Runtime integration | 4-6 hours | High |
| Doc audit script | 2-3 hours | Medium |
| Doc reorganization | 2-4 hours | Medium |
| Docs portal scaffold | 3-4 hours | Medium |
| Cheerio pipeline | 3-4 hours | Medium |
| UI components | 4-6 hours | Medium |
| GitHub Actions | 2-3 hours | Low |
| LLM enhancement | 2-3 hours | Low |

**Total Estimated: 27-42 hours**

---

## Appendix B: Open Questions

1. Should memory files support multiple "agents" (multi-tenant) or single global state?
2. What retention policy for memory events? (Suggested: 30 days)
3. Should docs portal be public or require authentication?
4. Hosting preference: GitHub Pages, Replit Static, or integrated into main app?

---

*End of Proposal*
