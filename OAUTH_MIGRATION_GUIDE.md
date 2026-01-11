# OAuth 2.0 Multi-User Migration Guide

## Overview
This document describes the changes made to implement per-user OAuth 2.0 authentication for Google Workspace integrations, transitioning from a single-user token system to true multi-user functionality.

## Critical Changes

### 1. Database Schema Updates
**File:** `shared/schema.ts`

Added the following columns to the `users` table:
- `googleAccessToken` (text) - Per-user Google OAuth access token
- `googleRefreshToken` (text) - Per-user refresh token for automatic token renewal
- `googleExpiryDate` (bigint) - Token expiration timestamp
- `googleTokenType` (text) - OAuth token type (usually "Bearer")
- `googleScope` (text) - Granted OAuth scopes

**Migration Required:** Run `npm run db:push` to apply these schema changes to the database.

### 2. Storage Layer Updates
**File:** `server/storage.ts`

Added new methods to the `IStorage` interface and `DrizzleStorage` implementation:
- `saveUserGoogleTokens(userId, tokens)` - Save OAuth tokens for a specific user
- `getUserGoogleTokens(userId)` - Retrieve OAuth tokens for a specific user
- `deleteUserGoogleTokens(userId)` - Revoke OAuth access for a specific user

Legacy methods remain for backward compatibility:
- `saveGoogleTokens()` - Uses singleton `google_oauth_tokens` table
- `getGoogleTokens()` - Uses singleton `google_oauth_tokens` table
- `deleteGoogleTokens()` - Uses singleton `google_oauth_tokens` table

### 3. Google OAuth Authentication
**File:** `server/integrations/google-auth.ts`

#### New Per-User Functions:
- `getUserOAuth2Client(userId)` - Get OAuth2 client for a specific user
- `handleUserCallback(userId, code)` - Handle OAuth callback for a specific user
- `isUserAuthenticated(userId)` - Check if user has valid Google tokens
- `revokeUserAccess(userId)` - Revoke Google access for a specific user

#### Token Management:
- Per-user token caching in memory for performance
- Automatic token refresh when expired (60 seconds before expiry)
- Graceful fallback to database on cache miss

### 4. OAuth Routes
**File:** `server/routes/auth.ts`

#### Session-Based Flow:
1. User clicks "Connect Google" in settings
2. `/api/auth/google` - Stores userId in session, redirects to Google
3. Google consent screen shown to user
4. `/api/auth/google/callback` - Retrieves userId from session, saves tokens
5. Redirects back to `/settings?auth=success`

#### Updated Endpoints:
- `GET /api/auth/google` - Requires authentication, stores userId in session
- `GET /api/auth/google/callback` - Retrieves userId from session
- `GET /api/auth/google/status` - Returns per-user auth status
- `POST /api/auth/google/revoke` - Revokes per-user tokens

### 5. Middleware Updates
**File:** `server/routes/middleware.ts`

Added helper functions:
- `getUserId(req)` - Extract user ID from request session
- `requireAuth` - Middleware to block unauthenticated requests

### 6. Gmail Integration (Example)
**File:** `server/integrations/gmail.ts`

All Gmail functions now accept `userId` as the first parameter:
- `listEmails(userId, maxResults, labelIds)`
- `getEmail(userId, messageId)`
- `sendEmail(userId, to, subject, body)`
- `getLabels(userId)`
- `searchEmails(userId, query, maxResults)`

New helper:
- `getGmailClientForUser(userId)` - Creates Gmail API client with user's tokens

### 7. Gmail Routes
**File:** `server/routes/gmail.ts`

All routes now:
1. Extract userId using `getUserId(req)`
2. Check for authentication
3. Pass userId to integration functions

### 8. Frontend Updates
**File:** `client/src/pages/settings.tsx`

- Changed `window.open()` to `window.location.href` for OAuth redirect
- Added OAuth callback status detection
- Automatically refreshes auth status after successful OAuth

## Remaining Work

### Integrations to Update
The following integrations still need to be refactored to use per-user tokens:

1. **Google Calendar** (`server/integrations/google-calendar.ts`)
2. **Google Drive** (`server/integrations/google-drive.ts`)
3. **Google Docs** (`server/integrations/google-docs.ts`)
4. **Google Sheets** (`server/integrations/google-sheets.ts`)
5. **Google Tasks** (`server/integrations/google-tasks.ts`)
6. **Google Contacts** (`server/integrations/google-contacts.ts`)

