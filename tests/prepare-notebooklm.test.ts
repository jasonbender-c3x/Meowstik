import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  ChunkedOutputWriter,
  MAX_OUTPUT_FILE_SIZE_BYTES,
  createHeader,
  formatBytes,
} from "../scripts/prepare-notebooklm";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("prepare-notebooklm", () => {
  it("uses a ~2 MB output cap per generated file", () => {
    expect(MAX_OUTPUT_FILE_SIZE_BYTES).toBe(2 * 1024 * 1024);
    expect(formatBytes(MAX_OUTPUT_FILE_SIZE_BYTES)).toBe("2.00 MB");
  });

  it("rolls over to numbered output files when a bucket exceeds the cap", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prepare-notebooklm-"));
    tempDirs.push(tempDir);

    const headerBytes = Buffer.byteLength(createHeader("TEST BUCKET"), "utf8");
    const writer = new ChunkedOutputWriter(tempDir, "logs", "TEST BUCKET", headerBytes + 32);

    await writer.appendString("a".repeat(16));
    await writer.appendString("b".repeat(20));
    await writer.finalize();

    expect(writer.files).toEqual(["logs.txt", "logs-2.txt"]);
    expect(fs.existsSync(path.join(tempDir, "logs.txt"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "logs-2.txt"))).toBe(true);
  });
});
