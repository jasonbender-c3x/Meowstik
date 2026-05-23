import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type EnvironmentVariableScope = "server" | "runtime" | "all";

export interface ManagedEnvironmentVariable {
  key: string;
  value: string;
  scope: EnvironmentVariableScope;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EnvironmentStateFile {
  variables: ManagedEnvironmentVariable[];
  lastChangedAt: string | null;
  lastServerChangeAt: string | null;
  lastRuntimeChangeAt: string | null;
}

export interface EnvironmentCatalogItem {
  key: string;
  label: string;
  group: string;
  description: string;
  scopeHint: EnvironmentVariableScope;
  isSecret: boolean;
}

export interface EnvironmentVariableSnapshot {
  key: string;
  label: string;
  group: string;
  description?: string | null;
  scope: EnvironmentVariableScope | null;
  scopeHint: EnvironmentVariableScope;
  isSecret: boolean;
  source: "managed" | "managed+environment" | "environment" | "missing";
  status: "configured" | "pending_restart" | "missing";
  valuePreview: string | null;
  revealable: boolean;
  hasManagedValue: boolean;
  hasLiveValue: boolean;
  serverRestartNeeded: boolean;
  runtimeRestartNeeded: boolean;
  updatedAt?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ENVIRONMENT_STATE_PATH = path.resolve(__dirname, "../../data/environment-variables.json");
export const ENVIRONMENT_OVERRIDES_PATH = path.resolve(__dirname, "../../data/environment-overrides.env");

const EMPTY_STATE: EnvironmentStateFile = {
  variables: [],
  lastChangedAt: null,
  lastServerChangeAt: null,
  lastRuntimeChangeAt: null,
};

export const ENVIRONMENT_CATALOG: EnvironmentCatalogItem[] = [
  {
    key: "GEMINI_API_KEY",
    label: "Gemini API key",
    group: "AI",
    description: "Primary Gemini key used for chat, summaries, and AI tooling.",
    scopeHint: "all",
    isSecret: true,
  },
  {
    key: "GOOGLE_CLIENT_ID",
    label: "Google OAuth client ID",
    group: "Google",
    description: "Google OAuth client ID for sign-in and Workspace access.",
    scopeHint: "server",
    isSecret: false,
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    label: "Google OAuth client secret",
    group: "Google",
    description: "Google OAuth client secret for sign-in and Workspace access.",
    scopeHint: "server",
    isSecret: true,
  },
  {
    key: "GOOGLE_REDIRECT_URI",
    label: "Google OAuth redirect URI",
    group: "Google",
    description: "OAuth callback URL registered with Google.",
    scopeHint: "server",
    isSecret: false,
  },
  {
    key: "GOOGLE_SERVICE_ACCOUNT_JSON",
    label: "Google service account JSON",
    group: "Google",
    description: "Inline service-account JSON for Google Cloud TTS and related services.",
    scopeHint: "server",
    isSecret: true,
  },
  {
    key: "GOOGLE_APPLICATION_CREDENTIALS",
    label: "Google credentials file path",
    group: "Google",
    description: "Filesystem path to Google application credentials.",
    scopeHint: "server",
    isSecret: false,
  },
  {
    key: "TWILIO_ACCOUNT_SID",
    label: "Twilio account SID",
    group: "Twilio",
    description: "Twilio account identifier for messaging and voice APIs.",
    scopeHint: "all",
    isSecret: false,
  },
  {
    key: "TWILIO_AUTH_TOKEN",
    label: "Twilio auth token",
    group: "Twilio",
    description: "Twilio authentication token for API access.",
    scopeHint: "all",
    isSecret: true,
  },
  {
    key: "TWILIO_PHONE_NUMBER",
    label: "Twilio phone number",
    group: "Twilio",
    description: "Primary Twilio number Meowstik uses for calls and SMS.",
    scopeHint: "all",
    isSecret: false,
  },
  {
    key: "OWNER_PHONE_NUMBER",
    label: "Owner phone number",
    group: "Twilio",
    description: "Owner callback number used in local single-user flows.",
    scopeHint: "all",
    isSecret: false,
  },
  {
    key: "ELEVENLABS_API_KEY",
    label: "ElevenLabs API key",
    group: "Voice",
    description: "API key for ElevenLabs speech synthesis.",
    scopeHint: "server",
    isSecret: true,
  },
  {
    key: "TTS_PROVIDER",
    label: "Default TTS provider",
    group: "Voice",
    description: "Default speech provider selection, such as google or elevenlabs.",
    scopeHint: "server",
    isSecret: false,
  },
  {
    key: "BROWSERBASE_API_KEY",
    label: "Browserbase API key",
    group: "Browser",
    description: "API key for Browserbase-powered browser sessions.",
    scopeHint: "server",
    isSecret: true,
  },
  {
    key: "BROWSERBASE_PROJECT_ID",
    label: "Browserbase project ID",
    group: "Browser",
    description: "Browserbase project identifier.",
    scopeHint: "server",
    isSecret: false,
  },
  {
    key: "GOOGLE_SEARCH_API_KEY",
    label: "Google Search API key",
    group: "Search",
    description: "Google Custom Search API key.",
    scopeHint: "server",
    isSecret: true,
  },
  {
    key: "GOOGLE_SEARCH_ENGINE_ID",
    label: "Search engine ID",
    group: "Search",
    description: "Google Custom Search engine identifier.",
    scopeHint: "server",
    isSecret: false,
  },
  {
    key: "EXA_API_KEY",
    label: "Exa API key",
    group: "Search",
    description: "Exa neural search API key.",
    scopeHint: "server",
    isSecret: true,
  },
  {
    key: "SESSION_SECRET",
    label: "Session secret",
    group: "Core",
    description: "Express session signing secret.",
    scopeHint: "server",
    isSecret: true,
  },
  {
    key: "COPILOT_GITHUB_TOKEN",
    label: "Copilot GitHub token",
    group: "Copilot",
    description: "Optional GitHub token passed into the Copilot CLI integration.",
    scopeHint: "server",
    isSecret: true,
  },
];

function parseIso(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isValidEnvironmentKey(key: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(key.trim());
}

export function maskEnvironmentValue(value: string): string {
  if (value.length === 0) {
    return "[empty]";
  }

  return `[set · ${value.length} chars]`;
}

function escapeEnvValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

export function serializeEnvironmentOverrides(variables: ManagedEnvironmentVariable[]): string {
  const lines = variables
    .filter((variable) => variable.scope === "server" || variable.scope === "all")
    .slice()
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((variable) => `${variable.key}="${escapeEnvValue(variable.value)}"`);

  return [
    "# Managed by Meowstik Environment / Secrets",
    "# Server-scoped variables apply after the app restarts.",
    ...lines,
    "",
  ].join("\n");
}

export function isServerRestartNeeded(lastServerChangeAt: string | null, processStartedAt: Date): boolean {
  const changeTime = parseIso(lastServerChangeAt);
  return changeTime !== null && changeTime > processStartedAt.getTime();
}

export function getStaleRuntimeServiceIds(
  lastRuntimeChangeAt: string | null,
  services: Array<{ id: string; status: string; startedAt?: string }>
): string[] {
  const runtimeChangeTime = parseIso(lastRuntimeChangeAt);
  if (runtimeChangeTime === null) {
    return [];
  }

  return services
    .filter((service) => service.status === "starting" || service.status === "running")
    .filter((service) => {
      const startedAt = parseIso(service.startedAt);
      return startedAt !== null && startedAt < runtimeChangeTime;
    })
    .map((service) => service.id);
}

export function buildEnvironmentVariableSnapshot(options: {
  catalogItem?: EnvironmentCatalogItem;
  definition?: ManagedEnvironmentVariable;
  liveValue?: string;
  processStartedAt: Date;
  lastServerChangeAt: string | null;
  staleRuntimeServiceIds: string[];
}): EnvironmentVariableSnapshot {
  const { catalogItem, definition, liveValue, processStartedAt, lastServerChangeAt, staleRuntimeServiceIds } = options;
  const key = definition?.key ?? catalogItem?.key ?? "";
  const label = catalogItem?.label ?? key;
  const group = catalogItem?.group ?? "Custom";
  const description = definition?.description ?? catalogItem?.description ?? null;
  const scope = definition?.scope ?? null;
  const scopeHint = definition?.scope ?? catalogItem?.scopeHint ?? "server";
  const isSecret = catalogItem?.isSecret ?? true;
  const hasManagedValue = !!definition;
  const hasLiveValue = typeof liveValue === "string";
  const serverRestartNeeded =
    !!definition &&
    (definition.scope === "server" || definition.scope === "all") &&
    isServerRestartNeeded(lastServerChangeAt, processStartedAt);
  const runtimeRestartNeeded =
    !!definition &&
    (definition.scope === "runtime" || definition.scope === "all") &&
    staleRuntimeServiceIds.length > 0;

  let source: EnvironmentVariableSnapshot["source"] = "missing";
  if (definition && hasLiveValue && serverRestartNeeded) {
    source = "managed+environment";
  } else if (definition) {
    source = "managed";
  } else if (hasLiveValue) {
    source = "environment";
  }

  let status: EnvironmentVariableSnapshot["status"] = "missing";
  if (definition || hasLiveValue) {
    status = serverRestartNeeded || runtimeRestartNeeded ? "pending_restart" : "configured";
  }

  return {
    key,
    label,
    group,
    description,
    scope,
    scopeHint,
    isSecret,
    source,
    status,
    valuePreview: definition ? maskEnvironmentValue(definition.value) : hasLiveValue ? maskEnvironmentValue(liveValue ?? "") : null,
    revealable: !!definition,
    hasManagedValue,
    hasLiveValue,
    serverRestartNeeded,
    runtimeRestartNeeded,
    updatedAt: definition?.updatedAt,
  };
}

function normalizeVariable(input: ManagedEnvironmentVariable): ManagedEnvironmentVariable {
  return {
    key: input.key.trim().toUpperCase(),
    value: input.value,
    scope: input.scope,
    description: input.description?.trim() || null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function normalizeState(raw: unknown): EnvironmentStateFile {
  if (Array.isArray(raw)) {
    return {
      ...EMPTY_STATE,
      variables: raw
        .filter((item): item is ManagedEnvironmentVariable => !!item && typeof item === "object")
        .map((item) => normalizeVariable(item)),
    };
  }

  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_STATE };
  }

  const record = raw as Partial<EnvironmentStateFile>;
  return {
    variables: Array.isArray(record.variables) ? record.variables.map((item) => normalizeVariable(item)) : [],
    lastChangedAt: typeof record.lastChangedAt === "string" ? record.lastChangedAt : null,
    lastServerChangeAt: typeof record.lastServerChangeAt === "string" ? record.lastServerChangeAt : null,
    lastRuntimeChangeAt: typeof record.lastRuntimeChangeAt === "string" ? record.lastRuntimeChangeAt : null,
  };
}

function touchesServer(scope: EnvironmentVariableScope): boolean {
  return scope === "server" || scope === "all";
}

function touchesRuntime(scope: EnvironmentVariableScope): boolean {
  return scope === "runtime" || scope === "all";
}

class EnvironmentManager {
  private state: EnvironmentStateFile = { ...EMPTY_STATE };
  private initialized = false;
  private persistChain: Promise<void> = Promise.resolve();

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await fsp.mkdir(path.dirname(ENVIRONMENT_STATE_PATH), { recursive: true });

    if (!fs.existsSync(ENVIRONMENT_STATE_PATH)) {
      await fsp.writeFile(ENVIRONMENT_STATE_PATH, `${JSON.stringify(EMPTY_STATE, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
    }

    const raw = await fsp.readFile(ENVIRONMENT_STATE_PATH, "utf8");
    this.state = normalizeState(JSON.parse(raw));
    this.initialized = true;
  }

  private async persistState(): Promise<void> {
    const payload = `${JSON.stringify(this.state, null, 2)}\n`;
    const overrides = serializeEnvironmentOverrides(this.state.variables);

    this.persistChain = this.persistChain.then(async () => {
      await fsp.mkdir(path.dirname(ENVIRONMENT_STATE_PATH), { recursive: true });

      const stateTempPath = `${ENVIRONMENT_STATE_PATH}.tmp`;
      await fsp.writeFile(stateTempPath, payload, { encoding: "utf8", mode: 0o600 });
      await fsp.rename(stateTempPath, ENVIRONMENT_STATE_PATH);
      await fsp.chmod(ENVIRONMENT_STATE_PATH, 0o600).catch(() => {});

      const overridesTempPath = `${ENVIRONMENT_OVERRIDES_PATH}.tmp`;
      await fsp.writeFile(overridesTempPath, overrides, { encoding: "utf8", mode: 0o600 });
      await fsp.rename(overridesTempPath, ENVIRONMENT_OVERRIDES_PATH);
      await fsp.chmod(ENVIRONMENT_OVERRIDES_PATH, 0o600).catch(() => {});
    });

    await this.persistChain;
  }

  async getState(): Promise<EnvironmentStateFile> {
    await this.ensureLoaded();
    return {
      variables: this.state.variables.map((variable) => ({ ...variable })),
      lastChangedAt: this.state.lastChangedAt,
      lastServerChangeAt: this.state.lastServerChangeAt,
      lastRuntimeChangeAt: this.state.lastRuntimeChangeAt,
    };
  }

  async listVariables(): Promise<ManagedEnvironmentVariable[]> {
    await this.ensureLoaded();
    return this.state.variables
      .slice()
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((variable) => ({ ...variable }));
  }

  async getVariable(key: string): Promise<ManagedEnvironmentVariable | undefined> {
    await this.ensureLoaded();
    const normalizedKey = key.trim().toUpperCase();
    const variable = this.state.variables.find((item) => item.key === normalizedKey);
    return variable ? { ...variable } : undefined;
  }

  async revealManagedValue(key: string): Promise<string> {
    const variable = await this.getVariable(key);
    if (!variable) {
      throw new Error("Managed environment variable not found");
    }

    return variable.value;
  }

  async getRuntimeEnvOverrides(): Promise<NodeJS.ProcessEnv> {
    await this.ensureLoaded();

    const env: NodeJS.ProcessEnv = {};
    for (const variable of this.state.variables) {
      if (touchesRuntime(variable.scope)) {
        env[variable.key] = variable.value;
      }
    }

    return env;
  }

  async upsertVariable(input: {
    key: string;
    value: string;
    scope: EnvironmentVariableScope;
    description?: string | null;
  }): Promise<ManagedEnvironmentVariable> {
    await this.ensureLoaded();

    const key = input.key.trim().toUpperCase();
    if (!isValidEnvironmentKey(key)) {
      throw new Error("Environment variable keys must match /^[A-Z_][A-Z0-9_]*$/");
    }

    const now = new Date().toISOString();
    const existingIndex = this.state.variables.findIndex((variable) => variable.key === key);
    const existing = existingIndex === -1 ? undefined : this.state.variables[existingIndex];

    const nextVariable: ManagedEnvironmentVariable = {
      key,
      value: input.value,
      scope: input.scope,
      description: input.description?.trim() || null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existingIndex === -1) {
      this.state.variables.push(nextVariable);
    } else {
      this.state.variables[existingIndex] = nextVariable;
    }

    this.state.lastChangedAt = now;
    if (touchesServer(existing?.scope ?? input.scope) || touchesServer(input.scope)) {
      this.state.lastServerChangeAt = now;
    }
    if (touchesRuntime(existing?.scope ?? input.scope) || touchesRuntime(input.scope)) {
      this.state.lastRuntimeChangeAt = now;
    }

    await this.persistState();
    return { ...nextVariable };
  }

  async updateVariable(
    key: string,
    updates: {
      value: string;
      scope: EnvironmentVariableScope;
      description?: string | null;
    }
  ): Promise<ManagedEnvironmentVariable> {
    await this.ensureLoaded();

    const existing = await this.getVariable(key);
    if (!existing) {
      throw new Error("Managed environment variable not found");
    }

    return this.upsertVariable({
      key: existing.key,
      value: updates.value,
      scope: updates.scope,
      description: updates.description,
    });
  }

  async deleteVariable(key: string): Promise<void> {
    await this.ensureLoaded();

    const normalizedKey = key.trim().toUpperCase();
    const existing = this.state.variables.find((variable) => variable.key === normalizedKey);
    if (!existing) {
      return;
    }

    this.state.variables = this.state.variables.filter((variable) => variable.key !== normalizedKey);

    const now = new Date().toISOString();
    this.state.lastChangedAt = now;
    if (touchesServer(existing.scope)) {
      this.state.lastServerChangeAt = now;
    }
    if (touchesRuntime(existing.scope)) {
      this.state.lastRuntimeChangeAt = now;
    }

    await this.persistState();
  }
}

export const environmentManager = new EnvironmentManager();
