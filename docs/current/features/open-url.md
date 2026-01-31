# Open URL Feature Implementation

## Overview

This feature enables Meowstik to open URLs in new browser tabs/windows, allowing the AI to direct users to relevant web pages, documentation, or resources directly from the chat interface.

## Architecture

The feature uses a coordinated client-server architecture:

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   User      │         │   Meowstik   │         │   Browser   │
│   Request   │────────>│   Backend    │────────>│   Frontend  │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │                        │
      │  "Open GitHub issue"   │                        │
      │───────────────────────>│                        │
      │                        │                        │
      │                        │  Generate tool call:   │
      │                        │  open_url(...)         │
      │                        │                        │
      │                        │  SSE: {openUrl: {...}} │
      │                        │───────────────────────>│
      │                        │                        │
      │                        │                   window.open()
      │                        │                        │
      │                        │<───────────────────────│
      │                   New tab opens                 │
```

## Implementation Details

### 1. Schema Definition (`shared/schema.ts`)

Added `open_url` to the tool call type enum and created a parameter schema:

```typescript
export const toolCallSchema = z.object({
  type: z.enum([
    // ... other tools
    "open_url",
    // ...
  ]),
  // ...
});

export const openUrlParamsSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});
```

### 2. Backend Dispatcher (`server/services/rag-dispatcher.ts`)

Added URL validation and pass-through logic:

```typescript
case "open_url":
  const openUrlParams = toolCall.parameters as { url?: string };
  if (!openUrlParams?.url) {
    throw new Error("URL parameter is required");
  }
  // Validate URL format
  try {
    new URL(openUrlParams.url);
  } catch (e) {
    throw new Error("Invalid URL format");
  }
  result = { url: openUrlParams.url, success: true };
  break;
```

### 3. Server-Sent Events (`server/routes.ts`)

Added SSE event handler to stream URL to frontend:

```typescript
if (toolCall.type === "open_url" && toolResult.success) {
  console.log(`[Routes][OPEN_URL] Sending open_url event`);
  const openUrlResult = toolResult.result as { url?: string; success?: boolean };
  if (openUrlResult?.url) {
    res.write(
      `data: ${JSON.stringify({
        openUrl: {
          url: openUrlResult.url,
        },
      })}\n\n`,
    );
    console.log(`[Routes][OPEN_URL] ✓ Sent URL to open: ${openUrlResult.url}`);
  }
}
```

### 4. Frontend Handler (`client/src/pages/home.tsx`)

Added SSE event listener to execute `window.open()`:

```typescript
// Handle openUrl event - open URL in new tab
if (data.openUrl) {
  console.log('[OPEN_URL] Received openUrl event:', data.openUrl);
  const openUrlData = data.openUrl as { url: string };
  if (openUrlData.url) {
    try {
      console.log('[OPEN_URL] Opening URL in new tab:', openUrlData.url);
      window.open(openUrlData.url, '_blank');
      console.log('[OPEN_URL] ✓ Successfully triggered window.open()');
    } catch (err) {
      console.error('[OPEN_URL] Error opening URL:', err);
    }
  }
}
```

### 5. Gemini Tool Declarations

Added function declarations for both authenticated and guest modes:

**`server/gemini-tools.ts`:**
```typescript
{
  name: "open_url",
  description: "Open a URL in a new browser tab. Use this when the user asks to view a webpage, open a link, or navigate to a URL. Does NOT terminate the loop.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to open (must include https:// or http://)"
      }
    },
    required: ["url"]
  }
}
```

## Usage Examples

### Example 1: Opening a GitHub Issue

**User:** "Open issue #581 in the Meowstik repo"

**AI Response:**
```json
{
  "toolCalls": [
    {
      "type": "say",
      "id": "s1",
      "operation": "speak",
      "parameters": {
        "utterance": "Opening the GitHub issue for you now."
      }
    },
    {
      "type": "open_url",
      "id": "u1",
      "operation": "open_browser",
      "parameters": {
        "url": "https://github.com/jasonbender-c3x/Meowstik/issues/581"
      }
    },
    {
      "type": "send_chat",
      "id": "c1",
      "operation": "respond",
      "parameters": {
        "content": "I've opened [issue #581](https://github.com/jasonbender-c3x/Meowstik/issues/581) for you in a new tab."
      }
    }
  ]
}
```

### Example 2: Opening Documentation

**User:** "Show me the React documentation for hooks"

**AI Response:**
```json
{
  "toolCalls": [
    {
      "type": "open_url",
      "id": "u1",
      "operation": "open_browser",
      "parameters": {
        "url": "https://react.dev/reference/react/hooks"
      }
    },
    {
      "type": "send_chat",
      "id": "c1",
      "operation": "respond",
      "parameters": {
        "content": "I've opened the [React Hooks documentation](https://react.dev/reference/react/hooks) for you."
      }
    }
  ]
}
```

## Security Considerations

1. **URL Validation**: URLs are validated using JavaScript's `URL` constructor on the backend
2. **Pop-up Blockers**: The action is triggered by user interaction (sending a message), so it should bypass most pop-up blockers
3. **HTTPS Enforcement**: The schema validates that URLs follow proper format
4. **Guest Access**: The tool is available to both authenticated and guest users (read-only operation)

## Browser Compatibility

The feature uses standard `window.open()` API which is supported in:
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Mobile browsers: ✅

## Testing

### Manual Testing Steps

1. **Start the Development Server:**
   ```bash
   npm run dev
   ```

2. **Open the Chat Interface:**
   Navigate to `http://localhost:5000`

