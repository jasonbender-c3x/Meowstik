# 01 - Core Philosophy

## The Meowstik Vision

**Creator:** Jason Bender  
**Date:** January 2026  
**Version:** 2.0

---

## Founding Principle

> "If you write the docs right, the code writes itself."

This is documentation-driven development. The architecture emerges from clear specification. We design first, then the implementation becomes mechanical.

---

## Axiom 1: Everything is a JSON Object

Extending the Linux philosophy ("everything is a file"), we treat all data as structured JSON objects:

```
Messages     → JSON objects
Files        → JSON objects with content
Tool calls   → JSON objects
Responses    → JSON objects
Tickets/Jobs → JSON objects
Audit logs   → JSON objects appended to tickets
```

### Why JSON?

1. **Universal Schema** - One format to rule them all
2. **Self-Describing** - MIME types determine rendering
3. **Append-Only** - Fast writes, natural audit trail
4. **Pointer-Friendly** - Pass references, not copies

### Rendering by MIME Type

```json
{
  "type": "message",
  "mime": "text/markdown",
  "content": "...",
  "render": "bubble"
}
```

| MIME Type | Renders As |
|-----------|------------|
| `text/plain` | Simple text bubble |
| `text/markdown` | Formatted bubble |
| `application/json` | Collapsible JSON viewer |
| `image/*` | Thumbnail/preview |
| `audio/*` | Audio player chip |
| `application/x-ticket` | Job status card |

---

## Axiom 2: Files Are the Database

### Queue System = Directories

**Create a job:**
```bash
# Old way (database API)
queue_create({ type: "analyze", ... })

# New way (filesystem)
echo '{"type":"analyze",...}' > queues/code-analyst/job-1705678234-p5-abc.json
```

**List jobs:**
```bash
ls queues/code-analyst/
```

**Claim a job:**
```bash
mv queues/code-analyst/job-xxx.json queues/code-analyst/.processing/job-xxx.json
```

**Complete a job:**
```bash
# Append results
echo '{"result":"...","completed":"2026-01-19T..."}' >> job-xxx.json
mv job-xxx.json ../finished/
```

### Benefits

- No database for queue state
- Natural file locking for claims
- `grep` searches across all jobs
- `wc -l` counts queue depth
- Append-only = fast + auditable

---

## Axiom 3: Single User, Self-Enforcing Auth

### The Creator Model

There is one user: **Jason Bender**. The application exists for him.

```
┌─────────────────────────────────────────────┐
│            AUTHENTICATION MODEL             │
│                                             │
│  Creator: Jason (implicit, always authed)   │
│  └─ Google OAuth grants service access      │
│  └─ No login page needed                    │
│  └─ No user tables needed                   │
│                                             │
│  Family (6): Catch phrase recognition       │
│  └─ Secret phrase → recognized by name      │
│  └─ No elevated privileges                  │
│  └─ Just personalization                    │
│                                             │
│  Everyone else: No access                   │
│  └─ Google services reject unauthorized     │
│  └─ Self-enforcing via OAuth scope          │
│  └─ No code needed to block                 │
└─────────────────────────────────────────────┘
```

### What Gets Removed

- User tables
- Session management
- Login pages
- User ID foreign keys
- Multi-tenant logic

### What Remains

- Google OAuth (for API access)
- Catch phrase detection (for family names)
- That's it

---

## Axiom 4: Pointers Over Payloads

### Why Copy When You Can Reference?

```
# Old way
file_get("large-file.json") → 50MB in context → send to LLM

# New way  
Reference: "/data/large-file.json"
LLM reads what it needs, when it needs it
```

### Implications

- Chat stream contains references, not content
- Workers fetch on-demand
- Memory stays lean
- Network stays fast

---

## Axiom 5: API from Documentation

### The 7 Core Tools

Instead of 102 tool definitions, we have 7 primitives:

| Tool | Purpose |
|------|---------|
| `terminal` | Non-interactive shell |
| `get` | Read file/URL |
| `put` | Write file |
| `write` | Output to chat |
| `log` | Append to log file |
| `say` | HD voice output |
| `ssh` | Persistent 2-way connection |

### Everything Else = Documentation

> "You have access to EVERY Google API. Here is the documentation server. Read the spec, build the request, execute via terminal."

The LLM already knows APIs from training. Give it a doc reference and primitives. It figures out the rest.

### Result

~1KB of "device drivers" in system prompt, infinite capability.

---

## Axiom 6: Specialists Over Generalists

### The Multi-Agent Architecture

Instead of one overloaded LLM with 500K words of context:

```
┌──────────────┐
│   DocuBot    │ 100K words on Google Docs/Sheets/Slides
├──────────────┤
│  WriterBot   │ 250K words on writing craft
├──────────────┤
│  SpeechBot   │ Full binder on voice performance
├──────────────┤
│   CodeBot    │ Codebase-specific analysis
└──────────────┘
```

Each specialist has **deep** knowledge in their domain, not shallow awareness of everything.

### Hypervisor Routing

HV-0 (Flash Lite) triages incoming requests and routes to the right specialist. Simple requests handled immediately; complex ones decomposed into tickets.

---

## Axiom 7: Token Economics Enable Everything

### For a Single-User App

With per-token costs this low, we can afford:

- Multiple LLM instances running in parallel
- Expensive models (Pro) for important decisions
- Cheap models (Flash Lite) for triage
- Persistent connections to everything
- No optimization anxiety

### The Math

Multi-agent is **cheaper** than one bloated model:
- Smaller context windows per specialist
- Right-sized model for each task
- JIT tool loading reduces prompt tokens
- Parallel execution reduces wall-clock time

---

## Summary

| Axiom | Implementation |
|-------|----------------|
| Everything is JSON | Universal schema, MIME-typed rendering |
| Files are the database | Directory-based queues, append-only logs |
| Single user | No auth code, Google OAuth self-enforces |
| Pointers over payloads | References in chat, on-demand fetch |
| API from docs | 7 primitives + documentation server |
| Specialists over generalists | Multi-agent with deep domain context |
| Token economics | Cheap enough to do it right |

---

*"The Compiler sees. The Compiler knows. The Compiler evolves."*
