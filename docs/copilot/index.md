# GitHub Copilot Working Instructions

**For GitHub Copilot working in this repository.**

---

## What This Codebase Is

Meowstik is an AI personal assistant (meta-agent) built on:
- **Backend:** Node.js + Express + TypeScript
- **AI:** Google Gemini via `@google/genai`
- **Database:** SQLite via `better-sqlite3` + Drizzle ORM
- **Frontend:** React 18 + Vite + Tailwind + shadcn/ui

This is **not** a RAG pipeline. There is no vector store, no embeddings, no kernel-based routing. The AI uses **function calling** (Gemini tool use) to take actions.

---

## Key Architectural Patterns

### 1. Schema → Storage → Routes

All changes follow this chain:
1. Add/modify table in `shared/schema.ts` (Drizzle ORM, SQLite)
2. Add/modify storage methods in `server/storage.ts` (typed query wrappers)
3. Expose via route in `server/routes.ts`

**Never** write raw SQL in routes. Always go through the storage layer.

### 2. Tool System

```
server/gemini-tools.ts         — FunctionDeclaration[] for Gemini
server/services/tool-dispatcher.ts  — executes tool calls
server/services/jit-tool-protocol.ts — predicts needed tools per message
```

When adding a new tool:
1. Declare it in `gemini-tools.ts` as a `FunctionDeclaration`
2. Add the execution case in `tool-dispatcher.ts`
3. JIT prediction in `jit-tool-protocol.ts` may need updating if the tool has a non-obvious use pattern

### 3. Schema Conventions

```typescript
// All tables use SQLite types from drizzle-orm/sqlite-core
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// IDs: nanoid strings (text), never auto-increment integers
id: text("id").primaryKey()

// Timestamps: ISO strings via defaultNow()
createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)

// JSON columns: text with mode:"json", NOT jsonb
metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>()

// Foreign keys must reference .id of the parent table
chatId: text("chat_id").notNull().references(() => chats.id)
```

### 4. Storage Method Pattern

```typescript
// All methods in DatabaseStorage class in server/storage.ts
async createFoo(data: InsertFoo): Promise<FooRecord> {
  const [result] = await db
    .insert(foos)
    .values({ id: nanoid(), ...data })
    .returning();
  return result;
}

async getFooById(id: string): Promise<FooRecord | undefined> {
  const [result] = await db
    .select()
    .from(foos)
    .where(eq(foos.id, id));
  return result;
}
```

### 5. Gemini API Call Pattern

```typescript
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const result = await genAI.models.generateContent({
  model: "gemini-2.0-flash",
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  config: {
    responseMimeType: "application/json",
  },
});
const output = JSON.parse(result.text!);
```

---

## Known Pre-existing Issues (Do Not Fix)

These exist before any of your changes — don't flag them as bugs introduced by new work:

1. `markFeedbackSubmitted(id: number)` — `feedback.id` is actually a `text` type; there's a type mismatch
2. `getFeedbackStats()` — references `f.sentiment` but the feedback table has `f.rating`
3. ~80+ TypeScript errors in client files and some server integration files — all pre-existing
4. `NODE_OPTIONS="--max-old-space-size=4096"` is required to run `tsc --noEmit` without OOM

---

## Copilot SDK Bridge

The `copilot_send_report` tool lets the Meowstik LLM hand off implementation tasks to Copilot without the LLM editing the repo directly.

**How it works:**
1. LLM calls `copilot_send_report` with a structured report
2. Report is written to `docs/copilot/intake/{timestamp}-report.md`
3. The report is routed to Copilot CLI for implementation

**After a report lands:**
- Open this repo in a terminal where Copilot CLI is running
- The report file in `docs/copilot/intake/` contains the full prompt
- Reference the file or paste the contents into your Copilot session

**Copilot env vars (optional):**
```env
COPILOT_MODEL=gpt-5
COPILOT_CLI_URL=...
COPILOT_GITHUB_TOKEN=...
COPILOT_LOG_LEVEL=info
```

---

## Directory Map

```
Meowstik/
├── shared/schema.ts         — Drizzle ORM schema (single source of truth)
├── server/
│   ├── index.ts             — Express app entry point
│   ├── routes.ts            — All HTTP routes (~2300 lines)
│   ├── storage.ts           — Database abstraction layer
│   ├── gemini-tools.ts      — All Gemini function declarations
│   ├── integrations/        — Third-party service clients
│   │   ├── expressive-tts.ts  — Google Cloud TTS Chirp3-HD
│   │   ├── twilio.ts          — SMS + Voice
│   │   └── ...
│   ├── routes/              — Route sub-modules
│   └── services/            — Business logic
│       ├── tool-dispatcher.ts       — Tool execution
│       ├── jit-tool-protocol.ts     — Tool prediction
│       ├── evolution-engine.ts      — Feedback → GitHub PR
│       ├── summarization-engine.ts  — Conversation/feedback summarization
│       └── ...
├── client/                  — React + Vite frontend
│   └── src/
│       ├── components/      — UI components
│       └── pages/           — Page-level components
├── browser-extension/       — Chrome extension
├── docs/                    — Documentation (this directory)
│   ├── README.md            — Master index
│   ├── ARCHITECTURE.md      — System design
│   ├── TOOLS.md             — Tool reference
│   └── copilot/             — Copilot working instructions (this file)
└── migrations/              — Drizzle migration files
```

---

## Test & Build

```bash
# Type check (needs 4GB heap)
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit

# Dev server
pnpm run dev

# Build
pnpm run build
```

There is no automated test suite. Verify changes by running the dev server and testing in the browser.
