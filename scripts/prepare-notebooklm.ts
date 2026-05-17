/**
 * =============================================================================
 * PREPARE NOTEBOOKLM INGESTION PACKAGE
 * =============================================================================
 *
 * Transforms the repository into text files optimised for Google NotebookLM.
 *
 * OUTPUTS (in ./notebooklm-ingest/):
 *   server.txt, server-2.txt, ...  – Server-side source code  (server/)
 *   client.txt, client-2.txt, ...  – Client-side source code  (client/)
 *   other.txt, other-2.txt, ...    – Everything else that is not docs/logs and
 *                                     not in server/ or client/
 *   docs.txt, docs-2.txt, ...      – Documentation (.md, docs/, etc.)
 *   logs.txt, logs-2.txt, ...      – Logs and memory (logs/, memory/)
 *   files.txt, files-2.txt, ...    – Full filesystem map
 *
 * Each generated output file is capped at ~2 MB. When a bucket grows beyond
 * that limit, the script automatically rolls over to the next numbered file.
 *
 * Usage:
 *   npm run prepare:notebooklm
 */

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

// =============================================================================
// CONFIGURATION
// =============================================================================

const OUTPUT_DIR = path.resolve(process.cwd(), "notebooklm-ingest");
export const MAX_OUTPUT_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_FILE_SIZE_BYTES = MAX_OUTPUT_FILE_SIZE_BYTES;
const LOG_INPUT_SAMPLE_RATE = 15;

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".scss", ".sql",
  ".json", ".yaml", ".yml", ".xml", ".sh", ".bat", ".config", ".toml",
]);

const DOC_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".csv"]);

const IGNORED_ITEMS = new Set([
  "node_modules", "dist", "build", "coverage", ".git", ".cache",
  ".vscode", ".local", "tmp", "temp", "__pycache__", "venv", "notebooklm-ingest",
  "notebooklm-output", "attached_assets", ".next", ".output",
  "package-lock.json", "yarn.lock", "py", "pnpm-lock.yaml",
]);

const DOCS_DIRS = new Set(["docs"]);
const LOGS_DIRS = new Set(["logs", "memory"]);

/** Top-level directory names that map to specific output streams. */
const SERVER_ROOT = "server";
const CLIENT_ROOT = "client";

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
  ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".mp3", ".wav", ".mp4", ".mov", ".avi", ".mkv",
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
]);

type Bucket = "server" | "client" | "other" | "docs" | "logs";
type OutputKey = Bucket | "files";

const stats: Record<Bucket, number> & { skipped: number } = {
  server: 0,
  client: 0,
  other: 0,
  docs: 0,
  logs: 0,
  skipped: 0,
};
let sampledLogInputCount = 0;

export function buildOutputFilePath(outputDir: string, baseName: string, part: number): string {
  return path.join(outputDir, part === 1 ? `${baseName}.txt` : `${baseName}-${part}.txt`);
}

export function createHeader(title: string): string {
  return [
    "################################################################################",
    `# ${title}`,
    `# Generated: ${new Date().toISOString()}`,
    "################################################################################",
    "",
    "",
  ].join("\n");
}

function createFileSection(relPath: string): string {
  return [
    "",
    "================================================================================",
    `FILE: ${relPath}`,
    "================================================================================",
    "",
    "",
  ].join("\n");
}

async function writeChunk(stream: fs.WriteStream, content: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stream.write(content, "utf8", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function pipeFileIntoStream(stream: fs.WriteStream, filePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const reader = fs.createReadStream(filePath, { encoding: "utf8" });
    const cleanup = () => {
      reader.removeListener("error", onReaderError);
      reader.removeListener("end", onEnd);
      stream.removeListener("error", onStreamError);
    };
    const onReaderError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onStreamError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onEnd = () => {
      cleanup();
      resolve();
    };

    reader.on("error", onReaderError);
    reader.on("end", onEnd);
    stream.on("error", onStreamError);
    reader.pipe(stream, { end: false });
  });
}

