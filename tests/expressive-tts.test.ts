import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getAuthenticatedClient: vi.fn(),
  getOAuthClientMode: vi.fn(),
  isAuthenticated: vi.fn(),
}));

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
}));

const googleMocks = vi.hoisted(() => ({
  googleAuthGetClient: vi.fn(),
  synthesize: vi.fn(),
}));

vi.mock("fs", () => fsMocks);
vi.mock("../server/integrations/google-auth", () => authMocks);
vi.mock("googleapis", () => {
  class MockGoogleAuth {
    constructor(_options?: unknown) {}

    getClient() {
      return googleMocks.googleAuthGetClient();
    }
  }

  class MockOAuth2 {
    setCredentials(_credentials: unknown) {}
  }

  return {
    google: {
      auth: {
        GoogleAuth: MockGoogleAuth,
        OAuth2: MockOAuth2,
      },
      texttospeech: () => ({
        text: {
          synthesize: googleMocks.synthesize,
        },
      }),
    },
  };
});

async function loadGenerateSingleSpeakerAudio() {
  const module = await import("../server/integrations/expressive-tts");
  return module.generateSingleSpeakerAudio;
}

beforeEach(() => {
  authMocks.getAuthenticatedClient.mockReset();
  authMocks.getOAuthClientMode.mockReset();
  authMocks.isAuthenticated.mockReset();
  fsMocks.existsSync.mockReset();
  fsMocks.readFileSync.mockReset();
  googleMocks.googleAuthGetClient.mockReset();
  googleMocks.synthesize.mockReset();

  fsMocks.existsSync.mockReturnValue(false);
  authMocks.getOAuthClientMode.mockReturnValue("unavailable");
  authMocks.isAuthenticated.mockResolvedValue(false);
});

afterEach(() => {
  vi.resetModules();
});

describe("generateSingleSpeakerAudio", () => {
  it("fails fast when only degraded OAuth is available and ADC is unavailable", async () => {
    authMocks.isAuthenticated.mockResolvedValue(true);
    authMocks.getOAuthClientMode.mockReturnValue("degraded");
    googleMocks.googleAuthGetClient.mockRejectedValue(new Error("ADC missing"));

    const generateSingleSpeakerAudio = await loadGenerateSingleSpeakerAudio();
    const result = await generateSingleSpeakerAudio("hello world");

    expect(result).toEqual({
      success: false,
      error:
        "HD TTS is unavailable because stored Google app tokens alone are not enough for Cloud TTS when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing. Restore those OAuth client credentials, configure a service account, or run `gcloud auth application-default login`.",
    });
    expect(authMocks.getAuthenticatedClient).not.toHaveBeenCalled();
  });

  it("uses Application Default Credentials when available", async () => {
    const adcClient = { kind: "adc-client" };
    googleMocks.googleAuthGetClient.mockResolvedValue(adcClient);
    googleMocks.synthesize.mockResolvedValue({
      data: {
        audioContent: "ZmFrZS1hdWRpbw==",
      },
    });

    const generateSingleSpeakerAudio = await loadGenerateSingleSpeakerAudio();
    const result = await generateSingleSpeakerAudio("hello world");

    expect(result).toEqual({
      success: true,
      audioBase64: "ZmFrZS1hdWRpbw==",
      mimeType: "audio/mpeg",
      duration: 1,
    });
    expect(authMocks.getAuthenticatedClient).not.toHaveBeenCalled();
    expect(googleMocks.synthesize).toHaveBeenCalledTimes(1);
  });
});
