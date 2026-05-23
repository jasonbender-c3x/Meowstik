import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import { ioLogger } from "./io-logger";
import { logBuffer } from "./log-buffer";
import { orchestrationLogger, redactLogMessage } from "./orchestration-logger";
import type { RuntimeServiceLogEntry, RuntimeServiceSnapshot } from "./runtime-manager";
import { runtimeManager } from "./runtime-manager";

const execFileAsync = promisify(execFile);

const DEFAULT_ENTRY_LIMIT = 200;
const MAX_ENTRY_LIMIT = 500;
const MAX_TAIL_BUFFER = 1024 * 1024;
const TAIL_TIMEOUT_MS = 5000;
const MAX_IO_PREVIEW_CHARS = 30_000;
const MAX_EXPORT_CHARS = 250_000;
const MAX_IO_SOURCES_PER_KIND = 10;

export type LogsSourceKind =
  | "runtime-stream"
  | "runtime-file"
  | "app-buffer"
  | "orchestration"
  | "io-input"
  | "io-output";

export type LogsSourceStatus = "ready" | "pending" | "error";

export interface LogsEntry {
  id: string;
  timestamp?: string;
  level?: string;
  stream?: string;
  text: string;
  meta?: string;
}

export interface LogsSourceSummary {
  id: string;
  kind: LogsSourceKind;
  label: string;
  description?: string;
  status: LogsSourceStatus;
  entryCount: number;
  serviceId?: string;
  serviceName?: string;
  pathDisplay?: string;
  updatedAt?: string;
  mimeType?: string;
  error?: string;
}

export interface LogsSourceSnapshot {
  source: LogsSourceSummary;
  entries: LogsEntry[];
  truncated?: boolean;
}

export interface LogsOverview {
  generatedAt: string;
  selectedSourceId: string | null;
  sources: LogsSourceSummary[];
  selectedSource: LogsSourceSnapshot | null;
}

type ParsedSourceId =
  | { kind: "app-buffer" }
  | { kind: "orchestration" }
  | { kind: "runtime-stream"; serviceId: string }
  | { kind: "runtime-file"; serviceId: string; index: number }
  | { kind: "io-input" | "io-output"; filename: string };

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit) || !limit) {
    return DEFAULT_ENTRY_LIMIT;
  }

  return Math.max(1, Math.min(MAX_ENTRY_LIMIT, Math.floor(limit)));
}

function isPathWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toEntryId(prefix: string, index: number): string {
  return `${prefix}:${index}`;
}

function trimExportContent(content: string): { content: string; truncated: boolean } {
  if (content.length <= MAX_EXPORT_CHARS) {
    return { content, truncated: false };
  }

  return {
    content: `${content.slice(0, MAX_EXPORT_CHARS)}\n\n[truncated by Meowstik logs export limit]`,
    truncated: true,
  };
}

function toRuntimeEntry(entry: RuntimeServiceLogEntry, index: number, prefix: string): LogsEntry {
  return {
    id: toEntryId(prefix, index),
    timestamp: entry.timestamp,
    level: entry.stream === "stderr" ? "error" : entry.stream === "system" ? "info" : "debug",
    stream: entry.stream,
    text: redactLogMessage(entry.text),
  };
}

function splitContentIntoEntries(content: string, prefix: string): LogsEntry[] {
  return content.split(/\r?\n/).map((line, index) => ({
    id: toEntryId(prefix, index),
    text: redactLogMessage(line),
  }));
}

function formatPathDisplay(rawPath: string): string {
  return rawPath.replace(/\\/g, "/");
}

function parseIoLogTimestamp(filename: string): number {
  const match = filename.match(/^(?:input|output)-(\d+)-/);
  return match ? Number(match[1]) : 0;
}