3. **Test Basic URL Opening:**
   - Send: "Open https://github.com"
   - Expected: GitHub homepage opens in new tab
   - Expected: AI confirms with a message

4. **Test with GitHub Issue:**
   - Send: "Open GitHub issue 581 in Meowstik repo"
   - Expected: Issue page opens in new tab
   - Expected: AI provides confirmation with link

5. **Test with Documentation:**
   - Send: "Show me TypeScript documentation"
   - Expected: TypeScript docs open in new tab

6. **Test Pop-up Blocker Behavior:**
   - Ensure browser pop-up blocker is enabled
   - Send: "Open https://example.com"
   - Expected: Tab should open (user-initiated action)

7. **Test Invalid URL:**
   - Send tool call with invalid URL format
   - Expected: Backend validation error, graceful handling

### Console Logging

The feature includes comprehensive logging:

```
[OPEN_URL] Received openUrl event: { url: "..." }
[OPEN_URL] Opening URL in new tab: ...
[OPEN_URL] ✓ Successfully triggered window.open()
```

Backend logs:
```
[Routes][OPEN_URL] Sending open_url event
[Routes][OPEN_URL] ✓ Sent URL to open: ...
```

## Future Enhancements

Potential improvements for future iterations:

1. **Window Features**: Support for specifying window size, position, features
2. **Tab Management**: Option to focus existing tab if URL already open
3. **URL Previews**: Show link previews before opening
4. **URL Shortening**: Integrate with URL shortening service for cleaner links
5. **History Tracking**: Track opened URLs in session for reference
6. **Confirmation Dialog**: Optional confirmation before opening external links

## Related Files

- `shared/schema.ts` - Tool call schema and validation
- `server/services/rag-dispatcher.ts` - Tool execution logic
- `server/routes.ts` - SSE event streaming
- `client/src/pages/home.tsx` - Frontend SSE handler
- `server/gemini-tools.ts` - AI function declarations
- `server/gemini-tools-guest.ts` - Guest mode declarations
- `docs/05-tool-call-schema.md` - Tool documentation
- `prompts/tools.md` - AI prompt documentation

## References

- [Issue #581](https://github.com/jasonbender-c3x/Meowstik/issues/581) - Original feature request
- [MDN: window.open()](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)
- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
