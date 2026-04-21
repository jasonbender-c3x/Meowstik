# Meowstik Desktop / Local Runtime

Meowstik is now best understood as a **local runtime**. The app runs on your machine, and computer use can execute on that same machine through the built-in desktop services.

Older docs may still talk about a separate **server**, **client**, or **desktop agent**. Those terms are now legacy implementation language or optional relay modes, not the default user model.

## Current Computer-Use Path

The live computer-use stack is:

- `server/services/desktop-service.ts` — local screenshots, mouse, keyboard, app launching
- `server/services/computer-use.ts` — Gemini Computer Use orchestration and tool declarations
- `server/websocket-live.ts` — live-mode routing for computer-use actions where needed

### Available local computer-use tools

- `computer_screenshot`
- `computer_click`
- `computer_type`
- `computer_key`
- `computer_scroll`
- `computer_move`
- `computer_wait`
- `computer_open`

## Running Meowstik Locally

### Development runtime

```bash
pnpm install
pnpm run dev
```

This starts the local runtime from the repository root.

### Optional Electron shell

An Electron wrapper still exists in `desktop-app/`, but it should be treated as an optional shell around the same local runtime rather than a separate client.

```bash
cd desktop-app
npm install
npm start
```

## Notes

- Local computer use depends on OS-level screenshot/input capabilities (`screenshot-desktop`, `@nut-tree-fork/nut-js`)
- Optional WebSocket desktop-relay paths still exist in the codebase for advanced or legacy setups
- MCP support is separate from computer use; MCP adds external tool servers, while `computer_*` controls the local machine
