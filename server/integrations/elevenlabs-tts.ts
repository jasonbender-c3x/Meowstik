/**
 * =============================================================================
 * ELEVENLABS TEXT-TO-SPEECH INTEGRATION
 * =============================================================================
 * 
 * High-quality TTS using ElevenLabs API.
 * Known for natural-sounding voices with emotional range.
 * 
 * Authentication: Requires ELEVENLABS_API_KEY environment variable
 * 
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export interface TTSResponse {
  success: boolean;
  audioBase64?: string;
  mimeType?: string;
  duration?: number;
  error?: string;
}

/**
 * Default voice for TTS - Rachel is a well-balanced, natural female voice
 */
export const DEFAULT_ELEVENLABS_VOICE = "Rachel";

/**
 * Pre-configured ElevenLabs voices with their IDs
 * These are the default premium voices available in ElevenLabs
 */
const AVAILABLE_VOICES: Record<string, { voiceId: string; gender: string; description: string }> = {
  // Female voices
  "Rachel": { 
    voiceId: "21m00Tcm4TlvDq8ikWAM", 
    gender: "FEMALE", 
    description: "Calm, young adult, well-rounded voice" 
  },
  "Domi": { 
    voiceId: "AZnzlk1XvdvUeBnXmlld", 
    gender: "FEMALE", 
    description: "Strong, confident female voice" 
  },
  "Bella": { 
    voiceId: "EXAVITQu4vr4xnSDxMaL", 
    gender: "FEMALE", 
    description: "Soft, young adult female voice" 
  },
  "Elli": { 
    voiceId: "MF3mGyEYCl7XYWbV9V6O", 
    gender: "FEMALE", 
    description: "Energetic, young female voice" 
  },
  "Freya": {
    voiceId: "jsCqWAovK2LkecY7zXl4",
    gender: "FEMALE",
    description: "Mature, authoritative female voice"
  },
  
  // Male voices
  "Antoni": { 
    voiceId: "ErXwobaYiN019PkySvjV", 
    gender: "MALE", 
    description: "Well-rounded male voice" 
  },
  "Josh": { 
    voiceId: "TxGEqnHWrfWFTfGW9XjX", 
    gender: "MALE", 
    description: "Deep, young adult male voice" 
  },
  "Arnold": { 
    voiceId: "VR6AewLTigWG4xSOukaG", 
    gender: "MALE", 
    description: "Crisp, strong male voice" 
  },
  "Adam": { 
    voiceId: "pNInz6obpgDQGcFmaJgB", 
    gender: "MALE", 
    description: "Deep, middle-aged male voice" 
  },
  "Sam": { 
    voiceId: "yoZ06aMxZJJ28mfd3POQ", 
    gender: "MALE", 
    description: "Raspy, young adult male voice" 
  },
};

let elevenLabsClient: ElevenLabsClient | null = null;

/**
 * Initialize ElevenLabs client with API key
 */
function getElevenLabsClient(): ElevenLabsClient | null {
  if (elevenLabsClient) return elevenLabsClient;
  
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn('[ElevenLabs] ELEVENLABS_API_KEY not set');
    return null;
  }
  
  try {
    elevenLabsClient = new ElevenLabsClient({ apiKey });
    console.log('[ElevenLabs] Client initialized successfully');
    return elevenLabsClient;
  } catch (error) {
    console.error('[ElevenLabs] Failed to initialize client:', error);
    return null;
  }
}

/**
 * Get list of available voice names
 */
export function getAvailableVoices(): string[] {
  return Object.keys(AVAILABLE_VOICES);
}

/**
 * Get voice configuration by name
 */
export function getVoiceConfig(voiceName: string) {
  return AVAILABLE_VOICES[voiceName] || AVAILABLE_VOICES[DEFAULT_ELEVENLABS_VOICE];
}

/**
 * Generate speech audio using ElevenLabs TTS
 * 
 * @param text - Text to convert to speech
 * @param voice - Voice name (defaults to Rachel)
 * @param maxRetries - Number of retry attempts for transient errors
 * @returns TTSResponse with base64-encoded MP3 audio
 */
