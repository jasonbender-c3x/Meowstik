# NotebookLM Ingestion Pipeline

**Meowstik Self-Knowledge & Context Generation System**

This system enables Meowstik to "read itself" by flattening its entire codebase, documentation, history, and runtime environment into a set of optimized text files. These files are designed to be ingested by Google's NotebookLM (or other large-context LLMs) to create a "Meta-Agent" or "Baby LLM" that perfectly understands the project's current state.

---

## 🚀 Quick Start

Generate all context artifacts in one go:

```bash
# 1. Generate the core codebase and documentation bundles
npx tsx scripts/prepare-notebooklm.ts

# 2. Generate the deep context extras (History, Schema, Health, API Stack)
npx tsx scripts/prepare-notebooklm-extras.ts
```

All output files will be placed in the `notebooklm-ingest/` directory.

---

## 📂 Generated Artifacts

The pipeline produces 8 distinct artifacts, each serving a specific knowledge domain for the LLM.

### 1. The Core Bundles (`prepare-notebooklm.ts`)

These files represent the *static* state of the code and docs.

| File | Content Description | Purpose |
|------|---------------------|---------|
| **`meowstik_codebase.txt`** | All source code (`.ts`, `.tsx`, `.py`, `.json`, etc.) excluding binaries and build artifacts. | Teaches the LLM *how* the system works internally. |
| **`meowstik_docs.txt`** | All markdown files from `docs/`, `README.md`, and other documentation. | Teaches the LLM *why* decisions were made and architectural intent. |
| **`meowstik_logs.txt`** | Recent server logs, error reports, and runtime telemetry. | Provides context on recent debugging sessions or runtime behavior. |
| **`meowstik_files.txt`** | complete file tree listing. | Gives the LLM spatial awareness of the project structure. |

### 2. The Deep Context Extras (`prepare-notebooklm-extras.ts`)

These files represent the *temporal* and *operational* state.

| File | Content Description | Purpose |
|------|---------------------|---------|
| **`meowstik_history.txt`** | Complete git log with commit messages, authors, and dates. | Teaches the LLM the project's evolution, feature velocity, and active contributors. |
| **`meowstik_schema.txt`** | Concatenated Drizzle schema definitions (`schema.ts`, `relations.ts`). | Provides a precise lookup for database entities and relationships. |
| **`meowstik_health.txt`** | Results of system checks (TS compilation, linting, test stubs). | Informs the LLM of the current stability and technical debt (e.g., "Build is failing"). |
| **`meowstik_api_stack.txt`** | A breakdown of external dependencies and API keys used in the project. | Provides context on the "capabilities stack" (Twilio, Gemini, Google Drive, etc.). |

---

## 🛠️ How It Works

### The Flattener (`scripts/prepare-notebooklm.ts`)
This script recursively traverses the repository root.
- **Includes**: TypeScript, Python, JSON, XML, Markdown, Shell scripts.
- **Excludes**: `node_modules`, `.git`, `dist`, `build`, binary files (images, PDFs), and large assets.
- **Formatting**: Each file is wrapped in XML-style tags for easy LLM parsing:
  ```text
  <file path="server/index.ts">
  ... content ...
  </file>
  ```

### The Context Generator (`scripts/prepare-notebooklm-extras.ts`)
This script performs targeted extractions:
1.  **History**: Runs `git log --pretty=format:"..."` to dump the entire commit timeline.
2.  **Schema**: Locates specific schema files in `server/db/` or `server/schema/`.
3.  **Health**: Runs a dry-run of `tsc --noEmit` to capture compile-time errors without halting.
4.  **API Stack**: Scans `package.json` and environmental usage to summarize the tech stack.

---

## 🧠 Usage: Creating the "Baby LLM"

1.  **Generate Files**: Run both scripts as shown in Quick Start.
2.  **Go to NotebookLM**: Open [NotebookLM](https://notebooklm.google.com/).
3.  **Create New Notebook**: Name it "Meowstik Expert" (or similar).
4.  **Add Source**: Upload all 8 files from the `notebooklm-ingest/` directory.
5.  **Query**:
    *   *"Explain the architecture of the browser extension."*
    *   *"What was the last feature added to the Google Drive integration?"*
    *   *"Generate a new tool definition based on the current schema."*

## ⚠️ Notes
- **Sensitive Data**: The scripts attempt to respect `.gitignore`, but always audit `notebooklm-ingest/` before sharing if you have hardcoded secrets (you shouldn't!).
- **Size Limits**: If the codebase grows too large, NotebookLM may hit token limits per source. The script can be modified to chunk output if needed.
