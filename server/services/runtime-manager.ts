import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import { environmentManager } from "./environment-manager";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNTIME_DATA_PATH = path.resolve(__dirname, "../../data/runtime-services.json");
const HEALTH_TIMEOUT_MS = 3000;
const STOP_TIMEOUT_MS = 5000;
const KILL_TIMEOUT_MS = 2000;
const MAX_LOG_LINES = 200;
const MAX_LOG_LINE_LENGTH = 400;

const ALLOWED_CHILD_ENV_KEYS = [
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "TERM",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "NODE_ENV",
  "npm_config_user_agent",
  "npm_execpath",
  "PNPM_HOME",
] as const;

export interface RuntimeServiceDefinition {
  id: string;
  name: string;
  command: string;
  cwd: string;
  port?: number | null;
  healthCheckPath?: string | null;
  healthCheckUrl?: string | null;
  logPaths?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeServiceLogEntry {
  timestamp: string;
  stream: "stdout" | "stderr" | "system";
  text: string;
}

export interface RuntimeListener {
  protocol: string;
  localAddress: string;
  host: string;
  port: number | null;
  processName?: string;
  pid?: number;
  raw: string;
}

export interface RuntimeServiceSnapshot extends RuntimeServiceDefinition {
  status: "stopped" | "starting" | "running" | "failed";
  pid: number | null;
  portStatus: "open" | "closed" | "unknown";
  healthStatus: "healthy" | "unhealthy" | "unknown";
  healthDetail?: string;
  startedAt?: string;
  stoppedAt?: string;
  lastExitCode?: number | null;
  lastExitSignal?: string | null;
  recentOutput: RuntimeServiceLogEntry[];
}

interface RuntimeProcessState {
  child: ChildProcess;
  pid: number;
  status: "starting" | "running" | "stopped" | "failed";
  stopRequested: boolean;
  startedAt: string;
  stoppedAt?: string;
  lastExitCode?: number | null;
  lastExitSignal?: string | null;
  recentOutput: RuntimeServiceLogEntry[];
  exitPromise: Promise<void>;
  resolveExit: () => void;
}

function normalizeRuntimeLogPaths(input?: string[] | null): string[] {
  if (!input) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export function normalizeRuntimeCwd(input?: string | null): string {
  const trimmed = input?.trim();
  if (!trimmed) {
    return process.cwd();
  }

  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(process.cwd(), trimmed);
}

export function buildChildEnv(
  source: NodeJS.ProcessEnv = process.env,
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  for (const key of ALLOWED_CHILD_ENV_KEYS) {
    if (source[key]) {
      env[key] = source[key];
    }
  }

  return {
    ...env,
    ...overrides,
  };
}

export function parseCommandLine(commandLine: string): { command: string; args: string[] } {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const character of commandLine.trim()) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (character === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (escaping || quote) {
    throw new Error("Command contains an unterminated quote or escape sequence");
  }

  if (current) {
    tokens.push(current);
  }

  if (tokens.length === 0) {
    throw new Error("Command is required");
  }

  return {
    command: tokens[0],
    args: tokens.slice(1),
  };
}

function splitHostAndPort(localAddress: string): { host: string; port: number | null } {
  const bracketed = localAddress.match(/^\[(.*)\]:(\d+|\*)$/);
  if (bracketed) {
    return {
      host: bracketed[1],
      port: bracketed[2] === "*" ? null : Number.parseInt(bracketed[2], 10),
    };
  }

  const lastColon = localAddress.lastIndexOf(":");
  if (lastColon === -1) {
    return { host: localAddress, port: null };
  }

  const host = localAddress.slice(0, lastColon);
  const rawPort = localAddress.slice(lastColon + 1);
  return {
    host,
    port: /^\d+$/.test(rawPort) ? Number.parseInt(rawPort, 10) : null,
  };
}

export function parseListenerSnapshot(output: string): RuntimeListener[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("State"))
    .map((line) => {
      const parts = line.split(/\s+/);
      const localAddress = parts[3] || "";
      const processField = parts.slice(5).join(" ");
      const { host, port } = splitHostAndPort(localAddress);
      const pidMatch = processField.match(/pid=(\d+)/);
      const processNameMatch = processField.match(/users:\(\("([^"]+)"/);

      return {
        protocol: "tcp",
        localAddress,
        host,
        port,
        processName: processNameMatch?.[1],
        pid: pidMatch ? Number.parseInt(pidMatch[1], 10) : undefined,
        raw: line,
      };
    });
}

async function isTcpPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const cleanup = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => cleanup(true));
    socket.once("timeout", () => cleanup(false));
    socket.once("error", () => cleanup(false));
  });
}

