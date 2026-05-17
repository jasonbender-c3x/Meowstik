# Project Greplit — Detailed Brief

## Executive summary

Greplit is a **local-first, browser-based software workspace** that delivers a Replit-like workflow without requiring Greplit to resell compute, storage, or model tokens at marked-up rates.

The core thesis is:

- the user brings their own **GitHub account**
- the user brings their own **GitHub Copilot access**
- the user brings their own **Google account / Google Workspace / Google Cloud**
- Greplit supplies the **workspace shell, orchestration layer, workflow UX, snapshots, logs, agent controls, and integrations**

In the strongest form, Greplit becomes:

- **Replit economics without Replit markup**
- **local-first developer experience without cloud lock-in**
- **Git-native rollback, auditability, and branch safety**
- **optional cloud burst / Codespaces mode when local is not enough**

The initial wedge is not "we trained a better model." The wedge is:

**your machine, your cloud, your GitHub, your models, your billing, your history**

---

## Product thesis

### Problem

Existing browser IDE / coding-agent platforms frequently bundle:

- infrastructure
- storage
- previews
- coding assistance
- secrets
- logging
- deployment

That convenience is valuable, but it also creates:

- compute markups
- token markups
- opaque billing
- platform lock-in
- weaker ownership boundaries for code, state, and logs

### Greplit answer

Greplit unbundles the costs while preserving the convenience layer.

The platform does **not** need to be the source of truth for:

- code hosting
- model access
- compute
- cloud storage
- identity

Instead, Greplit becomes the **control plane and workflow layer**.

### Primary promise

> A Replit-like workflow that runs primarily on hardware and accounts the user already owns.

---

## Product principles

1. **Local-first**
   - A modest Linux box should be a first-class deployment target.
   - Cloud is optional acceleration, not the default dependency.

2. **Bring your own billing**
   - Users pay GitHub and Google directly.
   - Greplit charges for orchestration, UX, workflow, and convenience.

3. **Git-native**
   - Every meaningful code change should be inspectable, revertible, branchable, and attributable.

4. **Agent-visible execution**
   - Logs, tool output, and execution traces are first-class.
   - The system should learn from what actually happened.

5. **Model-flexible**
   - Start with Copilot and Google-aligned workflows.
   - Keep the abstraction open for future multi-provider routing.

6. **User-owned state**
   - User secrets, history, and snapshots should remain under the user's control.

---

## Target users

### Primary

- indie developers
- power users frustrated with cloud IDE pricing
- builders comfortable with GitHub and Google accounts
- users who want a coding agent without surrendering infra ownership

### Secondary

- technical founders
- small remote teams
- "vibe coders" who want strong workflow scaffolding
- advanced hobbyists running older local hardware

### Early adopter profile

A likely ideal early user:

- already pays for GitHub Copilot
- already has or is willing to get Google Workspace
- wants local ownership and simple rollback
- values logs, branch safety, and transparent billing

---

## Core feature set

## 1. Workspace page

The main browser workspace should contain:

- file tree
- editor panes
- terminal
- preview panel
- branch indicator
- commit/checkpoint controls
- task runner status

Key requirements:

- works against a local daemon by default
- can optionally target a remote workspace provider
- handles long-running tasks cleanly
- preserves state across browser refreshes

---

## 2. Agent page / agent pane

The coding agent is the product's leverage point.

Initial backend:

- GitHub Copilot via the Copilot SDK

Capabilities:

- model selection
- task-based coding prompts
- approval boundaries
- execution logs
- file-diff awareness
- branch-aware changes
- rollback suggestions

Design goals:

- show the user what the agent did
- keep prompts, actions, and outputs inspectable
- avoid black-box "magic"

---

## 3. Secrets management page

Users need a clean UI for:

- environment variables
- project secrets
- provider tokens
- deployment secrets
- local vs remote scope

Requirements:

- clear scoping rules
- easy rotation
- masking in UI
- safe injection into tasks and previews
- audit visibility without leaking values

Important note:

Putting snapshots on Drive is helpful for ownership and backup, but **security is not automatic**. Greplit still needs:

- encrypted local storage where appropriate
- strict scope boundaries
- careful OAuth permissions
- masking/redaction in logs

---

## 4. Logs and debug page

This should be one of the differentiators.

Types of logs:

- agent prompts and actions
- tool invocations
- build logs
- terminal output
- preview/runtime errors
- deployment logs
- workspace lifecycle events

This page should support:

- filtering
- replay
- diff-aware correlation
- error highlighting
- exporting for support/debugging

Strategic value:

Execution visibility makes the system feel safer, more trustworthy, and more debuggable than opaque agent products.

