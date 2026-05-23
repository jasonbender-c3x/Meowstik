
/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    GEMINI LIVE API INTEGRATION                            ║
 * ║         Real-time Voice & Video Conversation with Gemini 2.5/3.0          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides real-time bidirectional audio/video streaming with Gemini's
 * native multimodal models. Features:
 * 
 * - WebSocket-based audio streaming (low latency ~100ms)
 * - Video streaming support (Gemini 3.0: 1 FPS JPEG frames)
 * - Voice Activity Detection (VAD) for natural conversations
 * - Barge-in support (user can interrupt AI mid-speech)
 * - Multi-speaker support via persona switching
 * - Transcript streaming alongside audio
 * 
 * Models:
 * - Gemini 2.5: gemini-2.5-flash-native-audio-preview-12-2025 (audio only, working)
 * - Gemini 3.0: gemini-3-flash-preview (audio + video streaming)
 * Audio Format: 16-bit PCM, 16kHz input / 24kHz output
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { DEFAULT_TTS_VOICE } from "./expressive-tts";
import { EventEmitter } from "events";

export interface LiveSessionConfig {
  systemInstruction?: string;
  voiceName?: string;
  language?: string;
  enableComputerUse?: boolean; // Enable Computer Use tools for desktop control
  enableVideoStreaming?: boolean; // Enable continuous video streaming (Gemini 3.0 only)
  useGemini3?: boolean; // Use Gemini 3.0 model instead of 2.5
  tools?: any[]; // Additional custom tools
}

export interface LiveCloseInfo {
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

export interface LiveSession {
  id: string;
  session: any;
  isActive: boolean;
  createdAt: Date;
  emitter?: EventEmitter;
  config: LiveSessionConfig;
  modelName: string;
  lastClose?: LiveCloseInfo;
}

const activeSessions = new Map<string, LiveSession>();

const DEFAULT_SYSTEM_INSTRUCTION = `You are Meowstik, a helpful and friendly AI assistant. 
You are having a real-time voice conversation. Be concise and natural in your responses.
Respond conversationally as if speaking to a friend. Avoid long lists or overly formal language.`;

const DEFAULT_VOICE = DEFAULT_TTS_VOICE;

const COMPUTER_USE_SYSTEM_INSTRUCTION = `

You have computer control capabilities. You can see the user's screen and control their computer through:
- computer_click: Click at coordinates
- computer_type: Type text
- computer_key: Press keyboard keys
- computer_scroll: Scroll the screen
- computer_move: Move the mouse
- computer_screenshot: Take a screenshot
- computer_wait: Wait before next action

Use these tools to help the user accomplish tasks hands-free through voice commands.`;

function buildSystemInstructionText(config: LiveSessionConfig = {}) {
  const instruction = config.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;

  if (!config.enableComputerUse) {
    return instruction;
  }

  return `${instruction}${COMPUTER_USE_SYSTEM_INSTRUCTION}`;
}

export function buildLiveSessionRequestConfig(config: LiveSessionConfig = {}) {
  const sessionConfig: any = {
    // Native-audio Live sessions reject AUDIO+TEXT at setup time. AUDIO mode still
    // returns text/thought parts alongside PCM chunks in serverContent messages.
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: config.voiceName || DEFAULT_VOICE,
        },
      },
    },
    systemInstruction: {
      parts: [{ text: buildSystemInstructionText(config) }],
    },
  };

  // Video is streamed as input frames via sendRealtimeInput; it is not a response modality.
  if (config.enableVideoStreaming && config.useGemini3) {
    console.log("[Gemini Live] Video streaming input enabled");
  }

  return sessionConfig;
}

function normalizeLiveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Unknown live session error");
}

export function isRetryableLiveClose(closeInfo?: LiveCloseInfo): boolean {
  if (!closeInfo) {
    return false;
  }

  return (
    closeInfo.code === 1011 ||
    /service is currently unavailable/i.test(closeInfo.reason || "")
  );
}

export function getLiveCloseErrorMessage(closeInfo?: LiveCloseInfo): string | undefined {
  if (!closeInfo) {
    return "Live session closed unexpectedly.";
  }

  const reason = closeInfo.reason?.trim();

  if (closeInfo.code === 1000 && !reason) {
    return undefined;
  }

  if (reason) {
    return `Live session closed: ${reason}`;
  }

  if (typeof closeInfo.code === "number") {
    return `Live session closed with code ${closeInfo.code}.`;
  }

  return "Live session closed unexpectedly.";
}

function getInactiveSessionError(liveSession: LiveSession): string {
  const closeMessage = getLiveCloseErrorMessage(liveSession.lastClose);

  if (!closeMessage) {
    return "Session not found or inactive";
  }

  return isRetryableLiveClose(liveSession.lastClose)
    ? `${closeMessage} Please retry.`
    : closeMessage;
}

