# Authentication Layer and Session Isolation

## Overview

This document describes the implementation of authentication-based access control and data isolation in Meowstik. The system creates a clear security boundary between authenticated users and guest (unauthenticated) users.

## Architecture

### 1. Authentication Middleware

**File:** `server/routes/middleware.ts`

The `checkAuthStatus` middleware runs on **all** requests and determines authentication status without blocking access:

```typescript
export const checkAuthStatus: RequestHandler = (req, res, next) => {
  const user = req.user as any;
  
  (req as any).authStatus = {
    isAuthenticated: req.isAuthenticated() && !!user?.claims?.sub,
    userId: user?.claims?.sub || null,
    isGuest: !req.isAuthenticated() || !user?.claims?.sub,
  };
  
  next();
};
```

**Key Points:**
- Non-blocking - determines status but doesn't reject requests
- Attached to all routes via `app.use(checkAuthStatus)`
- Sets `req.authStatus` object for use in route handlers

### 2. Database Schema Changes

**File:** `shared/schema.ts`

The `chats` table now includes:

```typescript
export const chats = pgTable("chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  isGuest: boolean("is_guest").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Fields:**
- `userId`: Foreign key to users table (NULL for guests)
- `isGuest`: Boolean flag marking guest conversations

**Migration:**
Run `npm run db:push` to apply schema changes when database is available.

### 3. Tool Scoping

**Files:** 
- `server/gemini-tools.ts` - Full tool set for authenticated users
- `server/gemini-tools-guest.ts` - Limited safe tools for guests

#### Authenticated User Tools (Full Set)
- ✅ send_chat, say
- ✅ file_get, file_put
- ✅ Gmail operations (list, read, send, search)
- ✅ Google Drive operations (list, read, create, update, delete)
- ✅ Google Calendar operations
- ✅ Google Docs operations
- ✅ Google Sheets operations
- ✅ Google Tasks operations
- ✅ Terminal execution
- ✅ GitHub operations
- ✅ Twilio SMS/Voice
- ✅ All integrations and personal data access

#### Guest User Tools (Limited Set)
- ✅ send_chat, say (basic output)
- ✅ Web search (google_search, duckduckgo_search)
- ✅ AI-powered search (tavily_search, perplexity_search)
- ✅ Web scraping (browser_scrape)
- ✅ Image generation (image_generate)
- ✅ Debug echo
- ❌ NO file system access
- ❌ NO Gmail, Drive, Calendar, Docs, Sheets, Tasks
- ❌ NO GitHub integration
- ❌ NO Twilio integration
- ❌ NO terminal execution
- ❌ NO personal data access

#### Tool Selection

**File:** `server/routes.ts`

```typescript
// Get auth status from middleware
const authStatus = (req as any).authStatus;

// Select appropriate tool set based on authentication
const toolDeclarations = getToolDeclarations(authStatus.isAuthenticated);

// Use in Gemini API call
const result = await genAI.models.generateContentStream({
  model: modelMode,
  config: {
    systemInstruction: modifiedPrompt.systemPrompt,
    tools: [{ functionDeclarations: toolDeclarations }],
    // ...
  },
  // ...
});
```

### 4. Data Segregation (Guest Bucket)

#### Chat Creation

**File:** `server/routes.ts`

```typescript
app.post("/api/chats", async (req, res) => {
  const authStatus = (req as any).authStatus;
  
  const validatedData = insertChatSchema.parse({
    ...req.body,
    userId: authStatus.userId, // null for guests
    isGuest: authStatus.isGuest, // true for guests
  });

  const chat = await storage.createChat(validatedData);
  // ...
});
```

#### RAG Service Data Isolation

**File:** `server/services/rag-service.ts`

##### Message Ingestion

The `ingestMessage()` method already stores userId:

```typescript
async ingestMessage(
  content: string,
  chatId: string,
  messageId: string,
  role: "user" | "ai",
  timestamp?: Date,
  userId?: string | null
): Promise<IngestResult | null>
```

Metadata stored with each chunk:
```typescript
const chunkMetadata = {
  // ...
  chatId,
  messageId,
  role,
  userId: userId || "guest",
  isVerified: !!userId,
  source: "conversation",
};
```

##### Data Retrieval

The `retrieve()` method filters by userId:

```typescript
async retrieve(
  query: string,
  topK: number = 20,
  threshold: number = 0.25,
  userId?: string | null  // NEW: Data isolation parameter
): Promise<RetrievalResult>
```

**Vector Store Filtering:**
```typescript
const filter: Record<string, unknown> = {};
if (userId !== undefined) {
  filter.userId = userId || "guest";
}

const searchResults = await vectorStore.search(queryEmbedding.embedding, {
  topK,
  threshold,
  filter, // Applies userId filter
});
```

**Legacy Retrieval Filtering:**
```typescript
let allChunks = await storage.getAllDocumentChunks();

if (userId !== undefined) {
  const targetUserId = userId || "guest";
  allChunks = allChunks.filter((chunk) => {
    const metadata = chunk.metadata as { userId?: string } | null;
    return metadata?.userId === targetUserId;
  });
}
```

### 5. Request Flow

#### Authenticated User Flow

```
1. User logs in via Replit OAuth
   ↓
