# Setting Up Meowstik as a Separate GitHub Identity

## Problem

When Meowstik makes GitHub API calls (creating issues, commenting on PRs, creating commits), they currently appear under your personal GitHub account (@jasonbender-c3x). You want Meowstik to have her own GitHub identity so comments and actions appear under her name, not yours.

## Solution Options

### Option 1: GitHub Bot Account (Easiest) ⭐ Recommended

Create a separate GitHub account for Meowstik that acts as a bot.

#### Step 1: Create GitHub Bot Account

1. **Sign out** of your personal GitHub account
2. Go to https://github.com/signup
3. Create a new account:
   - Username: `meowstik-bot`, `meowstik-ai`, or just `meowstik`
   - Email: Use a separate email (e.g., meowstik@yourdomain.com)
   - Verify the account

4. **Customize the profile:**
   - Profile picture: Upload Meowstik's avatar/logo
   - Bio: "Meowstik AI Assistant - Your friendly feline coding companion 🐱"
   - Website: Link to your domain (e.g., meowstik.com)

#### Step 2: Generate Personal Access Token (PAT)

1. While logged in as the bot account, go to:
   - **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Configure the token:
   - **Note**: "Meowstik Bot Token"
   - **Expiration**: No expiration (or set appropriate expiry)
   - **Scopes**: Select these permissions:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
     - ✅ `write:discussion` (Write discussions)
     - ✅ `read:org` (Read org membership)
     - ✅ `gist` (Create gists)
     - ✅ `user` (Update user profile)

4. Click **Generate token**
5. **IMPORTANT**: Copy the token immediately (you won't see it again!)

#### Step 3: Add Bot to Your Repositories

1. Go to your repository (jasonbender-c3x/Meowstik)
2. **Settings** → **Collaborators**
3. Click **Add people**
4. Add the bot account (e.g., `meowstik-bot`)
5. Give it **Write** or **Maintain** access

#### Step 4: Update Meowstik Configuration

Update your `.env` file to use the bot's token:

```bash
# Replace your personal token with the bot's token
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Specify bot username explicitly
GITHUB_BOT_USERNAME=meowstik-bot
```

#### Step 5: Restart Meowstik

```bash
npm run dev
```

**Result:** All GitHub comments, PRs, and commits from Meowstik will now appear under the bot account!

---

### Option 2: GitHub App (More Professional)

GitHub Apps get their own identity with `[bot]` suffix (e.g., `meowstik[bot]`).

#### Benefits:
- Official "bot" designation in GitHub
- Better permission granularity
- Can be installed on multiple repos/orgs
- Doesn't count as a user license
- More secure (app-level credentials)

#### Drawbacks:
- More complex setup
- Requires webhook endpoint for installation
- Need to handle GitHub App authentication flow

#### Setup Steps:

1. **Create GitHub App:**
   - Go to: Settings → Developer settings → GitHub Apps → New GitHub App
   - Name: "Meowstik"
   - Homepage URL: `https://meowstik.com` (or your domain)
   - Webhook: Set to your server URL (e.g., `https://yourserver.com/api/github/webhook`)
   - Permissions:
     - Repository permissions:
       - Contents: Read & write
       - Issues: Read & write
       - Pull requests: Read & write
       - Discussions: Read & write
     - Organization permissions:
       - Members: Read-only

2. **Generate Private Key:**
   - Scroll to bottom → Generate a private key
   - Download the `.pem` file
   - Store securely (e.g., `/home/runner/secrets/meowstik-github-app.pem`)

3. **Install the App:**
   - Install on your account/organization
   - Select repositories (or all repositories)

4. **Update Meowstik Code:**

Create `server/integrations/github-app.ts`:

```typescript
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import fs from 'fs';

// GitHub App configuration
const APP_ID = process.env.GITHUB_APP_ID!;
const PRIVATE_KEY = fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH!, 'utf8');
const INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID!;

// Create authenticated Octokit instance
export const octokitApp = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: APP_ID,
    privateKey: PRIVATE_KEY,
    installationId: INSTALLATION_ID,
  },
});

// Use this instead of the regular octokit for GitHub operations
export async function createComment(owner: string, repo: string, issueNumber: number, body: string) {
  return octokitApp.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}
```

5. **Update `.env`:**

```bash
# GitHub App credentials
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/meowstik-github-app.pem
GITHUB_APP_INSTALLATION_ID=78901234

# Keep GITHUB_TOKEN for fallback
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Comparison

| Feature | Bot Account | GitHub App |
|---------|-------------|------------|
| Setup Complexity | ⭐ Easy | ⭐⭐⭐ Complex |
| Identity | `@meowstik-bot` | `meowstik[bot]` |
| Permissions | User-level PAT | Granular app permissions |
| Multi-repo | Manual per repo | Install once |
| License Cost | Counts as user | Free (doesn't count) |
| Best For | Single org/simple | Enterprise/multiple orgs |

---

## Current Implementation

The branding feature you just implemented adds:
- ✅ Custom signatures on commits (e.g., "🐱 Automated by Catpilot")
- ✅ Custom agent name in chat responses
- ✅ Custom branding in UI

**What it does NOT change:**
- ❌ GitHub comment author (still shows your username)
- ❌ GitHub API caller identity

To change the comment author, you need to use one of the solutions above.

---

## Recommended Approach

**For quick setup (15 minutes):** Use Option 1 (Bot Account)
1. Create `@meowstik-bot` GitHub account
2. Generate PAT with appropriate permissions
3. Add bot as collaborator to your repos
4. Update `GITHUB_TOKEN` in `.env`
5. Restart server

**For production/enterprise (1-2 hours):** Use Option 2 (GitHub App)
- Better security and permissions
- Official "bot" designation
- Scales to multiple repositories

---

## Testing

After setup, test that comments appear under the bot account:

```bash
# Make a test comment
curl -X POST http://localhost:5000/api/test-github-comment \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "jasonbender-c3x/Meowstik",
    "issue": 1,
    "comment": "Test comment from Meowstik! 🐱"
  }'
