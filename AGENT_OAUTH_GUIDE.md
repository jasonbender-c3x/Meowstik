# Agent OAuth Context Guide

## Overview

The OAuth system now supports **dual contexts**:
1. **User Context** - Operations performed on behalf of the authenticated user
2. **Agent Context** - Operations performed on behalf of the LLM's own account

This allows the LLM to access Google services using its own account (agent account) while also being able to access users' accounts when needed.

## Account Numbering Scheme

As specified by the system architect:
- **Account 0**: Owner account (jasonbender-c3x)
- **Accounts 1-9**: Reserved for agents
- **Account 1**: Default agent (LLM's primary account)
- **Account 10+**: Regular users

## Agent User ID

The constant `AGENT_USER_ID` is defined as `'1'` in `server/integrations/google-auth.ts`.

This is the user ID of the default agent account that the LLM uses for its own operations.

## Usage

### For User Operations (Route Handlers)

When handling HTTP requests from users, extract the userId and pass it to integration functions:

```typescript
import { getUserId } from "./middleware";
import { listEmails } from "../integrations/gmail";

router.get("/messages", asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // This will use the user's OAuth tokens
  const emails = await listEmails(userId, maxResults);
  res.json(emails);
}));
```

### For Agent Operations (LLM Internal)

When the LLM needs to access Google services on its own behalf (not as a user), pass `null` as the userId:

```typescript
import { listEmails, sendEmail } from "../integrations/gmail";
import { AGENT_USER_ID } from "../integrations/google-auth";

// Option 1: Pass null to use agent context
const agentEmails = await listEmails(null, 20);

// Option 2: Explicitly pass AGENT_USER_ID
const agentEmails = await listEmails(AGENT_USER_ID, 20);

// Send email from agent account
await sendEmail(null, 'user@example.com', 'Subject', 'Body');
```

### Checking Agent Authentication

Before using agent context, check if the agent account is authenticated:

```typescript
import { isAgentAuthenticated } from "../integrations/google-auth";

if (await isAgentAuthenticated()) {
  // Agent can access Google services
  const emails = await listEmails(null);
} else {
  // Agent needs to be authenticated first
  console.error('Agent account not authenticated with Google');
}
```

## Authentication Functions

### User Context
- `getUserOAuth2Client(userId: string)` - Get OAuth client for specific user
- `isUserAuthenticated(userId: string)` - Check if user is authenticated
- `revokeUserAccess(userId: string)` - Revoke user's Google access

### Agent Context
- `getAgentOAuth2Client()` - Get OAuth client for agent account
- `isAgentAuthenticated()` - Check if agent is authenticated
- `revokeUserAccess(AGENT_USER_ID)` - Revoke agent's Google access

### Dual Context
- `getOAuth2ClientForContext(userId: string | null)` - Get OAuth client for either user or agent

## Integration Functions

All Gmail integration functions now accept `string | null` for userId:

```typescript
// User operations
listEmails(userId: string | null, maxResults?, labelIds?)
getEmail(userId: string | null, messageId: string)
sendEmail(userId: string | null, to: string, subject: string, body: string)
getLabels(userId: string | null)
searchEmails(userId: string | null, query: string, maxResults?)
```

**Usage:**
- Pass a user ID string to operate on that user's behalf
- Pass `null` to operate using the agent account

## Setup Required

### 1. Create Agent User Account

The agent account (user ID = 1) must be created in the database:

```sql
INSERT INTO users (id, email, first_name, last_name)
VALUES ('1', 'agent@meowstik.ai', 'Meowstik', 'Agent')
ON CONFLICT (id) DO NOTHING;
```

### 2. Authenticate Agent Account

The agent account needs to complete OAuth flow:

1. Navigate to `/settings` while logged in as admin
2. Click "Connect Google" 
3. Ensure the agent user (ID=1) completes OAuth
4. Tokens will be stored in the `users` table for the agent

Alternatively, manually insert OAuth tokens for the agent account if using a service account or pre-authorized credentials.

### 3. Verify Agent Authentication

```typescript
import { isAgentAuthenticated, AGENT_USER_ID } from "../integrations/google-auth";

console.log('Agent authenticated:', await isAgentAuthenticated());
```

## When to Use Each Context

### Use User Context When:
- Handling HTTP API requests from users
- Accessing user's personal data (emails, calendar, drive)
- Operations should show up in user's account history
- User gave explicit consent via OAuth

### Use Agent Context When:
- LLM needs to send notifications/emails from system account
- Creating system-wide resources (shared calendars, documents)
- Background operations not tied to specific user
- Internal monitoring or logging operations

## Example: Hybrid Usage

```typescript
import { getUserId } from "./middleware";
import { listEmails, sendEmail } from "../integrations/gmail";
import { AGENT_USER_ID } from "../integrations/google-auth";

router.post("/analyze-emails", asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // 1. Fetch user's emails using their OAuth token
  const userEmails = await listEmails(userId, 50);
  
  // 2. Analyze emails (LLM processing)
  const analysis = await analyzeEmails(userEmails);
  
  // 3. Send analysis report from agent account
  await sendEmail(
    null,  // Use agent context
    req.body.notificationEmail,
    'Email Analysis Report',
    generateReport(analysis)
  );
  
  res.json({ success: true, analysis });
}));
```

## Security Considerations

1. **Agent Account Permissions**: The agent account should have appropriate OAuth scopes. Don't grant excessive permissions.

2. **User Consent**: Always use user context when operating on user data that requires user consent.

3. **Audit Trail**: Log all agent operations for accountability.

4. **Token Security**: Agent tokens are stored in the database like user tokens. Consider additional encryption for agent credentials in production.

5. **Rate Limiting**: Agent operations should respect Google API quotas. Implement exponential backoff for agent requests.

## Migration Path

For existing integrations that haven't been updated yet:

```typescript
// Old pattern (deprecated)
const emails = await listEmails(userId, 20);

// New pattern (supports both user and agent)
const emails = await listEmails(userId, 20);  // User context
const emails = await listEmails(null, 20);    // Agent context
```

The migration is backward compatible - existing code passing a userId will continue to work.

## Testing

### Test User Context
```typescript
import { listEmails } from "../integrations/gmail";

// Should return user's emails
const emails = await listEmails('user-uuid-here', 10);
console.log('User emails:', emails.length);
```

### Test Agent Context
```typescript
import { listEmails, isAgentAuthenticated, AGENT_USER_ID } from "../integrations/gmail";

// Check if agent is authenticated
console.log('Agent authenticated:', await isAgentAuthenticated());

// Should return agent's emails
const emails = await listEmails(null, 10);
console.log('Agent emails:', emails.length);
```

## Future Work

1. **Extend to Other Integrations**: Apply the same pattern to Calendar, Drive, Docs, Sheets, Tasks, Contacts
2. **Multiple Agent Accounts**: Support accounts 2-9 for specialized agents
3. **Agent Permissions Manager**: UI for managing what each agent can access
4. **Agent Activity Logging**: Track all operations performed by agents
5. **Service Account Support**: Option to use Google Service Accounts instead of OAuth for agents