async function resolveManagedLogPath(service: RuntimeServiceSnapshot, rawPath: string): Promise<{
  status: LogsSourceStatus;
  resolvedPath?: string;
  pathDisplay: string;
  updatedAt?: string;
  error?: string;
}> {
  const cwd = service.cwd;
  const pathDisplay = formatPathDisplay(rawPath);

  let serviceRoot: string;
  try {
    serviceRoot = await fs.realpath(cwd);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve service directory";
    return {
      status: "error",
      pathDisplay,
      error: `Service directory is unavailable: ${message}`,
    };
  }

  const resolvedPath = path.isAbsolute(rawPath) ? path.normalize(rawPath) : path.resolve(cwd, rawPath);
  if (!isPathWithinRoot(serviceRoot, resolvedPath)) {
    return {
      status: "error",
      pathDisplay,
      error: "Log path must stay inside the service directory.",
    };
  }

  try {
    const realFilePath = await fs.realpath(resolvedPath);
    if (!isPathWithinRoot(serviceRoot, realFilePath)) {
      return {
        status: "error",
        pathDisplay,
        error: "Log path resolves outside the service directory.",
      };
    }

    const stats = await fs.stat(realFilePath);
    if (!stats.isFile()) {
      return {
        status: "error",
        pathDisplay,
        error: "Configured log path is not a file.",
      };
    }

    return {
      status: "ready",
      resolvedPath: realFilePath,
      pathDisplay,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      const parentPath = path.dirname(resolvedPath);
      try {
        const realParentPath = await fs.realpath(parentPath);
        if (!isPathWithinRoot(serviceRoot, realParentPath)) {
          return {
            status: "error",
            pathDisplay,
            error: "Log path parent resolves outside the service directory.",
          };
        }
      } catch (parentError) {
        const parentNodeError = parentError as NodeJS.ErrnoException;
        if (parentNodeError.code !== "ENOENT") {
          const message = parentError instanceof Error ? parentError.message : "Unable to inspect log directory";
          return {
            status: "error",
            pathDisplay,
            error: message,
          };
        }
      }

      return {
        status: "pending",
        resolvedPath,
        pathDisplay,
        error: "Log file has not been created yet.",
      };
    }

    const message = error instanceof Error ? error.message : "Unable to inspect log file";
    return {
      status: "error",
      pathDisplay,
      error: message,
    };
  }
}

async function tailFile(resolvedPath: string, limit: number): Promise<string[]> {
  const { stdout } = await execFileAsync("tail", ["-n", String(limit), resolvedPath], {
    timeout: TAIL_TIMEOUT_MS,
    maxBuffer: MAX_TAIL_BUFFER,
    windowsHide: true,
  });

  return stdout.replace(/\r\n/g, "\n").split("\n");
}

function createRuntimeStreamSummary(service: RuntimeServiceSnapshot): LogsSourceSummary {
  const lastEntry = service.recentOutput.at(-1);
  return {
    id: createLogsSourceId({ kind: "runtime-stream", serviceId: service.id }),
    kind: "runtime-stream",
    label: `${service.name} runtime`,
    description: `Recent stdout/stderr/system lines from ${service.name}.`,
    status: service.recentOutput.length > 0 ? "ready" : "pending",
    entryCount: service.recentOutput.length,
    serviceId: service.id,
    serviceName: service.name,
    updatedAt: lastEntry?.timestamp ?? service.updatedAt,
    mimeType: "text/plain",
  };
}

async function buildRuntimeFileSource(
  service: RuntimeServiceSnapshot,
  rawPath: string,
  index: number,
  limit: number,
): Promise<LogsSourceSnapshot> {
  const pathState = await resolveManagedLogPath(service, rawPath);
  const summary: LogsSourceSummary = {
    id: createLogsSourceId({ kind: "runtime-file", serviceId: service.id, index }),
    kind: "runtime-file",
    label: `${service.name} file ${index + 1}`,
    description: `Tail of ${pathState.pathDisplay}`,
    status: pathState.status,
    entryCount: 0,
    serviceId: service.id,
    serviceName: service.name,
    pathDisplay: pathState.pathDisplay,
    updatedAt: service.updatedAt,
    mimeType: "text/plain",
    error: pathState.status === "error" ? pathState.error : undefined,
  };

  if (pathState.status !== "ready" || !pathState.resolvedPath) {
    if (pathState.status === "pending") {
      summary.error = pathState.error;
    }
    return { source: summary, entries: [] };
  }

  try {
    const lines = await tailFile(pathState.resolvedPath, limit);
    const entries = lines.map((line, lineIndex) => ({
      id: toEntryId(summary.id, lineIndex),
      text: redactLogMessage(line),
    }));

    summary.entryCount = entries.length;
    summary.updatedAt = pathState.updatedAt ?? service.updatedAt;

    return { source: summary, entries };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read log file";
    summary.status = "error";
    summary.error = message;
    return { source: summary, entries: [] };
  }
}

