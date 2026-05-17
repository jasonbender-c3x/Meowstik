import { describe, expect, it } from "vitest";

import { getMicrophoneErrorMessage } from "../client/src/lib/microphone-errors";

describe("getMicrophoneErrorMessage", () => {
  it("maps denied microphone errors to a browser-permission message", () => {
    expect(
      getMicrophoneErrorMessage(new DOMException("Permission denied", "NotAllowedError"), {
        hasMediaDevices: true,
        isSecureContext: true,
      }),
    ).toBe("Microphone access denied. Please allow microphone access in your browser settings.");
  });

  it("maps missing media devices on insecure contexts to a secure-context message", () => {
    expect(
      getMicrophoneErrorMessage(null, {
        hasMediaDevices: false,
        isSecureContext: false,
      }),
    ).toBe("Microphone access requires a secure context. Open Meowstik over HTTPS or localhost.");
  });

  it("maps busy microphones to a device-in-use message", () => {
    expect(
      getMicrophoneErrorMessage(new DOMException("Device busy", "NotReadableError"), {
        hasMediaDevices: true,
        isSecureContext: true,
      }),
    ).toBe("Your microphone is already in use by another app or browser tab.");
  });
});
