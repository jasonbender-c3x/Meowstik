import { beforeEach, describe, expect, it } from "vitest";

import {
  getCurrentFamilyMember,
  getFamilyContext,
  recognizeFamilyMember,
  resetFamilyMember,
} from "../server/services/family-recognition";

describe("family recognition", () => {
  beforeEach(() => {
    resetFamilyMember();
  });

  it("starts neutral with no recognized family member", () => {
    expect(getCurrentFamilyMember()).toBeNull();
    expect(getFamilyContext()).toBe("");
  });

  it("recognizes a family catch phrase and adds personalization context", () => {
    const member = recognizeFamilyMember("Hey, sunshine girl checking in.");

    expect(member?.name).toBe("Amy");
    expect(getCurrentFamilyMember()?.name).toBe("Amy");
    expect(getFamilyContext()).toContain("Name: Amy");
  });

  it("resets back to neutral after recognition", () => {
    recognizeFamilyMember("player one reporting in");
    resetFamilyMember();

    expect(getCurrentFamilyMember()).toBeNull();
    expect(getFamilyContext()).toBe("");
  });
});
