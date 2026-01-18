# Debug Data Collection for LLM Calls

## Overview

This document describes the comprehensive debug data collection system that captures everything going into and out of LLM calls, providing complete visibility into the AI's decision-making process.

## Problem Statement

Previously, the debug system was not capturing:
1. RAG (Retrieval Augmented Generation) context - the knowledge retrieved from the database
2. `cache.md` - The "thoughts forward" from the previous turn
3. `Short_Term_Memory.md` - User-defined persistent instructions

These pieces were being embedded in the system prompt but not separately tracked for debugging purposes.

## Solution

We enhanced the debug data collection pipeline to capture and display all components that are sent to the LLM.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     LLM Call Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PromptComposer.compose()                                    │
│     ├── Load core directives, personality, tools                │
│     ├── Load cache.md (thoughts from last turn)                 │
│     ├── Load Short_Term_Memory.md (user instructions)          │
│     ├── Retrieve RAG context (semantic search)                  │
│     └── Return ComposedPrompt with debug data                   │
│                                                                  │
│  2. Routes.ts: Generate LLM Response                            │
│     ├── Send prompt to Gemini API                               │
│     ├── Stream response back to client                          │
│     └── Log to llmDebugBuffer with complete data                │
│                                                                  │
│  3. llmDebugBuffer.add()                                        │
│     ├── Store in-memory (last 10 interactions)                  │
│     └── Persist to database                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. ComposedPrompt Interface

**File**: `server/services/prompt-composer.ts`

```typescript
export interface ComposedPrompt {
  systemPrompt: string;
  userMessage: string;
  attachments: ComposedAttachment[];
  conversationHistory: ConversationTurn[];
  metadata: PromptMetadata;
  
  // Debug fields - NEW
  ragContext?: Array<{ 
    source: string; 
    content: string; 
    score?: number; 
    metadata?: Record<string, unknown> 
  }>;
  injectedFiles?: Array<{ 
    filename: string; 
    content: string; 
    mimeType?: string 
  }>;
}
```

#### 2. Enhanced Prompt Composition

**File**: `server/services/prompt-composer.ts`

The `compose()` method now:
1. Calls `retrievalOrchestrator.enrichPromptWithContext()` to get both enriched prompt AND retrieval results
2. Captures RAG context items with scores and metadata
3. Collects injected files (`cache.md`, `Short_Term_Memory.md`)
4. Returns all debug data alongside the composed prompt

```typescript
// Capture RAG context for debug logging
ragContext = retrievalResult.items.map(item => ({
  source: item.type,
  content: item.content,
  score: item.score,
  metadata: item.metadata,
}));

// Capture injected files for debug logging
if (this.cache && this.cache.trim()) {
  injectedFiles.push({
    filename: 'cache.md',
    content: this.cache,
    mimeType: 'text/markdown',
  });
}

if (this.shortTermMemory && this.shortTermMemory.trim()) {
  injectedFiles.push({
    filename: 'Short_Term_Memory.md',
    content: this.shortTermMemory,
    mimeType: 'text/markdown',
  });
}
```

#### 3. Retrieval Orchestrator Enhancement

**File**: `server/services/retrieval-orchestrator.ts`

New method `enrichPromptWithContext()` returns both:
- The enriched system prompt (string)
- The retrieval result (with all context items)

```typescript
async enrichPromptWithContext(
  userMessage: string, 
  systemContext: string = '', 
  userId?: string | null
): Promise<{
  enrichedPrompt: string;
  retrievalResult: RetrievalResult;
}>
```

#### 4. Debug Buffer Logging

**File**: `server/routes.ts`

The LLM call now passes complete debug data:

```typescript
await llmDebugBuffer.add({
  chatId: req.params.id,
  messageId: savedMessage.id,
  userId: userId,
  systemPrompt: modifiedPrompt.systemPrompt,
  userMessage: composedPrompt.userMessage,
  conversationHistory: chatMessages.map((m) => ({
    role: m.role,
    content: m.content,
  })),
  attachments: composedPrompt.attachments.map((a) => ({
    type: a.type,
    filename: a.filename,
    mimeType: a.mimeType,
  })),
  ragContext: composedPrompt.ragContext,        // NEW
  injectedFiles: composedPrompt.injectedFiles,  // NEW
  rawResponse: fullResponse,
  parsedToolCalls: parsedResponse?.toolCalls || [],
  cleanContent: finalContent,
  toolResults,
  model: modelMode,
  durationMs: endTime - (startTime || endTime),
});
```

