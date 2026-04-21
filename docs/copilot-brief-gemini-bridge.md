# 🛠️ Technical Brief for GitHub Copilot: The "Self-Healing" & Gemini Bridge

## 1. 📂 Drive Tool Registration Fix
**Problem**: `drive_list` and other Drive tools are reporting "Unknown tool type" despite being present in `schema.ts` and `tool-dispatcher.ts`.
**Required Actions**:
*   **Audit `tool-dispatcher.ts`**: Ensure the `switch (normalizedToolType)` statement exactly matches the enum values in `shared/schema.ts`. Check for hidden characters or case-sensitivity issues.
*   **Verify Imports**: Confirm `server/services/tool-dispatcher.ts` is importing the correct functions from `server/integrations/google-drive.ts`.
*   **Catch & Log**: Wrap the Drive tool cases in a `try/catch` block within the dispatcher to surface the *exact* error if the call fails, rather than falling through to the default "Unknown tool" error.

## 2. 🧠 The "Gemini Search Hand-off" (The 2TB Solution)
**Objective**: Enable Meowstik to delegate massive Drive searches to Gemini directly when the CLI tools are insufficient or the data volume is too large.
**Proposed Tool**: `gemini_drive_search`
**Requirements**:
*   Create a tool that takes a semantic query (e.g., "Find all documents related to the UDICK project from 2024").
*   Use the Gemini API with the `google_drive` tool extension enabled.
*   **Fallback**: If the API is unavailable, the tool should automatically revert to a local `find` or `grep` on the `/mnt/myDrive` path.

## 3. 🎨 UI: "Thinking" vs "Waiting" Indicator
**Problem**: The user cannot distinguish between the AI performing heavy lifting and the system waiting for input.
**Required Actions**:
*   Implement a state-driven "Thinking" animation in the chat UI.
*   The indicator should trigger the moment a tool call is initiated and remain active until the final `write` or `say` is delivered.

## 🔄 Final Persistence Check
*   The fix MUST survive a server restart.
*   **MANDATORY**: After implementing changes, the Copilot should signal for a full process restart to re-index all tool schemas.