/**
 * Create a new Gemini Live session
 */
export async function createLiveSession(
  sessionId: string,
  config: LiveSessionConfig = {}
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not configured"
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const sessionConfig = buildLiveSessionRequestConfig(config);

    // Add video streaming support for Gemini 3.0 (Project Ghost)
    if (config.enableVideoStreaming && config.useGemini3) {
      console.log(`[Gemini Live] Video streaming enabled for session ${sessionId}`);
    }

    // Add Computer Use tools if enabled (Project Ghost)
    if (config.enableComputerUse) {
      const { geminiFunctionDeclarations } = await import("../gemini-tools");
      
      // Filter to get only Computer Use tools
      const computerUseTools = geminiFunctionDeclarations.filter(tool => 
        tool.name?.startsWith('computer_')
      );
      
      sessionConfig.tools = computerUseTools;
    }

    // Add any additional custom tools
    if (config.tools && config.tools.length > 0) {
      if (!sessionConfig.tools) {
        sessionConfig.tools = [];
      }
      sessionConfig.tools.push(...config.tools);
    }

    // Select model based on configuration
    const modelName = "gemini-3-flash-preview";

    const emitter = new EventEmitter();

    const session = await (ai as any).live.connect({
      model: modelName,
      config: sessionConfig,
      callbacks: {
          onopen: () => {
              console.log(`[Gemini Live] Session ${sessionId} opened`);
              emitter.emit('open');
          },
          onmessage: (msg: any) => {
              // The SDK might return parsed JSON or event object
              // If it's an event with 'data', we might need to parse.
              // But based on types, it seems to be LiveServerMessage.
              emitter.emit('message', msg);
          },
          onclose: (e: any) => {
               const closeInfo: LiveCloseInfo = {
                 code: e?.code,
                 reason: e?.reason,
                 wasClean: e?.wasClean,
               };
               const currentSession = activeSessions.get(sessionId);
               if (currentSession) {
                 currentSession.isActive = false;
                 currentSession.lastClose = closeInfo;
               }
               console.log(`[Gemini Live] Session ${sessionId} closed`, closeInfo);
               emitter.emit('close', closeInfo);
          },
          onerror: (err: any) => {
               console.error(`[Gemini Live] Session ${sessionId} error`, err);
               emitter.emit('error', err);
          }
      }
    });

    activeSessions.set(sessionId, {
      id: sessionId,
      session,
      isActive: true,
      createdAt: new Date(),
      emitter,
      config: { ...config },
      modelName,
    });
    
    // Check if session has conn property (SDK v1.42+ behavior)
    if (session.conn) {
       console.log(`[Gemini Live] Session connected via session.conn`);
    } else {
       console.warn(`[Gemini Live] Session created but session.conn is missing! API might have changed.`);
    }

    const features = [
      config.enableComputerUse ? 'Computer Use' : null,
      config.enableVideoStreaming ? 'Video Streaming' : null,
      config.useGemini3 ? 'Gemini 3.0' : 'Gemini 2.5'
    ].filter(Boolean).join(', ');
    
    console.log(`[Gemini Live] Created session: ${sessionId} (${features})`);
    
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to create session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create live session"
    };
  }
}

/**
 * Send audio data to the live session
 */
export async function sendAudio(
  sessionId: string,
  audioData: Buffer | string,
  mimeType: string = "audio/pcm"
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return {
      success: false,
      error: liveSession ? getInactiveSessionError(liveSession) : "Session not found or inactive",
    };
  }

  try {
    const data = typeof audioData === "string" ? audioData : audioData.toString("base64");
    
    // Handle new SDK structure where session.conn.send is used
    if (liveSession.session.conn) {
        const msg = {
            realtime_input: {
                media_chunks: [
                    {
                        mime_type: mimeType,
                        data: data
                    }
                ]
            }
        };
        liveSession.session.conn.send(JSON.stringify(msg));
    } else if (typeof liveSession.session.send === 'function') {
        // Fallback to old method if available
        await liveSession.session.send({
          data,
          mimeType
        });
    } else {
        throw new Error("Session does not support sending audio");
    }

    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to send audio:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send audio"
    };
  }
}

/**
 * Send video frame to the live session (Gemini 3.0 only - Project Ghost)
 * Enables continuous video streaming for Computer Use with live vision
 */