async function buildIoSourceSnapshot(
  kind: "io-input" | "io-output",
  filename: string,
): Promise<LogsSourceSnapshot> {
  const content = ioLogger.getLog(filename);
  const summary: LogsSourceSummary = {
    id: createLogsSourceId({ kind, filename }),
    kind,
    label: filename,
    description: kind === "io-input" ? "Captured LLM request payload." : "Captured LLM response payload.",
    status: content ? "ready" : "error",
    entryCount: 0,
    updatedAt: parseIoLogTimestamp(filename) ? new Date(parseIoLogTimestamp(filename)).toISOString() : undefined,
    mimeType: "text/markdown",
    error: content ? undefined : "Log file is no longer available.",
  };

  if (!content) {
    return { source: summary, entries: [] };
  }

  const truncated = content.length > MAX_IO_PREVIEW_CHARS;
  const preview = truncated ? `${content.slice(0, MAX_IO_PREVIEW_CHARS)}\n\n[truncated by Meowstik preview limit]` : content;
  const entries = splitContentIntoEntries(preview, summary.id);
  summary.entryCount = entries.length;

  return {
    source: summary,
    entries,
    truncated,
  };
}

function buildAppBufferSnapshot(limit: number): LogsSourceSnapshot {
  const entries = logBuffer
    .getLogs(limit)
    .slice()
    .reverse()
    .map((entry, index) => ({
      id: toEntryId("app-buffer", index),
      timestamp: entry.timestamp,
      level: entry.level,
      text: redactLogMessage(entry.message),
      meta: entry.details ? redactLogMessage(entry.details) : undefined,
    }));

  return {
    source: {
      id: createLogsSourceId({ kind: "app-buffer" }),
      kind: "app-buffer",
      label: "App log buffer",
      description: "Recent application and debug log entries.",
      status: entries.length > 0 ? "ready" : "pending",
      entryCount: entries.length,
      updatedAt: entries.at(-1)?.timestamp,
      mimeType: "text/plain",
    },
    entries,
  };
}

function buildOrchestrationSnapshot(limit: number): LogsSourceSnapshot {
  const entries = orchestrationLogger.getRecent(limit).map((entry, index) => ({
    id: toEntryId("orchestration", index),
    timestamp: entry.timestamp.toISOString(),
    level: entry.level,
    stream: entry.source,
    text: redactLogMessage(entry.message),
    meta: entry.error?.message
      ? redactLogMessage(entry.error.message)
      : entry.data
        ? redactLogMessage(JSON.stringify(entry.data))
        : undefined,
  }));

  return {
    source: {
      id: createLogsSourceId({ kind: "orchestration" }),
      kind: "orchestration",
      label: "Orchestration logs",
      description: "Structured orchestration, agent, and task events.",
      status: entries.length > 0 ? "ready" : "pending",
      entryCount: entries.length,
      updatedAt: entries.at(-1)?.timestamp,
      mimeType: "text/plain",
    },
    entries,
  };
}

function formatEntryForExport(entry: LogsEntry): string {
  const parts = [entry.timestamp, entry.level, entry.stream].filter(Boolean);
  const prefix = parts.length > 0 ? `[${parts.join(" | ")}] ` : "";
  return entry.meta ? `${prefix}${entry.text}\n${entry.meta}` : `${prefix}${entry.text}`;
}