### Database Schema

**File**: `shared/schema.ts`

The `llm_interactions` table already had the necessary fields:

```sql
ragContext: jsonb("rag_context")
injectedFiles: jsonb("injected_files") 
injectedJson: jsonb("injected_json")
```

These fields are properly persisted by `llmDebugBuffer.persistInteraction()`.

## Debug UI

**File**: `client/src/pages/debug.tsx`

The debug page already had UI components ready to display these fields:

### Inputs Tab

1. **User Message** - The user's input text
2. **Conversation History** - Previous messages in the chat
3. **RAG Context** (NEW) - Knowledge retrieved from the database
   - Shows source, content, and relevance score for each item
4. **Injected Files** (NEW) - System files injected into the prompt
   - `cache.md` - AI's thoughts from the previous turn
   - `Short_Term_Memory.md` - User's persistent instructions
5. **Attachments** - User-uploaded files and screenshots

### System Tab

Shows the complete system prompt as sent to the LLM.

### Outputs Tab

1. **Clean Response** - The AI's response text
2. **Raw Response** - Unprocessed LLM output
3. **Tool Execution** - Tool calls made and their results

### Orchestration Tab

Metadata about the interaction (timing, token counts, etc.)

## API Endpoints

### Memory Buffer (Recent)
- `GET /api/debug/llm` - Get last N interactions from memory
- `GET /api/debug/llm/:id` - Get specific interaction by ID
- `DELETE /api/debug/llm` - Clear memory buffer

### Database (Historical)
- `GET /api/debug/llm/persistent` - Get interactions from database (paginated)
- `GET /api/debug/llm/persistent/:id` - Get specific interaction by ID
- `GET /api/debug/llm/persistent/chat/:chatId` - Get all interactions for a chat

## Testing

### Automated Test

```bash
npm run tsx scripts/test-debug-capture.ts
```

Verifies that:
- `cache.md` exists and is readable
- `Short_Term_Memory.md` exists and is readable
- File loading logic works correctly

### Manual Testing

1. Start dev server: `npm run dev`
2. Send a chat message
3. Open debug page: `http://localhost:5000/debug`
4. Select the most recent interaction
5. Verify "Injected Files" section shows:
   - `cache.md` with content
   - `Short_Term_Memory.md` with content
6. Verify "RAG Context" section shows retrieved knowledge items (if any matched the query)

## Benefits

### Complete Ground Truth
- Every piece of data sent to the LLM is now visible
- Can trace exactly why the AI made certain decisions
- Facilitates debugging and optimization

### RAG Visibility
- See which knowledge was retrieved
- Understand relevance scores
- Debug retrieval quality issues

### Memory System Transparency
- Verify cache.md is persisting thoughts correctly
- Ensure Short_Term_Memory.md instructions are being applied
- Debug memory-related issues

### Data Isolation
- `userId` is tracked throughout the pipeline
- RAG retrieval respects user data boundaries
- Debug data can be filtered by user

## Implementation Notes

### Backward Compatibility
- Existing `enrichPrompt()` method still works
- New `enrichPromptWithContext()` method added alongside it
- No breaking changes to existing code

### Performance
- RAG retrieval happens once per request
- Debug data adds minimal memory overhead
- Database persistence is optional (configurable)

### Security
- Sensitive data should not be logged to debug buffer
- Consider scrubbing API keys, passwords, etc.
- Review data retention policies for production

## Future Enhancements

### Potential Improvements
1. Add filtering by RAG source type
2. Implement diff view between turns
3. Add search across historical interactions
4. Export debug data for offline analysis
5. Add visualization of RAG relevance scores

### Tools Integration
When tools.md is properly modularized (per the 15 MRU modules plan), this system will automatically capture which tool definitions were active for each LLM call.

## Related Files

- `server/services/prompt-composer.ts` - Prompt composition logic
- `server/services/retrieval-orchestrator.ts` - RAG retrieval logic
- `server/services/llm-debug-buffer.ts` - Debug buffer management
- `server/routes.ts` - LLM call and debug endpoints
- `client/src/pages/debug.tsx` - Debug UI
- `shared/schema.ts` - Database schema
- `scripts/test-debug-capture.ts` - Automated test

## Conclusion

This enhancement provides complete visibility into the LLM decision-making pipeline, making it easier to debug issues, optimize prompts, and understand AI behavior. The system captures both the structured data (RAG context, injected files) and the final assembled prompt, giving developers the full picture of each interaction.