async function checkServiceHealth(definition: RuntimeServiceDefinition): Promise<{ status: "healthy" | "unhealthy" | "unknown"; detail?: string }> {
  if (definition.healthCheckUrl?.trim()) {
    try {
      const url = new URL(definition.healthCheckUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        return { status: "unhealthy", detail: "Health URL must use http or https" };
      }

      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
      return response.ok
        ? { status: "healthy" }
        : { status: "unhealthy", detail: `Health check returned ${response.status}` };
    } catch (error) {
      return { status: "unhealthy", detail: error instanceof Error ? error.message : "Health check failed" };
    }
  }

  if (definition.port && definition.healthCheckPath?.trim()) {
    const healthPath = definition.healthCheckPath.startsWith("/")
      ? definition.healthCheckPath
      : `/${definition.healthCheckPath}`;

    try {
      const response = await fetch(`http://127.0.0.1:${definition.port}${healthPath}`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      return response.ok
        ? { status: "healthy" }
        : { status: "unhealthy", detail: `Health check returned ${response.status}` };
    } catch (error) {
      return { status: "unhealthy", detail: error instanceof Error ? error.message : "Health check failed" };
    }
  }

  if (definition.port) {
    const open = await isTcpPortOpen(definition.port);
    return open ? { status: "healthy" } : { status: "unhealthy", detail: "Port is not accepting connections" };
  }

  return { status: "unknown" };
}

function trimLogText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => (line.length > MAX_LOG_LINE_LENGTH ? `${line.slice(0, MAX_LOG_LINE_LENGTH)}...` : line));
}

class RuntimeManager {
  private definitions: RuntimeServiceDefinition[] = [];
  private processStates = new Map<string, RuntimeProcessState>();
  private initialized = false;
  private persistChain: Promise<void> = Promise.resolve();

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await fsp.mkdir(path.dirname(RUNTIME_DATA_PATH), { recursive: true });

    if (!fs.existsSync(RUNTIME_DATA_PATH)) {
      await fsp.writeFile(RUNTIME_DATA_PATH, "[]\n", "utf8");
    }

    const raw = await fsp.readFile(RUNTIME_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as RuntimeServiceDefinition[];
    this.definitions = Array.isArray(parsed) ? parsed : [];
    this.initialized = true;
  }

  private async persistDefinitions(): Promise<void> {
    const payload = JSON.stringify(this.definitions, null, 2);
    this.persistChain = this.persistChain.then(async () => {
      const tempPath = `${RUNTIME_DATA_PATH}.tmp`;
      await fsp.writeFile(tempPath, `${payload}\n`, "utf8");
      await fsp.rename(tempPath, RUNTIME_DATA_PATH);
    });

    await this.persistChain;
  }

  private getDefinition(id: string): RuntimeServiceDefinition {
    const definition = this.definitions.find((item) => item.id === id);
    if (!definition) {
      throw new Error("Runtime service not found");
    }
    return definition;
  }

  private appendLog(state: RuntimeProcessState, stream: RuntimeServiceLogEntry["stream"], text: string): void {
    for (const line of trimLogText(text)) {
      state.recentOutput.push({
        timestamp: new Date().toISOString(),
        stream,
        text: line,
      });
    }

    if (state.recentOutput.length > MAX_LOG_LINES) {
      state.recentOutput.splice(0, state.recentOutput.length - MAX_LOG_LINES);
    }
  }

