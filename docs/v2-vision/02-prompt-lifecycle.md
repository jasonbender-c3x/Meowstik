# 02 - The Lifecycle of a Prompt

## From Voice to Action: A Journey

---

## Prologue: The Moment Before

You're sitting with your coffee. A thought forms. You speak:

*"Honey... I need to understand the codebase for that new project. Analyze it and write me some docs."*

This is where it begins.

---

## Chapter 1: Awakening

The wake word lands. **"Honey..."**

```
┌─────────────────────────────────────┐
│         WAKE WORD DETECTOR          │
│         (On-device, tiny)           │
│                                     │
│  Listening... listening...          │
│  "Honey" detected!                  │
│  → Activate audio stream            │
│  → Route to STT                     │
└─────────────────────────────────────┘
```

Your voice streams to the Speech-to-Text model. Words materialize as text.

---

## Chapter 2: The Airhead Who Isn't

**Level 0 (HV-0)** receives the text. The Gemini 2.0 Flash Lite triage layer.

She sounds ditzy, but she's reading you like a book.

```
┌─────────────────────────────────────┐
│         HV-0: TRIAGE                │
│         (Flash Lite)                │
│                                     │
│  Input: "Analyze codebase...        │
│          write me some docs"        │
│                                     │
│  Classification:                    │
│  ├─ Small talk?      NO             │
│  ├─ Personal/emotional? NO          │
│  ├─ Routine lookup?  NO             │
│  └─ Technical/complex? YES          │
│                                     │
│  Decision: Route to HV-2 Technical  │
└─────────────────────────────────────┘
```

She wraps your request in a JSON object and hands it off:

```json
{
  "id": "prompt_20260119_094532_xyz",
  "type": "user_request",
  "content": "I need to understand the codebase...",
  "source": "voice",
  "classification": "technical_complex",
  "routed_to": "hv2_technical",
  "timestamp": "2026-01-19T09:45:32Z"
}
```

---

## Chapter 3: The Strategist Thinks

**HV-2 Technical** (Gemini 3.0 Pro) receives the job.

Its system prompt is filled with stuff you've READ and KEPT - technical wisdom, debugging patterns, architectural guidance.

```
┌─────────────────────────────────────┐
│      HV-2: TECHNICAL PRO            │
│          (Gemini 3.0 Pro)           │
│                                     │
│  Analyzing request...               │
│                                     │
│  Observations:                      │
│  1. "Codebase" - which repo?        │
│  2. "Analyze" - deep work needed    │
│  3. "Write docs" - multiple files   │
│  4. This is a multi-ticket job      │
│                                     │
│  Required specialists:              │
│  • CodeBot (analysis)               │
│  • WriterBot (documentation)        │
│  • Archivist (publishing)           │
└─────────────────────────────────────┘
```

Maybe it asks a clarifying question first:

*"Which repo - the one from GitHub yesterday, or the local one in workspace?"*

You answer. Now it has everything it needs.

---

## Chapter 4: The Plan Becomes Tickets

HV-2 formulates a plan and writes it as executable tickets:

```
DECOMPOSITION
─────────────────────────────────────

Ticket 1: terminal "ls -aglR * > results.txt"
    ↓ on_complete

Ticket 2: get results.txt → create exam-list.md
    ↓ on_complete

Ticket 3: For each file in exam-list.md:
           Create analysis ticket
    ↓ spawns N tickets

Ticket 4...N: Analyze [file_path]
              Append findings to ticket
    ↓ all complete

Ticket N+1: Aggregate results → final-report.md
    ↓ on_complete

Ticket N+2: Archivist → HTML, publish to docs
```

---

## Chapter 5: Queue Dispatch

Each ticket is a JSON file dropped into a queue directory:

```
/queues/
├── hypervisor/
│   └── (orchestration tasks)
├── code-analyst/
│   ├── job-1705678235-p5-003.json
│   ├── job-1705678235-p5-004.json
│   └── job-1705678235-p5-005.json
├── writer/
│   └── job-1705678236-p3-006.json  (waiting)
└── archivist/
    └── job-1705678237-p2-007.json  (waiting)
```

### Ticket File Format

```json
{
  "id": "job-1705678235-p5-003",
  "prompt_id": "prompt_20260119_094532_xyz",
  "priority": 5,
  "status": "queued",
  "source": "/workspace/src/routes.ts",
  "destination": "/results/analysis/routes.md",
  "on_complete": "queue://writer",
  "instructions": "Analyze this Express routes file. Document endpoints, middleware, patterns.",
  "created": "2026-01-19T09:45:35Z",
  "claimed_by": null,
  "audit": [],
  "results": []
}
```

---

## Chapter 6: Workers Awaken

Workers are specialized LLMs monitoring their queues.

**CodeBot** (with 100K words of code analysis wisdom) claims a ticket:

```
┌─────────────────────────────────────┐
│         WORKER: CodeBot-1           │
│                                     │
│  Polling queue: /queues/code-analyst│
│                                     │
│  Found: job-003 (priority 5)        │
│  Action: CLAIM                      │
│                                     │
│  mv job-003.json .processing/       │
│  Update status: "processing"        │
│  Update claimed_by: "codebot-1"     │
└─────────────────────────────────────┘
```

Audit entry appended:

```json
{
  "timestamp": "2026-01-19T09:45:40Z",
  "worker": "codebot-1",
  "action": "claimed"
}
```

---

## Chapter 7: Execution

The worker reads the source file, processes it, appends results:

```
┌─────────────────────────────────────┐
│         CODEBOT EXECUTING           │
│                                     │
│  1. get("/workspace/src/routes.ts") │
│  2. Analyze structure               │
│  3. Identify patterns               │
│  4. Document findings               │
│  5. Append to results[]             │
└─────────────────────────────────────┘
```

