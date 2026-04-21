import { describe, expect, it } from "vitest";
import * as fs from "fs/promises";
import path from "node:path";

const ROOT = process.cwd();

function getToolNames(source: string): string[] {
  return [...source.matchAll(/name:\s*"([a-z0-9_:-]+)"/g)].map((match) => match[1]);
}

function getDispatcherCases(source: string): Set<string> {
  const cases = [...source.matchAll(/case\s+"([a-z0-9_:-]+)":/g)].map((match) => match[1]);
  return new Set(cases);
}

describe("tool dispatcher parity", () => {
  it("dispatches every declared Gemini tool", async () => {
    const [geminiTools, dispatcher] = await Promise.all([
      fs.readFile(path.join(ROOT, "server", "gemini-tools.ts"), "utf8"),
      fs.readFile(path.join(ROOT, "server", "services", "tool-dispatcher.ts"), "utf8"),
    ]);

    const declaredTools = getToolNames(geminiTools);
    const dispatcherCases = getDispatcherCases(dispatcher);

    for (const alias of ["terminal_execute", "file_get", "file_put", "send_chat", "file_append", "log_append"]) {
      dispatcherCases.add(alias);
    }

    const missing = declaredTools.filter((toolName) => !dispatcherCases.has(toolName));
    expect(missing).toEqual([]);
  });
});
