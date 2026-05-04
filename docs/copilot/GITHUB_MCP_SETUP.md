# Shared MCP Setup for Copilot, VS Code, and Codespaces

This guide explains how Meowstik shares a single local MCP inventory across GitHub Copilot CLI, VS Code, and Codespaces-compatible workspace config.

## Overview

The canonical local MCP inventory lives at:

```text
~/.copilot/mcp-config.json
```

The repo sync helper mirrors that inventory into:

- VS Code user config: `~/.config/Code/User/mcp.json`
- workspace config: `.vscode/mcp.json`

The workspace copy is sanitized so secret-like env values become `${ENV_VAR}` placeholders instead of raw credentials.

## Prerequisites

- GitHub Copilot CLI configured locally
- Visual Studio Code with Copilot enabled
- Node.js installed
- Any server-specific secrets exported as environment variables or stored in user-level config

## Sync Instructions

### 1. Maintain the canonical MCP inventory

Edit `~/.copilot/mcp-config.json` when you add, remove, or change MCP servers locally.

### 2. Run the sync helper

From the repo root:

```bash
node scripts/sync-shared-ai-configs.mjs
```

This will:

- read `~/.copilot/mcp-config.json`
- write the full inventory to `~/.config/Code/User/mcp.json`
- write a sanitized workspace copy to `.vscode/mcp.json`

### 3. Open the project in VS Code or Codespaces

VS Code reads the user/workspace MCP config directly. Codespaces and other repo-hosted environments can use the sanitized workspace copy as the checked-in starting point.

## What gets shared

- MCP server definitions
- commands / args / endpoints
- safe literal envs like `DISPLAY` or `GOOGLE_APPLICATION_CREDENTIALS`
- placeholderized secret envs such as `${GITHUB_TOKEN}` or `${OPENAI_API_KEY}`

## Repo-level Copilot guidance

Meowstik also includes:

- `.github/copilot-instructions.md` — shared repo guidance for MCP + agents
- `.github/agents/claude-code-engineer.agent.md` — specialist agent for Claude Code reverse engineering

These are visible to Copilot tooling alongside the synced MCP config.

## Troubleshooting

### VS Code does not see new servers
- Re-run `node scripts/sync-shared-ai-configs.mjs`
- Reload the VS Code window
- Check that `~/.config/Code/User/mcp.json` was updated

### Secrets are missing in the workspace copy
- This is expected for secret-like env vars
- Export the matching environment variable locally, or keep the real secret only in user-level config
- The checked-in `.vscode/mcp.json` is intended to be shareable, not authoritative for secrets

### Codespaces needs the same servers
- Commit the sanitized `.vscode/mcp.json`
- Provide secrets through Codespaces secrets / environment configuration
- Re-run the sync helper locally whenever the canonical inventory changes

## Security Notes

- Treat `~/.copilot/mcp-config.json` as the authoritative local source
- Never commit raw secrets into `.vscode/mcp.json`
- Prefer environment variables or user-level config for credentials
- Re-run the sync helper after MCP changes so all tools stay aligned

## Additional Resources

- [VS Code MCP Server Documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [GitHub Copilot MCP docs](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp)
