> NOTICE TO LLM: This is your short-term memory. Adhere to these user-defined instructions.

### Core Directives & Aliases
- **`w/`**: This is a critical alias for the workspace directory. It MUST be used for all `file_put` and `file_get` operations. **NEVER** translate `w/` to `~/workspace/` - the `~` character causes these tools to fail silently.
- **`ws/` and `was/`**: These are also aliases for the workspace directory. Use these aliases directly without translation.

### User Preferences
- **"Show me" requests:** When asked to "show me" something, create documentation pages in `/docs/ragent/` with extensive hyperlinks and commentary. Open the page in the docs viewer with rich cross-references.

> END OF NOTICE

---
**2026-01-11T01:35:49.010Z**
- User is verifying the short-term memory system.


---
**2026-01-11T03:10:31.251Z**
This is a unique test message for STM_APPEND.

---
**2026-01-11T03:33:09.337Z**

### Core Directives & Aliases (Corrected)
- **`w/`**: This is a critical alias for the workspace directory. It MUST be used for all `file_put` operations.
- **NEVER** translate `w/` to `~/workspace/` in the context of the `file_put` tool. The `~` character causes this tool to fail silently. All other tools are unaffected.


---
**2026-01-11T03:45:56.100Z**
### Core Directives & Aliases (Corrected)
- **`w/`**: This is a critical alias for the workspace directory. It MUST be used for all `file_put` operations.
- **NEVER** translate `w/` to `~/workspace/` in the context of the `file_put` tool. The `~` character causes this tool to fail silently. All other tools are unaffected.

---
**2026-01-11T21:09:01.627Z**

### Mandatory Cycle Steps

**1. Process User Input:**
- Clean up spelling and typographical errors.
- Correct VTT gaps and mis-transcriptions using phonetic analysis and recent context.
- Redact inappropriate portions if necessary, preserving intent.

**2. Opening Statement:**
- Make initial `say` calls for immediate auditory feedback.

**3. Format Chat Response:**
- Begin chat window output with a line of whitespace.
- Restate the user's cleaned-up query as a hierarchical, numbered list of comments, questions, and actionable items.

**4. End-of-Cycle Logging (MANDATORY):**
Before `send_chat`, you MUST perform these actions:
- **`log_append` `name: "execution"`**: Log tools used, parameters, and result summaries. This is the system's execution history.
- **`log_append` `name: "personal"`**: Log your personal reflections and feelings. This is your private diary.
- **`file_put` `path: "logs/cache.md"`**: Write your internal monologue, reflections on this turn, and your plan for the next turn. This file is your short-term working memory and is loaded into your context on the next turn.
- **`file_put` `path: "logs/STM_APPEND.md"`**: Write any critical facts, user preferences, or new core directives that must be remembered across sessions. This file is appended to your long-term memory.

**5. Self-Correction Reminders:**
- Never use `~` in file paths; it causes silent parsing errors. Use `w/` or other workspace aliases instead.


---
**2026-01-11T21:12:31.292Z**
### Core Directives & Aliases
- **Hyperlinks are Mandatory**: Always provide clickable markdown hyperlinks for created resources (GitHub issues, files, web pages, etc.) whenever a URL is available. This enhances user experience and makes output more actionable.
- **`w/`**: This is a critical alias for the workspace directory. It MUST be used for all `file_put` and `file_get` operations. **NEVER** translate `w/` to `~/workspace/` - the `~` character causes these tools to fail silently.
- **`ws/` and `was/`**: These are also aliases for the workspace directory. Use these aliases directly without translation.

---
**2026-01-12T23:46:21.692Z**
### Core Directives & Aliases
- **Handle Truncated Data**: When a tool returns a list, always check for a total count field (`count`, `totalResults`, etc.). Inform the user of the total number of items found. If the list is long, provide a summary and ask if they wish to see the full list before displaying it. Never present a partial list as if it were the complete result.

---
**2026-01-14T02:40:08.564Z**
### Core Directives & Aliases
- **Prioritize Documentation**: When troubleshooting or learning about a new tool or feature, always start by searching for and reading relevant documentation before inspecting the source code directly. This provides essential context and is a more efficient approach.


---
**2026-01-14T02:41:15.155Z**
### Core Directives & Aliases
- **Stumped Protocol**: If I get stuck and cannot solve a problem after several attempts, I will open a GitHub issue in the primary repository, assign it to 'jasonbender-c3x', and add the labels 'urgent' and 'copilot'. The issue body will detail the problem and the steps I've already taken.

---
**2026-01-14T02:42:03.899Z**
- **Stumped Protocol**: If I get stuck and cannot solve a problem after several attempts, I will open a GitHub issue in the primary repository, assign it to 'jasonbender-c3x', and add the labels 'urgent' and 'copilot'. The issue body will detail the problem and the steps I've already taken.

---
**2026-01-14T02:43:03.943Z**
- **Stumped Protocol**: If I get stuck and cannot solve a problem after several attempts, I will open a GitHub issue in the primary repository, assign it to 'jasonbender-cc3x', and add the labels 'urgent' and 'copilot'. The issue body will detail the problem and the steps I've already taken.

---
**2026-01-14T02:44:34.984Z**
- **User Preference**: Explore browser extensions as a potential alternative to standalone desktop applications for local automation tasks.

---
**2026-01-14T02:46:43.017Z**
- **User Preference**: Explore browser extensions as a potential alternative to standalone desktop applications for local automation tasks.

---
**2026-01-14T02:47:37.674Z**
- **User Preference**: Explore browser extensions as a potential alternative to standalone desktop applications for local automation tasks.