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
 * - Gemini 2.5: gemini-2.5-flash-native-audio-preview-12-2025 (audio only)
 * - Gemini 3.0: gemini-3.0-flash-preview (audio + video streaming)
 * Audio Format: 16-bit PCM, 16kHz input / 24kHz output
 * Video Format: JPEG frames at 1 FPS (Gemini 3.0 only)
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { DEFAULT_TTS_VOICE } from "./expressive-tts";

export interface LiveSessionConfig {
  systemInstruction?: string;
  voiceName?: string;
  language?: string;
  enableComputerUse?: boolean; // Enable Computer Use tools for desktop control
  enableVideoStreaming?: boolean; // Enable continuous video streaming (Gemini 3.0 only)
  useGemini3?: boolean; // Use Gemini 3.0 model instead of 2.5
  tools?: any[]; // Additional custom tools
}

export interface LiveSession {
  id: string;
  session: any;
  isActive: boolean;
  createdAt: Date;
}

const activeSessions = new Map<string, LiveSession>();

const DEFAULT_SYSTEM_INSTRUCTION = `You are Meowstik, a helpful and friendly AI assistant. 
You are having a real-time voice conversation. Be concise and natural in your responses.
Respond conversationally as if speaking to a friend. Avoid long lists or overly formal language.`;

const DEFAULT_VOICE = DEFAULT_TTS_VOICE;

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
    
    const sessionConfig: any = {
      responseModalities: [Modality.AUDIO, Modality.TEXT],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: config.voiceName || DEFAULT_VOICE
          }
        }
      },
      systemInstruction: config.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION
    };

    // Add video streaming support for Gemini 3.0 (Project Ghost)
    if (config.enableVideoStreaming && config.useGemini3) {
      // Enable video input modality for continuous streaming
      if (!sessionConfig.responseModalities.includes(Modality.VIDEO)) {
        sessionConfig.responseModalities.push(Modality.VIDEO);
      }
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
      
      // Update system instruction to include Computer Use capabilities
      sessionConfig.systemInstruction = `${sessionConfig.systemInstruction}

You have computer control capabilities. You can see the user's screen and control their computer through:
- computer_click: Click at coordinates
- computer_type: Type text
- computer_key: Press keyboard keys
- computer_scroll: Scroll the screen
- computer_move: Move the mouse
- computer_screenshot: Take a screenshot
- computer_wait: Wait before next action

Use these tools to help the user accomplish tasks hands-free through voice commands.`;
    }

    // Add any additional custom tools
    if (config.tools && config.tools.length > 0) {
      if (!sessionConfig.tools) {
        sessionConfig.tools = [];
      }
      sessionConfig.tools.push(...config.tools);
    }

    // Select model based on configuration
    const modelName = config.useGemini3 
      ? "gemini-3.0-flash-preview" 
      : "gemini-2.5-flash-native-audio-preview-12-2025";

    const session = await (ai as any).live.connect({
      model: modelName,
      config: sessionConfig
    });

    activeSessions.set(sessionId, {
      id: sessionId,
      session,
      isActive: true,
      createdAt: new Date()
    });

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
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    const data = typeof audioData === "string" ? audioData : audioData.toString("base64");
    
    await liveSession.session.send({
      data,
      mimeType
    });

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
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    // Remove data URL prefix if present
    const base64Data = frameData.replace(/^data:image\/\w+;base64,/, "");
    
    await liveSession.session.send({
      data: base64Data,
      mimeType
    });

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
    await liveSession.session.send({ text });
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
  type: "audio" | "text" | "transcript" | "functionCall" | "end";
  data?: string;
  text?: string;
  functionCall?: { name: string; args: any };
}> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    yield { type: "end" };
    return;
  }

  try {
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
          if (part.text) {
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
  }
  
  yield { type: "end" };
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
    if (liveSession.session.interrupt) {
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
    await liveSession.session.send({
      system_instruction: systemInstruction
    });
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
    await liveSession.session.send({
      functionResponse: {
        name: functionName,
        response: result
      }
    });
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
    if (liveSession.session.close) {
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
