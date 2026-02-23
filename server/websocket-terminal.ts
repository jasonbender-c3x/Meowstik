import { WebSocketServer, WebSocket } from "ws";

/**
 * [💭 Analysis]
 * Terminal WebSocket Handler.
 * Explicit named export to resolve ESM 'is not a function' errors.
 */
export function setupTerminalWebsocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    console.log("📟 [Terminal] WebSocket Connected");

    ws.on("message", (message) => {
      // Echo logic or PTY bridge would go here
      console.log(`[Terminal] Received: ${message}`);
    });

    ws.on("close", () => console.log("📟 [Terminal] WebSocket Disconnected"));
  });
}