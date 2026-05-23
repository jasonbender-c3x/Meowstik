import { describe, expect, it } from "vitest";
import {
  buildEnvironmentVariableSnapshot,
  getStaleRuntimeServiceIds,
  isServerRestartNeeded,
  isValidEnvironmentKey,
  maskEnvironmentValue,
  serializeEnvironmentOverrides,
  type ManagedEnvironmentVariable,
} from "../server/services/environment-manager";

function managedVariable(overrides: Partial<ManagedEnvironmentVariable> = {}): ManagedEnvironmentVariable {
  return {
    key: "GEMINI_API_KEY",
    value: "secret-value",
    scope: "all",
    description: "Primary model key",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("environment-manager helpers", () => {
  it("validates safe environment variable keys", () => {
    expect(isValidEnvironmentKey("GEMINI_API_KEY")).toBe(true);
    expect(isValidEnvironmentKey("bad-key")).toBe(false);
    expect(isValidEnvironmentKey("BAD=KEY")).toBe(false);
    expect(isValidEnvironmentKey("1BAD_KEY")).toBe(false);
  });

  it("masks values without revealing their contents", () => {
    expect(maskEnvironmentValue("abcd")).toBe("[set · 4 chars]");
    expect(maskEnvironmentValue("")).toBe("[empty]");
  });

  it("serializes managed overrides as quoted env lines", () => {
    const serialized = serializeEnvironmentOverrides([
      managedVariable({
        key: "ALPHA",
        value: 'line one\nline "two" #hash\\end',
        scope: "all",
      }),
      managedVariable({
        key: "BETA",
        value: "runtime-only",
        scope: "runtime",
      }),
    ]);

    expect(serialized).toContain('ALPHA="line one\\nline \\"two\\" #hash\\\\end"');
    expect(serialized).not.toContain("BETA=");
  });

  it("detects when the current process needs a restart for server-scoped changes", () => {
    expect(isServerRestartNeeded("2026-01-02T00:00:00.000Z", new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(isServerRestartNeeded("2025-12-31T23:59:59.000Z", new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("finds stale runtime services when env changed after they started", () => {
    expect(
      getStaleRuntimeServiceIds("2026-01-03T00:00:00.000Z", [
        { id: "old-service", status: "running", startedAt: "2026-01-02T00:00:00.000Z" },
        { id: "fresh-service", status: "running", startedAt: "2026-01-04T00:00:00.000Z" },
        { id: "stopped-service", status: "stopped", startedAt: "2026-01-01T00:00:00.000Z" },
      ])
    ).toEqual(["old-service"]);
  });

  it("marks managed variables as pending restart when server or runtime drift exists", () => {
    const snapshot = buildEnvironmentVariableSnapshot({
      definition: managedVariable({
        scope: "all",
        updatedAt: "2026-01-03T00:00:00.000Z",
      }),
      liveValue: "old-live-value",
      processStartedAt: new Date("2026-01-02T00:00:00.000Z"),
      lastServerChangeAt: "2026-01-03T00:00:00.000Z",
      staleRuntimeServiceIds: ["runtime-service"],
    });

    expect(snapshot.status).toBe("pending_restart");
    expect(snapshot.source).toBe("managed+environment");
    expect(snapshot.serverRestartNeeded).toBe(true);
    expect(snapshot.runtimeRestartNeeded).toBe(true);
  });
});