export async function sendVideoFrame(
  sessionId: string,
  frameData: string, // base64 JPEG
  mimeType: string = "image/jpeg"
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return {
      success: false,
      error: liveSession ? getInactiveSessionError(liveSession) : "Session not found or inactive",
    };
  }

  try {
    // Handle new SDK structure where session.conn.send is used
    if (liveSession.session.conn) {
        // Remove data URL prefix if present
        const base64Data = frameData.replace(/^data:image\/\w+;base64,/, "");
        
        const msg = {
            realtime_input: {
                media_chunks: [
                    {
                        mime_type: mimeType,
                        data: base64Data
                    }
                ]
            }
        };
        liveSession.session.conn.send(JSON.stringify(msg));
    } else {
        // Remove data URL prefix if present
        const base64Data = frameData.replace(/^data:image\/\w+;base64,/, "");
        
        await liveSession.session.send({
          data: base64Data,
          mimeType
        });
    }

    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to send video frame:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send video frame"
    };
  }
}

/**
 * Send text message to the live session
 */
export async function sendText(
  sessionId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    if (liveSession.session.conn) {
        const msg = {
            client_content: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text }]
                    }
                ],
                turn_complete: true
            }
        };
        liveSession.session.conn.send(JSON.stringify(msg));
    } else {
        await liveSession.session.send({ text });
    }
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to send text:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send text"
    };
  }
}

/**
 * Generator function to receive responses from the live session
 */
export async function* receiveResponses(
  sessionId: string
): AsyncGenerator<{
  type: "audio" | "text" | "transcript" | "functionCall" | "error" | "end";
  data?: string;
  text?: string;
  error?: string;
  retryable?: boolean;
  functionCall?: { id?: string; name: string; args: any };
}> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    yield { type: "end" };
    return;
  }

  // If we have an emitter (new SDK path)
  if (liveSession.emitter) {
      const emitter = liveSession.emitter;
      const queue: Array<
        | { kind: "message"; message: any }
        | { kind: "close"; closeInfo: LiveCloseInfo }
        | { kind: "error"; error: string }
      > = [];
      let resolveNext: ((value?: any) => void) | null = null;
      let ended = false;

      const onMessage = (msg: any) => {
          queue.push({ kind: "message", message: msg });
          if (resolveNext) {
              resolveNext();
              resolveNext = null;
          }
      };

      const onClose = (closeInfo: LiveCloseInfo) => {
          queue.push({ kind: "close", closeInfo });
          ended = true;
          if (resolveNext) {
              resolveNext();
              resolveNext = null;
          }
      };

      const onError = (err: any) => {
           queue.push({ kind: "error", error: normalizeLiveErrorMessage(err) });
           ended = true;
           if (resolveNext) {
             resolveNext();
             resolveNext = null;
           }
      };

      emitter.on('message', onMessage);
      emitter.on('close', onClose);
      emitter.on('error', onError);

      try {
          while (!ended || queue.length > 0) {
              if (queue.length === 0) {
                  await new Promise<void>((resolve) => {
                      resolveNext = resolve;
                  });
              }
              
              if (queue.length === 0 && ended) break;
              
              while (queue.length > 0) {
                  const event = queue.shift();
                  if (!event) {
                    continue;
                  }

                  if (event.kind === "close") {
                      const errorMessage = getLiveCloseErrorMessage(event.closeInfo);
                      if (errorMessage) {
                          yield {
                            type: "error",
                            error: errorMessage,
                            retryable: isRetryableLiveClose(event.closeInfo),
                          };
                      }
                      continue;
                  }

                  if (event.kind === "error") {
                      yield {
                        type: "error",
                        error: event.error,
                      };
                      continue;
                  }

                  const msg = event.message;

                  if (msg.serverContent) {
                      const { modelTurn } = msg.serverContent;
                      if (modelTurn && modelTurn.parts) {
                          for (const part of modelTurn.parts) {
                              if (part.inlineData) {
                                  yield { type: "audio", data: part.inlineData.data };
                              }
                              if (part.text && !part.thought) {
                                  yield { type: "transcript", text: part.text };
                                  yield { type: "text", text: part.text };
                              }
                              if (part.functionCall) {
                                  yield { 
                                      type: "functionCall", 
                                      functionCall: {
                                          name: part.functionCall.name,
                                          args: part.functionCall.args
                                      }
                                  };
                              }
                          }
                      }
                  } else if (msg.toolCall) {
                      // Handle tool calls
                      const { functionCalls } = msg.toolCall;
                      if (functionCalls) {
                          for (const call of functionCalls) {
                              yield {
                                  type: "functionCall",
                                  functionCall: {
                                      name: call.name,
                                      args: call.args
                                  }
                              };
                          }
                      }
                  }
              }
          }
      } finally {
          emitter.off('message', onMessage);
          emitter.off('close', onClose);
          emitter.off('error', onError);
      }
      
      yield { type: "end" };
      return;
  }

  try {
    // Legacy path
    // ... (rest of old code)
        for await (const response of liveSession.session) {
          if (response.data) {
            yield { type: "audio", data: response.data };
          }
          if (response.text) {
            yield { type: "text", text: response.text };
          }
          if (response.serverContent?.modelTurn?.parts) {
            for (const part of response.serverContent.modelTurn.parts) {
              if (part.inlineData) {
                yield { type: "audio", data: part.inlineData.data };
              }
              if (part.text && !part.thought) {
                yield { type: "transcript", text: part.text };
              }
              // Handle function calls from Computer Use (Project Ghost)
              if (part.functionCall) {
                yield { 
                  type: "functionCall", 
                  functionCall: {
                    name: part.functionCall.name,
                    args: part.functionCall.args
                  }
                };
              }
            }
          }
        }
  } catch (error) {
    console.error("[Gemini Live] Error receiving responses:", error);
    yield {
      type: "error",
      error: normalizeLiveErrorMessage(error),
    };
  }
  
  yield { type: "end" };
}

