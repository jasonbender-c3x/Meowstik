# System Architecture Proposal

## 1. Executive Summary

This proposal outlines the architecture for integrating the Desktop Agent and Browser Extension into the Meowstik ecosystem.

**Key Changes from Original Request:**
- **Desktop Agent**: Instead of a standalone Electron app, the desktop agent capabilities (screen capture, input control) will be integrated directly into the local backend server. This simplifies deployment since the backend now runs locally.
- **Browser Extension**: The extension will serve as the primary development interface, replacing the web client for local tasks. It will reside in the Side Panel and provide advanced features like DOM parsing and screen reading.

## 2. Integrated Desktop Agent

The backend server (`server/`) is already running locally. We will add a `DesktopService` that runs within the same Node.js process to handle screen capture and input simulation.

### 2.1. Architecture
- **Service**: `server/services/desktop-service.ts`
- **Libraries**:
  - `screenshot-desktop`: for capturing screen frames (already in package.json).
  - `@nut-tree-fork/nut-js`: for simulating mouse/keyboard input (needs install).
  - `jimp`: for resizing/compressing frames before processing (needs install).
- **Flow**:
  1. `DesktopService` captures screen frames at a configurable interval (e.g., 1-2 FPS).
  2. Frames are passed to the `VisionService` (Gemini) for analysis when needed.
  3. AI commands (click, type) are executed directly by `DesktopService` using `nut.js`.
- **API**: The service will expose methods to:
  - `startCapture()` / `stopCapture()`
  - `getSnapshot()`
  - `performAction(action: Action)`

### 2.2. Implementation Steps
1.  **Install Dependencies**: `npm install @nut-tree-fork/nut-js jimp` (using fork of nut-js for better compatibility).
2.  **Create Service**: Implement `server/services/desktop-service.ts`.
3.  **Integrate with Tools**: Register a new tool (e.g., `computer_use`) that allows the AI to interact with the desktop.
4.  **Security**: Ensure this feature is only active when running in "Local Mode" or with explicit user permission.

## 3. Browser Extension (Side Panel)

The browser extension will be upgraded to Manifest V3 with a Side Panel UI.

### 3.1. Architecture
- **Manifest V3**:
  - `side_panel`: The main UI for chat and interaction.
  - `background`: Handles WebSocket connection to the local server.
  - `content_scripts`: Inject into pages for DOM parsing and screen reading.
- **Features**:
  - **Chat Interface**: Replicates the web client chat in the sidebar.
  - **DOM Parsing**: Allows the AI to "see" the raw HTML/DOM of the active tab for precise coding assistance.
  - **Screen Reader**: Uses the `chrome.debugger` or `chrome.accessibilityFeatures` APIs (if available) or DOM traversal to describe page content to the AI.
  - **Gemini Portal Helper**: Automation scripts specifically for the Gemini Web Portal (e.g., pasting prompts).

### 3.2. Implementation Steps
1.  **Update Manifest**: Modify `manifest.json` to include `"side_panel"` and necessary permissions.
2.  **Migrate UI**: Move the existing React/HTML UI from `popup/` to `side_panel/`.
3.  **Content Script Communication**: Implement a message bus between the Side Panel and Content Scripts.
4.  **DOM Parser Tool**: Create a tool definition that allows the AI to request "Get Active Tab DOM".

## 4. Work Plan

1.  **Phase 1: Desktop Agent Integration**
    - Install dependencies.
    - Implement `DesktopService` with basic screenshot capability.
    - Test `nut.js` for mouse movement/clicking.
    - Connect to AI tools.

2.  **Phase 2: Extension Side Panel**
    - Refactor extension to use Side Panel API.
    - Establish WebSocket connection to local server.
    - Implement "Get DOM" feature.

3.  **Phase 3: Integration & Testing**
    - Test end-to-end flow: AI sees screen -> AI clicks button.
    - Test extension flow: AI reads DOM -> AI suggests code change.
