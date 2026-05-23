import { describe, expect, it } from "vitest";
import { Modality } from "@google/genai";

import {
  buildLiveSessionRequestConfig,
  getLiveCloseErrorMessage,
  isRetryableLiveClose,
} from "../server/integrations/gemini-live";

describe("buildLiveSessionRequestConfig", () => {
  it("uses audio-only native live responses and wraps system instructions as content", () => {
    const config = buildLiveSessionRequestConfig({
      voiceName: "Kore",
      systemInstruction: "You are helpful.",
    });

    expect(config.responseModalities).toEqual([Modality.AUDIO]);
    expect(config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Kore");
    expect(config.systemInstruction).toEqual({
      parts: [{ text: "You are helpful." }],
    });
  });

  it("does not add video as a response modality for video streaming sessions", () => {
    const config = buildLiveSessionRequestConfig({
      enableVideoStreaming: true,
      useGemini3: true,
    });

    expect(config.responseModalities).toEqual([Modality.AUDIO]);
  });

  it("keeps computer-use instructions in the content payload shape", () => {
    const config = buildLiveSessionRequestConfig({
      enableComputerUse: true,
      systemInstruction: "You are helpful.",
    });

    expect(config.systemInstruction.parts[0].text).toContain("You are helpful.");
    expect(config.systemInstruction.parts[0].text).toContain("computer_click");
  });
});

describe("live close classification", () => {
  it("marks service-unavailable closes as retryable", () => {
    const closeInfo = {
      code: 1011,
      reason: "The service is currently unavailable.",
    };

    expect(isRetryableLiveClose(closeInfo)).toBe(true);
    expect(getLiveCloseErrorMessage(closeInfo)).toBe(
      "Live session closed: The service is currently unavailable.",
    );
  });

  it("treats clean closes as non-errors", () => {
    expect(isRetryableLiveClose({ code: 1000 })).toBe(false);
    expect(getLiveCloseErrorMessage({ code: 1000 })).toBeUndefined();
  });
});
