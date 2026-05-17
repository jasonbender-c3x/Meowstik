interface MicrophoneErrorContext {
  hasMediaDevices?: boolean;
  isSecureContext?: boolean;
}

export function getMicrophoneErrorMessage(
  error: unknown,
  context: MicrophoneErrorContext = {},
): string {
  if (!context.hasMediaDevices) {
    return context.isSecureContext === false
      ? "Microphone access requires a secure context. Open Meowstik over HTTPS or localhost."
      : "Microphone access is unavailable in this browser.";
  }

  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
      case "SecurityError":
        return "Microphone access denied. Please allow microphone access in your browser settings.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No microphone found. Please connect a microphone.";
      case "NotReadableError":
      case "TrackStartError":
        return "Your microphone is already in use by another app or browser tab.";
      case "AbortError":
        return "Microphone startup was interrupted. Please try again.";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "Your microphone does not support the requested audio settings.";
      case "TypeError":
        return context.isSecureContext === false
          ? "Microphone access requires a secure context. Open Meowstik over HTTPS or localhost."
          : "Microphone access is unavailable in this browser.";
      default:
        break;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Could not start microphone audio.";
}
