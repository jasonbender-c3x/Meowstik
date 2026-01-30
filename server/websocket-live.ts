/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     LIVE VOICE WEBSOCKET HANDLER                          ║
 * ║        Real-time Audio Streaming for Gemini Live API (Project Ghost)     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Enhanced with Computer Use function calling for hands-free desktop control
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import * as geminiLive from "./integrations/gemini-live";
import { desktopRelayService } from "./services/desktop-relay-service";

interface LiveWebSocketClient {
  ws: WebSocket;
  sessionId: string;
  isActive: boolean;
  desktopSessionId?: string; // For Computer Use integration
}

const activeClients = new Map<string, LiveWebSocketClient>();

export function setupLiveWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ 
    noServer: true
  });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    
    if (url?.startsWith("/api/live/stream/")) {
      const sessionId = url.split("/api/live/stream/")[1]?.split("?")[0];
      
      if (!sessionId) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
        handleConnection(ws, sessionId);
      });
    }
  });

  console.log("[Live WS] WebSocket server initialized");
}

async function handleConnection(ws: WebSocket, sessionId: string): Promise<void> {
  console.log(`[Live WS] Client connected: ${sessionId}`);

  const client: LiveWebSocketClient = {
    ws,
    sessionId,
    isActive: true,
  };

  activeClients.set(sessionId, client);

  startReceiving(client);

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "audio") {
        const result = await geminiLive.sendAudio(
          sessionId,
          message.data,
          message.mimeType || "audio/pcm"
        );

        if (!result.success) {
          sendError(ws, result.error || "Failed to send audio");
        }
      } else if (message.type === "text") {
        const result = await geminiLive.sendText(sessionId, message.text);

        if (!result.success) {
          sendError(ws, result.error || "Failed to send text");
        }
      } else if (message.type === "interrupt") {
        await geminiLive.interrupt(sessionId);
      } else if (message.type === "persona") {
        const result = await geminiLive.updateSystemInstruction(
          sessionId,
          message.systemInstruction
        );

        if (!result.success) {
          sendError(ws, result.error || "Failed to update persona");
        }
      } else if (message.type === "linkDesktop") {
        // Link this Live session to a desktop session for Computer Use (Project Ghost)
        client.desktopSessionId = message.desktopSessionId;
        console.log(`[Live WS] Linked to desktop session: ${message.desktopSessionId}`);
        sendMessage(ws, { type: "desktopLinked", sessionId: message.desktopSessionId });
      } else if (message.type === "functionResult") {
        // Send function execution result back to Gemini Live
        const result = await geminiLive.sendFunctionResult(
          sessionId,
          message.functionName,
          message.result
        );

        if (!result.success) {
          sendError(ws, result.error || "Failed to send function result");
        }
      }
    } catch (error) {
      console.error("[Live WS] Error processing message:", error);
      sendError(ws, "Invalid message format");
    }
  });

  ws.on("close", async () => {
    console.log(`[Live WS] Client disconnected: ${sessionId}`);
    client.isActive = false;
    activeClients.delete(sessionId);
    await geminiLive.closeLiveSession(sessionId);
  });

  ws.on("error", (error) => {
    console.error(`[Live WS] WebSocket error for ${sessionId}:`, error);
    client.isActive = false;
  });
}

async function startReceiving(client: LiveWebSocketClient): Promise<void> {
  try {
    for await (const response of geminiLive.receiveResponses(client.sessionId)) {
      if (!client.isActive || client.ws.readyState !== WebSocket.OPEN) {
        break;
      }

      if (response.type === "audio" && response.data) {
        sendMessage(client.ws, { type: "audio", data: response.data });
      } else if (response.type === "text" && response.text) {
        sendMessage(client.ws, { type: "text", text: response.text });
      } else if (response.type === "transcript" && response.text) {
        sendMessage(client.ws, { type: "transcript", text: response.text });
      } else if (response.type === "functionCall" && response.functionCall) {
        // Handle Computer Use function calls (Project Ghost)
        await handleFunctionCall(client, response.functionCall);
      } else if (response.type === "end") {
        sendMessage(client.ws, { type: "end" });
      }
    }
  } catch (error) {
    console.error(`[Live WS] Error receiving responses for ${client.sessionId}:`, error);
    if (client.isActive && client.ws.readyState === WebSocket.OPEN) {
      sendError(client.ws, "Connection to AI lost");
    }
  }
}

