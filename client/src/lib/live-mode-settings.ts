export interface LiveModeSettings {
  ttsVoice: string;
  liveModeContinuousListening: boolean;
  liveModeSTTEnabled: boolean;
  liveModeVADSensitivity: number;
  liveModeVadSilenceDurationMs: number;
  liveModeVadSpeechDurationMs: number;
}

export const defaultLiveModeSettings: LiveModeSettings = {
  ttsVoice: "Kore",
  liveModeContinuousListening: true,
  liveModeSTTEnabled: true,
  liveModeVADSensitivity: 0.015,
  liveModeVadSilenceDurationMs: 800,
  liveModeVadSpeechDurationMs: 200,
};

export function getLiveModeSettings(): LiveModeSettings {
  if (typeof window === "undefined") {
    return defaultLiveModeSettings;
  }

  const rawSettings = localStorage.getItem("meowstic-settings");
  if (!rawSettings) {
    return defaultLiveModeSettings;
  }

  try {
    const parsedSettings = JSON.parse(rawSettings) as Partial<LiveModeSettings>;
    return {
      ...defaultLiveModeSettings,
      ...parsedSettings,
      ttsVoice: typeof parsedSettings.ttsVoice === "string" ? parsedSettings.ttsVoice : defaultLiveModeSettings.ttsVoice,
      liveModeContinuousListening:
        typeof parsedSettings.liveModeContinuousListening === "boolean"
          ? parsedSettings.liveModeContinuousListening
          : defaultLiveModeSettings.liveModeContinuousListening,
      liveModeSTTEnabled:
        typeof parsedSettings.liveModeSTTEnabled === "boolean"
          ? parsedSettings.liveModeSTTEnabled
          : defaultLiveModeSettings.liveModeSTTEnabled,
      liveModeVADSensitivity:
        typeof parsedSettings.liveModeVADSensitivity === "number"
          ? parsedSettings.liveModeVADSensitivity
          : defaultLiveModeSettings.liveModeVADSensitivity,
      liveModeVadSilenceDurationMs:
        typeof parsedSettings.liveModeVadSilenceDurationMs === "number"
          ? parsedSettings.liveModeVadSilenceDurationMs
          : defaultLiveModeSettings.liveModeVadSilenceDurationMs,
      liveModeVadSpeechDurationMs:
        typeof parsedSettings.liveModeVadSpeechDurationMs === "number"
          ? parsedSettings.liveModeVadSpeechDurationMs
          : defaultLiveModeSettings.liveModeVadSpeechDurationMs,
    };
  } catch (error) {
    console.error("[LiveModeSettings] Failed to parse meowstic-settings:", error);
    return defaultLiveModeSettings;
  }
}
