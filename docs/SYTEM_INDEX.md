# Meowstik (Project Index & Glossary)

## 🏗️ Core Infrastructure
- **Server**: Node.js backend (`server/`)
- **Database**: Drizzle ORM + PostgreSQL (`shared/schema.ts`, `server/storage.ts`)
- **RAG Engine**: Multi-stage ingestion (`server/services/ingestion-pipeline.ts`, `retrieval-orchestrator.ts`)
- **Browser UI**: React application (`client/`)

## 🛠️ Key Integrated Services
- **Gemini**: LLM for chat & tool dispatching (`server/routes.ts`, `server/gemini-tools.ts`)
- **Expressive TTS**: Google Cloud Neural2 voices (`server/integrations/expressive-tts.ts`)
- **Desktop Support**: Electron and Nut-js for automation (`desktop-app/`, `desktop-agent/`)
- **Browser Extension**: Real-time context capture (`browser-extension/`, `extension/`)

## 📘 Component Definitions
- **Agent Lifecycle**: How the LLM turns inputs into actions (see `docs/exhibit/01-core-features/`).
- **Tool Dispatcher**: `server/services/rag-dispatcher.ts` - Central "brain" for execution.
- **SSE Stream**: Server-Sent Events for real-time tokens and tool events (`server/routes.ts`).
- **Hardware Integrations**: Petoi, Arduino, KiCad in `server/integrations/`.

## 📜 Repository Structure
- `attached_assets/`: Static generated files.
- `docs/`: Extensive architectural documentation.
- `prompts/`: System prompting strategies.
- `shared/`: Shared schemas between client, server, and extensions.
