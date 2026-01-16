# AutoDoc Workflow Operational Instructions

**Status:** Active  
**Purpose:** Clear operational guide for the GitHub Copilot-based AutoDoc workflow  
**Last Updated:** January 16, 2026

---

## Overview

The AutoDoc workflow is a three-phase automated documentation generation system that integrates GitHub Copilot with the Meowstik documentation pipeline. This guide provides step-by-step instructions for triggering, monitoring, and managing the workflow.

## Quick Start

### Prerequisites
- GitHub repository with GitHub Copilot enabled
- `GEMINI_API_KEY` configured in repository secrets
- Access to `docs/copilot/` and `docs/proposals/` directories

### Trigger the Workflow

**Option 1: Automatic (Recommended)**
```bash
# Workflow triggers automatically on:
# - Push to main branch with changes in server/, client/, shared/, docs/
# - Pull request creation targeting main branch
git push origin main
```

**Option 2: Manual Trigger**
```bash
# Via GitHub Actions UI:
# 1. Go to Actions tab
# 2. Select "AutoDoc Complete Pipeline"
# 3. Click "Run workflow"
# 4. Choose phase: all | understand | assess | publish
```

---

## Three-Phase Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PHASE 1   │────▶│   PHASE 2   │────▶│   PHASE 3   │
│ UNDERSTAND  │     │   ASSESS    │     │   PUBLISH   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                     │
      ▼                   ▼                     ▼
  Code Maps          Error Report         Multi-Audience
  Cliff Notes        Gap Analysis         SPA Exhibits
  Rosetta Stone      Debt Score           (Dev/Academic/Customer)
```

---

## Phase 1: Understanding Phase

### What It Does
Analyzes the codebase and generates foundational understanding artifacts.

### Outputs
- **Code Map** (`docs/copilot/generated/code-map.json`)
  - Dependency graph of all modules, classes, and functions
  - Complexity metrics and LOC statistics
  - Import/export relationships

- **Cliff Notes** (`docs/copilot/generated/cliff-notes.md`)
  - High-level system overview
  - Key architectural decisions
  - Entry points and critical paths

- **Rosetta Stone** (`docs/copilot/generated/rosetta-stone.md`)
  - Terminology dictionary
  - Cross-reference of concepts across files
  - API surface mappings

### How to Trigger
```bash
# Automatic: On any code change
git add server/services/new-feature.ts
git commit -m "feat: Add new service"
git push origin main

# Manual: Via workflow dispatch
gh workflow run autodoc-full.yml -f phase=understand
```

### Where to Find Results
```
docs/copilot/generated/
├── code-map.json          # Dependency graph
├── cliff-notes.md         # System overview
└── rosetta-stone.md       # Terminology guide
```

---

## Phase 2: Assessment Phase

### What It Does
Reviews Phase 1 artifacts to identify documentation gaps, errors, and improvement areas.

### Outputs
- **Error Report** (`docs/copilot/intake/error-report.md`)
  - Documentation inconsistencies
  - Missing API documentation
  - Broken internal links

- **Gap Analysis** (`docs/copilot/intake/gap-analysis.md`)
  - Under-documented modules
  - Missing architecture diagrams
  - Incomplete code examples

- **Technical Debt Score** (`docs/copilot/intake/debt-score.json`)
  - Quantified documentation coverage
  - Priority areas for improvement

### Copilot Integration

After Phase 2 completes, the workflow **automatically tags @copilot** with a comment:

```markdown
@copilot Please review the documentation assessment findings.

## High Priority Issues
- Missing API documentation for 12 endpoints
- 5 architecture diagrams needed
- 23 broken internal links

Full report: docs/copilot/intake/error-report.md
```

### How to Respond
1. **Review the assessment** in the PR created by the workflow
2. **Approve improvements** by commenting on specific findings
3. **Copilot implements** the approved changes automatically
4. **Merge the PR** once review is complete

---

## Phase 3: Publishing Phase

### What It Does
Generates multi-audience documentation and publishes to GitHub Pages.

### Outputs

#### Developer Documentation
- **Format:** MDX with interactive code blocks
- **Content:** API reference, architecture guides, contribution docs
- **Location:** `docs/copilot/exhibits/developer/`

#### Academic Documentation
- **Format:** LaTeX-style markdown
- **Content:** Research papers, technical whitepapers, algorithm analysis
- **Location:** `docs/copilot/exhibits/academic/`

#### Customer Documentation
- **Format:** Interactive SPA demos
- **Content:** Feature showcases, tutorials, getting started guides
- **Location:** `docs/copilot/exhibits/customer/`

### SPA Exhibit Features
- Interactive code playgrounds
- Live API demonstrations
- Copy-to-clipboard functionality
- Full-text search
- Responsive design

### Publishing Target
```
https://<username>.github.io/<repo>/docs-portal/
```

---

## Directory Structure

```
docs/
├── copilot/
│   ├── index.md                      # This hub (mission & usage)
│   ├── recommended-moves.md          # Document relocation inventory
│   ├── AUTODOC_INSTRUCTIONS.md       # This file
│   ├── workflows/
│   │   └── autodoc.md                # Workflow specification
│   ├── intake/                       # Phase 2 triage notes
│   │   ├── error-report.md
│   │   ├── gap-analysis.md
│   │   └── debt-score.json
│   ├── drafts/                       # Work-in-progress documents
│   ├── exhibits/                     # Phase 3 published artifacts
│   │   ├── developer/
│   │   ├── academic/
│   │   └── customer/
│   └── generated/                    # Phase 1 auto-generated content
│       ├── code-map.json
│       ├── cliff-notes.md
│       └── rosetta-stone.md
└── proposals/
    └── PROPOSAL-002-github-autodoc-workflow.md  # Full technical proposal
