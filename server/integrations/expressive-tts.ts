
/**
 * =============================================================================
 * GOOGLE CLOUD TEXT-TO-SPEECH INTEGRATION
 * =============================================================================
 * 
 * High-quality TTS using Google Cloud Text-to-Speech API.
 * Free tier: 1M characters/month (vs Gemini TTS's 100/day limit)
 * 
 * Supports two authentication methods:
 * 1. Service Account (preferred): Set GOOGLE_APPLICATION_CREDENTIALS env var
 * 2. OAuth2: Falls back to user OAuth tokens if no service account
 * 
 * @see https://cloud.google.com/text-to-speech/docs
 */

import { google, Auth } from "googleapis";
import { getAuthenticatedClient, getOAuthClientMode, isAuthenticated } from "./google-auth";
import * as fs from "fs";
import * as path from "path";
import { VoiceStyle, VOICE_STYLE_MAPPING } from "../../shared/voice-styles.js";
import { parseVoiceStyle } from "../services/style-parser.js";

export interface TTSResponse {
  success: boolean;
  audioBase64?: string;
  mimeType?: string;
  duration?: number;
  error?: string;
}

/**
 * Default voice for TTS - change this single constant to update the default everywhere.
 * Use alternate voices (e.g., "Puck", "Charon") for alerts or emphasis.
 */
export const DEFAULT_TTS_VOICE = "Kore";
const CLOUD_TTS_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

// Chirp 3 HD voices — Google's highest quality neural voices (2025)
// Do not support SSML prosody; style is conveyed via natural language in the text.
const AVAILABLE_VOICES: Record<string, { languageCode: string; name: string; note: string }> = {
  "Kore":    { languageCode: "en-US", name: "en-US-Chirp3-HD-Kore",    note: "Female · American · Natural" },
  "Puck":    { languageCode: "en-US", name: "en-US-Chirp3-HD-Puck",    note: "Male · American · Upbeat" },
  "Charon":  { languageCode: "en-US", name: "en-US-Chirp3-HD-Charon",  note: "Male · American · Informative" },
  "Fenrir":  { languageCode: "en-US", name: "en-US-Chirp3-HD-Fenrir",  note: "Male · American · Excitable" },
  "Aoede":   { languageCode: "en-US", name: "en-US-Chirp3-HD-Aoede",   note: "Female · American · Breezy" },
  "Leda":    { languageCode: "en-US", name: "en-US-Chirp3-HD-Leda",    note: "Female · American · Youthful" },
  "Orus":    { languageCode: "en-US", name: "en-US-Chirp3-HD-Orus",    note: "Male · American · Firm" },
  "Zephyr":  { languageCode: "en-US", name: "en-US-Chirp3-HD-Zephyr",  note: "Female · American · Bright" },
  "Schedar": { languageCode: "en-US", name: "en-US-Chirp3-HD-Schedar", note: "Female · American · Even" },
  "Sulafat": { languageCode: "en-US", name: "en-US-Chirp3-HD-Sulafat", note: "Female · American · Warm" },
};

let serviceAccountAuth: Auth.GoogleAuth | null = null;
let applicationDefaultAuthProbeComplete = false;

async function getApplicationDefaultAuth(): Promise<Auth.GoogleAuth | null> {
  if (serviceAccountAuth) return serviceAccountAuth;
  if (applicationDefaultAuthProbeComplete) return null;

  applicationDefaultAuthProbeComplete = true;

  try {
    const auth = new google.auth.GoogleAuth({
      scopes: CLOUD_TTS_SCOPES,
    });

    await auth.getClient();
    serviceAccountAuth = auth;
    console.log("[TTS] Loaded Google Cloud credentials from Application Default Credentials");
    return serviceAccountAuth;
  } catch (error) {
    console.warn("[TTS] Application Default Credentials not available for Google Cloud TTS");
    console.warn("[TTS] Run `gcloud auth application-default login` or configure a service account");
    return null;
  }
}

