import { afterEach, describe, expect, it } from "vitest";
import {
  getMissingScopes,
  getOAuthClientMode,
  hasConfiguredOAuthClientCredentials,
  hasFullScopes,
  SCOPES,
  setTokens,
} from "../server/integrations/google-auth";

const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

afterEach(() => {
  process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
  setTokens({});
});

describe("Google scope validation", () => {
  it("reports missing Drive scope when token is partial", () => {
    setTokens({
      access_token: "token",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/tasks",
      ].join(" "),
    });

    const missingScopes = getMissingScopes();
    expect(missingScopes).toContain("https://www.googleapis.com/auth/drive.readonly");
    expect(hasFullScopes()).toBe(false);
  });

  it("treats the token as full only when every required scope is present", () => {
    setTokens({
      access_token: "token",
      scope: SCOPES.join(" "),
    });

    expect(getMissingScopes()).toEqual([]);
    expect(hasFullScopes()).toBe(true);
  });

  it("uses degraded OAuth mode when stored tokens exist but env credentials are missing", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    setTokens({
      access_token: "token",
      scope: SCOPES.join(" "),
    });

    expect(hasConfiguredOAuthClientCredentials()).toBe(false);
    expect(getOAuthClientMode()).toBe("degraded");
  });
});
