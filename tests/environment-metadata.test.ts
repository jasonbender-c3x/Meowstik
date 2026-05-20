import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getCurrentTimestamp,
  formatEnvironmentMetadata,
} from "../server/utils/environment-metadata";

describe("getCurrentTimestamp", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    const { date } = getCurrentTimestamp();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a time string in HH:MM:SS format", () => {
    const { time } = getCurrentTimestamp();
    expect(time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("returns a non-empty IANA timezone string", () => {
    const { timezone } = getCurrentTimestamp();
    expect(typeof timezone).toBe("string");
    expect(timezone.length).toBeGreaterThan(0);
  });

  it("returns an ISO 8601 UTC timestamp", () => {
    const { iso } = getCurrentTimestamp();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("returns a fresh timestamp on each call", () => {
    // Fake timers so we can advance time between calls
    vi.useFakeTimers();
    const t1 = getCurrentTimestamp().iso;
    vi.advanceTimersByTime(2000);
    const t2 = getCurrentTimestamp().iso;
    expect(t1).not.toBe(t2);
    vi.useRealTimers();
  });
});

describe("formatEnvironmentMetadata", () => {
  it("includes Current Date, Current Time, and Timezone fields", () => {
    const output = formatEnvironmentMetadata();
    expect(output).toContain("**Current Date**:");
    expect(output).toContain("**Current Time**:");
    expect(output).toContain("**Timezone**:");
  });

  it("includes a date value in YYYY-MM-DD format", () => {
    const output = formatEnvironmentMetadata();
    expect(output).toMatch(/\*\*Current Date\*\*: `\d{4}-\d{2}-\d{2}`/);
  });

  it("includes a time value in HH:MM:SS format", () => {
    const output = formatEnvironmentMetadata();
    expect(output).toMatch(/\*\*Current Time\*\*: `\d{2}:\d{2}:\d{2}`/);
  });

  it("still includes existing Environment and Server Hostname fields", () => {
    const output = formatEnvironmentMetadata();
    expect(output).toContain("**Environment**:");
    expect(output).toContain("**Server Hostname**:");
  });

  it("uses the real current date (not a stale cached value)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-15T08:00:00.000Z"));
    const output = formatEnvironmentMetadata();
    vi.useRealTimers();
    // The date should reflect January 2030 in whatever timezone the system uses
    expect(output).toMatch(/2030/);
  });
});