Results appended to ticket:

```json
{
  "timestamp": "2026-01-19T09:46:12Z",
  "content": "## routes.ts Analysis\n\n### Endpoints: 47\n### Middleware: 12\n### Patterns: RESTful with auth guards..."
}
```

Audit entry:

```json
{
  "timestamp": "2026-01-19T09:46:12Z",
  "worker": "codebot-1",
  "action": "completed",
  "tokens_in": 12000,
  "tokens_out": 3500,
  "duration_ms": 32000
}
```

---

## Chapter 8: Status Updates Flow

While workers work, little notes flow back to you:

```
┌─────────────────────────────────────┐
│         STATUS STREAM               │
│                                     │
│  💬 "Analyzing routes.ts..."        │
│  💬 "Found 47 endpoints"            │
│  💬 "Moving to auth.ts..."          │
│  💬 "12 of 34 files complete"       │
└─────────────────────────────────────┘
```

These appear in your chat stream. If you're in voice mode, the Speech model reads them in a calm, informative tone.

---

## Chapter 9: Routing Complete Tickets

Based on `on_complete` field (or policy override):

| Destination | Action |
|-------------|--------|
| `queue://writer` | Move to writer queue |
| `file:///results/report.md` | Write to disk |
| `bin://finished` | Archive completed |
| `bin://trash` | Discard |
| `chat://stream` | Send to user |
| `tts://speak` | Vocalize result |

---

## Chapter 10: Aggregation

When all child tickets complete, the aggregator activates:

```
┌─────────────────────────────────────┐
│         AGGREGATION                 │
│                                     │
│  Waiting for: 34 analysis tickets   │
│  Complete: 34/34 ✓                  │
│                                     │
│  Action:                            │
│  1. Collect all results[]           │
│  2. Merge into unified analysis     │
│  3. Create final-analysis.md        │
│  4. Route to WriterBot queue        │
└─────────────────────────────────────┘
```

---

## Chapter 11: The Writer Crafts

**WriterBot** (250K words of writing craft) receives the aggregated analysis:

*"Write documentation for a developer who's never seen this code. Make it approachable."*

It writes. Beautiful, clear documentation emerges:

```
/results/docs/codebase-documentation.md
```

Ticket routes to **Archivist**.

---

## Chapter 12: The Archivist Publishes

**Archivist** receives the markdown:

```
┌─────────────────────────────────────┐
│         ARCHIVIST                   │
│                                     │
│  1. Convert markdown → HTML         │
│  2. Add navigation, cross-links     │
│  3. Upload to docs site             │
│  4. Update reference manual index   │
│  5. Notify completion               │
└─────────────────────────────────────┘
```

---

## Chapter 13: The Delivery

Back in your chat stream, a beautiful card appears:

```
┌─────────────────────────────────────┐
│  📄 Codebase Documentation          │
│                                     │
│  47 endpoints • 12 middleware       │
│  34 files analyzed                  │
│                                     │
│  [View] [Download] [Speak] [Share]  │
└─────────────────────────────────────┘
```

If you're in voice mode, she says:

*"All done! I analyzed 34 files, found 47 endpoints, and documented the whole thing. The docs are live on the site. Want me to walk you through the highlights?"*

---

## Epilogue: Memory Forms

The system remembers:

- **cache.md** - Context for next turn
- **STM_APPEND.md** - Items to persist
- **Short_Term_Memory.md** - Accumulated memories
- **Ticket archive** - Full audit trail

Next time you mention this project, context is ready.

---

## The Journey Visualized

```
     🎤 "Honey..."
         │
    ┌────▼────┐
    │Wake Word│
    └────┬────┘
         │
    ┌────▼────┐
    │   STT   │
    └────┬────┘
         │
    ┌────▼────┐
    │  HV-0   │ Triage
    │  Lite   │
    └────┬────┘
         │
    ┌────▼────┐
    │  HV-2   │ Strategy
    │  Pro    │
    └────┬────┘
         │
    ┌────▼────┐
    │Decompose│ Create tickets
    └────┬────┘
         │
    ┌────┴────┬─────────┐
    ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐
│Code  │ │Code  │ │Code  │  Parallel
│Bot   │ │Bot   │ │Bot   │  Workers
└──┬───┘ └──┬───┘ └──┬───┘
   └────────┼────────┘
            │
    ┌───────▼───────┐
    │   Aggregate   │
    └───────┬───────┘
            │
    ┌───────▼───────┐
    │   WriterBot   │
    └───────┬───────┘
            │
    ┌───────▼───────┐
    │   Archivist   │
    └───────┬───────┘
            │
    ┌───────▼───────┐
    │    Publish    │
    └───────┬───────┘
            │
    💬 "All done!"
```

---

## Proactive AI: Beyond Reactive

The system doesn't just respond. It anticipates.

### Chrono Triggers (Time-based)

```
Every 15 minutes:
  "It has been {X} minutes since Jason spoke."
  → Check emails for urgent items
  → Check calendar for upcoming events
  → Check texts/calls for missed messages
  → Assess: anything he should know?
```

### Event Triggers (External)

```
Text from boss arrives:
  → Immediate escalation
  → Interrupt current work if needed
  → "Jason, you just got a text from [boss]"
```

### Context Triggers (Inferred)

```
Morning, 8:45am, calendar shows 9am meeting:
  Jason hasn't moved.
  
  Assessment: Possibly still asleep.
  Action: "Jason, you have a meeting in 15 minutes."
  
  If no response:
  Action: Activate TV remote, turn on lights.
```

---

*This is the journey. From thought to speech to understanding to work to delivery to memory.*
