import { WebSocketServer, WebSocket } from "ws";

/**
 * [💭 Analysis]
 * Twilio Media Stream WebSocket Handler.
 */
export function setupTwilioWebsocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    console.log("📞 [Twilio] Stream Connected");

    ws.on("message", (message) => {
      const msg = JSON.parse(message.toString());
      if (msg.event === "start") {
        console.log(`[Twilio] Stream starting: ${msg.start.streamSid}`);
      }
    });

    ws.on("close", () => console.log("📞 [Twilio] Stream Disconnected"));
  });
}