async function buildAllSources(limit: number, serviceId?: string): Promise<LogsSourceSnapshot[]> {
  const services = await runtimeManager.listServices();
  const selectedServices = serviceId ? services.filter((service) => service.id === serviceId) : services;

  const runtimeSources: LogsSourceSnapshot[] = selectedServices.map((service) => ({
    source: createRuntimeStreamSummary(service),
    entries: service.recentOutput.slice(-limit).map((entry, index) => toRuntimeEntry(entry, index, `runtime:${service.id}`)),
  }));

  runtimeSources.forEach((snapshot) => {
    snapshot.source.entryCount = snapshot.entries.length;
  });

  const runtimeFileSources = await Promise.all(
    selectedServices.flatMap((service) =>
      (service.logPaths ?? []).map((logPath, index) => buildRuntimeFileSource(service, logPath, index, limit))
    )
  );

  const { inputs, outputs } = ioLogger.listLogs();
  const ioSources = await Promise.all([
    ...inputs.slice(0, MAX_IO_SOURCES_PER_KIND).map((filename) => buildIoSourceSnapshot("io-input", filename)),
    ...outputs.slice(0, MAX_IO_SOURCES_PER_KIND).map((filename) => buildIoSourceSnapshot("io-output", filename)),
  ]);

  return [
    ...runtimeSources,
    ...runtimeFileSources,
    buildAppBufferSnapshot(limit),
    buildOrchestrationSnapshot(limit),
    ...ioSources,
  ].sort((left, right) => {
    const leftTime = left.source.updatedAt ? Date.parse(left.source.updatedAt) : 0;
    const rightTime = right.source.updatedAt ? Date.parse(right.source.updatedAt) : 0;
    return rightTime - leftTime;
  });
}

export function createLogsSourceId(source: ParsedSourceId): string {
  switch (source.kind) {
    case "app-buffer":
      return "logs:app-buffer";
    case "orchestration":
      return "logs:orchestration";
    case "runtime-stream":
      return `logs:runtime-stream:${encodeURIComponent(source.serviceId)}`;
    case "runtime-file":
      return `logs:runtime-file:${encodeURIComponent(source.serviceId)}:${source.index}`;
    case "io-input":
    case "io-output":
      return `logs:${source.kind}:${encodeURIComponent(source.filename)}`;
  }
}

export function parseLogsSourceId(sourceId: string): ParsedSourceId | null {
  if (sourceId === "logs:app-buffer") {
    return { kind: "app-buffer" };
  }

  if (sourceId === "logs:orchestration") {
    return { kind: "orchestration" };
  }

  if (sourceId.startsWith("logs:runtime-stream:")) {
    const serviceId = decodeURIComponent(sourceId.slice("logs:runtime-stream:".length));
    return serviceId ? { kind: "runtime-stream", serviceId } : null;
  }

  if (sourceId.startsWith("logs:runtime-file:")) {
    const parts = sourceId.split(":");
    if (parts.length !== 4) {
      return null;
    }

    const index = Number(parts[3]);
    if (!Number.isInteger(index) || index < 0) {
      return null;
    }

    const serviceId = decodeURIComponent(parts[2]);
    return serviceId ? { kind: "runtime-file", serviceId, index } : null;
  }

  if (sourceId.startsWith("logs:io-input:")) {
    const filename = decodeURIComponent(sourceId.slice("logs:io-input:".length));
    return filename ? { kind: "io-input", filename } : null;
  }

  if (sourceId.startsWith("logs:io-output:")) {
    const filename = decodeURIComponent(sourceId.slice("logs:io-output:".length));
    return filename ? { kind: "io-output", filename } : null;
  }

  return null;
}

export { resolveManagedLogPath };

class LogManager {
  async getOverview(options: { sourceId?: string; serviceId?: string; limit?: number } = {}): Promise<LogsOverview> {
    const limit = clampLimit(options.limit);
    const sources = await buildAllSources(limit, options.serviceId);
    const selectedSource =
      (options.sourceId ? sources.find((source) => source.source.id === options.sourceId) : null) ??
      sources.find((source) => source.source.status !== "error") ??
      sources[0] ??
      null;

    return {
      generatedAt: new Date().toISOString(),
      selectedSourceId: selectedSource?.source.id ?? null,
      sources: sources.map((source) => source.source),
      selectedSource,
    };
  }

  async exportSource(sourceId: string, limit?: number): Promise<{ content: string; mimeType: string; truncated: boolean }> {
    const overview = await this.getOverview({ sourceId, limit });
    const source = overview.selectedSource;
    if (!source || source.source.id !== sourceId) {
      throw new Error("Unknown log source");
    }

    const content =
      source.source.kind === "io-input" || source.source.kind === "io-output"
        ? source.entries.map((entry) => entry.text).join("\n")
        : source.entries.map(formatEntryForExport).join("\n");

    const trimmed = trimExportContent(content);
    return {
      content: trimmed.content,
      mimeType: source.source.mimeType ?? "text/plain",
      truncated: trimmed.truncated || Boolean(source.truncated),
    };
  }
}

export const logManager = new LogManager();
