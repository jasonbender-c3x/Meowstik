# Meowstik Desktop App

The **Meowstik Desktop App** wraps the core server in an Electron shell, providing:
1.  **Computer Use**: Enables the AI to see your screen and control your mouse/keyboard.
2.  **Native Integration**: Runs as a native application rather than just a web server.
3.  **Unified Runtime**: Manages the backend server process automatically.

## Architecture

The desktop app is located in `desktop-app/` and uses a multi-process architecture:
-   **Main Process (Electron)**: Handles window management and system integration.
-   **Server Process (Child)**: Spawns the main Meowstik server (`server/index.ts`) as a forked Node.js process.
-   **Renderer Process (Web)**: Displays the frontend UI (served by the Server Process).

## Installation

The desktop app is part of the monorepo workspace.

```bash
# Install all dependencies (from root)
pnpm install

# Build the desktop app TypeScript
cd desktop-app
pnpm run build
```

## Running the App

To start the full system (Server + UI + Desktop Agent):

```bash
# From the root directory
cd desktop-app
npm start
```

> **Note:** `npm start` in `desktop-app` will launch the Electron window and automatically start the backend server on port 5000.

## Computer Use Capabilities

When running in Desktop App mode, the AI gains the following capabilities:
-   **Screen Vision**: Can take screenshots of your active desktop.
-   **Mouse Control**: Can move, click, and drag the mouse.
-   **Keyboard Control**: Can type text and press key combinations.
-   **App Launching**: Can open applications by name.

These features are exposed to the AI via the `computer_*` toolset (e.g., `computer_click`, `computer_type`, `computer_screenshot`).
