import { afterEach, describe, expect, it } from "vitest";
import * as os from "os";
import * as path from "path";
import { promises as fs } from "fs";
import {
  createLogsSourceId,
  parseLogsSourceId,
  resolveManagedLogPath,
} from "../server/services/log-manager";
import type { RuntimeServiceSnapshot } from "../server/services/runtime-manager";

const tempPaths: string[] = [];

function buildService(cwd: string): RuntimeServiceSnapshot {
  return {
    id: "service-1",
    name: "Test Service",
    command: "pnpm dev",
    cwd,
    port: 3000,
    healthCheckPath: null,
    healthCheckUrl: null,
    logPaths: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "running",
    pid: 123,
    portStatus: "open",
    healthStatus: "healthy",
    recentOutput: [],
  };
}

async function createTempDir(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempPaths.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((target) => fs.rm(target, { recursive: true, force: true })));
});

describe("log-manager helpers", () => {
  it("round-trips opaque runtime and io source ids", () => {
    const runtimeSourceId = createLogsSourceId({ kind: "runtime-file", serviceId: "web-ui", index: 2 });
    expect(parseLogsSourceId(runtimeSourceId)).toEqual({ kind: "runtime-file", serviceId: "web-ui", index: 2 });

    const ioSourceId = createLogsSourceId({ kind: "io-output", filename: "output-123-test.md" });
    expect(parseLogsSourceId(ioSourceId)).toEqual({ kind: "io-output", filename: "output-123-test.md" });
  });

  it("allows configured log files that stay inside the service root", async () => {
    const root = await createTempDir("meowstik-log-root-");
    const logFile = path.join(root, "logs", "app.log");
    await fs.mkdir(path.dirname(logFile), { recursive: true });
    await fs.writeFile(logFile, "hello\n");

    const result = await resolveManagedLogPath(buildService(root), "logs/app.log");

    expect(result.status).toBe("ready");
    expect(result.resolvedPath).toBe(logFile);
  });

  it("marks missing in-root files as pending instead of failing", async () => {
    const root = await createTempDir("meowstik-log-root-");
    await fs.mkdir(path.join(root, "logs"), { recursive: true });

    const result = await resolveManagedLogPath(buildService(root), "logs/missing.log");

    expect(result.status).toBe("pending");
    expect(result.error).toContain("not been created");
  });

  it("rejects traversal outside the service root", async () => {
    const root = await createTempDir("meowstik-log-root-");
    const outside = await createTempDir("meowstik-log-outside-");
    const outsideLog = path.join(outside, "outside.log");
    await fs.writeFile(outsideLog, "secret\n");

    const result = await resolveManagedLogPath(buildService(root), `../${path.basename(outside)}/outside.log`);

    expect(result.status).toBe("error");
    expect(result.error).toContain("inside the service directory");
  });

  it("rejects symlinked log files that escape the service root", async () => {
    const root = await createTempDir("meowstik-log-root-");
    const outside = await createTempDir("meowstik-log-outside-");
    const outsideLog = path.join(outside, "outside.log");
    const linkedPath = path.join(root, "logs", "linked.log");

    await fs.mkdir(path.dirname(linkedPath), { recursive: true });
    await fs.writeFile(outsideLog, "secret\n");
    await fs.symlink(outsideLog, linkedPath);

    const result = await resolveManagedLogPath(buildService(root), "logs/linked.log");

    expect(result.status).toBe("error");
    expect(result.error).toContain("outside the service directory");
  });
});
