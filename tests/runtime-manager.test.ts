import { describe, expect, it } from "vitest";
import {
  buildChildEnv,
  normalizeRuntimeCwd,
  parseCommandLine,
  parseListenerSnapshot,
} from "../server/services/runtime-manager";

describe("runtime-manager helpers", () => {
  it("parses direct command invocations with quoted args", () => {
    expect(parseCommandLine(`pnpm --dir "./apps/web" dev`)).toEqual({
      command: "pnpm",
      args: ["--dir", "./apps/web", "dev"],
    });
  });

  it("builds a whitelisted child environment and applies managed overrides", () => {
    expect(
      buildChildEnv({
        PATH: "/usr/bin",
        HOME: "/home/meow",
        GEMINI_API_KEY: "secret",
        GOOGLE_CLIENT_SECRET: "secret-2",
        NODE_ENV: "development",
      }, {
        GEMINI_API_KEY: "managed-secret",
      })
    ).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/meow",
      NODE_ENV: "development",
      GEMINI_API_KEY: "managed-secret",
    });

    expect(
      buildChildEnv({
        PATH: "/usr/bin",
        HOME: "/home/meow",
        GEMINI_API_KEY: "secret",
        GOOGLE_CLIENT_SECRET: "secret-2",
        NODE_ENV: "development",
      })
    ).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/meow",
      NODE_ENV: "development",
    });
  });

  it("normalizes runtime working directories", () => {
    expect(normalizeRuntimeCwd("client")).toBe(`${process.cwd()}/client`);
  });

  it("parses ss listener snapshots", () => {
    expect(
      parseListenerSnapshot(
        `State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess
LISTEN 0      511        127.0.0.1:3000      0.0.0.0:*    users:(("node",pid=12345,fd=18))
LISTEN 0      128            [::]:5173         [::]:*    users:(("vite",pid=22334,fd=22))`
      )
    ).toEqual([
      {
        protocol: "tcp",
        localAddress: "127.0.0.1:3000",
        host: "127.0.0.1",
        port: 3000,
        processName: "node",
        pid: 12345,
        raw: `LISTEN 0      511        127.0.0.1:3000      0.0.0.0:*    users:(("node",pid=12345,fd=18))`,
      },
      {
        protocol: "tcp",
        localAddress: "[::]:5173",
        host: "::",
        port: 5173,
        processName: "vite",
        pid: 22334,
        raw: `LISTEN 0      128            [::]:5173         [::]:*    users:(("vite",pid=22334,fd=22))`,
      },
    ]);
  });
});
