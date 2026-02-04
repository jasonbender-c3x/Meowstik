/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     TWILIO MEDIA STREAM WEBSOCKET                         ║
 * ║        Real-time Phone Conversation with Meowstic (Receptionist Mode)     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Handles Twilio Media Streams for live phone conversations.
 * Connects inbound/outbound calls to the AI model via WebSocket.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import type { Duplex } from "stream";
import crypto from "crypto";
import * as geminiLive from "./integrations/gemini-live";
import { log } from "./index";
import { decodeMuLaw, encodeMuLaw, resample8kTo16k, resample24kTo8k } from "./utils/audio-transcoder";

interface TwilioMediaStreamMessage {
  event: "start" | "media" | "stop" | "mark" | "clear" | "connected";
  sequenceNumber?: string;
  media?: {
    track: "inbound" | "outbound";
    chunk: string; // Base64 encoded audio
    timestamp?: string;
    payload?: string;
  };
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
    mediaFormat: {
      encoding: "audio/x-mulaw";
      sampleRate: 8000;
      channels: 1;
    };
  };
}

export function setupTwilioWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ 
    noServer: true
  });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    
    // Twilio will connect to /streams/twilio
    if (url === "/streams/twilio" || url?.startsWith("/streams/twilio")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
        handleTwilioConnection(ws);
      });
    }
  });

  log("Twilio WebSocket server initialized at /streams/twilio", "twilio");
}

function handleTwilioConnection(ws: WebSocket): void {
  let streamSid: string | null = null;
  let callSid: string | null = null;
  const sessionId: string = crypto.randomUUID();
  let isSessionActive = false;

  console.log("[Twilio WS] New Media Stream connection");

  // Define reception loop function
  const startGeminiResponseStream = async () => {
    if (!streamSid) return;
    
    console.log(`[Twilio WS] Starting Gemini response stream for ${sessionId}`);
    
    try {
      // Consume the async generator from Gemini Live
      for await (const response of geminiLive.receiveResponses(sessionId)) {
        if (ws.readyState !== WebSocket.OPEN) break;

        if (response.type === "audio" && response.data) {
          // Gemini sends PCM audio (Likely 24kHz Base64)
          try {
            const pcmBuffer = Buffer.from(response.data, "base64");
            
            // Transcode: PCM 24k -> PCM 8k -> MuLaw
            const downsampled = resample24kTo8k(pcmBuffer);
            const mulaw = encodeMuLaw(downsampled);
            const payload = mulaw.toString("base64");

            // Send to Twilio
            const mediaMessage = {
              event: "media",
              streamSid: streamSid,
              media: {
                payload: payload
              }
            };
            
            ws.send(JSON.stringify(mediaMessage));
            
          } catch (err) {
            console.error("[Twilio WS] Error transcoding audio output:", err);
          }
        } 
        else if (response.type === "text") {
           // Log text for debugging, or maybe send as SMS? (Out of scope for live voice)
           // console.log("Gemini Text:", response.text);
        }
        else if (response.type === "end") {
           console.log("[Twilio WS] Gemini session ended");
           break;
        }
      }
    } catch (error) {
      console.error("[Twilio WS] Error in Gemini response loop:", error);
    }
  };

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as TwilioMediaStreamMessage;

      if (msg.event === "start") {
        streamSid = msg.start!.streamSid;
        callSid = msg.start!.callSid;
        const customParams = msg.start!.customParameters || {};
        const fromNumber = customParams.fromNumber || "Unknown";
        
        console.log(`[Twilio WS] Stream started: ${streamSid} for Call: ${callSid} From: ${fromNumber}`);
        
        // System Prompt for Receptionist
        const RECEPTIONIST_PROMPT = `
You are Meowstic, a professional and intelligent AI receptionist for Jason Bender.
You are currently speaking on the phone with ${fromNumber}.
Your duties are:
1. Politely screen the call. Ask for their name and reason for calling.
2. If it is urgent or a known contact (Family), say you will forward the message immediately.
3. If it is sales/spam, politely decline and end the call.
4. Keep responses concise and conversational (speech-optimized).
5. Do not describe your actions (e.g. *nods*), just speak.
`;

        // Initialize Gemini Live Session
        const result = await geminiLive.createLiveSession(sessionId, {
          systemInstruction: RECEPTIONIST_PROMPT,
          voiceName: "Aoede",
          language: "en-US",
          // Assume we are using Gemini 2.5/3.0 which handles audio i/o
        });

        if (result.success) {
          isSessionActive = true;
          // Start the response loop (background)
          startGeminiResponseStream();
        } else {
          console.error("[Twilio WS] Failed to create Gemini session:", result.error);
          ws.close();
        }
      } 
      else if (msg.event === "media" && msg.media?.track === "inbound") {
        // Send audio to Gemini
        if (isSessionActive && msg.media.payload) {
             const mulawChunk = Buffer.from(msg.media.payload, "base64");
             
             // Transcode: MuLaw -> PCM 16bit 8k -> PCM 16bit 16k
             const pcm8k = decodeMuLaw(mulawChunk);
             const pcm16k = resample8kTo16k(pcm8k);
             
             // Gemini expects simple Base64 string of PCM data
             await geminiLive.sendAudio(sessionId, pcm16k.toString("base64"), "audio/pcm");
        }
      }
      else if (msg.event === "stop") {
        console.log(`[Twilio WS] Stream stopped: ${streamSid}`);
        isSessionActive = false;
        // In a real app, we should properly dispose of the Gemini session here
        // geminiLive.endSession(sessionId); // If that method existed
      }
    } catch (error) {
      console.error("[Twilio WS] Error processing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("[Twilio WS] Connection closed");
    isSessionActive = false;
  });
}
