# VS Code Integration

Meowstik offers a powerful integration with Visual Studio Code, enabling seamless bidirectional communication between your chat interface and your coding environment. This allows Meowstik to:

1.  **Read Files**: Access your current workspace files.
2.  **Write Code**: Create or modify files directly from the chat.
3.  **Execute Commands**: Run terminal commands and build scripts.
4.  **Voice Coding**: Dictate code changes and see them applied instantly.

## Architecture

The integration consists of two main components:

1.  **Meowstik Server (WebSocket Endpoint)**:
    -   Location: `server/websocket-vscode.ts`
    -   Endpoint: `ws://localhost:5000/api/vscode/connect`
    -   Role: Acts as the central hub, managing the WebSocket connection and routing messages between the web client and the VS Code extension.

2.  **VS Code Extension (Client)**:
    -   Location: `vscode-extension/`
    -   Role: Connects to the server, listens for commands (like `write_file`, `read_file`), and executes them using the VS Code API. It also sends events (like `file_saved`, `terminal_output`) back to the server.

## Setup & Running

### Prerequisites

-   Node.js 18+
-   `pnpm` (Use `npm install -g pnpm` if needed)
-   Visual Studio Code

### Building the Extension

The extension is located in the `vscode-extension` directory.

```bash
# From the project root
cd vscode-extension
pnpm install
pnpm run compile
```

This will produce the compiled extension in `vscode-extension/dist/`.

### Running in Development Mode

1.  **Start the Meowstik Server**:
    ```bash
    pnpm run dev
    ```
    Ensure the server is running on `http://localhost:5000`.

2.  **Launch VS Code Extension**:
    -   Open the `vscode-extension` folder in VS Code.
    -   Press `F5` to start debugging.
    -   A new "Extension Development Host" window will open.
    -   The extension will automatically attempt to connect to `ws://localhost:5000/api/vscode/connect`.

3.  **Verify Connection**:
    -   Check the "Output" panel in the Extension Host window (select "Meowstik" from the dropdown).
    -   You should see "Connected to Meowstik Server".

### Usage

Once connected, you can use Meowstik's chat interface to interact with your VS Code session.

-   **"Create a file named hello.ts..."**: The server sends a `write_file` command to the extension.
-   **"Read src/app.ts..."**: The server requests file content via `read_file`.

## Protocol

Communication uses JSON messages over WebSocket.

**Server -> Extension:**
```json
{
  "id": "req_123",
  "type": "write_file",
  "path": "/absolute/path/to/file.ts",
  "content": "console.log('Hello');"
}
```

**Extension -> Server:**
```json
{
  "id": "req_123",
  "type": "response",
  "success": true
}
```

## Configuration

The extension contributes the following settings in VS Code:

-   `meowstik.serverUrl`: The WebSocket URL of the Meowstik server (default: `ws://localhost:5000/api/vscode/connect`).

## Troubleshooting

-   **Connection Refused**: Ensure the Meowstik server is running on port 5000.
-   **Dependencies**: If compilation fails, ensure you ran `pnpm install` inside `vscode-extension` (not just root).
-   **Firewall**: Check if local connections to port 5000 are blocked.
