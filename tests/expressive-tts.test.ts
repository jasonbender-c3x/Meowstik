import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const VALID_TOKEN_EXPIRY_MS = TOKEN_REFRESH_BUFFER_MS * 2;

const synthesizeMock = vi.fn();
const getAuthenticatedClientMock = vi.fn();
const isAuthenticatedMock = vi.fn();
const getTokensMock = vi.fn();
const forceRefreshTokensMock = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn(),
    },
    texttospeech: vi.fn(() => ({
      text: {
        synthesize: synthesizeMock,
      },
    })),
  },
  Auth: {},
}));

vi.mock("../server/integrations/google-auth.ts", () => ({
  TOKEN_REFRESH_BUFFER_MS,
  getAuthenticatedClient: getAuthenticatedClientMock,
  isAuthenticated: isAuthenticatedMock,
  getTokens: getTokensMock,
  forceRefreshTokens: forceRefreshTokensMock,
}));

describe("expressive-tts OAuth refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    isAuthenticatedMock.mockResolvedValue(true);
    getAuthenticatedClientMock.mockResolvedValue({});
    forceRefreshTokensMock.mockResolvedValue({
      access_token: "fresh-token",
      refresh_token: "refresh-token",
      expiry_date: Date.now() + TOKEN_REFRESH_BUFFER_MS,
    });
    synthesizeMock.mockResolvedValue({
      data: {
        audioContent: "ZmFrZS1hdWRpbw==",
      },
    });
  });

  it("refreshes an expired OAuth token before synthesizing audio", async () => {
    getTokensMock.mockResolvedValue({
      access_token: "expired-token",
      refresh_token: "refresh-token",
      expiry_date: Date.now() - 1_000,
    });

    const { generateSingleSpeakerAudio } = await import("../server/integrations/expressive-tts.ts");
    const result = await generateSingleSpeakerAudio("Hello from Meowstik");

    expect(forceRefreshTokensMock).toHaveBeenCalledTimes(1);
    expect(forceRefreshTokensMock.mock.invocationCallOrder[0]).toBeLessThan(
      getAuthenticatedClientMock.mock.invocationCallOrder[0]
    );
    expect(synthesizeMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      audioBase64: "ZmFrZS1hdWRpbw==",
      mimeType: "audio/mpeg",
    });
  });

  it("forces an OAuth refresh and retries when Google returns an auth error", async () => {
    getTokensMock.mockResolvedValue({
      access_token: "current-token",
      refresh_token: "refresh-token",
      expiry_date: Date.now() + VALID_TOKEN_EXPIRY_MS,
    });

    synthesizeMock
      .mockRejectedValueOnce(new Error("401 UNAUTHENTICATED"))
      .mockResolvedValueOnce({
        data: {
          audioContent: "cmV0cnktc3VjY2Vzcw==",
        },
      });

    const { generateSingleSpeakerAudio } = await import("../server/integrations/expressive-tts.ts");
    const result = await generateSingleSpeakerAudio("Retry after refresh", undefined, 1);

    expect(forceRefreshTokensMock).toHaveBeenCalledTimes(1);
    expect(synthesizeMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      success: true,
      audioBase64: "cmV0cnktc3VjY2Vzcw==",
    });
  });
});
