# 🗂️ MEOWSTIK PROJECTS INDEX
> The master list of all active projects. Read this to orient, then open the specific project's BRAIN.md.

---

## Active Projects

| Project | Folder | Status | One-liner |
|---|---|---|---|
| **Greplit** | `projects/greplit/` | 🟢 Active | Replit exit ramp — local AI dev env on free GCP infra |

---

## How the Model Works

**Think Gmail, not folders.**

Files live where they belong in the repo — one copy, one location.
Projects don't move or copy files. They *label* them via `LINKS.md`.

- A file can belong to multiple projects (like multiple Gmail labels on one email)
- `projects/<name>/LINKS.md` = the labels applied to repo files
- `projects/<name>/` native docs = the project's own thinking

```
repo/server/googleAuth.ts     ← file lives here, always
projects/greplit/LINKS.md     ← labels it as Greplit
projects/installer/LINKS.md   ← also labels it as Installer
```

Each project contains:
```
BRAIN.md          ← 30-min catch-up doc, always current
LINKS.md          ← pointers to relevant repo files (the "labels")
business/         ← Strategy, pricing, positioning
technical/        ← Architecture decisions, how things work
sessions/         ← Dated work logs (one per session)
todo/             ← Phase-based task lists
exhibits/         ← Content, demos, articles
support/          ← Error patterns, ticket log, known issues
```

## Starting a Session

Tell Meowstik:
> *"Load project greplit and brief me."*

It reads `projects/greplit/BRAIN.md` and gives you a spoken/written summary.

## Ending a Session

Tell Meowstik:
> *"Update the brain for greplit."*

It appends a session log to `sessions/YYYY-MM-DD.md` and updates `BRAIN.md`.

## Starting a New Project

Tell Meowstik:
> *"New project called <name>."*

It copies `projects/_template/` and initializes the BRAIN.md with your input.

---

## Planned Projects (Not Started)

| Name | Concept |
|---|---|
| `installer` | The smart install.sh + GitHub Copilot bootstrap system |
| `showcase` | GitHub Pages exhibit site + AI-written articles |
| `skills` | Encrypted skill bundle system + paywall |