  private async buildSnapshot(definition: RuntimeServiceDefinition): Promise<RuntimeServiceSnapshot> {
    const state = this.processStates.get(definition.id);
    const portStatus = definition.port
      ? ((await isTcpPortOpen(definition.port)) ? "open" : "closed")
      : "unknown";
    const health = state?.status === "running" ? await checkServiceHealth(definition) : { status: "unknown" as const };

    return {
      ...definition,
      status: state?.status === "starting" || state?.status === "running" ? state.status : state?.status ?? "stopped",
      pid: state?.status === "starting" || state?.status === "running" ? state.pid : null,
      portStatus,
      healthStatus: health.status,
      healthDetail: health.detail,
      startedAt: state?.startedAt,
      stoppedAt: state?.stoppedAt,
      lastExitCode: state?.lastExitCode,
      lastExitSignal: state?.lastExitSignal,
      recentOutput: state?.recentOutput ?? [],
    };
  }

  async listServices(): Promise<RuntimeServiceSnapshot[]> {
    await this.ensureLoaded();
    return Promise.all(this.definitions.map((definition) => this.buildSnapshot(definition)));
  }

  async createService(input: Omit<RuntimeServiceDefinition, "id" | "createdAt" | "updatedAt">): Promise<RuntimeServiceSnapshot> {
    await this.ensureLoaded();
    const now = new Date().toISOString();
    const definition: RuntimeServiceDefinition = {
      id: nanoid(),
      name: input.name.trim(),
      command: input.command.trim(),
      cwd: normalizeRuntimeCwd(input.cwd),
      port: input.port ?? null,
      healthCheckPath: input.healthCheckPath?.trim() || null,
      healthCheckUrl: input.healthCheckUrl?.trim() || null,
      logPaths: normalizeRuntimeLogPaths(input.logPaths),
      createdAt: now,
      updatedAt: now,
    };

    this.definitions.push(definition);
    await this.persistDefinitions();
    return this.buildSnapshot(definition);
  }

  async updateService(id: string, updates: Partial<Omit<RuntimeServiceDefinition, "id" | "createdAt" | "updatedAt">>): Promise<RuntimeServiceSnapshot> {
    await this.ensureLoaded();
    const definition = this.getDefinition(id);
    const wasRunning = this.processStates.get(id)?.status === "running" || this.processStates.get(id)?.status === "starting";

    if (wasRunning) {
      await this.stopService(id);
    }

    definition.name = updates.name?.trim() || definition.name;
    definition.command = updates.command?.trim() || definition.command;
    definition.cwd = updates.cwd ? normalizeRuntimeCwd(updates.cwd) : definition.cwd;
    definition.port = updates.port === undefined ? definition.port : updates.port ?? null;
    definition.healthCheckPath =
      updates.healthCheckPath === undefined ? definition.healthCheckPath : updates.healthCheckPath?.trim() || null;
    definition.healthCheckUrl =
      updates.healthCheckUrl === undefined ? definition.healthCheckUrl : updates.healthCheckUrl?.trim() || null;
    definition.logPaths = updates.logPaths === undefined ? definition.logPaths ?? [] : normalizeRuntimeLogPaths(updates.logPaths);
    definition.updatedAt = new Date().toISOString();

    await this.persistDefinitions();

    if (wasRunning) {
      await this.startService(id);
    }

    return this.buildSnapshot(definition);
  }

  async deleteService(id: string): Promise<void> {
    await this.ensureLoaded();

    if (this.processStates.has(id)) {
      await this.stopService(id);
    }

    this.definitions = this.definitions.filter((definition) => definition.id !== id);
    await this.persistDefinitions();
  }

  async startService(id: string): Promise<RuntimeServiceSnapshot> {
    await this.ensureLoaded();
    const definition = this.getDefinition(id);
    const existing = this.processStates.get(id);

    if (existing && (existing.status === "starting" || existing.status === "running")) {
      throw new Error("Runtime service is already running");
    }

    const cwd = normalizeRuntimeCwd(definition.cwd);
    const stat = await fsp.stat(cwd).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      throw new Error(`Working directory does not exist: ${cwd}`);
    }

    if (definition.port && (await isTcpPortOpen(definition.port))) {
      throw new Error(`Port ${definition.port} is already in use`);
    }

