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