```

Check GitHub to verify the comment author is the bot account.

---

## Environment Variables Summary

### Option 1 (Bot Account):
```bash
GITHUB_TOKEN=<bot-account-pat>
GITHUB_BOT_USERNAME=meowstik-bot  # Optional
```

### Option 2 (GitHub App):
```bash
GITHUB_APP_ID=<app-id>
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem
GITHUB_APP_INSTALLATION_ID=<installation-id>
GITHUB_TOKEN=<fallback-token>  # Optional fallback
```

---

## Security Notes

1. **Never commit tokens to git** - Use `.env` file (already in `.gitignore`)
2. **Rotate tokens regularly** - Especially if exposed
3. **Minimum permissions** - Only grant what's needed
4. **Monitor usage** - Check bot account activity regularly
5. **Two-factor auth** - Enable 2FA on bot account

---

## Troubleshooting

### Comments still showing under my name
- ✓ Check `.env` has correct `GITHUB_TOKEN`
- ✓ Verify token belongs to bot account, not personal
- ✓ Restart server after changing `.env`
- ✓ Clear any cached credentials

### Bot can't access repository
- ✓ Add bot as collaborator with Write access
- ✓ For private repos, ensure bot accepted invite
- ✓ Check token has `repo` scope

### "Bad credentials" error
- ✓ Verify token is valid (not expired)
- ✓ Check token has correct permissions
- ✓ Ensure no extra spaces in `.env` value

---

## Next Steps

1. Choose your preferred option (Bot Account or GitHub App)
2. Follow the setup steps above
3. Update `.env` with new credentials
4. Restart Meowstik
5. Test by creating a GitHub comment
6. Verify comment appears under Meowstik's identity 🐱

**Meowstik's on it!** 🎉
