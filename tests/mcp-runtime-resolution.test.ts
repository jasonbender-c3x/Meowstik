import { describe, expect, it } from "vitest";
import { resolveRuntimeArgs, resolveRuntimeMap, resolveRuntimeString } from "../server/services/mcp-runtime-resolution";

function withEnv<T>(entries: Record<string, string | undefined>, run: () => T): T {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(entries)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("mcp runtime placeholder resolution", () => {
  it("resolves exact and inline placeholders in strings", () => {
    withEnv(
      {
        MCP_TEST_TOKEN: "secret-token",
        MCP_TEST_DATABASE_URL: "file:/tmp/meowstik.db",
      },
      () => {
        expect(resolveRuntimeString("${MCP_TEST_DATABASE_URL}")).toBe("file:/tmp/meowstik.db");
        expect(resolveRuntimeString("Bearer ${MCP_TEST_TOKEN}")).toBe("Bearer secret-token");
      },
    );
  });

  it("preserves unresolved placeholders", () => {
    withEnv({ MCP_TEST_MISSING: undefined }, () => {
      expect(resolveRuntimeString("${MCP_TEST_MISSING}")).toBe("${MCP_TEST_MISSING}");
      expect(resolveRuntimeString("Bearer ${MCP_TEST_MISSING}")).toBe("Bearer ${MCP_TEST_MISSING}");
    });
  });

  it("resolves placeholders in args arrays and maps", () => {
    withEnv(
      {
        MCP_TEST_DATABASE_URL: "file:/tmp/meowstik.db",
        MCP_TEST_TOKEN: "secret-token",
      },
      () => {
        expect(resolveRuntimeArgs(["serve", "${MCP_TEST_DATABASE_URL}"])).toEqual([
          "serve",
          "file:/tmp/meowstik.db",
        ]);
        expect(
          resolveRuntimeMap({
            Authorization: "Bearer ${MCP_TEST_TOKEN}",
            DATABASE_URL: "${MCP_TEST_DATABASE_URL}",
          }),
        ).toEqual({
          Authorization: "Bearer secret-token",
          DATABASE_URL: "file:/tmp/meowstik.db",
        });
      },
    );
  });
});
