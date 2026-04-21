import { describe, expect, it } from "vitest";
import { getMissingScopes, hasFullScopes, setTokens, SCOPES } from "../server/integrations/google-auth";

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
});
