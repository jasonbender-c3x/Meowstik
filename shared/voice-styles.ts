/**
 * Expressive Voice Style Definitions
 * Maps abstract styles to concrete parameters for different TTS providers
 */

export enum VoiceStyle {
  Neutral = "neutral",
  Cheerful = "cheerful",
  Serious = "serious",
  Excited = "excited",
  Calm = "calm",
  Dramatic = "dramatic",
  Whisper = "whisper",
  News = "news",
  Warm = "warm",
  Professional = "professional",
  Triumphant = "triumphant",
  Empathetic = "empathetic",
  Uncertain = "uncertain",
  Relieved = "relieved"
}

// SSML parameters for Google Cloud TTS
export interface GoogleStyleParams {
  rate?: string;  // e.g. "1.1" or "1.05"
  pitch?: string; // e.g. "+2st"
  volume?: string; // e.g. "loud" or "-2dB"
  emphasis?: "strong" | "moderate" | "reduced" | "none";
}

// ElevenLabs parameters
export interface ElevenLabsStyleParams {
  stability: number;       // 0.0 to 1.0 (lower = more variable/expressive)
  similarity_boost: number; // 0.0 to 1.0
  style: number;           // 0.0 to 1.0 (exaggeration)
  use_speaker_boost?: boolean;
}

// Mapping configuration
export const VOICE_STYLE_MAPPING: Record<VoiceStyle, {
  google: GoogleStyleParams;
  elevenlabs: ElevenLabsStyleParams;
}> = {
  [VoiceStyle.Neutral]: {
    google: { rate: "1.0", pitch: "0st" },
    elevenlabs: { stability: 0.5, similarity_boost: 0.75, style: 0.0 }
  },
  [VoiceStyle.Cheerful]: {
    google: { rate: "1.05", pitch: "+2st" },
    elevenlabs: { stability: 0.4, similarity_boost: 0.75, style: 0.5 }
  },
  [VoiceStyle.Serious]: {
    google: { rate: "0.95", pitch: "-2st" },
    elevenlabs: { stability: 0.8, similarity_boost: 0.75, style: 0.0 }
  },
  [VoiceStyle.Excited]: {
    google: { rate: "1.1", pitch: "+4st" },
    elevenlabs: { stability: 0.3, similarity_boost: 0.8, style: 0.8 }
  },
  [VoiceStyle.Calm]: {
    google: { rate: "0.9", pitch: "-1st" },
    elevenlabs: { stability: 0.7, similarity_boost: 0.75, style: 0.0 }
  },
  [VoiceStyle.Dramatic]: {
    google: { rate: "0.9", pitch: "-2st", volume: "+6.0dB" },
    elevenlabs: { stability: 0.3, similarity_boost: 0.8, style: 1.0 }
  },
  [VoiceStyle.Whisper]: {
    google: { volume: "-6.0dB", rate: "0.9" },
    elevenlabs: { stability: 0.5, similarity_boost: 0.5, style: 0.0 } // Requires Whisper model if available, otherwise just soft
  },
  [VoiceStyle.News]: {
    google: { rate: "1.0", pitch: "0st" },
    elevenlabs: { stability: 0.7, similarity_boost: 0.75, style: 0.2 }
  },
  [VoiceStyle.Warm]: {
    google: { rate: "0.95", pitch: "-1st" },
    elevenlabs: { stability: 0.6, similarity_boost: 0.8, style: 0.2 }
  },
  [VoiceStyle.Professional]: {
    google: { rate: "1.0", pitch: "0st" },
    elevenlabs: { stability: 0.8, similarity_boost: 0.8, style: 0.0 }
  },
  [VoiceStyle.Triumphant]: {
    google: { rate: "1.05", pitch: "+2st", volume: "+6.0dB" },
    elevenlabs: { stability: 0.4, similarity_boost: 0.8, style: 0.7 }
  },
  [VoiceStyle.Empathetic]: {
    google: { rate: "0.9", pitch: "-1st" },
    elevenlabs: { stability: 0.6, similarity_boost: 0.8, style: 0.3 }
  },
  [VoiceStyle.Uncertain]: {
    google: { rate: "0.9", pitch: "+1st" },
    elevenlabs: { stability: 0.4, similarity_boost: 0.6, style: 0.2 }
  },
  [VoiceStyle.Relieved]: {
    google: { rate: "0.9", pitch: "-2st" },
    elevenlabs: { stability: 0.5, similarity_boost: 0.75, style: 0.1 }
  }
};
