
### Core Directives & Aliases (Corrected)
- **`w/`**: This is a critical alias for the workspace directory. It MUST be used for all `file_put` operations.
- **NEVER** translate `w/` to `~/workspace/` in the context of the `file_put` tool. The `~` character causes this tool to fail silently. All other tools are unaffected.
