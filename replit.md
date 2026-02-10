# Meowstik

## Overview
Meowstik is an AI chat interface powered by Google's Generative AI, integrating Google Workspace services and featuring an HTML/CSS/JS editor with live preview. It aims to provide a modern, user-friendly, and powerful conversational AI experience with a clean, Google-esque design. The project's vision includes developing a self-evolving AI system with advanced AI integrations for speech, music, and image generation, a robust knowledge ingestion pipeline, and a workflow orchestration engine. The system operates with a dual identity: "The Compiler" (the self-evolving AI) and "Meowstik" (a user-friendly persona for interaction).

## User Preferences
- **Communication style:** Simple, everyday language.
- **"Show me" requests:** When asked to "show me" something, create documentation pages in `/docs/ragent/` with extensive hyperlinks and commentary rather than just searching. Open the page in the docs viewer with rich cross-references.

## System Architecture

### Frontend
- **Framework:** React 18 with TypeScript and Vite.
- **UI/UX:** Google-esque design, shadcn/ui on Radix UI, Tailwind CSS v4, CSS variables for theming (light/dark mode), Framer Motion for animations, responsive design.
- **Core Components:** Wouter for routing, TanStack Query for data fetching, Monaco Editor for code editing.

### Backend
- **Framework:** Express.js with Node.js (ES Modules) and TypeScript.
- **Database:** PostgreSQL with Drizzle ORM, storing `Chats` and `Messages`.
- **API:** RESTful design.

### AI Integration
- **Generative AI:** Google's Gemini models (`gemini-2.5-pro`, `gemini-2.5-flash`) with native function calling for tools defined in `server/gemini-tools.ts`.
- **AI Capabilities:**
    - **Expressive Speech (TTS):** Google Cloud Text-to-Speech API with Neural2 voices.
    - **Music Generation:** Lyria RealTime experimental API.
    - **Image Generation:** Gemini 2.0 Flash Preview Image Generation with canvas editor and AI editing.
    - **Evolution Engine:** AI analyzes user feedback and creates GitHub PRs for self-improvement.
    - **Knowledge Ingestion:** Multimodal pipeline (text, images, audio, documents, PDF/file upload) for domain-specific knowledge buckets.
    - **Retrieval Orchestrator:** Hybrid search (vector + keyword), entity recognition, context window management, prompt injection.
    - **Conversation Memory (RAG):** User and AI messages are chunked, embedded, and stored for semantic retrieval.
    - **Embedding Service:** Google Gemini `gemini-embedding-001` (3072-dim vectors).
    - **Modular Vector Store:** Pluggable storage with adapters for `pgvector`, Vertex AI, and in-memory.
    - **Workflow Orchestration Engine:** Hierarchical task management with sequential/parallel execution, AI-evaluated conditional logic, cron scheduling, and event triggers.
    - **Codebase Analysis Agent:** Crawls repositories, extracts code entities from 20+ languages, ingests them into RAG, and generates documentation.
    - **JIT Tool Protocol:** Uses Gemini 2.0 Flash Lite to predict and inject relevant tool examples.
- **Core Tooling (V2 Primitives):** `terminal`, `get`, `put`, `write`, `log`, `say`, `ssh`. Additional tools include `sms_send/sms_list`, `call_make/call_list`, `end_turn`.
- **Memory System:** AI maintains context using `Short_Term_Memory.md`, `cache.md`, `STM_APPEND.md`, and `execution.md` files.
- **Verbosity Slider:** 4-mode voice output control (Mute, Low, Normal, Experimental).
    - **Audio Playback:** Uses persistent Web Audio API AudioContext for iframe-compatible playback; falls back to HTML Audio and browser TTS.

### Advanced AI Features
- **AI Desktop Collaboration:** TeamViewer-style AI hub with headless browser or full desktop modes, a cloud relay, and a standalone `meowstik-agent` for screen/audio capture and input injection.
- **Turn-Based Collaborative Editing:** Operational Transform (OT) protocol with server enforcement and UI guards for multi-user editing.
- **Job Orchestration System:** Multi-worker job processing with DAG-based dependency resolution, using a `pg-boss` backed queue and `AgentWorker` services for execution.
- **Browser Extension & Local Agent:** Chrome extension for AI-powered browser assistance (chat, screen capture, content extraction) and a Node.js local agent for AI-directed desktop control (screen capture, mouse/keyboard input).

### Developer Tools
- **Interactive Terminal (`/terminal`):** Full terminal emulator using xterm.js with node-pty for interactive shell sessions (vim, ssh, etc.). Features WebSocket streaming, command mode for quick commands, interactive PTY mode for full shell access, and a traffic monitor panel showing WebSocket activity on landscape displays.
- **Browser Page (`/browser`):** Full web browser with Browserbase integration.
- **Database Explorer (`/database`):** UI for viewing, editing, and deleting database records.
- **Live Voice Page (`/live`):** Real-time voice conversation interface using Gemini Live API.
- **RAG Debug Page (`/rag-debug`):** Real-time visualization of RAG pipeline activity with trace events and statistics.

## External Dependencies

- **Google Workspace Services:** Drive, Gmail, Calendar, Docs, Sheets, Tasks, Contacts (via `googleapis`).
- **GitHub Integration:** Repository operations, file content, issues, pull requests, commits, user info (via `@octokit/rest`).
- **Twilio:** SMS messaging, voice calls, webhooks (via `twilio`).
- **Authentication:** OAuth2 via Replit Connectors for Google services and GitHub.
- **Replit Platform Integration:** Vite plugins (cartographer, dev-banner, runtime-error-modal, meta images).
- **PostgreSQL:** Primary database.