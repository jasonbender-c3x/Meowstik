# Meowstik Copilot Instructions

- Treat `~/.copilot/mcp-config.json` as the canonical local MCP inventory.
- Run `node scripts/sync-shared-ai-configs.mjs` after MCP changes so Copilot CLI, VS Code, and Codespaces all see the same servers.
- Keep secrets in user-level config or environment variables; the workspace `.vscode/mcp.json` should stay safe to share.
- Shared specialist agents live in `.github/agents/`.
- Use the `claude-code-engineer` agent for reverse engineering the local Claude Code source tree.