---

## 5. Git and rollback page

Greplit should enforce a Git-based workflow rather than treating version control as optional.

Capabilities:

- lightweight checkpoints
- named snapshots
- automatic branch creation for risky changes
- safe restore flows
- visual diff browser
- deployment branch separation

Design principle:

- source rollback belongs to Git
- environment/workspace rollback belongs to snapshots

Both should exist and be clearly distinct.

---

## 6. Snapshot and backup page

Snapshots should capture more than code when useful:

- working tree state
- session metadata
- logs/artifacts
- selected workspace config
- optional dependency/install state references

Storage approach:

- local snapshots first
- export/archive to Google Drive
- optionally sync metadata to a lightweight Greplit control record

Drive use cases:

- backup
- export
- migration
- restore packages
- sharable recovery bundles

---

## 7. Integrations page

Initial integrations:

- GitHub
- GitHub Copilot
- Google account
- Google Drive
- Google Cloud
- Google Workspace surfaces over MCP

Later integrations:

- deployment targets
- Supabase
- Cloudflare
- Vercel/Netlify equivalents
- multi-model gateways

---

## 8. Account / billing page

Even with BYO billing, Greplit needs a clean commercial surface.

What users should see:

- what Greplit charges for
- what GitHub charges for
- what Google charges for
- what remains inside free tiers
- what features require paid upstream subscriptions

This clarity becomes a marketing advantage.

---

## Architecture proposal

## Local-first baseline architecture

### Components

1. **Local workspace daemon**
   - runs on the user's machine
   - manages repo, terminal sessions, previews, logs, snapshots, and local state

2. **Browser UI**
   - connects to the daemon
   - renders editor/workspace/agent/logs/secrets

3. **Agent orchestration layer**
   - mediates between UI, Copilot SDK, tools, Git state, and logs

4. **Git integration layer**
   - branch creation
   - diffs
   - rollback helpers
   - checkpoint tagging

5. **Storage/backups layer**
   - local state
   - Drive export/import
   - optional metadata sync

### Why local-first matters

- low hosting cost
- high user trust
- good performance on modest hardware
- no need to out-scale Replit in cloud costs
- better ownership narrative

---

## Remote / cloud architecture

Remote should be optional, not required.

Possible remote providers:

- GitHub Codespaces
- GCP VM / container
- user-managed Linux box
- future provider abstraction

Use cloud mode for:

- heavier builds
- always-on previews
- team workflows
- mobile access
- deployment staging

Greplit should treat remote workspaces as one backend class, not the identity of the whole product.

---

## Copilot SDK role

Copilot is the initial agent engine, not the whole product.

Copilot provides:

- model-backed coding help
- model selection
- GitHub adjacency
- developer familiarity

Greplit adds:

- local-first runtime
- execution trace visibility
- Git-native rollback UX
- secrets/logs/snapshot control
- Google integration layer
- project memory and workflow structure

This distinction is critical. Otherwise Greplit becomes just a thin wrapper.

---

## Google stack role

Google is the first ecosystem anchor, not just a random provider.

Reasons to standardize on Google early:

- Drive for export/snapshot ownership
- Google Workspace for Docs/Sheets/Gmail/Calendar integrations
- Gemini / NotebookLM adjacency
- Google Cloud for burst or hosted deployment
- strong identity and storage layer

Recommended product assumption:

Require or strongly encourage a Google account early.

Possible premium positioning:

Google Workspace becomes the "power user bundle":

- more storage
- better backup behavior
- document integrations
- Gemini access
- long-lived workspace artifacts

---

## Multi-model strategy

Do not delay MVP with an overly general "any model" layer.

Instead:

### Phase 1
- Copilot SDK
- model selection exposed where supported

### Phase 2
- add provider abstraction
- begin routing non-coding or auxiliary tasks to other providers

### Phase 3
- user chooses between:
  - Copilot-backed coding
  - Google-backed assistant modes
  - third-party model gateway
  - local models for privacy/permissiveness/offline use

The architecture should be abstracted, but the product should launch with one clean path.

---

## Business model

## Revenue thesis

Greplit should **not** try to profit mainly from compute resale.

That is exactly the trap it is trying to escape.

Instead charge for:

- orchestration
- workflow UX
- local/remote workspace management
- logs and replay
- snapshots/backups
- integrations
- team collaboration features
- managed policies and presets

### Good pricing story

Users pay:

- GitHub for Copilot / GitHub services
- Google for cloud/storage/workspace where needed
- Greplit for the workflow shell and orchestration

That framing is legible and believable.

### Initial monetization options

