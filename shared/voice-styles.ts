/**
 * Expressive Voice Style Definitions
 * Maps abstract styles to concrete Google TTS parameters
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

// Mapping configuration
export const VOICE_STYLE_MAPPING: Record<VoiceStyle, GoogleStyleParams> = {
  [VoiceStyle.Neutral]: {
    rate: "1.0", pitch: "0st"
  },
  [VoiceStyle.Cheerful]: {
    rate: "1.05", pitch: "+2st"
  },
  [VoiceStyle.Serious]: {
    rate: "0.95", pitch: "-2st"
  },
  [VoiceStyle.Excited]: {
    rate: "1.1", pitch: "+4st"
  },
  [VoiceStyle.Calm]: {
    rate: "0.9", pitch: "-1st"
  },
  [VoiceStyle.Dramatic]: {
    rate: "0.9", pitch: "-2st", volume: "+6.0dB"
  },
  [VoiceStyle.Whisper]: {
    volume: "-6.0dB", rate: "0.9"
  },
  [VoiceStyle.News]: {
    rate: "1.0", pitch: "0st"
  },
  [VoiceStyle.Warm]: {
    rate: "0.95", pitch: "-1st"
  },
  [VoiceStyle.Professional]: {
    rate: "1.0", pitch: "0st"
  },
  [VoiceStyle.Triumphant]: {
    rate: "1.05", pitch: "+2st", volume: "+6.0dB"
  },
  [VoiceStyle.Empathetic]: {
    rate: "0.9", pitch: "-1st"
  },
  [VoiceStyle.Uncertain]: {
    rate: "0.9", pitch: "+1st"
  },
  [VoiceStyle.Relieved]: {
    rate: "0.9", pitch: "-2st"
  }
};