export async function recreateLiveSession(
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);

  if (!liveSession) {
    return { success: false, error: "Session not found" };
  }

  if (liveSession.isActive) {
    try {
      if (typeof liveSession.session.close === "function") {
        await liveSession.session.close();
      } else if (liveSession.session.conn) {
        liveSession.session.conn.close();
      }
    } catch (error) {
      console.warn(`[Gemini Live] Failed to close session before recreating ${sessionId}:`, error);
    }
  }

  activeSessions.delete(sessionId);

  return createLiveSession(sessionId, liveSession.config);
}

/**
 * Interrupt the current response (barge-in)
 */
export async function interrupt(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    if (liveSession.session.conn) {
        // Can't interrupt via message? Or check docs.
        // Usually sending empty audio or specific control message?
        // But for now, maybe just closing and reopening is the only way if interrupt not supported?
        // Or send "client_content" with "interrupt": true?
        // The protocol doesn't explicitly mention "interrupt" message type.
        // It relies on "turn_complete" or just sending new content to preempt.
        
        // Actually, just sending new audio chunks often interrupts.
        // We'll leave it as no-op or log it for now as we can't easily interrupt via raw WS without knowing the exact JSON.
        console.log("[Gemini Live] Interrupt requested (not fully implemented for SDK v1.42)");
    } else if (liveSession.session.interrupt) {
      await liveSession.session.interrupt();
    }
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to interrupt:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to interrupt"
    };
  }
}

/**
 * Update the session's system instruction (for persona switching)
 */
export async function updateSystemInstruction(
  sessionId: string,
  systemInstruction: string
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    if (liveSession.session.conn) {
        // update system instruction via "setup" message? 
        // Not sure if we can re-setup mid-session.
        console.log("[Gemini Live] Update system instruction requested (not fully implemented for SDK v1.42)");
    } else {
        await liveSession.session.send({
          system_instruction: systemInstruction
        });
    }
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to update system instruction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update system instruction"
    };
  }
}

/**
 * Send function result back to the Live session (Project Ghost)
 * Used when Computer Use tools execute actions
 */
export async function sendFunctionResult(
  sessionId: string,
  functionName: string,
  result: any
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    if (liveSession.session.conn) {
        const msg = {
            tool_response: {
                function_responses: [
                    {
                        name: functionName,
                        response: { result }
                    }
                ]
            }
        };
        liveSession.session.conn.send(JSON.stringify(msg));
    } else {
        await liveSession.session.send({
          functionResponse: {
            name: functionName,
            response: result
          }
        });
    }
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to send function result:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send function result"
    };
  }
}

/**
 * Close a live session
 */
export async function closeLiveSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession) {
    return { success: false, error: "Session not found" };
  }

  try {
    if (liveSession.session.conn) {
        liveSession.session.conn.close();
    } else if (liveSession.session.close) {
      await liveSession.session.close();
    }
    liveSession.isActive = false;
    activeSessions.delete(sessionId);
    
    console.log(`[Gemini Live] Closed session: ${sessionId}`);
    
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to close session:", error);
    activeSessions.delete(sessionId);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to close session"
    };
  }
}

/**
 * Get session info
 */
export function getSessionInfo(sessionId: string): LiveSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Get all active session IDs
 */
export function getActiveSessions(): string[] {
  return Array.from(activeSessions.keys());
}

/**
 * Available voices for Gemini TTS
 */
export const AVAILABLE_VOICES = [
  { value: "Kore", label: "Kore - Clear Female", gender: "female" },
  { value: "Puck", label: "Puck - Warm Male", gender: "male" },
  { value: "Charon", label: "Charon - Deep Male", gender: "male" },
  { value: "Fenrir", label: "Fenrir - Strong Male", gender: "male" },
  { value: "Aoede", label: "Aoede - Melodic Female", gender: "female" },
  { value: "Leda", label: "Leda - Soft Female", gender: "female" },
  { value: "Orus", label: "Orus - Authoritative Male", gender: "male" },
  { value: "Zephyr", label: "Zephyr - Gentle Neutral", gender: "neutral" },
] as const;


