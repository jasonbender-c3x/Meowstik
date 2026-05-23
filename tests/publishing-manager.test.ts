import { describe, expect, it } from "vitest";
import {
  buildPublishingChecklist,
  chooseDefaultLaunchScript,
  deriveDeploymentHistoryStatus,
  derivePublishingStatus,
  detectPackageManagerFromFiles,
  getDeploymentActivationBlockedReason,
  parseEnvironmentExampleKeys,
  resolveDeploymentActivationMode,
  type PublishingScriptInfo,
} from "../server/services/publishing-manager";

function launchScripts(names: string[]): PublishingScriptInfo[] {
  return names.map((name) => ({ name, command: `${name} command` }));
}

describe("publishing-manager helpers", () => {
  it("detects the package manager from common lockfiles", () => {
    expect(detectPackageManagerFromFiles(["pnpm-lock.yaml", "package.json"])).toBe("pnpm");
    expect(detectPackageManagerFromFiles(["yarn.lock", "package.json"])).toBe("yarn");
    expect(detectPackageManagerFromFiles(["package-lock.json", "package.json"])).toBe("npm");
    expect(detectPackageManagerFromFiles(["package.json"])).toBe("npm");
  });

  it("parses env example files without comments or invalid keys", () => {
    expect(
      parseEnvironmentExampleKeys(`
# Comment
export API_KEY=secret
NEXT_PUBLIC_URL=https://example.test
bad-key=value
EMPTY = still-counts
`)
    ).toEqual(["API_KEY", "NEXT_PUBLIC_URL", "EMPTY"]);
  });

  it("prefers the requested launch script when it exists", () => {
    expect(chooseDefaultLaunchScript(launchScripts(["dev", "preview"]), "dev")).toBe("dev");
  });

  it("falls back to publishing-oriented launch script order", () => {
    expect(chooseDefaultLaunchScript(launchScripts(["dev", "start", "preview"]), null)).toBe("preview");
    expect(chooseDefaultLaunchScript(launchScripts(["dev", "start"]), null)).toBe("start");
    expect(chooseDefaultLaunchScript(launchScripts(["dev"]), null)).toBe("dev");
  });

  it("marks blocking publishing prerequisites as action required", () => {
    const checklist = buildPublishingChecklist({
      repoAvailability: "ready",
      hasPackageJson: true,
      hasLaunchScript: true,
      missingEnvKeys: ["DATABASE_URL"],
      serviceStatus: "none",
      runtimeRestartNeeded: false,
      gitHasUpstream: true,
      gitIsDirty: false,
      hasLogs: false,
    });

    expect(checklist.find((item) => item.id === "environment")?.status).toBe("action_required");
    expect(checklist.find((item) => item.id === "runtime")?.status).toBe("action_required");
    expect(derivePublishingStatus(checklist)).toEqual({
      state: "blocked",
      headline: "Secrets & environment needs attention",
      nextAction: "Missing required keys: DATABASE_URL",
    });
  });

  it("reports attention when the project is launchable but still needs follow-up", () => {
    const checklist = buildPublishingChecklist({
      repoAvailability: "ready",
      hasPackageJson: true,
      hasLaunchScript: true,
      missingEnvKeys: [],
      serviceStatus: "running",
      runtimeRestartNeeded: true,
      gitHasUpstream: true,
      gitIsDirty: false,
      hasLogs: true,
    });

    expect(checklist.every((item) => item.status !== "action_required")).toBe(true);
    expect(derivePublishingStatus(checklist)).toEqual({
      state: "attention",
      headline: "Secrets & environment needs follow-up",
      nextAction: "Managed runtime variables changed after the linked service started.",
    });
  });

  it("treats matching revisions as re-activation and older ones as rollback", () => {
    expect(resolveDeploymentActivationMode("abc1234", "abc1234")).toBe("reactivate");
    expect(resolveDeploymentActivationMode("abc1234", "def5678")).toBe("rollback");
  });

  it("derives deployment history status from active runtime state", () => {
    expect(deriveDeploymentHistoryStatus(true, "running")).toBe("running");
    expect(deriveDeploymentHistoryStatus(true, "failed")).toBe("failed");
    expect(deriveDeploymentHistoryStatus(false, null)).toBe("inactive");
  });

  it("blocks rollback and re-activation when tracked changes are present", () => {
    expect(
      getDeploymentActivationBlockedReason({
        isActive: false,
        mode: "rollback",
        deploymentRevisionHash: "abc1234",
        stagedCount: 1,
        unstagedCount: 0,
      })
    ).toBe("Rollback requires a clean working tree.");

    expect(
      getDeploymentActivationBlockedReason({
        isActive: false,
        mode: "reactivate",
        deploymentRevisionHash: "abc1234",
        stagedCount: 0,
        unstagedCount: 2,
      })
    ).toBe("Re-activating a deployment requires a clean working tree.");
  });
});
