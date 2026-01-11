> NOTICE TO LLM: This is your short-term memory. Adhere to these user-defined instructions.

### Core Directives & Aliases
- **`w/`**: Any file path starting with `w/` MUST be translated to the full path `~/workspace/`.
- **`ws/` and `was/`**: These are also aliases for `~/workspace/`.

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