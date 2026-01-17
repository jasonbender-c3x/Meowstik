# LLM I/O Capture Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION                                   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CHAT API ENDPOINT                                        │
│                  POST /api/chats/:id/messages                                │
│                                                                               │
│  1. Validates user message                                                   │
│  2. Builds conversation history                                              │
│  3. Composes system prompt (RAG + tools)                                     │
│  4. Calls Gemini LLM API                                                     │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GEMINI LLM API                                        │
│                                                                               │
│  • Processes prompt with system instruction                                  │
│  • Generates response (text + function calls)                                │
│  • Returns streaming response                                                │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RESPONSE PROCESSING                                     │
│                                                                               │
│  1. Collects streamed response chunks                                        │
│  2. Parses function/tool calls                                               │
│  3. Executes tools via ragDispatcher                                         │
│  4. Collects tool results                                                    │
│  5. Saves AI message to database                                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LLM DEBUG BUFFER CAPTURE                                  │
│                  llmDebugBuffer.add(interaction)                             │
│                                                                               │
│  Captures:                                                                   │
│  ✓ System prompt (with RAG context)                                         │
│  ✓ User message                                                              │
│  ✓ Conversation history                                                      │
│  ✓ Attachments metadata                                                      │
│  ✓ Raw LLM response                                                          │
│  ✓ Clean content (prose only)                                                │
│  ✓ Parsed tool calls                                                         │
│  ✓ Tool execution results                                                    │
│  ✓ Performance metrics                                                       │
└───────────────────┬────────────────────────┬────────────────────────────────┘
                    │                        │
                    │                        │
        ┌───────────▼──────────┐  ┌─────────▼──────────────┐
        │   IN-MEMORY BUFFER   │  │  DATABASE PERSISTENCE  │
        │                      │  │                         │
        │ • Last 10 records    │  │ • PostgreSQL            │
        │ • Fast access        │  │ • All records           │
        │ • Lost on restart    │  │ • Queryable             │
        │ • getAll(limit)      │  │ • Survives restarts     │
        │ • getById(id)        │  │ • llm_interactions      │
        └──────────┬───────────┘  └─────────┬───────────────┘
                   │                        │
                   │                        │
        ┌──────────▼────────────────────────▼───────────────┐
        │              DEBUG CONSOLE API                     │
        │                                                    │
        │  Memory Mode:      Persistent Mode:               │
        │  GET /api/debug/llm                               │
        │                    GET /api/debug/llm/persistent  │
        │                    GET /api/debug/llm/stats       │
        └────────────────────────┬──────────────────────────┘
                                 │
                                 ▼
        ┌─────────────────────────────────────────────────┐
        │           DEBUG CONSOLE UI (/debug)             │
        │                                                 │
        │  [Memory (Recent)] [Database (All)]  ← Toggle  │
        │                                                 │
        │  ┌─────────────────────────────────────────┐   │
        │  │ Interaction List                        │   │
        │  │                                         │   │
        │  │ • User: "Hello, how are you?"          │   │
        │  │   Model: gemini-2.0-flash              │   │
        │  │   Duration: 1.5s | Tokens: 150         │   │
        │  │                                         │   │
        │  │ • User: "Tell me a joke"               │   │
        │  │   Model: gemini-2.5-pro                │   │
        │  │   Duration: 2.1s | Tokens: 200         │   │
        │  └─────────────────────────────────────────┘   │
        │                                                 │
        │  ┌─────────────────────────────────────────┐   │
        │  │ Interaction Details                     │   │
        │  │                                         │   │
        │  │ [Inputs] [System] [Outputs] [Tools]    │   │
        │  │                                         │   │
        │  │ System Prompt: (expandable)            │   │
        │  │ User Message: (expandable)             │   │
        │  │ Tool Calls: (expandable)               │   │
        │  │ Tool Results: (expandable)             │   │
        │  └─────────────────────────────────────────┘   │
        └─────────────────────────────────────────────────┘
```

## Data Flow

### Capture Flow

```
User Message → Routes Handler → LLM API → Response Processing → Debug Buffer
                                                                      ↓
                                                           ┌──────────┴──────────┐
                                                           │                     │
                                                      Memory Buffer      Database Storage
                                                    (Last 10, Fast)     (All, Persistent)
```

### Query Flow

```
Debug UI → Toggle Selection → API Endpoint → Data Source → Response
                                    ↓              ↓
                           /api/debug/llm    Memory Buffer
                                    ↓              ↓
                     /api/debug/llm/persistent  Database
```

## Database Schema

```sql
CREATE TABLE llm_interactions (
  -- Identity
  id VARCHAR PRIMARY KEY,
  chat_id VARCHAR REFERENCES chats(id),
  message_id VARCHAR REFERENCES messages(id),
  user_id VARCHAR REFERENCES users(id),
  
  -- Inputs (what went into the LLM)
  system_prompt TEXT,
  user_message TEXT,
  conversation_history JSONB,
  attachments JSONB,
  rag_context JSONB,
  injected_files JSONB,
  injected_json JSONB,
  
  -- Outputs (what came out of the LLM)
  raw_response TEXT,
  clean_content TEXT,
  parsed_tool_calls JSONB,
  tool_results JSONB,
  
  -- Metadata
  model VARCHAR(100),
  duration_ms INTEGER,
  token_estimate JSONB,
  error TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP
);
```

## Component Interactions

```
┌─────────────┐
│   Routes    │
│  (routes.ts)│
└──────┬──────┘
       │ await llmDebugBuffer.add(...)
       ▼
┌─────────────────────┐
│  LLM Debug Buffer   │
│(llm-debug-buffer.ts)│
│                     │
│ • add()             │
│ • getAll()          │
│ • getById()         │
│ • setPersistence()  │
└──────┬──────────────┘
       │ await storage.saveLlmInteraction(...)
       ▼
┌─────────────────────┐
│     Storage         │
│   (storage.ts)      │
│                     │
│ • saveLlmInteraction()        │
│ • getRecentLlmInteractions()  │
│ • getLlmInteractionsByChat()  │
│ • getLlmInteractionById()     │
│ • getLlmInteractionStats()    │
│ • deleteOldLlmInteractions()  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│    PostgreSQL       │
│ llm_interactions    │
└─────────────────────┘
```

## API Endpoints

### In-Memory Buffer

```
GET    /api/debug/llm              → llmDebugBuffer.getAll()
GET    /api/debug/llm/:id          → llmDebugBuffer.getById()
DELETE /api/debug/llm              → llmDebugBuffer.clear()
```

### Persistent Storage

```
GET    /api/debug/llm/persistent                → storage.getRecentLlmInteractions()
GET    /api/debug/llm/persistent/:id            → storage.getLlmInteractionById()
GET    /api/debug/llm/persistent/chat/:chatId   → storage.getLlmInteractionsByChat()
GET    /api/debug/llm/stats                     → storage.getLlmInteractionStats()
DELETE /api/debug/llm/persistent/cleanup        → storage.deleteOldLlmInteractions()
```

## Deployment Considerations

### Development
- Enable persistence: ✅ (for debugging)
- Retention: Keep all data
- UI: Use both Memory and Database modes

### Staging
- Enable persistence: ✅ (for testing)
- Retention: 30 days
- UI: Both modes available

### Production
- Enable persistence: ⚠️ (consider privacy/compliance)
- Retention: 7-14 days
- UI: Restrict access to authorized users
- Consider: PII scrubbing, encryption, access controls
