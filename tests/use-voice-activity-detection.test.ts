import { describe, expect, it, vi } from "vitest";

import { normalizeVoiceActivityDetectionArgs } from "../client/src/hooks/use-voice-activity-detection";

describe("normalizeVoiceActivityDetectionArgs", () => {
  it("keeps a real volume callback and separate config", () => {
    const onVolumeChange = vi.fn();
    const normalized = normalizeVoiceActivityDetectionArgs(onVolumeChange, { threshold: 0.02 });

    expect(normalized.onVolumeChange).toBe(onVolumeChange);
    expect(normalized.initialConfig).toEqual({ threshold: 0.02 });
  });

  it("treats a misplaced third-argument config object as VAD config", () => {
    const normalized = normalizeVoiceActivityDetectionArgs({
      threshold: 0.02,
      silenceDuration: 500,
    });

    expect(normalized.onVolumeChange).toBeUndefined();
    expect(normalized.initialConfig).toEqual({
      threshold: 0.02,
      silenceDuration: 500,
    });
  });
});
