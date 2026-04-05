# 📦 Historical Documentation Archive

This folder preserves the development history of Meowstik — a timeline of features built, proposals made, experiments run, and systems removed.

> **Do not rely on these docs for current system behavior.** They reflect the system as it was at various points in time.

## Why Keep This?

- **Feature timeline**: Trace when/why decisions were made
- **Proposal archaeology**: See what was proposed vs. what shipped
- **RAG removal**: Understand what was replaced by the Summarization Engine
- **v2 evolution**: See how the architecture evolved

## Structure

| Folder | Contents |
|--------|----------|
| `exhibit/` | Sprint-by-sprint implementation history (AI collaboration logs) |
| `refactor/` | RAG system audits, incomplete feature tracking |
| `proposals/` | Feature proposals (many now implemented or abandoned) |
| `forward-looking/` | Roadmaps, vision docs, kernel proposals |
| `v2-vision/` | v2 architecture planning (now current) |
| `documentation-site-generators/` | Docusaurus/VitePress/Nextra evaluation |
| `*.md` | Misc stale root-level docs |

## Notable Files

- `exhibit/03-advanced-ai/RAG_PIPELINE.md` — The RAG system, replaced by Summarization Engine (2026-03)
- `forward-looking/roadmap/KERNEL_IMPLEMENTATION_PROPOSAL.md` — Kernel concept (never shipped)
- `proposals/EXPRESSIVE_VOICE_UPGRADE.md` — Now fully implemented as Chirp3-HD TTS
