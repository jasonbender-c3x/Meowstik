# Meowstik: The Meta-Agent Platform

**Universal Control Plane for AI-Human Collaboration**

Meowstik is not just a chat application. It is a comprehensive ecosystem of interconnected agents, interfaces, and protocols designed to give AI models (specifically Gemini) agency over the digital world. It bridges the gap between text-based reasoning and active execution across local desktops, web browsers, and remote servers.

---

## 🌌 The "Meta" Architecture

Meowstik operates as a hub-and-spoke model where the **Server** acts as the central brain, coordinating various "limbs" (agents) that interact with different environments.

```mermaid
graph TD
    User[User] <--> Client[Web Client / UI]
    Client <--> Server[Meowstik Server (Hub)]
    
    subgraph "The Brain (Server)"
        Server --> Gemini[Google Gemini AI]
        Server --> DB[(Postgres Database)]
        Server --> RAG[RAG / Knowledge Base]
    end
    
    subgraph "The Limbs (Agents)"
        Server <-->|WebSockets| Desktop[Desktop Agent]
        Server <-->|WebSockets| Extension[Browser Extension]
        Server <-->|SSH| Remote[SSH Gateway (Project Chimera)]
        Server <-->|HTTP| CloudBrowser[Browserless / Cloud Scraper]
    end

    Desktop -->|Control| LocalOS(Local OS / Screen / Keyboard)
    Extension -->|Control| UserBrowser(User's Active Tabs)
    Remote -->|Control| RemoteServer(Linux Servers)
    CloudBrowser -->|Scrape| DeepWeb(The Web)
```

---

## 📂 System Manifest (Directory Map)

Meowstik is a monorepo containing several distinct applications that work in concert:

### 1. The Core (Brain & Face)
*   **`server/`**: The neural hub. Use Express + Drizzle ORM.
    *   **Orchestrator**: Manages tool calls (`rag-dispatcher.ts`).
    *   **Protocols**: Handles real-time WebSockets for all agents.
    *   **Intelligence**: Integrates Google Gemini (`gemini-tools.ts`).
*   **`client/`**: The visual interface.
    *   A React/Vite application for chatting with the agent, visualizing agent actions, and managing configurations.

### 2. The Agents (Limbs)
These are independent applications that connect to the Server to receive instructions and stream back data (video/audio/text).

*   **`desktop-agent/`** *(Node.js)*:
    *   **Role**: Full OS control.
    *   **Capabilities**: Screen recording, mouse injection (`robotjs`), global keyboard shortcuts.
    *   **Use Case**: "Watch me fix this bug in VS Code" or "Click that button for me."
*   **`browser-extension/`** *(Chrome Extension)*:
    *   **Role**: Context-aware browser companion.
    *   **Capabilities**: Reading active tabs, manipulating DOM, side-panel chat.
    *   **Use Case**: "Summarize this article" or "Fill out this form."
*   **`local-agent/`** *(Playwright)*:
    *   **Role**: Headless background worker.
    *   **Capabilities**: Navigating web pages invisibly to perform tasks without interrupting the user.
*   **`desktop-app/`** *(Electron)*:
    *   **Role**: A native wrapper for the Client, bridging the gap between web UI and local desktop features.

### 3. Capabilities & Projects
*   **Project Chimera** (`CHIMERA_PHASE1_COMPLETE.md`): 
    *   **SSH Gateway**: Enables the AI to SSH into remote servers, run shell commands, and manage infrastructure directly from chat.
*   **Browserless Integration** (`BROWSERLESS_README.md`):
    *   **Self-Hosted Scraping**: A cost-saving architecture to run high-volume web scraping tasks using a local or cloud-hosted headless browser fleet, avoiding expensive SaaS fees.
*   **Call Recording & Voice**:
    *   Integration with Twilio for handling voice calls and SMS (`TWILIO_IMPLEMENTATION_SUMMARY.md`), allowing the AI to act as a receptionist or phone operator.

---

## 🚀 How It Works Together

1.  **User Intent**: You say, *"Log into my server and fix the Nginx config, then verify it by opening the site."*
2.  **Dispatch**: The `Server` analyzes this intent.
    *   It calls **Project Chimera** tools to SSH into the box and edit the config.
    *   It keeps the `Client` updated via SSE (Server-Sent Events).
    *   It instructs the **Browserless** module (or `local-agent`) to visit the URL and take a screenshot of the result.
3.  **Feedback**: The `Server` synthesizes the SSH output and the screenshot, and Gemini explains the result to you in the `Client`.

---

## ⚡ Quick Start (The "Universal" Way)

Since there are many moving parts, the standard dev loop focuses on the Core:

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start the Brain (Server & Client)**:
    ```bash
    npm run dev
    ```

3.  **Connect an Limb (Optional)**:
    *   *Desktop Agent*: `cd desktop-agent && npm start`
    *   *Extension*: Load `browser-extension/` directory as an unpacked extension in Chrome.

---

## 📚 Documentation Index

*   **Backend Architecture**: [BACKEND_IMPLEMENTATION_SUMMARY.md](BACKEND_IMPLEMENTATION_SUMMARY.md)
*   **Browserless System**: [BROWSERLESS_README.md](BROWSERLESS_README.md)
*   **SSH / Operating System**: [CHIMERA_PHASE1_COMPLETE.md](CHIMERA_PHASE1_COMPLETE.md)
*   **Desktop Hardware**: [HARDWARE_IMPLEMENTATION_SUMMARY.md](HARDWARE_IMPLEMENTATION_SUMMARY.md)
