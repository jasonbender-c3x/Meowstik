import { WebSocketServer, WebSocket } from "ws";

/**
 * [💭 Analysis]
 * Collaboration/Sync WebSocket Handler.
 */
export function setupCollabWebsocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    console.log("👥 [Collab] WebSocket Connected");

    ws.on("close", () => console.log("👥 [Collab] WebSocket Disconnected"));
  });
}