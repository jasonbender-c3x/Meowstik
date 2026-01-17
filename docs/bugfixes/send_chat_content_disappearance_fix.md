# Bug Fix: send_chat Content Disappearance on end_turn

## Issue Description

When the AI agent called `send_chat` to display content to the user, followed by `end_turn` to complete the response, the content sent via `send_chat` would disappear from the chat history after the stream completed.

### Impact
- **Severity**: High
- **User Experience**: The agent appeared to have amnesia, with previous responses literally vanishing
- **Broken Functionality**: Conversational continuity was lost

## Root Cause

The bug occurred in `server/routes.ts` in the message streaming handler:

1. When `send_chat` tool was executed in the agentic loop, its content was:
   - ✅ Streamed to the client for real-time display (line 918)
   - ❌ **NOT** added to `cleanContentForStorage` variable

2. When the stream completed with `end_turn`:
   - The `cleanContentForStorage` variable was saved to the database (line 1204)
   - `loadChatMessages()` reloaded from database, replacing the temporary message
   - **Result**: The `send_chat` content was lost

## Solution

Modified the `executeToolsAndGetResults` helper function to:

1. **Return** the accumulated `send_chat` content in addition to results
2. **Update callers** to add this content to `cleanContentForStorage`
3. **Ensure persistence** so content survives the database reload

### Code Changes

**File**: `server/routes.ts`

#### Change 1: Update helper function signature and accumulation
```typescript
// BEFORE
const executeToolsAndGetResults = async (
  toolCalls: ToolCall[],
  messageId: string
): Promise<{ results: typeof toolResults; shouldEndTurn: boolean }> => {
  const results: typeof toolResults = [];
  let endTurn = false;
  
  // ... tool execution ...
  
  if (toolCall.type === "send_chat" && toolResult.success) {
    const sendChatResult = toolResult.result as { content?: string };
    if (sendChatResult?.content) {
      // Stream the send_chat content to the client
      res.write(`data: ${JSON.stringify({ text: sendChatResult.content })}\n\n`);
      // ❌ Content not saved!
    }
  }
  
  return { results, shouldEndTurn: endTurn };
};

// AFTER
const executeToolsAndGetResults = async (
  toolCalls: ToolCall[],
  messageId: string
): Promise<{ results: typeof toolResults; shouldEndTurn: boolean; sendChatContent: string }> => {
  const results: typeof toolResults = [];
  let endTurn = false;
  let sendChatContent = ""; // ✅ Accumulate send_chat content for storage
  
  // ... tool execution ...
  
  if (toolCall.type === "send_chat" && toolResult.success) {
    const sendChatResult = toolResult.result as { content?: string };
    if (sendChatResult?.content) {
      // Stream the send_chat content to the client
      res.write(`data: ${JSON.stringify({ text: sendChatResult.content })}\n\n`);
      // ✅ CRITICAL FIX: Accumulate send_chat content so it's saved to database
      sendChatContent += sendChatResult.content;
    }
  }
  
  return { results, shouldEndTurn: endTurn, sendChatContent };
};
```

#### Change 2: Update call sites to use accumulated content
```typescript
// Initial tool execution (line ~1022)
const execResult = await executeToolsAndGetResults(limitedToolCalls, savedMessage.id);
toolResults.push(...execResult.results);
shouldEndTurn = execResult.shouldEndTurn;
// ✅ CRITICAL FIX: Add send_chat content to storage so it persists
if (execResult.sendChatContent) {
  cleanContentForStorage += execResult.sendChatContent;
}

// Loop iteration tool execution (line ~1148)
const loopExecResult = await executeToolsAndGetResults(limitedLoopToolCalls, savedMessage.id);
toolResults.push(...loopExecResult.results);
shouldEndTurn = loopExecResult.shouldEndTurn;
// ✅ CRITICAL FIX: Add send_chat content to storage so it persists
if (loopExecResult.sendChatContent) {
  cleanContentForStorage += loopExecResult.sendChatContent;
}
```

## Testing

### Test Scenario 1: Single send_chat + end_turn
**Before Fix:**
1. Agent calls `send_chat` with "Hello!"
2. Content appears in UI (temporary message)
3. Agent calls `end_turn`
4. ❌ Content disappears after database reload

**After Fix:**
1. Agent calls `send_chat` with "Hello!"
2. Content appears in UI and accumulated in `sendChatContent`
3. Agent calls `end_turn`
4. ✅ Content persists (saved to `cleanContentForStorage` → database)

### Test Scenario 2: Multiple send_chat calls
**Before Fix:**
1. Agent calls `send_chat` with "Searching..."
2. Agent calls `send_chat` with "Found results!"
3. Agent calls `end_turn`
4. ❌ Both messages disappear

**After Fix:**
1. Agent calls `send_chat` with "Searching..."
2. Agent calls `send_chat` with "Found results!"
3. Agent calls `end_turn`
4. ✅ "Searching...Found results!" persists in chat history

## Verification

Run the following test to verify the fix:
```bash
node /tmp/test_send_chat_fix.js
```

Expected output:
```
✓ Content will be saved to database: true
✓ All send_chat content accumulated: true
```

## Related Files
- `server/routes.ts` - Main fix location
- `server/gemini-tools.ts` - Tool declarations (documentation)
- `prompts/core-directives.md` - Usage examples
- `prompts/tools.md` - Tool documentation

## Commits
- `64fb535` - Fix: Accumulate send_chat content to prevent disappearance on end_turn
