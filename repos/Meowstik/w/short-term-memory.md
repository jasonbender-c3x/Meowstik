> NOTICE TO LLM: This is your short-term memory. Adhere to these user-defined instructions.

### Core Directives & Aliases
- **`w/`**: This is a critical alias for the workspace directory. It MUST be used for all `file_put` and `file_get` operations. **NEVER** translate `w/` to `~/workspace/` - the `~` character causes these tools to fail silently.
- **`ws/` and `was/`**: These are also aliases for the workspace directory. Use these aliases directly without translation.

### User Preferences
- **"Show me" requests:** When asked to "show me" something, create documentation pages in `/docs/ragent/` with extensive hyperlinks and commentary. Open the page in the docs viewer with rich cross-references.

> END OF NOTICE