async function closeStream(stream: fs.WriteStream | null): Promise<void> {
  if (!stream) return;

  await new Promise<void>((resolve, reject) => {
    stream.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export class ChunkedOutputWriter {
  private stream: fs.WriteStream | null = null;
  private part = 0;
  private currentBytes = 0;
  public readonly files: string[] = [];

  constructor(
    private readonly outputDir: string,
    private readonly baseName: string,
    private readonly title: string,
    private readonly maxBytes: number = MAX_OUTPUT_FILE_SIZE_BYTES,
  ) {}

  private async openNextPart(): Promise<void> {
    await closeStream(this.stream);

    this.part += 1;
    const filePath = buildOutputFilePath(this.outputDir, this.baseName, this.part);
    const headerTitle = this.part === 1 ? this.title : `${this.title} (Part ${this.part})`;
    const header = createHeader(headerTitle);

    this.stream = fs.createWriteStream(filePath, { encoding: "utf8" });
    this.files.push(path.basename(filePath));
    this.currentBytes = 0;

    await writeChunk(this.stream, header);
    this.currentBytes += Buffer.byteLength(header, "utf8");
  }

  private async ensureCapacity(additionalBytes: number): Promise<void> {
    if (additionalBytes > this.maxBytes) {
      throw new Error(
        `Single write of ${formatBytes(additionalBytes)} exceeds bucket limit ${formatBytes(this.maxBytes)}.`,
      );
    }

    if (!this.stream) {
      await this.openNextPart();
      return;
    }

    if (this.currentBytes + additionalBytes > this.maxBytes) {
      await this.openNextPart();
    }
  }

  async appendString(content: string): Promise<void> {
    const contentBytes = Buffer.byteLength(content, "utf8");
    await this.ensureCapacity(contentBytes);
    await writeChunk(this.stream!, content);
    this.currentBytes += contentBytes;
  }

  async appendFile(filePath: string, relPath: string, stat: fs.Stats): Promise<void> {
    const preamble = createFileSection(relPath);
    const footer = "\n\n";
    const estimatedBytes =
      Buffer.byteLength(preamble, "utf8") +
      stat.size +
      Buffer.byteLength(footer, "utf8");

    if (estimatedBytes > this.maxBytes) {
      throw new Error(
        `File section ${relPath} would exceed the per-output limit (${formatBytes(estimatedBytes)}).`,
      );
    }

    await this.ensureCapacity(estimatedBytes);
    await writeChunk(this.stream!, preamble);
    this.currentBytes += Buffer.byteLength(preamble, "utf8");

    await pipeFileIntoStream(this.stream!, filePath);
    this.currentBytes += stat.size;

    await writeChunk(this.stream!, footer);
    this.currentBytes += Buffer.byteLength(footer, "utf8");
  }

  async finalize(): Promise<void> {
    await closeStream(this.stream);
    this.stream = null;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("📦 Starting NotebookLM Preparation…");
  console.log(`   Working Directory: ${process.cwd()}`);

  // Recreate output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`📂 Output directory: ${OUTPUT_DIR}`);
  console.log(`📏 Max output size per file: ${formatBytes(MAX_OUTPUT_FILE_SIZE_BYTES)}`);

  const writers: Record<OutputKey, ChunkedOutputWriter> = {
    server: new ChunkedOutputWriter(OUTPUT_DIR, "server", "MEOWSTIK — SERVER SOURCE CODE"),
    client: new ChunkedOutputWriter(OUTPUT_DIR, "client", "MEOWSTIK — CLIENT SOURCE CODE"),
    other: new ChunkedOutputWriter(
      OUTPUT_DIR,
      "other",
      "MEOWSTIK — OTHER SOURCE CODE (scripts, shared, root, etc.)",
    ),
    docs: new ChunkedOutputWriter(OUTPUT_DIR, "docs", "MEOWSTIK — DOCUMENTATION"),
    logs: new ChunkedOutputWriter(OUTPUT_DIR, "logs", "MEOWSTIK — LOGS & MEMORY"),
    files: new ChunkedOutputWriter(OUTPUT_DIR, "files", "MEOWSTIK — FILESYSTEM MAP"),
  };

  console.log("🔍 Scanning repository…");
  await processDirectory(process.cwd(), writers);

  const total = stats.server + stats.client + stats.other + stats.docs + stats.logs;
  console.log("✅ Content processing complete.");
  console.log(`   Server  : ${stats.server} files → ${writers.server.files.join(", ") || "(none)"}`);
  console.log(`   Client  : ${stats.client} files → ${writers.client.files.join(", ") || "(none)"}`);
  console.log(`   Other   : ${stats.other} files → ${writers.other.files.join(", ") || "(none)"}`);
  console.log(`   Docs    : ${stats.docs} files → ${writers.docs.files.join(", ") || "(none)"}`);
  console.log(`   Logs    : ${stats.logs} files → ${writers.logs.files.join(", ") || "(none)"}`);
  console.log(`   Total   : ${total}`);
  console.log(`   Skipped : ${stats.skipped}`);

  try {
    await generateFileList(process.cwd(), writers.files);
    console.log(`✅ Generated filesystem map → ${writers.files.files.join(", ") || "(none)"}`);
  } catch (err) {
    console.error("❌ Failed to generate files.txt", err);
  }

  await Promise.all(Object.values(writers).map((writer) => writer.finalize()));

  console.log("\n🎉 Done! Upload these files to NotebookLM:");
  for (const key of ["server", "client", "other", "docs", "logs", "files"] as const) {
    for (const file of writers[key].files) {
      console.log(`   - ${file}`);
    }
  }
}

// =============================================================================
// TRAVERSAL
// =============================================================================

async function processDirectory(
  currentPath: string,
  writers: Record<OutputKey, ChunkedOutputWriter>,
): Promise<void> {
  let entries: string[];
  try {
    entries = fs.readdirSync(currentPath).sort();
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORED_ITEMS.has(entry)) continue;

    const fullPath = path.join(currentPath, entry);
    const relPath = path.relative(process.cwd(), fullPath);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      await processDirectory(fullPath, writers);
      continue;
    }

    if (!stat.isFile()) continue;

    const ext = path.extname(entry).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      stats.skipped++;
      continue;
    }
    if (shouldSkipFile(relPath, stat)) {
      stats.skipped++;
      continue;
    }

    const dest = resolveDestination(relPath, ext);
    if (!dest) {
      stats.skipped++;
      continue;
    }

    try {
      await writers[dest.bucket].appendFile(fullPath, relPath, stat);
      stats[dest.bucket] += 1;
    } catch (error) {
      stats.skipped++;
      console.warn(`⏭️  Skipping ${relPath}: ${(error as Error).message}`);
    }
  }
}

function resolveDestination(
  relPath: string,
  ext: string,
): { bucket: Bucket } | null {
  const parts = relPath.split(path.sep);
  const topLevel = parts[0];

  // Logs (always wins for log dirs)
  if (parts.some((p) => LOGS_DIRS.has(p))) {
    return { bucket: "logs" };
  }

  // Docs directory or markdown/text files
  if (parts.some((p) => DOCS_DIRS.has(p)) || DOC_EXTENSIONS.has(ext)) {
    return { bucket: "docs" };
  }

  // Only code/config files below this point
  if (!CODE_EXTENSIONS.has(ext)) return null;

  if (topLevel === SERVER_ROOT) return { bucket: "server" };
  if (topLevel === CLIENT_ROOT) return { bucket: "client" };
  return { bucket: "other" };
}

// =============================================================================
// HELPERS
// =============================================================================

async function generateFileList(startPath: string, writer: ChunkedOutputWriter): Promise<void> {
  async function crawl(currentPath: string): Promise<void> {
    let entries: string[];
    try {
      entries = fs.readdirSync(currentPath).sort();
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_ITEMS.has(entry)) continue;

      const fullPath = path.join(currentPath, entry);
      const relPath = path.relative(startPath, fullPath);
      await writer.appendString(`${relPath}\n`);

      try {
        if (fs.statSync(fullPath).isDirectory()) {
          await crawl(fullPath);
        }
      } catch {
        // Ignore transient filesystem issues while building the file map.
      }
    }
  }

  await crawl(startPath);
}

function shouldSkipFile(relPath: string, stat: fs.Stats): boolean {
  if (stat.size > MAX_SOURCE_FILE_SIZE_BYTES) {
    console.log(`⏭️  Skipping oversized source file (${formatBytes(stat.size)}): ${relPath}`);
    return true;
  }

  if (isSampledLogInputMarkdown(relPath)) {
    sampledLogInputCount += 1;
    const shouldInclude = (sampledLogInputCount - 1) % LOG_INPUT_SAMPLE_RATE === 0;
    if (!shouldInclude) {
      return true;
    }
  }

  return false;
}

function isSampledLogInputMarkdown(relPath: string): boolean {
  const normalizedPath = relPath.split(path.sep).join("/");
  const fileName = path.basename(normalizedPath).toLowerCase();

  return (
    normalizedPath.startsWith("logs/") &&
    normalizedPath.includes("/io") &&
    fileName.startsWith("input") &&
    fileName.endsWith(".md")
  );
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(console.error);
}
