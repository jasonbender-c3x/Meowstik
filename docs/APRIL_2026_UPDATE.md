# April 2026 Update

This document summarizes the Meowstik changes shipped during April 2026, including the April work completed in this session.

## Highlights

### 2026-04-21

- Expanded the built-in **MCP library** with the official/reference servers:
  - `filesystem`
  - `fetch`
  - `git`
  - `memory`
  - `time`
  - `sequentialthinking`
  - `everything`
- Added first-pass **external skills discovery**:
  - scans common assistant instruction/skill locations
  - exposes discovered entries in Settings
  - injects summaries into the runtime system prompt
- Simplified the **workbench/sidebar UX**:
  - starts closed by default
  - removed the workbench-local input row
  - removed the workbench screen recorder button
  - relies on the main chat input as the primary prompt surface
- Removed **voice-related destructive toast popups** in the main chat input and replaced them with inline error text
- Fixed the **Live API connect flow** so cleanup only disconnects on unmount instead of normal callback churn / re-renders
- Corrected prompt documentation to match the current `PromptComposer` assembly path and removed unused prompt files from `prompts/`

### 2026-04-19

- Added full **MCP server support**:
  - persistent `mcp_servers` storage
  - built-in MCP library/catalog
  - supported transports: `stdio`, streamable HTTP, legacy SSE
  - agent tools: `mcp_list_servers`, `mcp_list_tools`, `mcp_call`
  - settings UI for library browsing, server management, testing, and tool inspection
  - built-in **Nelson MCP** entry for LibreOffice-compatible workflows
- Fixed a **live page lint regression** caused by a duplicate `nextStartTimeRef`
- Fixed the **append/log tool status regression** so append writes no longer leave `tool_call_logs` rows stuck in `pending`
- Added a regression test for the append/log status fix
- Removed unused root dependencies and refreshed stale docs around local runtime, MCP, and Browserbase removal

### 2026-04-13

- Fixed urgent chat issues affecting current-day usage

### 2026-04-10

- Improved agentic loop error handling

### 2026-04-07

- Added 503 retry/backoff handling
- Fixed additional tool-dispatcher issues
- Updated source-code modification guidance in system prompt docs

### 2026-04-06 to 2026-04-04

- Large TypeScript cleanup pass
- Storage and schema fixes
- Chat message date formatting fix
- Added cast/camera tools and related services
- Improved voice-tag stripping and related frontend behavior

## Documentation corrections made in this update

- Reframed Meowstik as a **local-first runtime**
- Clarified that old **server/client/desktop agent** terminology is legacy or optional relay language
- Replaced stale **Browserbase** documentation with the current **MCP** story
- Updated MCP docs to match the shipped settings UI and supported transports