    const { command, args } = parseCommandLine(definition.command);
    const runtimeEnvOverrides = await environmentManager.getRuntimeEnvOverrides();
    const child = spawn(command, args, {
      cwd,
      env: buildChildEnv(process.env, runtimeEnvOverrides),
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (!child.pid) {
      throw new Error("Failed to start runtime service");
    }

    let resolveExit = () => {};
    const exitPromise = new Promise<void>((resolve) => {
      resolveExit = resolve;
    });

    const state: RuntimeProcessState = {
      child,
      pid: child.pid,
      status: "starting",
      stopRequested: false,
      startedAt: new Date().toISOString(),
      recentOutput: [],
      exitPromise,
      resolveExit,
    };

    this.processStates.set(id, state);
    this.appendLog(state, "system", `Starting ${definition.command}`);

    child.stdout?.on("data", (chunk) => this.appendLog(state, "stdout", chunk.toString()));
    child.stderr?.on("data", (chunk) => this.appendLog(state, "stderr", chunk.toString()));

    child.once("spawn", () => {
      state.status = "running";
      this.appendLog(state, "system", `Service started with PID ${state.pid}`);
    });

    child.once("error", (error) => {
      state.status = "failed";
      state.stoppedAt = new Date().toISOString();
      state.lastExitCode = null;
      state.lastExitSignal = null;
      this.appendLog(state, "system", `Failed to start service: ${error.message}`);
      state.resolveExit();
    });

    child.once("exit", (code, signal) => {
      state.status = state.stopRequested || code === 0 ? "stopped" : "failed";
      state.stoppedAt = new Date().toISOString();
      state.lastExitCode = code;
      state.lastExitSignal = signal ?? null;
      this.appendLog(
        state,
        "system",
        state.stopRequested
          ? `Service stopped (${signal ?? code ?? "unknown"})`
          : `Service exited unexpectedly (${signal ?? code ?? "unknown"})`
      );
      state.resolveExit();
    });

    await new Promise<void>((resolve, reject) => {
      child.once("spawn", () => resolve());
      child.once("error", (error) => reject(error));
    });

    definition.updatedAt = new Date().toISOString();
    await this.persistDefinitions();
    return this.buildSnapshot(definition);
  }

  async stopService(id: string): Promise<RuntimeServiceSnapshot> {
    await this.ensureLoaded();
    const definition = this.getDefinition(id);
    const state = this.processStates.get(id);

    if (!state || (state.status !== "starting" && state.status !== "running")) {
      return this.buildSnapshot(definition);
    }

    state.stopRequested = true;
    this.appendLog(state, "system", "Stopping service");

    const killGroup = (signal: NodeJS.Signals) => {
      if (process.platform === "win32") {
        state.child.kill(signal);
      } else {
        process.kill(-state.pid, signal);
      }
    };

    try {
      killGroup("SIGTERM");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        throw error;
      }
    }

    await Promise.race([
      state.exitPromise,
      new Promise<void>((resolve) => setTimeout(resolve, STOP_TIMEOUT_MS)),
    ]);

    if (!state.stoppedAt) {
      this.appendLog(state, "system", "Service did not exit after SIGTERM; sending SIGKILL");
      try {
        killGroup("SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
          throw error;
        }
      }

      await Promise.race([
        state.exitPromise,
        new Promise<void>((resolve) => setTimeout(resolve, KILL_TIMEOUT_MS)),
      ]);
    }

    if (!state.stoppedAt) {
      throw new Error("Runtime service did not stop cleanly");
    }

    definition.updatedAt = new Date().toISOString();
    await this.persistDefinitions();
    return this.buildSnapshot(definition);
  }

  async restartService(id: string): Promise<RuntimeServiceSnapshot> {
    await this.ensureLoaded();
    const definition = this.getDefinition(id);
    await this.stopService(id);
    return this.startService(definition.id);
  }

  async listListeners(): Promise<RuntimeListener[]> {
    try {
      const { stdout } = await execFileAsync("ss", ["-tlnp"], {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      });
      return parseListenerSnapshot(stdout)
        .filter((listener) => listener.port !== null)
        .sort((left, right) => (left.port ?? 0) - (right.port ?? 0));
    } catch (error) {
      console.warn("[RuntimeManager] Failed to inspect listening ports:", error);
      return [];
    }
  }
}

export const runtimeManager = new RuntimeManager();
