# Copilot Documentation Hub

**Mission:** Automated generation, curation, and publishing of multi-audience documentation through AI-assisted workflows.

## Structure

```
docs/copilot/
├── index.md              # This file - mission & usage
├── recommended-moves.md  # Document relocation inventory
├── workflows/            # Workflow specifications
│   └── autodoc.md        # GitHub AutoDoc workflow spec
├── intake/               # Triage notes from analysis
├── drafts/               # Work-in-progress documents
├── exhibits/             # Published SPA-ready artifacts
└── generated/            # Auto-generated content
```

## Audiences

| Audience | Purpose | Format |
|----------|---------|--------|
| **Developer** | Ground truth architecture, API reference | MDX with code blocks |
| **Academic** | Research papers, technical whitepapers | LaTeX-style markdown |
| **Customer** | Demos, tutorials, feature showcases | Interactive SPA exhibits |

## Workflow Overview

1. **Intake** → Raw analysis, code maps, cliff notes
2. **Review** → Error detection, improvement suggestions
3. **Transform** → Multi-audience content generation
4. **Publish** → SPA exhibit compilation

## Quick Links

- [GitHub MCP Server Setup](./GITHUB_MCP_SETUP.md) - Configure GitHub Copilot to access GitHub MCP server
- [Recommended Document Moves](./recommended-moves.md)
- [AutoDoc Workflow Proposal](../proposals/PROPOSAL-002-github-autodoc-workflow.md)
- [State of the Art Report](../proposals/REPORT-001-codebase-understanding-automation.md)

## Copilot SDK Bridge

- **Purpose:** Allows the Meowstik LLM to prepare a report describing desired code fixes and hand that report to GitHub Copilot for tactical implementation without the LLM editing the repository directly.
- **How it works:** Structured responses can call the `copilot_send_report` tool, which writes a summary file to `docs/copilot/intake/`, then routes the request through `@github/copilot-sdk` to send a message to the Copilot CLI. Copilot can later run using the same workspace so that the report is visible in the terminal/logs.
- **Configuration:** Set `COPILOT_MODEL` (defaults to `gpt-5`), optionally point to an existing CLI via `COPILOT_CLI_URL`, override `COPILOT_CLI_PATH`, and provide `COPILOT_GITHUB_TOKEN` if you want to authenticate with a specific token. Use `COPILOT_LOG_LEVEL`/`COPILOT_USE_LOGGED_IN_USER` to tune logging and authentication mode.
- **Next steps:** After the LLM writes a report, run Copilot manually (e.g., `copilot chat` or `gh copilot` in the repo root) so the terminal stays visible to you. The generated report files contain the prompt that was sent and can be referenced again if you need to rerun Copilot later.