2. Session stored with userId
   ↓
3. checkAuthStatus sets:
   - isAuthenticated: true
   - userId: "user-uuid"
   - isGuest: false
   ↓
4. Chat created with userId and isGuest=false
   ↓
5. Message sent
   ↓
6. Routes selects FULL tool set
   ↓
7. RAG retrieve filters by userId
   ↓
8. LLM has access to:
   - Personal emails, calendar, drive
   - File system access
   - All integrations
   - User's RAG data only
```

#### Guest User Flow

```
1. User visits without logging in
   ↓
2. No session exists
   ↓
3. checkAuthStatus sets:
   - isAuthenticated: false
   - userId: null
   - isGuest: true
   ↓
4. Chat created with userId=null and isGuest=true
   ↓
5. Message sent
   ↓
6. Routes selects LIMITED guest tool set
   ↓
7. RAG retrieve filters by userId="guest"
   ↓
8. LLM has access to:
   - Web search only
   - Image generation
   - NO personal data
   - Guest RAG data only
```

## Security Guarantees

### Data Isolation
- ✅ Guest conversations stored separately (userId=null, isGuest=true)
- ✅ RAG retrieval filtered by userId
- ✅ No cross-contamination between users
- ✅ Guest cannot retrieve authenticated user's data
- ✅ Authenticated user cannot retrieve other users' data

### Tool Restrictions
- ✅ Guests cannot call tools that access personal data
- ✅ Guests cannot access file system
- ✅ Guests cannot send emails or access calendar
- ✅ Tool set enforced at LLM prompt level (native function calling)

### Authentication Boundaries
- ✅ Authentication checked on every request
- ✅ Auth status passed through request context
- ✅ No hardcoded assumptions about authentication

## Testing Checklist

### Manual Testing

#### Guest User Tests
- [ ] Visit app without logging in
- [ ] Create a chat (should have userId=null, isGuest=true)
- [ ] Send a message asking to search the web (should work)
- [ ] Send a message asking to read email (should fail - no tool available)
- [ ] Send a message asking to create a file (should fail - no tool available)
- [ ] Verify RAG retrieval only returns guest data

#### Authenticated User Tests
- [ ] Log in via Replit OAuth
- [ ] Create a chat (should have userId set, isGuest=false)
- [ ] Send a message asking to search the web (should work)
- [ ] Send a message asking to read email (should work)
- [ ] Send a message asking to create a file (should work)
- [ ] Verify RAG retrieval only returns user's data

#### Data Isolation Tests
- [ ] As guest, add some information via chat
- [ ] Log in as user A, add different information
- [ ] Log in as user B, verify cannot see user A's data
- [ ] Log out, verify guest data is separate from users

### Automated Testing

Create tests for:
- `checkAuthStatus` middleware
- `getToolDeclarations()` function
- RAG service `retrieve()` with userId filtering
- Chat creation with auth status

## Configuration

### Environment Variables

No new environment variables required. The system uses existing Replit Auth configuration.

### Database Migration

Run when database is available:
```bash
npm run db:push
```

This will apply the schema changes to add `userId` and `isGuest` to the `chats` table.

## Future Enhancements

### Guest Conversation Cleanup

Consider implementing a periodic cleanup job for guest conversations:

```typescript
// Pseudo-code
async function cleanupGuestConversations() {
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await storage.deleteGuestChatsOlderThan(cutoffDate);
}

// Schedule cleanup
cron.schedule('0 0 * * *', cleanupGuestConversations); // Daily at midnight
```

### Guest Rate Limiting

Consider adding rate limits for guest users to prevent abuse:

```typescript
const guestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window for guests
  skip: (req) => !(req as any).authStatus?.isGuest,
});

app.use(guestRateLimiter);
```

### Analytics

Track usage patterns:
- Number of guest vs authenticated sessions
- Tool usage by guest vs authenticated users
- Conversion rate from guest to authenticated

## Troubleshooting

### Issue: Guest can still access personal data
**Cause:** Tool declarations not properly selected based on auth status  
**Fix:** Verify `getToolDeclarations()` is called with correct auth status

### Issue: Authenticated user sees guest data in RAG
**Cause:** userId not passed to RAG retrieve  
**Fix:** Ensure userId from authStatus is passed through to rag.retrieve()

### Issue: Database migration fails
**Cause:** Database not provisioned  
**Fix:** Ensure DATABASE_URL is set and database is accessible

### Issue: All users treated as guests
**Cause:** Replit Auth not configured  
**Fix:** Verify REPL_ID and ISSUER_URL environment variables

## References

- Replit Auth Documentation: https://docs.replit.com/hosting/authenticating-users-replit-auth
- Gemini Function Calling: https://ai.google.dev/gemini-api/docs/function-calling
- Vector Store Implementation: `server/services/vector-store/`
- RAG Service: `server/services/rag-service.ts`

## Summary

This implementation creates a robust security boundary between authenticated and guest users by:

1. **Detecting** authentication status on every request
2. **Scoping** available tools based on authentication
3. **Isolating** data storage and retrieval by userId
4. **Enforcing** boundaries at multiple layers (middleware, tools, data)

The system allows guests to use the product in a limited, safe manner while protecting authenticated users' personal data and ensuring privacy between users.
