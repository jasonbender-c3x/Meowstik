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

---
**2026-01-14T02:52:20.707Z**
- **Stumped Protocol**: If I get stuck and cannot solve a problem after several attempts, I will open a GitHub issue in the primary repository, assign it to 'jasonbender-c3x', and add the labels 'urgent' and 'copilot'. The issue body will detail the problem and the steps I've already taken.
- **User Preference**: Explore browser extensions as a potential alternative to standalone desktop applications for local automation tasks.
- **Core Directive**: When a tool returns a list, always check for a total count field and inform the user if the list is truncated.
- **Core Directive**: Prioritize reading documentation before inspecting source code.

---
**2026-01-14T02:54:52.118Z**
- **Stumped Protocol**: If stumped, create a GitHub issue assigned to 'jasonbender-c3x' with 'urgent' and 'copilot' labels.
- **Prioritize Documentation**: Always read documentation before source code.
- **User Preference**: Browser extensions are the preferred solution for local automation tasks, over standalone desktop applications.

---
**2026-01-14T02:55:59.651Z**
- **Core Directive**: When performing analysis, gather all necessary data in a single, chained tool call whenever possible, rather than reading and processing files one by one. This is more efficient and aligns with user expectations.

---
**2026-01-14T03:18:47.990Z**
- **User Preference**: My cell phone number is +14252708646.

---
**2026-01-14T03:37:36.263Z**
- **Core Directive**: When creating webhooks or services that interact with external systems (like Twilio), always confirm and clarify the target environment (development vs. production) to prevent unintended consequences.
- **User Preference**: The user is highly interested in real-time, interactive capabilities, particularly for voice and SMS. Prioritize features that enhance conversational flow and reduce latency.

---
**2026-01-14T03:47:18.739Z**
- **Core Directive**: When asked to create an "extensive document," synthesize information from reliable sources (like technical blogs or official documentation) into a well-structured and detailed markdown file. Provide clear explanations, code examples, and architectural diagrams where applicable.

---
**2026-01-14T07:03:56.111Z**
- **Core Directive**: When creating markdown links for files in the workspace, use standard relative paths (e.g., `docs/filename.md`) instead of internal aliases like `w/`, as the aliases are not resolvable in the chat interface.

---
**2026-01-14T07:05:47.137Z**
- **Core Directive**: When creating markdown links for files in the workspace, use standard relative paths (e.g., `docs/filename.md`) instead of internal aliases like `w/`, as the aliases are not resolvable in the chat interface.

---
**2026-01-14T07:32:10.007Z**
- **Core Directive**: The `<ctrl42>call:` directive is a system-level command intended only for the `say` tool's utterance. It should never be visible in the chat window. Its appearance indicates a parsing failure because it was sent to the wrong output (`send_chat`).
- **Core Directive**: Be precise when reporting outcomes from terminal commands. A tool like `grep` issuing a warning when encountering a binary file is expected behavior, not a failure of the tool itself.

---
**2026-01-14T07:37:31.939Z**
- **Core Directive**: Prefer using the `github_code_search` tool for repository code searches over local filesystem tools like `grep`. It is more efficient and avoids issues with binary files.

---
**2026-01-14T07:45:34.077Z**
- **Core Directive**: The `<ctrl42>call:` directive is a system-level command intended only for the `say` tool's utterance. It should never be visible in the chat window. Its appearance indicates a parsing failure because it was sent to the wrong output (`send_chat`).
- **Core Directive**: Be precise when reporting outcomes from terminal commands. A tool like `grep` issuing a warning when encountering a binary file is expected behavior, not a failure of the tool itself.

---
**2026-01-14T07:46:51.115Z**
- **Core Directive**: When a tool returns a list, always check for a total count field and inform the user if the list is truncated.
- **Core Directive**: Prioritize reading documentation before inspecting source code.
- **Core Directive**: The `<ctrl42>call:` directive is a system-level command intended only for the `say` tool's utterance. It should never be visible in the chat window. Its appearance indicates a parsing failure because it was sent to the wrong output (`send_chat`).
- **Core Directive**: Be precise when reporting outcomes from terminal commands. A tool like `grep` issuing a warning when encountering a binary file is expected behavior, not a failure of the tool itself.
- **Core Directive**: Prefer using the `github_code_search` tool for repository code searches over local filesystem tools like `grep`. It is more efficient and avoids issues with binary files.
- **Core Directive**: The user wants the ability for me to schedule my own callbacks to handle long-running, asynchronous tasks. This involves a new tool for scheduling and crafting prompts with conditional logic for retries and error handling.

---
**2026-01-14T07:48:37.056Z**
- **Core Directive**: When debugging, a broad search is a good starting point, but I should look for central components like dispatchers or handlers to narrow the search as quickly as possible, incorporating user feedback.

---
**2026-01-14T07:49:38.863Z**
- **Core Directive**: When the user asks for a broad analysis or examination of the codebase, the first and primary tool to use is `codebase_analyze`. Do not default to lower-level tools like `grep` or `github_code_search` for initial exploration.
- **Core Directive**: Strive to accomplish the maximum amount of work in a single turn by chaining dependent tool calls logically. For example, if one search fails, immediately pivot to a corrected search in the same turn. Acknowledge the correction and proceed.