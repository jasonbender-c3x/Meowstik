# Proposed System Upgrades: Complete Discussion

## The Core Problem

The LLM is **stateless**. Every turn starts fresh with no memory of what worked before. It must be constantly reminded of:
- What tools it has and how to use them effectively
- Patterns that worked well in past sessions
- User preferences and corrections
- Operational wisdom ("HTTP tools can call any API", "GitHub CLI works too")

This document proposes a comprehensive upgrade to the **knowledge collection, storage, retrieval, and introspection** systems to address this fundamental limitation.

---

## Part 1: Knowledge Architecture Redesign

### Current State
```
logs/Short_Term_Memory.md  → User directives, preferences (manual updates)
logs/cache.md              → Last turn's thoughts (auto-overwritten)
logs/execution.md          → Tool history log (append-only)
knowledge/                 → Static reference docs (new, empty)
RAG system                 → Semantic search over messages/docs
```

### Proposed State
```
memory/
├── operational/           → HOW to use tools effectively
│   ├── patterns.md        → "HTTP tools can call any REST API"
│   ├── shortcuts.md       → "GitHub CLI: gh issue create --title X"
│   └── gotchas.md         → "Never use ~ in file_put paths"
│
├── factual/               → WHAT I know
│   ├── user-prefs.md      → Jason's preferences, corrections
│   ├── project-context.md → Current project state, architecture
│   └── entities.md        → People, repos, APIs I've encountered
│
├── procedural/            → HOW to do complex tasks
│   ├── github-workflow.md → Step-by-step: create PR with changes
│   ├── debug-workflow.md  → How to diagnose and fix errors
│   └── search-pattern.md  → When uncertain → search → save findings
│
└── introspection/         → Self-knowledge
    ├── capabilities.md    → What I can and cannot do
    ├── mistakes.md        → Past errors and how I fixed them
    └── performance.md     → What takes long, what's fast
```

### Why This Structure?

**Operational** = Constantly remind LLM of tool mastery
- "I have 5 HTTP tools (GET/POST/PUT/PATCH/DELETE) - I can call ANY REST API"
- "I can use `gh` CLI for GitHub without HTTP if it's simpler"
- "file_put fails silently with ~ paths - use w/ prefix"

**Factual** = Accumulated knowledge that rarely changes
- User name is Jason, GitHub is jasonbender-c3x
- Project uses Drizzle ORM, Express, React
- Saved API keys are in Replit secrets

**Procedural** = Multi-step recipes
- "To create a GitHub PR: 1) branch 2) commit 3) push 4) create PR"
- "To debug an error: 1) read logs 2) search error 3) check docs 4) try fix"

**Introspection** = Self-awareness
- "I'm good at code analysis but slow at large file edits"
- "Last time I tried X it failed because Y"
- "Web search is cheap - use liberally when uncertain"

---

## Part 2: Automatic Memory Population

### Problem
Memory files are useless if empty. They need to be **auto-populated** from:
1. Successful tool patterns (what worked)
2. User corrections ("no, do it this way")
3. Search findings (useful docs found)
4. Error resolutions (what fixed the problem)

### Proposed: Memory Induction Engine