```

---

## Copilot Integration Points

### 1. Evolution Engine Orchestration

When the Evolution Engine creates a PR (either from feedback analysis or message scanning), it **automatically adds a comment** tagging @copilot:

```typescript
// server/services/evolution-engine.ts
await github.addCommentWithAgent(
  targetRepo.owner,
  targetRepo.repo,
  pr.number,
  `@copilot Please review these evolution suggestions...`,
  agent
);
```

### 2. AutoDoc Phase 2 Completion

After assessment phase completes, the workflow triggers Copilot to implement improvements.

### 3. Manual Invocation

Tag @copilot in any PR or issue to request:
- Code review
- Documentation generation
- Bug fixes
- Feature implementations

---

## Monitoring & Debugging

### Check Workflow Status
```bash
# List recent workflow runs
gh run list --workflow=autodoc-full.yml

# View specific run logs
gh run view <run-id>

# Watch live
gh run watch <run-id>
```

### Common Issues

#### Issue: "GEMINI_API_KEY not found"
**Solution:** Add API key to repository secrets
```bash
gh secret set GEMINI_API_KEY < api_key.txt
```

#### Issue: "Phase 1 artifacts not found"
**Solution:** Ensure Phase 1 completed successfully before running Phase 2
```bash
# Check Phase 1 status
gh run list --workflow=autodoc-full.yml --json conclusion,name

# Re-run Phase 1 only
gh workflow run autodoc-full.yml -f phase=understand
```

#### Issue: "GitHub Pages not updating"
**Solution:** Verify GitHub Pages is enabled and configured to deploy from `gh-pages` branch
```bash
# Check Pages status
gh api repos/:owner/:repo/pages
```

---

## Best Practices

### 1. Incremental Documentation
- Run AutoDoc on feature branches to catch documentation gaps early
- Review generated artifacts before merging to main

### 2. Custom Prompts
Modify AI prompts in `prompts/` directory to customize output:
- `prompts/autodoc-understand.md` - Phase 1 analysis prompts
- `prompts/autodoc-assess.md` - Phase 2 review prompts
- `prompts/autodoc-publish.md` - Phase 3 generation prompts

### 3. Manual Overrides
Place manually-written documentation in `docs/copilot/drafts/` to prevent overwriting:
```markdown
<!-- docs/copilot/drafts/custom-guide.md -->
<!--
  AUTODOC: SKIP
  Reason: Manually curated content
-->
```

### 4. Copilot Feedback Loop
- Review Copilot's implementations
- Provide feedback in PR comments
- Iteratively refine until satisfactory

---

## Evolution Engine Integration

The Evolution Engine works in tandem with AutoDoc:

1. **User Feedback Collection**
   - Feedback is stored in the database via the feedback system
   - Negative feedback and complaints are automatically analyzed

2. **PR Creation with Auto-Tagging**
   - Evolution Engine creates a PR with improvement suggestions
   - **Automatically tags @copilot** to trigger implementation
   - Includes detailed analysis and priority levels

3. **Implementation Phase**
   - Copilot reviews the suggestions
   - Implements approved improvements
   - Updates documentation if needed

4. **Continuous Improvement**
   - Merged improvements feed back into the knowledge base
   - AutoDoc regenerates documentation with new changes

---

## Support & References

### Documentation
- [Full AutoDoc Proposal](../proposals/PROPOSAL-002-github-autodoc-workflow.md)
- [Copilot Hub](./index.md)
- [Evolution Engine Guide](../../server/services/evolution-engine.ts)

### GitHub Actions
- Workflow file: `.github/workflows/autodoc-full.yml`
- Workflow logs: GitHub Actions tab in repository

### Contact
- Create an issue with label `documentation` for workflow problems
- Tag @copilot in any PR for documentation assistance

---

**Next Steps:**
1. Ensure all prerequisites are met
2. Push a code change to trigger the workflow
3. Monitor Phase 1 completion
4. Review Phase 2 assessment
5. Approve Copilot's improvements
6. Merge and celebrate automated documentation! 🎉