async function getServiceAccountAuth(): Promise<Auth.GoogleAuth | null> {
  if (serviceAccountAuth) return serviceAccountAuth;
  
  // Method 1: Check for GOOGLE_SERVICE_ACCOUNT_JSON secret (JSON content directly)
  const jsonSecret = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || (fs.existsSync("google-credentials.json") ? fs.readFileSync("google-credentials.json", "utf8") : null);
  if (jsonSecret) {
    try {
      const credentials = JSON.parse(jsonSecret);
      serviceAccountAuth = new google.auth.GoogleAuth({
        credentials,
        scopes: CLOUD_TTS_SCOPES,
      });
      console.log('[TTS] Loaded service account from GOOGLE_SERVICE_ACCOUNT_JSON secret');
      console.log(`[TTS] Service Account: ${credentials.client_email}`);
      console.log(`[TTS] Project: ${credentials.project_id}`);
      return serviceAccountAuth;
    } catch (error) {
      console.error('[TTS] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', error);
    }
  }
  
  // Method 2: Check for GOOGLE_APPLICATION_CREDENTIALS file path
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || (fs.existsSync("google-credentials.json") ? "google-credentials.json" : null);
  if (!credentialsPath) {
    const defaultAuth = await getApplicationDefaultAuth();
    if (defaultAuth) {
      return defaultAuth;
    }

    console.warn('[TTS] No Google Cloud credentials configured for TTS');
    console.warn('[TTS] Set GOOGLE_SERVICE_ACCOUNT_JSON, set GOOGLE_APPLICATION_CREDENTIALS, or run `gcloud auth application-default login`');
    return null;
  }
  
  const resolvedPath = path.resolve(credentialsPath);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(`[TTS] Service account file not found: ${resolvedPath}`);
    return await getApplicationDefaultAuth();
  }
  
  try {
    const credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    serviceAccountAuth = new google.auth.GoogleAuth({
      keyFile: resolvedPath,
      scopes: CLOUD_TTS_SCOPES,
    });
    console.log('[TTS] Loaded Google Cloud credentials from file');
    if (credentials.client_email) {
      console.log(`[TTS] Service Account: ${credentials.client_email}`);
    }
    if (credentials.project_id) {
      console.log(`[TTS] Project: ${credentials.project_id}`);
    }
    return serviceAccountAuth;
  } catch (error) {
    console.error('[TTS] Failed to load service account from file:', error);
  }

  return await getApplicationDefaultAuth();
}