```typescript
// server/services/memory-inducer.ts

interface MemoryEvent {
  type: 'success' | 'correction' | 'discovery' | 'resolution';
  category: 'operational' | 'factual' | 'procedural' | 'introspection';
  content: string;
  source: string; // tool name, user message, search result
}

class MemoryInducer {
  // Detect patterns worth saving
  detectPattern(toolResult: ToolResult): MemoryEvent | null {
    // Tool succeeded after previous failure = resolution
    if (toolResult.success && this.previousFailed(toolResult.toolName)) {
      return {
        type: 'resolution',
        category: 'procedural',
        content: `${toolResult.toolName} works when: ${this.diffFromLastAttempt()}`,
        source: toolResult.toolName
      };
    }
    
    // HTTP tool used for new API = operational pattern
    if (toolResult.toolName.startsWith('http_') && this.isNewEndpoint(toolResult.params.url)) {
      return {
        type: 'discovery',
        category: 'operational',
        content: `API endpoint: ${toolResult.params.url} - ${toolResult.summary}`,
        source: 'http_tools'
      };
    }
    
    return null;
  }
  
  // Detect user corrections
  detectCorrection(userMessage: string, previousResponse: string): MemoryEvent | null {
    const correctionPatterns = [
      /no,?\s+(actually|instead|use|don't)/i,
      /that's (wrong|incorrect|not right)/i,
      /I (meant|wanted|prefer)/i,
    ];
    
    if (correctionPatterns.some(p => p.test(userMessage))) {
      return {
        type: 'correction',
        category: 'factual',
        content: `User correction: ${userMessage}`,
        source: 'user'
      };
    }
    return null;
  }
  
  // Save to appropriate memory file
  async save(event: MemoryEvent) {
    const path = `memory/${event.category}/${this.getFilename(event)}.md`;
    const entry = `\n## ${new Date().toISOString()}\n${event.content}\n`;
    await fs.appendFile(path, entry);
    
    // Also ingest to RAG for semantic search
    await ragService.ingest(event.content, { 
      bucket: 'OPERATIONAL_MEMORY',
      source: path 
    });
  }
}
```

### Auto-Population Triggers

| Trigger | Memory Type | Example |
|---------|-------------|---------|
| Tool succeeds after retry | procedural | "file_put works with w/ prefix, not ~" |
| User says "no" or corrects | factual | "User prefers tabs over spaces" |
| web_search returns useful result | operational | "GitHub API rate limit: 5000/hr" |
| Complex task completed | procedural | "PR workflow: branch → commit → push → create" |
| Error resolved | introspection | "ENOENT means file doesn't exist" |

---

## Part 3: Introspection System

### What is Introspection?

The LLM examining its own:
- **Capabilities** - What can I do? What are my limits?
- **Performance** - What's fast? What's slow? What fails often?
- **History** - What did I try before? What worked?

### Proposed: Introspection Prompts

Add to system prompt:
```markdown
## Self-Awareness Protocol

Before complex tasks, reflect:
1. Have I done this before? Check memory/introspection/
2. What tools do I need? Check memory/operational/
3. What's the step-by-step? Check memory/procedural/
4. What could go wrong? Check memory/introspection/mistakes.md

After task completion, update:
- If new pattern learned → memory/operational/
- If mistake made and fixed → memory/introspection/mistakes.md
- If user corrected me → memory/factual/user-prefs.md
```

### Introspection Files

**memory/introspection/capabilities.md**
```markdown
# What I Can Do

## Strong Capabilities
- Call any REST API with http_* tools
- Read/write files anywhere on server
- Execute terminal commands
- Search web for current information
- Control GitHub via API or CLI

## Limitations
- Cannot access user's local filesystem directly
- Cannot persist state between turns (use memory files)
- Large file edits may timeout
- Rate limits on external APIs

## Tool Mastery Reminders
- HTTP tools: I have GET/POST/PUT/PATCH/DELETE - can call ANY API
- GitHub: Use http_post to api.github.com OR use `gh` CLI
- Files: Use w/ prefix, never ~ in file_put
```

**memory/introspection/mistakes.md**
```markdown
# Past Mistakes & Fixes

## 2026-01-20: file_put silent failure
- Problem: file_put with ~/path failed silently
- Cause: ~ character not expanded in this tool
- Fix: Always use w/ prefix or full path

## 2026-01-22: GitHub API 401
- Problem: http_post to GitHub returned 401
- Cause: Missing Accept header
- Fix: Always include "Accept": "application/vnd.github.v3+json"
```

---

## Part 4: Knowledge Retrieval Upgrades

### Current RAG Flow
```
User message → Embedding → Vector search → Top-K results → Inject into prompt
```

### Proposed: Multi-Stage Retrieval

```
User message
    ↓
┌───────────────────────────────────────────┐
│ Stage 1: Intent Classification            │
│ Is this about: tools? facts? procedures?  │
└───────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────┐
│ Stage 2: Memory File Lookup               │
│ Check relevant memory/ subdirectory       │
│ (fast, deterministic)                     │
└───────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────┐
│ Stage 3: RAG Semantic Search              │
│ Search ingested docs and past messages    │
│ (slower, but finds related content)       │
└───────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────┐
│ Stage 4: Combine & Prioritize             │
│ Memory files > RAG results > fallback     │
└───────────────────────────────────────────┘
    ↓