export async function generateSingleSpeakerAudio(
  text: string, 
  voice: string = DEFAULT_ELEVENLABS_VOICE,
  maxRetries: number = 2
): Promise<TTSResponse> {
  const client = getElevenLabsClient();
  
  if (!client) {
    return {
      success: false,
      error: "ElevenLabs API key not configured. Please set ELEVENLABS_API_KEY environment variable."
    };
  }

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: "Text cannot be empty"
    };
  }

  const voiceConfig = getVoiceConfig(voice);
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[ElevenLabs] Retry attempt ${attempt}/${maxRetries}`);
        await new Promise(r => setTimeout(r, 500 * attempt));
      }

      console.log(`[ElevenLabs] Generating audio with voice: ${voice} (${voiceConfig.voiceId})`);

      // Generate audio using ElevenLabs API
      const audioStream = await client.textToSpeech.convert(voiceConfig.voiceId, {
        text: text,
        model_id: "eleven_turbo_v2_5", // Fast, high-quality model
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      });

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      if (audioBuffer.length === 0) {
        throw new Error("Received empty audio buffer");
      }

      // Convert to base64
      const audioBase64 = audioBuffer.toString('base64');

      // Estimate duration (rough estimate: ~15 characters per second)
      const estimatedDuration = Math.ceil(text.length / 15);

      console.log(`[ElevenLabs] Audio generated successfully (${audioBuffer.length} bytes, ~${estimatedDuration}s)`);
      
      return {
        success: true,
        audioBase64,
        mimeType: "audio/mpeg",
        duration: estimatedDuration
      };

    } catch (error: any) {
      lastError = error;
      const errorStr = error.message || String(error);
      
      // Check for API key issues
      if (errorStr.includes("401") || errorStr.includes("unauthorized") || 
          errorStr.includes("invalid_api_key")) {
        console.error("[ElevenLabs] Authentication error:", errorStr);
        
        const { logLLMError } = await import("../services/llm-error-buffer");
        logLLMError("elevenlabs-tts", "generateSingleSpeakerAudio", error, {
          textLength: text.length,
          voice: voiceConfig.voiceId,
          attempt,
          authIssue: true
        }, {
          model: "eleven_turbo_v2_5"
        });
        
        return {
          success: false,
          error: "ElevenLabs API key is invalid or expired. Please check your ELEVENLABS_API_KEY environment variable."
        };
      }

      // Check for quota/rate limit issues
      if (errorStr.includes("429") || errorStr.includes("quota") || 
          errorStr.includes("rate limit")) {
        console.error("[ElevenLabs] Rate limit or quota exceeded:", errorStr);
        
        const { logLLMError } = await import("../services/llm-error-buffer");
        logLLMError("elevenlabs-tts", "generateSingleSpeakerAudio", error, {
          textLength: text.length,
          voice: voiceConfig.voiceId,
          attempt,
          quotaIssue: true
        }, {
          model: "eleven_turbo_v2_5"
        });
        
        return {
          success: false,
          error: "ElevenLabs API quota exceeded or rate limited. Please check your account limits."
        };
      }
      
      // Check for retryable errors
      const isRetryable = errorStr.includes("500") || 
                         errorStr.includes("503") ||
                         errorStr.includes("504") ||
                         errorStr.includes("INTERNAL") ||
                         errorStr.includes("UNAVAILABLE") ||
                         errorStr.includes("timeout");
      
      if (!isRetryable || attempt === maxRetries) {
        console.error("[ElevenLabs] Generation error:", errorStr);
        
        const { logLLMError } = await import("../services/llm-error-buffer");
        logLLMError("elevenlabs-tts", "generateSingleSpeakerAudio", error, {
          textLength: text.length,
          voice: voiceConfig.voiceId,
          attempt
        }, {
          model: "eleven_turbo_v2_5"
        });
        
        return {
          success: false,
          error: `ElevenLabs TTS generation failed: ${errorStr}`
        };
      }
      
      console.log(`[ElevenLabs] Retryable error: ${errorStr}`);
    }
  }

  return {
    success: false,
    error: `ElevenLabs TTS failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  };
}

/**
 * Multi-speaker wrapper (currently delegates to single speaker)
 * Future enhancement: Could support ElevenLabs' multi-voice features
 */
export async function generateMultiSpeakerAudio(request: {
  speakers: Array<{ text: string; voice?: string }>;
}): Promise<TTSResponse> {
  if (!request.speakers || request.speakers.length === 0) {
    return {
      success: false,
      error: "No speakers provided"
    };
  }

  // For now, concatenate all text and use first speaker's voice
  const combinedText = request.speakers.map(s => s.text).join(" ");
  const firstVoice = request.speakers[0].voice || DEFAULT_ELEVENLABS_VOICE;

  return generateSingleSpeakerAudio(combinedText, firstVoice);
}

/**
 * Test ElevenLabs connection and API key
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  const client = getElevenLabsClient();
  
  if (!client) {
    return {
      success: false,
      error: "ELEVENLABS_API_KEY not configured"
    };
  }

  try {
    // Try to list voices as a connectivity test
    const voices = await client.voices.getAll();
    console.log(`[ElevenLabs] Connection test successful. Found ${voices.voices.length} voices available.`);
    return { success: true };
  } catch (error: any) {
    console.error("[ElevenLabs] Connection test failed:", error.message);
    return {
      success: false,
      error: error.message || "Connection test failed"
    };
  }
}