/**
 * Handle Computer Use function calls from Gemini Live (Project Ghost)
 */
async function handleFunctionCall(
  client: LiveWebSocketClient,
  functionCall: { name: string; args: any }
): Promise<void> {
  console.log(`[Live WS] Function call: ${functionCall.name}`, functionCall.args);
  
  // Send function call to client for display
  sendMessage(client.ws, { 
    type: "functionCall", 
    functionCall 
  });

  // If this is a Computer Use function and we have a linked desktop session
  if (functionCall.name.startsWith('computer_') && client.desktopSessionId) {
    try {
      // Convert function call to desktop input event
      const inputEvent = convertFunctionCallToInputEvent(functionCall);
      
      if (inputEvent) {
        // Execute on desktop
        desktopRelayService.sendInputToAgent(client.desktopSessionId, inputEvent);
        
        // Send success result back to Gemini Live
        await geminiLive.sendFunctionResult(
          client.sessionId,
          functionCall.name,
          { success: true, executed: true }
        );
        
        console.log(`[Live WS] Executed ${functionCall.name} on desktop ${client.desktopSessionId}`);
      } else {
        // Unknown function - send error
        await geminiLive.sendFunctionResult(
          client.sessionId,
          functionCall.name,
          { success: false, error: "Unknown function type" }
        );
      }
    } catch (error: any) {
      console.error(`[Live WS] Error executing function ${functionCall.name}:`, error);
      await geminiLive.sendFunctionResult(
        client.sessionId,
        functionCall.name,
        { success: false, error: error.message }
      );
    }
  } else if (!client.desktopSessionId) {
    // No desktop session linked
    sendMessage(client.ws, { 
      type: "error", 
      error: "No desktop session linked. Use linkDesktop message to connect."
    });
    
    await geminiLive.sendFunctionResult(
      client.sessionId,
      functionCall.name,
      { success: false, error: "No desktop session linked" }
    );
  }
}

/**
 * Convert Gemini Computer Use function call to desktop agent input event
 */
function convertFunctionCallToInputEvent(functionCall: { name: string; args: any }): any {
  const { name, args } = functionCall;
  
  switch (name) {
    case 'computer_click':
      return {
        type: 'mouse',
        action: 'click',
        x: args.x,
        y: args.y,
        button: args.button || 'left',
        source: 'ai'
      };
      
    case 'computer_move':
      return {
        type: 'mouse',
        action: 'move',
        x: args.x,
        y: args.y,
        source: 'ai'
      };
      
    case 'computer_type':
      return {
        type: 'keyboard',
        action: 'type',
        text: args.text,
        source: 'ai'
      };
      
    case 'computer_key':
      return {
        type: 'keyboard',
        action: 'keydown',
        key: args.key,
        modifiers: args.modifiers,
        source: 'ai'
      };
      
    case 'computer_scroll':
      return {
        type: 'mouse',
        action: 'scroll',
        direction: args.direction,
        delta: args.amount || 300,
        source: 'ai'
      };
      
    case 'computer_screenshot':
      // Screenshot handling - send request to desktop agent to capture
      // The screenshot will be included in the next frame update
      return {
        type: 'screenshot',
        action: 'capture',
        fullScreen: args.fullScreen !== false,
        source: 'ai'
      };
      
    case 'computer_wait':
      // Wait is handled client-side via setTimeout
      // Return a marker event that the agent can recognize
      return {
        type: 'wait',
        action: 'delay',
        duration: args.delay,
        source: 'ai'
      };
      
    default:
      return null;
  }
}

function sendMessage(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, error: string): void {
  sendMessage(ws, { type: "error", error });
}