### Pattern to Follow

For each integration file:

1. Add `getUserOAuth2Client` import:
```typescript
import { getUserOAuth2Client } from './google-auth';
```

2. Add helper function:
```typescript
export async function get[Service]ClientForUser(userId: string) {
  const auth = await getUserOAuth2Client(userId);
  return google.[service]({ version: 'v1', auth });
}
```

3. Update all exported functions to accept `userId` as first parameter:
```typescript
export async function someFunction(userId: string, ...otherParams) {
  const client = await get[Service]ClientForUser(userId);
  // ... rest of function
}
```

4. Update corresponding routes to:
   - Import `getUserId` from middleware
   - Extract userId in each route handler
   - Check authentication
   - Pass userId to integration functions

## Testing Checklist

- [ ] Run `npm run db:push` to apply database schema changes
- [ ] Test OAuth flow:
  - [ ] User logs in with Replit Auth
  - [ ] User navigates to Settings
  - [ ] User clicks "Connect Google"
  - [ ] User grants consent on Google's page
  - [ ] User redirected back to Settings with success message
  - [ ] Auth status shows as connected
- [ ] Test Gmail operations with per-user tokens:
  - [ ] List emails
  - [ ] Read email
  - [ ] Send email
  - [ ] Search emails
- [ ] Test token refresh:
  - [ ] Wait for token to expire (or manually set expiry date in DB)
  - [ ] Make API call
  - [ ] Verify token is automatically refreshed
- [ ] Test revocation:
  - [ ] Click "Disconnect Google"
  - [ ] Verify tokens removed from database
  - [ ] Verify subsequent API calls fail with auth error
- [ ] Test multi-user isolation:
  - [ ] User A connects Google account
  - [ ] User B connects different Google account
  - [ ] Verify User A sees their own emails
  - [ ] Verify User B sees their own emails

## Security Considerations

1. **Token Storage**: OAuth tokens are stored in the database in plaintext. Consider encrypting sensitive columns in production.

2. **Session Security**: The OAuth flow relies on Express sessions. Ensure:
   - `SESSION_SECRET` is strong and unique
   - Sessions are stored in PostgreSQL (already configured)
   - Cookies use `httpOnly`, `secure`, and `sameSite` flags (already configured)

3. **CORS and Redirect URIs**: Ensure Google Cloud Console has correct redirect URIs configured:
   - Development: `https://<replit-dev-domain>/api/auth/google/callback`
   - Production: `https://<production-domain>/api/auth/google/callback`

4. **Scope Minimization**: Review requested OAuth scopes. Current scopes include:
   - Gmail (read, send)
   - Calendar (read, write)
   - Drive (read, write files)
   - Docs, Sheets, Tasks, Contacts (various)
   - Consider requesting only the scopes needed for each user's use case

## Backward Compatibility

The legacy singleton token system (`google_oauth_tokens` table) is preserved for backward compatibility. The code includes fallback logic to use legacy tokens when:
- No userId is found in the session (OAuth callback)
- Function is called without userId parameter (old code)

Once all integrations are migrated and tested, the legacy code can be removed.

## Environment Variables Required

Ensure these environment variables are set:
- `GOOGLE_CLIENT_ID` - Google Cloud OAuth 2.0 Client ID
- `GOOGLE_CLIENT_SECRET` - Google Cloud OAuth 2.0 Client Secret
- `GOOGLE_REDIRECT_URI` (optional) - Override automatic redirect URI detection
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret

## Deployment Notes

1. Apply database migration: `npm run db:push`
2. Verify all environment variables are set
3. Update Google Cloud Console with production redirect URI
4. Test OAuth flow in production before announcing to users
5. Monitor logs for OAuth errors during rollout
6. Plan for users to re-authenticate (old singleton tokens won't work with new per-user system)

## Known Issues

1. **Knowledge Ingestion Routes**: The `/api/knowledge-ingestion` routes use Gmail and Drive integrations but haven't been updated to pass userId yet. These will need similar updates.

2. **Legacy Code**: Some routes may still reference the old singleton pattern. Audit all Google integration usage before full production deployment.

3. **No Encryption**: OAuth tokens are stored in plaintext. Implement encryption before production use with real user data.
