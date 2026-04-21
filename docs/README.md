# Meowstik Documentation

> **AI Personal Assistant & Meta-Agent Platform**

Meowstik is a personal AI assistant built on Google Gemini. It's not just a chat app — it gives the AI real agency over your digital world: browsing the web, running shell commands, reading and sending email, controlling your desktop, making phone calls, and continuously improving itself through feedback.

---

## Documentation Index

| Document | What it covers |
|----------|---------------|
| **[QUICK_START.md](./QUICK_START.md)** | Get running in 5 minutes |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System design, data flow, component overview |
| **[FEATURES.md](./FEATURES.md)** | Full feature list with status |
| **[TOOLS.md](./TOOLS.md)** | Every tool Gemini can call, with parameters |
| **[APRIL_2026_UPDATE.md](./APRIL_2026_UPDATE.md)** | This month's shipped changes and doc refresh |
| **[TTS.md](./TTS.md)** | Voice synthesis — Chirp3-HD, voices, expressive styles |
| **[SUMMARIZATION_ENGINE.md](./SUMMARIZATION_ENGINE.md)** | Conversation & feedback summarization |
| **[EVOLUTION_ENGINE.md](./EVOLUTION_ENGINE.md)** | Self-improvement loop via feedback → GitHub PRs |
| **[AGENTS.md](./AGENTS.md)** | Optional desktop relay + browser extension notes |
| **[INTEGRATIONS.md](./INTEGRATIONS.md)** | Google, Twilio, GitHub, MCP |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Local dev, Replit, env vars |
| **[copilot/index.md](./copilot/index.md)** | Instructions for GitHub Copilot working on this repo |

---

## What Meowstik Is

Meowstik is a **local-first AI runtime** built on Google Gemini. In normal use it runs on your machine as one app/runtime, even though the codebase is still organized into a React UI, Node services, and SQLite storage.

Older docs may still use terms like **server**, **client**, or **desktop agent**. In current usage, those are implementation details or optional relay modes — not the primary mental model for a local Meowstik install.

```
User ──► Meowstik Local Runtime
          (React UI + Node services + SQLite)
                  │
        ┌─────────┼─────────┬────────────┐
        ▼         ▼         ▼            ▼
   Computer Use   MCP     Browser     Twilio
   (same machine) Servers  Extension  SMS/Voice
```

The AI has direct tool access to: filesystem, shell, Gmail, Google Calendar/Drive/Docs, GitHub, phone calls, local computer-use actions, MCP tools, database queries, and more.

---

## Architecture in One Diagram

```mermaid
graph TD
    User[User] <--> Runtime[Meowstik Local Runtime]

    subgraph Local Runtime
        Runtime --> UI[React UI]
        Runtime --> Node[Node Services]
        Runtime --> DB[(SQLite / Drizzle)]
        Runtime --> Gemini[Google Gemini]
        Runtime --> SE[Summarization Engine]
        Runtime --> EE[Evolution Engine]
        Runtime --> CU[Computer Use / desktop-service]
    end

    subgraph Optional Connections
        Runtime <-->|MCP| MCP[MCP Servers]
        Runtime <-->|WS| Ext[Browser Extension]
        Runtime <-->|WS| Relay[Desktop Relay (legacy/advanced)]
    end

    subgraph Integrations
        Runtime --> TTS[Cloud TTS · Chirp3-HD]
        Runtime --> Google[Google Workspace]
        Runtime --> Twilio[Twilio SMS/Voice]
        Runtime --> GitHub[GitHub API]
    end
```

---

## Current Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Model | Google Gemini (`gemini-2.0-flash`, `gemini-2.5-pro`) |
| Backend | Node.js 20 + Express 4 |
| Database | SQLite via `better-sqlite3` + Drizzle ORM |
| Frontend | React 19 + Vite + Tailwind CSS + shadcn/ui |
| Voice | Google Cloud TTS Chirp3-HD |
| Real-time | Server-Sent Events (SSE) |
| Auth | Google OAuth 2.0 + `passport` |

---

## Key Design Principles

1. **Real tools, not simulated** — Gemini calls actual functions that execute against real systems
2. **Cheap inference for routine work** — Gemini Flash for summarization/classification, Pro for complex reasoning
3. **Self-improvement loop** — feedback → summarization → pattern analysis → GitHub PRs
4. **Personality over plain text** — expressive voice styles make TTS responses feel natural
5. **Human in the loop** — Evolution Engine creates PRs for review, never auto-merges
