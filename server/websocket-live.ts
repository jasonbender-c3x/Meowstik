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
import { localComputerControl } from "./services/local-computer-control";

interface LiveWebSocketClient {
  ws: WebSocket;
  sessionId: string;
  isActive: boolean;
  desktopSessionId?: string; // For Computer Use integration
  pendingScreenshotRequests?: Map<string, { resolve: (data: string) => void, reject: (reason: any) => void }>;
}

const activeClients = new Map<string, LiveWebSocketClient>();

export function setupLiveWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ 
    noServer: true
  });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    console.log(`[Live WS] Upgrade request for: ${url}`);
    
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
    pendingScreenshotRequests: new Map()
  };

  activeClients.set(sessionId, client);

  startReceiving(client);

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "screenshot_response") {
        const { id, data: b64Data, error } = message;
        const pending = client.pendingScreenshotRequests?.get(id);
        
        if (pending) {
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(b64Data);
          }
          client.pendingScreenshotRequests?.delete(id);
        }
        return;
      } else if (message.type === "log") {
        console.log(`[Client Log] ${sessionId}:`, message.data);
      } else if (message.type === "audio") {
        console.log(`[Live WS] Received audio chunk (${message.data.length} chars)`);
        const result = await geminiLive.sendAudio(
          sessionId,
          message.data,
          message.mimeType || "audio/pcm"
        );

        if (!result.success) {
          sendError(ws, result.error || "Failed to send audio");
        }
      } else if (message.type === "text") {
        console.log(`[Live WS] Received text: ${message.text.substring(0, 50)}...`);
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

  // If this is a Computer Use function
  if (functionCall.name.startsWith('computer_')) {
    
    // 1. Try Desktop Agent (Priority)
    if (client.desktopSessionId) {
      try {
        // ... (existing desktop logic) ...
        const inputEvent = convertFunctionCallToInputEvent(functionCall);
        if (inputEvent) {
          desktopRelayService.sendInputToAgent(client.desktopSessionId, inputEvent);
          await geminiLive.sendFunctionResult(client.sessionId, functionCall.name, { success: true, executed: true });
          console.log(`[Live WS] Executed ${functionCall.name} on desktop ${client.desktopSessionId}`);
          return;
        }
      } catch (error: any) {
        console.error(`[Live WS] Desktop execution failed, trying local:`, error);
      }
    }

    // 2. Fallback to Local Execution (Server-side)
    try {
      console.log(`[Live WS] Executing ${functionCall.name} locally on server...`);
      const { name, args } = functionCall;
      let result = { success: true, executed: true };

      switch (name) {
        case 'computer_click':
          await localComputerControl.click(args.x, args.y, args.button);
          break;
        case 'computer_move':
          await localComputerControl.moveMouse(args.x, args.y);
          break;
        case 'computer_type':
          await localComputerControl.type(args.text);
          break;
        case 'computer_key':
          await localComputerControl.pressKey(args.key, args.modifiers);
          break;
        case 'computer_scroll':
          await localComputerControl.scroll(args.direction, args.amount);
          break;
        case 'computer_screenshot':
          // Try to get screenshot from client first (browser/frontend)
          let b64 = "";
          try {
            // Request screenshot from client with 5s timeout
            b64 = await new Promise<string>((resolve, reject) => {
              const requestId = `req-${Date.now()}-${Math.random()}`;
              
              // Store pending request
              // Note: We need access to pendingScreenshotRequests map here.
              // Since it's inside handleConnection scope, we can't easily access it from handleFunctionCall 
              // unless we pass it or attach it to the client object.
              
              // Let's attach it to the client object for simplicity
              if (!client.pendingScreenshotRequests) {
                reject(new Error("Client not ready for screenshots"));
                return;
              }
              
              client.pendingScreenshotRequests.set(requestId, { resolve, reject });
              
              // Send request
              sendMessage(client.ws, { type: "request_screenshot", id: requestId });
              
              // Timeout fallback
              setTimeout(() => {
                if (client.pendingScreenshotRequests?.has(requestId)) {
                  client.pendingScreenshotRequests.delete(requestId);
                  reject(new Error("Client screenshot timeout"));
                }
              }, 5000);
            });
            console.log("[Live WS] Received screenshot from client");
          } catch (err) {
            console.warn(`[Live WS] Client screenshot failed (${err.message}), falling back to local system...`);
            // Fallback to local system (which might be headless/placeholder)
            b64 = await localComputerControl.takeScreenshot();
          }

          // Send as video frame for Gemini 3.0 Live
          await geminiLive.sendVideoFrame(client.sessionId, b64);
          result = { success: true, screenshot_taken: true };
          break;
        case 'computer_wait':
          await new Promise(r => setTimeout(r, args.delay || 1000));
          break;
      }

      await geminiLive.sendFunctionResult(client.sessionId, name, result);
      console.log(`[Live WS] Locally executed ${name}`);

    } catch (error: any) {
      console.error(`[Live WS] Local execution failed:`, error);
      await geminiLive.sendFunctionResult(client.sessionId, functionCall.name, { success: false, error: error.message });
    }

  } else {
    // Unknown function (not computer_*) or handled elsewhere
    // ... existing error handling for non-computer functions? ...
    // Actually the original code had an else block for !client.desktopSessionId which sent an error.
    // We removed that restriction for computer_* functions.
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
