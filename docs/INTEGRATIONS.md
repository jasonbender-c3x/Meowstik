# Integrations

Third-party services that Meowstik connects to.

---

## Google — OAuth 2.0

**Required env vars:**
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

**Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web Application)
3. Add your redirect URI to the authorized list
4. Enable APIs: Gmail, Calendar, Drive, Docs, Sheets, Tasks, People, Cloud Text-to-Speech

**OAuth scopes requested:**
- `email`, `profile` — basic identity
- `gmail.modify` — read + send email
- `calendar` — full calendar access
- `drive` — full Drive access
- `documents` — Docs read/write
- `spreadsheets` — Sheets read/write
- `tasks` — Tasks access
- `contacts` — Contacts read/write
- `cloud-platform` — for TTS fallback

Tokens stored in the `google_oauth_tokens` table, refreshed automatically.

---

## Google Cloud TTS — Chirp3-HD

**See [TTS.md](./TTS.md) for full documentation.**

**Recommended:** Service account authentication.

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`.

**API used:** `textspeech.googleapis.com/v1/text:synthesize`

**Model:** `en-US-Chirp3-HD-{VoiceName}` with `NEURAL2` synthesis

---

## Google Gemini AI

**Required:**
```env
GEMINI_API_KEY=your_key_from_aistudio
```

**Models used:**
| Context | Model |
|---------|-------|
| Main chat | `gemini-2.5-pro` (or `gemini-2.0-flash` for lighter queries) |
| Evolution suggestions | `gemini-3-flash-preview` |
| Summarization Engine | `gemini-2.0-flash` |
| JIT tool prediction | `gemini-2.0-flash` |

**Library:** `@google/genai` v1.x

---

## Twilio — SMS & Voice

**Required for SMS/calling:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567
```

**Location:** `server/integrations/twilio.ts`

**Features:**
- Inbound SMS webhook — Twilio POSTs to your server, AI responds
- Outbound SMS via `sms_send` tool
- Inbound call handling with TwiML voice responses
- Outbound AI calling — AI conducts entire conversations via `call_make` tool
- Voicemail detection + transcription
- `call_conversations` and `sms_messages` tables for history

**Webhook configuration:**
- SMS webhook: `https://your-domain/api/twilio/sms`
- Voice webhook: `https://your-domain/api/twilio/voice`
- Configure these URLs in your [Twilio Console](https://console.twilio.com)

---

## GitHub

**For Evolution Engine PRs and git operations.**

Set up via OAuth in the UI (sign in with GitHub), or provide a PAT:
```env
GITHUB_TOKEN=ghp_your_personal_access_token
```

**Library:** `@octokit/rest` v22

**Operations:**
- Create/update files with agent attribution
- Create branches
- Open pull requests
- Add PR comments (tagging `@copilot`)
- Read repos, issues, PRs

**Agent identity:** PRs are attributed to "Agentia Compiler" agent or the user's custom GitHub signature from `user_branding`.

---

## Exa (Neural Web Search)

```env
EXA_API_KEY=your_key
```

**Library:** `exa-js`

Exa provides semantic / neural search. Better than keyword search for conceptual queries. Used by the `exa_search` tool.

---

## Google Custom Search

```env
GOOGLE_SEARCH_API_KEY=your_api_key
GOOGLE_SEARCH_ENGINE_ID=your_engine_id
```

Traditional keyword search via Google's Custom Search JSON API. Used by the `web_search` tool.

---

## MCP Servers

**Library:** `@modelcontextprotocol/sdk`

Meowstik can connect to external MCP (Model Context Protocol) servers and expose their tools directly to the agent.

**Current support:**
- `stdio`
- Streamable HTTP
- Legacy SSE

**Agent-facing MCP tools:**
- `mcp_list_servers`
- `mcp_list_tools`
- `mcp_call`

**Built-in library:**
- Official/reference servers:
  - `filesystem`
  - `fetch`
  - `git`
  - `memory`
  - `time`
  - `sequentialthinking`
  - `everything`
- Includes **Nelson MCP** for LibreOffice workflows

**Configuration:**
- MCP servers are managed from the Settings UI
- Built-in library entries can be added as configured servers
- Only enabled configured servers are callable by the agent

**Related prompt context:**
- Meowstik also discovers local assistant instruction/skill markdown files from common roots such as `.claude`, `.github`, `~/.claude`, `~/.gemini`, and `~/.copilot`
- Those discovered skills are summarized into the runtime system prompt via `externalSkillsService`
- This is prompt enrichment, not MCP transport

> Browserbase has been removed from the live integration set. Browser automation should use the current Puppeteer / Playwright flows or MCP servers where appropriate.

---

## Residential Proxy (Optional)

For web scraping through residential IPs:
```env
RESIDENTIAL_PROXY_URL=http://proxy.example.com:8080
RESIDENTIAL_PROXY_USER=username
RESIDENTIAL_PROXY_PASSWORD=password
```

---

## Passport (Google OAuth Sessions)

**Library:** `passport`, `passport-google-oauth20`, `express-session`

Sessions are stored server-side. The `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` vars above drive this. No separate config needed.