- low monthly subscription
- annual discounted plan
- tiny team plan
- optional paid setup/support tier
- open-core-ish distribution with managed convenience layer

If using GitHub Sponsors as a bootstrap revenue rail, treat it as early monetization, not the final billing system.

---

## Website / go-to-market strategy

The website should function as a **proof artifact**.

### Core message

> Replit-style workflow. Local-first. Your GitHub. Your Google. Your billing.

### Marketing tactic

Build the website with Greplit and show:

- screen-captured development sessions
- branch and rollback demos
- agent logs
- snapshots/restores
- local-first setup on modest hardware

This converts the website into a product demonstration.

### Best proof points

- "built with Greplit"
- "runs on modest hardware"
- "no marked-up tokens"
- "full Git rollback"
- "export your state"

---

## Risks and constraints

## 1. Platform / licensing risk

This is the biggest strategic risk.

If Greplit depends too heavily on GitHub Copilot in a way GitHub later restricts, the product becomes fragile.

Mitigation:

- verify SDK and service terms carefully
- keep agent backend abstraction clean
- design for pluggable providers later

## 2. Thin-wrapper risk

If Greplit is only:

- browser editor
- Copilot pane
- a few prompts

then it is easy to copy.

Mitigation:

- invest in logs, Git rollback, secrets, snapshot UX, integrations, local-first runtime

## 3. Complexity creep

The temptation will be to become:

- Replit
- Codespaces
- Cursor
- n8n
- IDE
- deployment platform
- companion agent

all at once.

Mitigation:

- start with one crisp user story:
  - "local-first coding workspace with Copilot, Git rollback, and Google-backed snapshot/export"

## 4. Security model confusion

Drive export is not enough.

Mitigation:

- explicit threat model
- scoped tokens
- secrets separation
- redaction in logs
- local encryption where appropriate

---

## Proposed implementation roadmap

## Phase 0 — validation and architecture notes

Deliverables:

- confirm Copilot SDK and product-shape assumptions
- define local daemon architecture
- define state model: repo, workspace, snapshot, task, log, secret
- choose frontend shell
- define Google auth/storage scopes

Success criteria:

- confidence that the product is legally and technically viable

---

## Phase 1 — local MVP

Goal:

Ship a local-first workspace that proves the basic thesis.

Scope:

- local daemon
- browser workspace UI
- open repo / clone repo
- editor + terminal + preview
- Copilot-powered task pane
- Git commit/checkpoint support
- build/runtime logs

Success criteria:

- a user can clone a repo, ask the agent to modify it, run it, inspect logs, and revert safely

---

## Phase 2 — secrets, snapshots, and Google integration

Scope:

- secrets page
- local snapshot system
- Drive export/import
- Google sign-in
- basic workspace metadata backup

Success criteria:

- user can safely manage project credentials
- user can restore from backup/export

---

## Phase 3 — stronger Git workflow and release safety

Scope:

- automatic branch creation for risky changes
- diff browser
- rollback UI
- branch-based staging vs deployment workflow
- restore points tied to Git checkpoints

Success criteria:

- user feels protected against bad agent edits

---

## Phase 4 — optional remote workspace mode

Scope:

- Codespaces integration or another remote backend
- provider abstraction
- remote preview URLs
- remote log aggregation

Success criteria:

- same product feel locally and remotely, with cloud only when needed

---

## Phase 5 — workspace integrations and team polish

Scope:

- richer Google Workspace integrations through MCP
- shareable logs/snapshots
- collaboration
- team settings/policies
- admin and audit features

Success criteria:

- product is credible for small technical teams, not just solo users

---

## Phase 6 — multi-model and advanced orchestration

Scope:

- provider abstraction beyond Copilot
- selective task routing
- model presets
- local/private model options
- advanced workflow automation

Success criteria:

- Greplit becomes a general bring-your-own-agent workspace, not just a Copilot wrapper

---

## Recommended MVP boundary

If discipline is kept, the MVP should include only:

- local daemon
- browser workspace
- repo import
- terminal
- preview
- Copilot coding pane
- logs
- Git checkpoint/rollback
- basic secrets

Everything else is second wave.

---

## Positioning statement

Greplit is best positioned as:

**A local-first, Git-native, bring-your-own-billing coding workspace with an integrated coding agent.**

Not:

- "the next frontier model company"
- "an all-in-one AI everything platform"
- "just another editor wrapper"

---

## Why this could win

It meets several real desires at once:

- lower cost
- less lock-in
- stronger ownership
- better rollback
- better observability
- good enough local performance

If execution is strong, Greplit can become the product people reach for when they want **Replit convenience without surrendering control**.