export function getAvailableVoices(): string[] {
  return Object.keys(AVAILABLE_VOICES);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Convert semitone notation (+2st) to percentage (+12%) for SSML prosody pitch
function semitoneToPercent(pitchStr: string): string {
  const m = pitchStr.match(/^([+-]?\d+(?:\.\d+)?)st$/i);
  if (!m) return pitchStr;
  const pct = Math.round((Math.pow(2, parseFloat(m[1]) / 12) - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function buildSSML(cleanText: string, style: VoiceStyle, voiceName?: string): string {
  // Journey and Chirp3 voices do not support SSML prosody (pitch/rate) — they use neural
  // conversational models that reject those tags with "invalid argument".
  const isUnsupportedSSML = voiceName?.includes("Journey") || voiceName?.includes("Chirp3");
  if (isUnsupportedSSML) return `<speak>${escapeXml(cleanText)}</speak>`;

  const p = VOICE_STYLE_MAPPING[style] ?? VOICE_STYLE_MAPPING[VoiceStyle.Neutral];
  const attrs: string[] = [];
  if (p.rate && p.rate !== "1.0") attrs.push(`rate="${p.rate}"`);
  if (p.pitch && p.pitch !== "0st") attrs.push(`pitch="${semitoneToPercent(p.pitch)}"`);
  if (p.volume) attrs.push(`volume="${p.volume.replace(".0", "")}"`); // "+6.0dB" → "+6dB"
  if (attrs.length === 0) return `<speak>${escapeXml(cleanText)}</speak>`;
  return `<speak><prosody ${attrs.join(' ')}>${escapeXml(cleanText)}</prosody></speak>`;
}

export async function generateSingleSpeakerAudio(
  text: string, 
  voice: string = DEFAULT_TTS_VOICE,
  maxRetries: number = 2
): Promise<TTSResponse> {
  const serviceAuth = await getServiceAccountAuth();
  const hasOAuth = await isAuthenticated();
  const oauthClientMode = getOAuthClientMode();
  
  if (!serviceAuth && !hasOAuth) {
    return {
      success: false,
      error:
        "Google Cloud TTS authentication not available. Configure GOOGLE_SERVICE_ACCOUNT_JSON, set GOOGLE_APPLICATION_CREDENTIALS, or run `gcloud auth application-default login`.",
    };
  }

  if (!serviceAuth && oauthClientMode === "degraded") {
    return {
      success: false,
      error:
        "HD TTS is unavailable because stored Google app tokens alone are not enough for Cloud TTS when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing. Restore those OAuth client credentials, configure a service account, or run `gcloud auth application-default login`.",
    };
  }

  const voiceConfig = AVAILABLE_VOICES[voice] || AVAILABLE_VOICES[DEFAULT_TTS_VOICE];
  const authMethod = serviceAuth ? "service account" : "OAuth";
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[TTS] Retry attempt ${attempt}/${maxRetries}`);
        await new Promise(r => setTimeout(r, 500 * attempt));
      }

      const auth = serviceAuth || await getAuthenticatedClient();
      const tts = google.texttospeech({ version: "v1beta1", auth: auth as any });
      
      const { style, cleanText } = parseVoiceStyle(text);

      // Chirp3-HD and Journey voices: plain text only — no SSML, no effectsProfileId
      const isLimitedVoice = voiceConfig.name.includes("Chirp3") || voiceConfig.name.includes("Journey");

      console.log(`[TTS] Generating audio — voice: ${voiceConfig.name}, style: ${style}`);

      const requestBody: any = {
        input: isLimitedVoice ? { text: cleanText } : { ssml: buildSSML(cleanText, style) },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.name,
        },
        audioConfig: {
          audioEncoding: "MP3",
          ...(isLimitedVoice ? {} : { effectsProfileId: ["headphone-class-device"] }),
        }
      };

      const response = await tts.text.synthesize({
        requestBody
      });

      const audioContent = response.data.audioContent;
      
      if (audioContent) {
        console.log("[TTS] Audio generated successfully");
        return {
          success: true,
          audioBase64: typeof audioContent === 'string' ? audioContent : Buffer.from(audioContent).toString('base64'),
          mimeType: "audio/mpeg",
          duration: Math.ceil(text.length / 15)
        };
      }

      return {
        success: false,
        error: "No audio data in response"
      };

    } catch (error: any) {
      lastError = error;
      const errorStr = error.message || String(error);
      
      if (errorStr.includes("403") || errorStr.includes("PERMISSION_DENIED") || 
          errorStr.includes("insufficient") || errorStr.includes("scope") ||
          errorStr.includes("Insufficient Permission")) {
        console.error("[TTS] Permission denied:", errorStr);
        console.error("[TTS] This usually means the service account lacks the required IAM role");
        console.error("[TTS] Required: roles/texttospeech.user (Cloud Text-to-Speech User)");
        console.error("[TTS] See: https://console.cloud.google.com/iam-admin/iam");
        
        const { logLLMError } = await import("../services/llm-error-buffer");
        logLLMError("tts", "generateSingleSpeakerAudio", error, {
          textLength: text.length,
          voice: voiceConfig.name,
          attempt,
          scopeIssue: true,
          authMethod
        }, {
          model: "google-cloud-tts-journey"
        });
        
        return {
          success: false,
          error: authMethod === "service account" 
            ? "TTS service account lacks required IAM permissions. The service account needs the 'Cloud Text-to-Speech User' role (roles/texttospeech.user) in Google Cloud IAM. Please contact your administrator."
            : "TTS requires Cloud Platform permissions. Please re-authorize your Google account to enable text-to-speech."
        };
      }
      
      const isRetryable = errorStr.includes("500") || 
                         errorStr.includes("INTERNAL") || 
                         errorStr.includes("503") ||
                         errorStr.includes("UNAVAILABLE") ||
                         errorStr.includes("429");
      
      if (!isRetryable || attempt === maxRetries) {
        console.error("[TTS] Generation error:", errorStr);
        
        const { logLLMError } = await import("../services/llm-error-buffer");
        logLLMError("tts", "generateSingleSpeakerAudio", error, {
          textLength: text.length,
          voice: voiceConfig.name,
          attempt
        }, {
          model: "google-cloud-tts-journey"
        });
        
        return {
          success: false,
          error: `TTS generation failed: ${errorStr}`
        };
      }
      
      console.warn(`[TTS] Transient error, will retry: ${errorStr}`);
    }
  }

  return {
    success: false,
    error: `TTS generation failed after ${maxRetries + 1} attempts: ${lastError?.message}`
  };
}

export async function generateMultiSpeakerAudio(request: { text: string; speakers: Array<{ voice?: string }>; model?: string }): Promise<TTSResponse> {
  const voice = request.speakers[0]?.voice || DEFAULT_TTS_VOICE;
  return generateSingleSpeakerAudio(request.text, voice);
}
