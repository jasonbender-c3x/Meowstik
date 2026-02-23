import { WebSocketServer, WebSocket } from "ws";

/**
 * [💭 Analysis]
 * Live Voice/Interaction WebSocket Handler.
 */
export function setupLiveWebsocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    console.log("🎙️ [Live] WebSocket Connected");

    ws.on("close", () => console.log("🎙️ [Live] WebSocket Disconnected"));
  });
}