Inject into prompt
```

### Implementation

```typescript
// server/services/retrieval-orchestrator.ts (upgrade)

async function retrieveContext(userMessage: string): Promise<string> {
  // Stage 1: Classify intent
  const intent = await classifyIntent(userMessage);
  // Returns: 'operational' | 'factual' | 'procedural' | 'general'
  
  // Stage 2: Direct memory lookup
  const memoryDir = `memory/${intent}/`;
  const memoryFiles = await fs.readdir(memoryDir);
  const memoryContent = await Promise.all(
    memoryFiles.map(f => fs.readFile(`${memoryDir}/${f}`, 'utf8'))
  );
  
  // Stage 3: RAG semantic search
  const ragResults = await ragService.search(userMessage, {
    buckets: ['OPERATIONAL_MEMORY', 'USER_PREFS', 'PROJECTS'],
    topK: 5
  });
  
  // Stage 4: Combine with priority
  return `
## Operational Memory
${memoryContent.join('\n')}

## Related Knowledge (RAG)
${ragResults.map(r => r.content).join('\n')}
`;
}
```

---

## Part 5: Prompt Injection Points

### Where Memory Gets Injected

```typescript
// server/services/prompt-composer.ts

async function composeSystemPrompt(): Promise<string> {
  const parts = [
    // 1. Core identity and behavior
    await fs.readFile('prompts/core-directives.md'),
    
    // 2. Tool reference (condensed)
    await fs.readFile('prompts/tools.md'),
    
    // 3. OPERATIONAL MEMORY (new)
    '## Operational Reminders',
    await fs.readFile('memory/operational/patterns.md'),
    await fs.readFile('memory/operational/gotchas.md'),
    
    // 4. User preferences
    await fs.readFile('memory/factual/user-prefs.md'),
    
    // 5. Recent introspection
    await this.getRecentMistakes(3), // Last 3 mistakes
    
    // 6. Short-term cache (last turn's thoughts)
    await fs.readFile('logs/cache.md'),
  ];
  
  return parts.filter(Boolean).join('\n\n---\n\n');
}
```

### Critical Reminders Section

Always inject these operational facts:

```markdown
## Critical Operational Facts

1. **HTTP Tools**: I have 5 HTTP tools (http_get, http_post, http_put, http_patch, http_delete). I can call ANY REST API by constructing the right URL and headers.

2. **GitHub Access**: Two options:
   - HTTP: `http_post` to `https://api.github.com/...` with auth header
   - CLI: `terminal_execute` with `gh issue create...`

3. **File Paths**: Never use `~` in file_put - use `w/` prefix or full path.

4. **When Uncertain**: Use `web_search` immediately. Cost of search < cost of wrong answer.

5. **Memory is External**: I am stateless. All memory is in files. Check memory/ before acting.
```

---

## Part 6: Implementation Priorities

### Phase 1: Memory Structure (Do First)
1. Create memory/ directory structure
2. Populate initial operational reminders
3. Add memory injection to prompt-composer

### Phase 2: Auto-Population (Week 2)
1. Build MemoryInducer service
2. Hook into tool execution pipeline
3. Detect and save patterns automatically

### Phase 3: Introspection (Week 3)
1. Add introspection prompt section
2. Create capabilities.md and mistakes.md
3. Auto-log errors and resolutions

### Phase 4: Retrieval Upgrade (Week 4)
1. Add intent classification
2. Implement multi-stage retrieval
3. Prioritize memory files over RAG

---

## Summary

| Component | Purpose | Key Upgrade |
|-----------|---------|-------------|
| memory/operational/ | Tool mastery reminders | "HTTP tools can call any API" |
| memory/factual/ | User knowledge | Preferences, project context |
| memory/procedural/ | Step-by-step recipes | How to create PR, debug error |
| memory/introspection/ | Self-awareness | Past mistakes, capabilities |
| MemoryInducer | Auto-save patterns | Corrections, discoveries, fixes |
| Multi-stage retrieval | Smarter context | Memory files > RAG > fallback |

The goal: **The LLM should never forget what it learned**, even across sessions. Every insight, correction, and successful pattern gets captured and resurfaced when relevant.
