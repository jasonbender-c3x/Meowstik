import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServer } from "@shared/schema";
import fs from "fs";
import { nanoid } from "nanoid";
import os from "os";
import path from "path";
import { resolveRuntimeArgs, resolveRuntimeMap, resolveRuntimeString } from "./mcp-runtime-resolution";
import { storage } from "../storage";
import { rawDb } from "../db";

export type McpLibraryEntry = {
  key: string;
  name: string;
  description: string;
  transport: "stdio" | "streamable-http" | "sse";
  docsUrl?: string;
  homepage?: string;
  template: {
    endpointUrl?: string;
    command?: string;
    args?: string[];
    cwd?: string;
    headers?: Record<string, string>;
    env?: Record<string, string>;
  };
};

type ActiveClient = {
  client: Client;
  close: () => Promise<void>;
};

export type McpLoggingLevel = "errors" | "basic" | "verbose";

export type McpLoggingSettings = {
  userId: string;
  level: McpLoggingLevel;
  verboseBudget: number;
  captureResponses: boolean;
  updatedAt: number;
};

export type McpTrafficLog = {
  id: string;
  userId: string;
  serverId: string | null;
  serverName: string;
  transport: McpServer["transport"] | null;
  eventType: "list_tools" | "test_server" | "call_tool";
  toolName: string | null;
  status: "ok" | "error";
  summary: string;
  requestPayload: unknown;
  responsePayload: unknown;
  errorMessage: string | null;
  createdAt: number;
};

const MCP_LIBRARY: McpLibraryEntry[] = [
  {
    key: "google-workspace-mcp-local",
    name: "Google Workspace MCP (local)",
    description: "All-in-one Google Workspace server for Gmail, Calendar, Docs, Sheets, Tasks, Contacts, Drive, Slides, and more using local stdio auth flow.",
    transport: "stdio",
    homepage: "https://github.com/taylorwilsdon/google_workspace_mcp",
    docsUrl: "https://workspacemcp.com/quick-start",
    template: {
      command: "uvx",
      args: ["workspace-mcp", "--tool-tier", "complete"],
      env: {
        GOOGLE_OAUTH_CLIENT_ID: "${GOOGLE_OAUTH_CLIENT_ID}",
        GOOGLE_OAUTH_CLIENT_SECRET: "${GOOGLE_OAUTH_CLIENT_SECRET}",
        OAUTHLIB_INSECURE_TRANSPORT: "1",
      },
    },
  },
  {
    key: "google-workspace-mcp-remote",
    name: "Google Workspace MCP (hosted)",
    description: "Connect to a centrally hosted Google Workspace MCP server over HTTP with OAuth 2.1 or service-account backed auth.",
    transport: "streamable-http",
    homepage: "https://github.com/taylorwilsdon/google_workspace_mcp",
    docsUrl: "https://workspacemcp.com/docs",
    template: {
      endpointUrl: "http://localhost:8000/mcp",
      headers: {
        Authorization: "Bearer ${WORKSPACE_MCP_BEARER_TOKEN}",
      },
    },
  },
  {
    key: "claude-code-explorer-mcp",
    name: "Claude Code Explorer MCP",
    description: "Repository snooper / explorer server for the Claude Code source snapshot, as documented in the desktop claude-code report.",
    transport: "stdio",
    homepage: "https://www.npmjs.com/package/claude-code-explorer-mcp",
    docsUrl: "https://www.npmjs.com/package/claude-code-explorer-mcp",
    template: {
      command: "npx",
      args: ["-y", "claude-code-explorer-mcp"],
    },
  },
  {
    key: "nelson-mcp",
    name: "Nelson MCP",
    description: "LibreOffice MCP server over HTTP for reading and editing Writer, Calc, Draw, and Impress documents.",
    transport: "streamable-http",
    homepage: "https://github.com/quazardous/nelson-mcp",
    docsUrl: "https://extensions.libreoffice.org/en/extensions/show/99528",
    template: {
      endpointUrl: "http://localhost:8766/mcp",
    },
  },
  {
    key: "libreoffice-mcp",
    name: "LibreOffice MCP",
    description: "Local stdio MCP server from mcp-libre for creating, converting, reading, and editing LibreOffice documents.",
    transport: "stdio",
    homepage: "https://github.com/patrup/mcp-libre",
    docsUrl: "https://github.com/patrup/mcp-libre#readme",
    template: {
      command: "uv",
      args: ["run", "python", "src/main.py"],
      cwd: "mcp-libre",
    },
  },
  {
    key: "puppeteer-mcp",
    name: "Puppeteer MCP",
    description: "Local browser automation MCP server bundled with Meowstik.",
    transport: "stdio",
    template: {
      command: "npx",
      args: ["tsx", "src/index.ts"],
      cwd: "servers/puppeteer-mcp",
    },
  },
  {
    key: "filesystem-mcp",
    name: "Filesystem MCP",
    description: "Official reference MCP server for controlled local file access.",
    transport: "stdio",
    homepage: "https://github.com/modelcontextprotocol/servers",
    docsUrl: "https://registry.modelcontextprotocol.io/",
    template: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
  },
  {
    key: "fetch-mcp",
    name: "Fetch MCP",
    description: "Official reference MCP server for web fetching and page conversion.",
    transport: "stdio",
    homepage: "https://github.com/modelcontextprotocol/servers",
    docsUrl: "https://registry.modelcontextprotocol.io/",
    template: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
    },
  },
  {
    key: "git-mcp",
    name: "Git MCP",
    description: "Official reference MCP server for reading and manipulating Git repositories.",
    transport: "stdio",
    homepage: "https://github.com/modelcontextprotocol/servers",
    docsUrl: "https://registry.modelcontextprotocol.io/",
    template: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-git"],
    },
  },
  {
    key: "memory-mcp",
    name: "Memory MCP",
    description: "Official reference MCP server for persistent knowledge-graph memory.",
    transport: "stdio",
    homepage: "https://github.com/modelcontextprotocol/servers",
    docsUrl: "https://registry.modelcontextprotocol.io/",
    template: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
    },
  },
  {
    key: "time-mcp",
    name: "Time MCP",
    description: "Official reference MCP server for time and timezone utilities.",
    transport: "stdio",
    homepage: "https://github.com/modelcontextprotocol/servers",
    docsUrl: "https://registry.modelcontextprotocol.io/",
    template: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-time"],
    },
  },
  {
    key: "sequentialthinking-mcp",
    name: "Sequential Thinking MCP",
    description: "Official reference MCP server for reflective step-by-step reasoning support.",
    transport: "stdio",
    homepage: "https://github.com/modelcontextprotocol/servers",
    docsUrl: "https://registry.modelcontextprotocol.io/",
    template: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sequentialthinking"],
    },
  },
  {
    key: "everything-mcp",
    name: "Everything MCP",
    description: "Official reference test server that exposes prompts, resources, and tools.",
    transport: "stdio",
    homepage: "https://github.com/modelcontextprotocol/servers",
    docsUrl: "https://registry.modelcontextprotocol.io/",
    template: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything"],
    },
  },
];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "mcp-server";
}

function normaliseMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null)
    .map(([key, entryValue]) => [key, String(entryValue)] as const);

  return Object.fromEntries(entries);
}

function normaliseArgs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry !== undefined && entry !== null)
    .map((entry) => String(entry));
}

function resolveCwd(cwd: string | null | undefined): string | undefined {
  if (!cwd) return undefined;
  if (cwd.startsWith("/")) return cwd;
  return `${process.cwd()}/${cwd}`;
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "MCP Server";
}

type CanonicalMcpServerEntry = {
  type?: string;
  transport?: string;
  name?: string;
  description?: string;
  command?: string;
  args?: unknown;
  cwd?: string;
  env?: unknown;
  headers?: unknown;
  url?: string;
  endpointUrl?: string;
  enabled?: boolean;
};

type CanonicalMcpConfig = {
  mcpServers?: Record<string, CanonicalMcpServerEntry>;
};

type CanonicalImportResult = {
  created: number;
  updated: number;
  skipped: Array<{ key: string; reason: string }>;
  servers: Array<{ key: string; id: string; action: "created" | "updated"; slug: string; name: string }>;
  configPath: string;
};

function normaliseTransport(entry: CanonicalMcpServerEntry): "stdio" | "streamable-http" | "sse" {
  const candidate = String(entry.transport ?? entry.type ?? "").trim().toLowerCase();
  if (candidate === "stdio") return "stdio";
  if (candidate === "sse") return "sse";
  if (candidate === "streamable-http" || candidate === "http" || candidate === "https") {
    return "streamable-http";
  }

  return entry.command ? "stdio" : "streamable-http";
}

function parseJsonPayload(value: unknown): unknown {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class McpService {
  private clients = new Map<string, ActiveClient>();
  private schemaReady = false;

  private ensureSchema(): void {
    if (this.schemaReady) return;

    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        transport TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'custom',
        library_key TEXT,
        endpoint_url TEXT,
        command TEXT,
        args TEXT,
        env TEXT,
        headers TEXT,
        cwd TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_servers_user ON mcp_servers(user_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_servers_slug ON mcp_servers(slug);
      CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
      CREATE TABLE IF NOT EXISTS mcp_logging_settings (
        user_id TEXT PRIMARY KEY,
        level TEXT NOT NULL DEFAULT 'errors',
        verbose_budget INTEGER NOT NULL DEFAULT 0,
        capture_responses INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE TABLE IF NOT EXISTS mcp_traffic_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        server_id TEXT,
        server_name TEXT NOT NULL,
        transport TEXT,
        event_type TEXT NOT NULL,
        tool_name TEXT,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        request_payload TEXT,
        response_payload TEXT,
        error_message TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_traffic_logs_user_created
        ON mcp_traffic_logs(user_id, created_at DESC);
    `);

    this.schemaReady = true;
  }

  getLibrary(): McpLibraryEntry[] {
    return MCP_LIBRARY;
  }

  getLibraryEntry(key: string): McpLibraryEntry | undefined {
    return MCP_LIBRARY.find((entry) => entry.key === key);
  }

  async listServers(userId: string): Promise<McpServer[]> {
    this.ensureSchema();
    return storage.getMcpServers(userId);
  }

  async listEnabledServers(userId: string): Promise<McpServer[]> {
    this.ensureSchema();
    return storage.getEnabledMcpServers(userId);
  }

  async getLoggingSettings(userId: string): Promise<McpLoggingSettings> {
    this.ensureSchema();
    rawDb
      .prepare(`
        INSERT OR IGNORE INTO mcp_logging_settings (user_id)
        VALUES (?)
      `)
      .run(userId);

    const row = rawDb
      .prepare(`
        SELECT user_id, level, verbose_budget, capture_responses, updated_at
        FROM mcp_logging_settings
        WHERE user_id = ?
      `)
      .get(userId) as
      | {
          user_id: string;
          level: McpLoggingLevel;
          verbose_budget: number;
          capture_responses: number;
          updated_at: number;
        }
      | undefined;

    return {
      userId,
      level: row?.level ?? "errors",
      verboseBudget: Math.max(0, row?.verbose_budget ?? 0),
      captureResponses: Boolean(row?.capture_responses ?? 1),
      updatedAt: row?.updated_at ?? Date.now(),
    };
  }

  async updateLoggingSettings(
    userId: string,
    input: Partial<Pick<McpLoggingSettings, "level" | "verboseBudget" | "captureResponses">>,
  ): Promise<McpLoggingSettings> {
    const current = await this.getLoggingSettings(userId);
    const next: McpLoggingSettings = {
      userId,
      level: input.level ?? current.level,
      verboseBudget:
        input.verboseBudget !== undefined ? Math.max(0, Math.floor(input.verboseBudget)) : current.verboseBudget,
      captureResponses: input.captureResponses ?? current.captureResponses,
      updatedAt: Date.now(),
    };

    rawDb
      .prepare(`
        INSERT INTO mcp_logging_settings (user_id, level, verbose_budget, capture_responses, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          level = excluded.level,
          verbose_budget = excluded.verbose_budget,
          capture_responses = excluded.capture_responses,
          updated_at = excluded.updated_at
      `)
      .run(
        next.userId,
        next.level,
        next.verboseBudget,
        next.captureResponses ? 1 : 0,
        next.updatedAt,
      );

    return next;
  }

  async armVerboseLogging(userId: string, operations: number): Promise<McpLoggingSettings> {
    const current = await this.getLoggingSettings(userId);
    return this.updateLoggingSettings(userId, {
      level: current.level,
      captureResponses: current.captureResponses,
      verboseBudget: Math.max(1, Math.floor(operations)),
    });
  }

  async listTrafficLogs(userId: string, limit = 50): Promise<McpTrafficLog[]> {
    this.ensureSchema();
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 200);
    const rows = rawDb
      .prepare(`
        SELECT
          id,
          user_id,
          server_id,
          server_name,
          transport,
          event_type,
          tool_name,
          status,
          summary,
          request_payload,
          response_payload,
          error_message,
          created_at
        FROM mcp_traffic_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(userId, safeLimit) as Array<{
        id: string;
        user_id: string;
        server_id: string | null;
        server_name: string;
        transport: McpServer["transport"] | null;
        event_type: McpTrafficLog["eventType"];
        tool_name: string | null;
        status: McpTrafficLog["status"];
        summary: string;
        request_payload: string | null;
        response_payload: string | null;
        error_message: string | null;
        created_at: number;
      }>;

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      serverId: row.server_id,
      serverName: row.server_name,
      transport: row.transport,
      eventType: row.event_type,
      toolName: row.tool_name,
      status: row.status,
      summary: row.summary,
      requestPayload: parseJsonPayload(row.request_payload),
      responsePayload: parseJsonPayload(row.response_payload),
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
  }

  async clearTrafficLogs(userId: string): Promise<void> {
    this.ensureSchema();
    rawDb.prepare(`DELETE FROM mcp_traffic_logs WHERE user_id = ?`).run(userId);
  }

  async createServer(input: {
    userId: string;
    name?: string;
    slug?: string;
    description?: string;
    transport?: "stdio" | "streamable-http" | "sse";
    endpointUrl?: string;
    command?: string;
    args?: string[];
    cwd?: string;
    headers?: Record<string, string>;
    env?: Record<string, string>;
    enabled?: boolean;
    source?: "custom" | "library";
    libraryKey?: string;
  }): Promise<McpServer> {
    this.ensureSchema();

    const name = input.name?.trim() || "MCP Server";
    const baseSlug = slugify(input.slug || name);
    const slug = await this.getUniqueSlug(input.userId, baseSlug);

    return storage.createMcpServer({
      userId: input.userId,
      name,
      slug,
      description: input.description?.trim() || null,
      transport: input.transport ?? "streamable-http",
      endpointUrl: input.endpointUrl?.trim() || null,
      command: input.command?.trim() || null,
      args: normaliseArgs(input.args),
      cwd: input.cwd?.trim() || null,
      headers: normaliseMap(input.headers),
      env: normaliseMap(input.env),
      enabled: input.enabled ?? true,
      source: input.source ?? "custom",
      libraryKey: input.libraryKey ?? null,
    });
  }

  async createServerFromLibrary(userId: string, libraryKey: string): Promise<McpServer> {
    const entry = this.getLibraryEntry(libraryKey);
    if (!entry) {
      throw new Error(`Unknown MCP library entry: ${libraryKey}`);
    }

    return this.createServer({
      userId,
      name: entry.name,
      slug: libraryKey,
      description: entry.description,
      transport: entry.transport,
      endpointUrl: entry.template.endpointUrl,
      command: entry.template.command,
      args: entry.template.args,
      cwd: entry.template.cwd,
      headers: entry.template.headers,
      env: entry.template.env,
      source: "library",
      libraryKey: entry.key,
    });
  }

  async updateServer(userId: string, serverId: string, input: {
    name?: string;
    description?: string;
    transport?: "stdio" | "streamable-http" | "sse";
    endpointUrl?: string;
    command?: string;
    args?: string[];
    cwd?: string;
    headers?: Record<string, string>;
    env?: Record<string, string>;
    enabled?: boolean;
  }): Promise<McpServer | undefined> {
    this.ensureSchema();
    await this.invalidateServer(serverId);

    return storage.updateMcpServerForUser(userId, serverId, {
      ...(input.name !== undefined ? { name: input.name.trim() || "MCP Server" } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.transport !== undefined ? { transport: input.transport } : {}),
      ...(input.endpointUrl !== undefined ? { endpointUrl: input.endpointUrl.trim() || null } : {}),
      ...(input.command !== undefined ? { command: input.command.trim() || null } : {}),
      ...(input.args !== undefined ? { args: normaliseArgs(input.args) } : {}),
      ...(input.cwd !== undefined ? { cwd: input.cwd.trim() || null } : {}),
      ...(input.headers !== undefined ? { headers: normaliseMap(input.headers) } : {}),
      ...(input.env !== undefined ? { env: normaliseMap(input.env) } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    });
  }

  async deleteServer(userId: string, serverId: string): Promise<boolean> {
    this.ensureSchema();
    await this.invalidateServer(serverId);
    return storage.deleteMcpServerForUser(userId, serverId);
  }

  async importServersFromCanonicalConfig(userId: string): Promise<CanonicalImportResult> {
    this.ensureSchema();

    const copilotHome = process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot");
    const configPath = path.join(copilotHome, "mcp-config.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(`Canonical MCP config not found at ${configPath}`);
    }

    const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as CanonicalMcpConfig;
    if (!raw.mcpServers || typeof raw.mcpServers !== "object") {
      throw new Error(`Canonical MCP config is missing mcpServers: ${configPath}`);
    }

    const result: CanonicalImportResult = {
      created: 0,
      updated: 0,
      skipped: [],
      servers: [],
      configPath,
    };

    for (const [key, entry] of Object.entries(raw.mcpServers)) {
      const slug = slugify(key);
      const name = entry.name?.trim() || humanizeKey(key);
      const transport = normaliseTransport(entry);
      const endpointUrl = entry.endpointUrl?.trim() || entry.url?.trim() || undefined;
      const command = entry.command?.trim() || undefined;

      if (transport === "stdio" && !command) {
        result.skipped.push({ key, reason: "Missing command for stdio server" });
        continue;
      }

      if ((transport === "streamable-http" || transport === "sse") && !endpointUrl) {
        result.skipped.push({ key, reason: "Missing endpoint URL for network server" });
        continue;
      }

      const payload = {
        name,
        description: entry.description?.trim() || `Imported from ${configPath}`,
        transport,
        endpointUrl,
        command,
        args: normaliseArgs(entry.args),
        cwd: entry.cwd?.trim() || undefined,
        headers: normaliseMap(entry.headers),
        env: normaliseMap(entry.env),
      };

      const existing = await storage.getMcpServerBySlug(userId, slug);
      if (existing) {
        const updated = await storage.updateMcpServerForUser(userId, existing.id, {
          ...payload,
          enabled: existing.enabled,
        });
        if (!updated) {
          result.skipped.push({ key, reason: "Existing server could not be updated" });
          continue;
        }
        await this.invalidateServer(existing.id);
        result.updated += 1;
        result.servers.push({ key, id: updated.id, action: "updated", slug: updated.slug, name: updated.name });
        continue;
      }

      const created = await this.createServer({
        userId,
        slug,
        ...payload,
        enabled: entry.enabled ?? true,
        source: "custom",
      });
      result.created += 1;
      result.servers.push({ key, id: created.id, action: "created", slug: created.slug, name: created.name });
    }

    return result;
  }

  async invalidateServer(serverId: string): Promise<void> {
    const existing = this.clients.get(serverId);
    if (!existing) return;

    this.clients.delete(serverId);
    await existing.close();
  }

  async listTools(userId: string, identifier?: string): Promise<Array<{
    server: Pick<McpServer, "id" | "name" | "slug" | "transport" | "enabled">;
    tools: Array<{
      name: string;
      title?: string;
      description?: string;
      inputSchema: Record<string, unknown>;
    }>;
  }>> {
    const servers = identifier
      ? [await this.resolveServer(userId, identifier)]
      : await this.listEnabledServers(userId);

    return Promise.all(servers.map((server) => this.inspectServerTools(userId, server, "list_tools")));
  }

  async testServer(userId: string, identifier: string): Promise<{
    ok: boolean;
    server: Pick<McpServer, "id" | "name" | "slug" | "transport">;
    toolCount: number;
  }> {
    const server = await this.resolveServer(userId, identifier);
    const result = await this.inspectServerTools(userId, server, "test_server");

    return {
      ok: true,
      server: result.server,
      toolCount: result.tools.length,
    };
  }

  async callTool(userId: string, identifier: string, toolName: string, args: Record<string, unknown> = {}): Promise<{
    server: Pick<McpServer, "id" | "name" | "slug" | "transport">;
    toolName: string;
    result: unknown;
  }> {
    const server = await this.resolveServer(userId, identifier);
    const requestPayload = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    try {
      const client = await this.getClient(server);
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });

      await this.logTrafficExchange({
        userId,
        server,
        eventType: "call_tool",
        toolName,
        status: "ok",
        summary: `Called ${toolName} on ${server.name}`,
        requestPayload,
        responsePayload: result,
      });

      return {
        server: {
          id: server.id,
          name: server.name,
          slug: server.slug,
          transport: server.transport,
        },
        toolName,
        result,
      };
    } catch (error) {
      await this.logTrafficExchange({
        userId,
        server,
        eventType: "call_tool",
        toolName,
        status: "error",
        summary: `Failed to call ${toolName} on ${server.name}`,
        requestPayload,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async buildPromptSummary(userId: string): Promise<string | null> {
    const servers = await this.listEnabledServers(userId);
    if (servers.length === 0) return null;

    const lines = servers.map((server) => {
      const location = server.transport === "stdio"
        ? [server.command, ...(server.args ?? [])].filter(Boolean).join(" ")
        : server.endpointUrl
      return `- ${server.name} (\`${server.slug}\`, ${server.transport}${location ? `, ${location}` : ""})`;
    });

    return [
      "## MCP SERVERS",
      "You can use configured MCP servers through the MCP tools below.",
      "Start with `mcp_list_servers` or `mcp_list_tools` when you need to inspect capabilities, then use `mcp_call` to invoke the chosen MCP tool.",
      "Enabled MCP servers:",
      ...lines,
    ].join("\n");
  }

  private async logTrafficExchange(input: {
    userId: string;
    server: Pick<McpServer, "id" | "name" | "transport">;
    eventType: McpTrafficLog["eventType"];
    toolName?: string;
    status: McpTrafficLog["status"];
    summary: string;
    requestPayload?: unknown;
    responsePayload?: unknown;
    errorMessage?: string;
  }): Promise<void> {
    const settings = await this.getLoggingSettings(input.userId);
    const verboseCapture = settings.level === "verbose" || settings.verboseBudget > 0;
    const shouldPersist =
      input.status === "error" || settings.level === "basic" || settings.level === "verbose" || settings.verboseBudget > 0;

    if (!shouldPersist) {
      return;
    }

    rawDb
      .prepare(`
        INSERT INTO mcp_traffic_logs (
          id,
          user_id,
          server_id,
          server_name,
          transport,
          event_type,
          tool_name,
          status,
          summary,
          request_payload,
          response_payload,
          error_message,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        nanoid(),
        input.userId,
        input.server.id,
        input.server.name,
        input.server.transport,
        input.eventType,
        input.toolName ?? null,
        input.status,
        input.summary,
        input.requestPayload !== undefined ? JSON.stringify(input.requestPayload) : null,
        settings.captureResponses && input.responsePayload !== undefined
          ? JSON.stringify(input.responsePayload)
          : null,
        input.errorMessage ?? null,
        Date.now(),
      );

    if (verboseCapture && settings.level !== "verbose" && settings.verboseBudget > 0) {
      await this.updateLoggingSettings(input.userId, {
        level: settings.level,
        captureResponses: settings.captureResponses,
        verboseBudget: settings.verboseBudget - 1,
      });
    }
  }

  private async inspectServerTools(
    userId: string,
    server: McpServer,
    eventType: Extract<McpTrafficLog["eventType"], "list_tools" | "test_server">,
  ): Promise<{
    server: Pick<McpServer, "id" | "name" | "slug" | "transport" | "enabled">;
    tools: Array<{
      name: string;
      title?: string;
      description?: string;
      inputSchema: Record<string, unknown>;
    }>;
  }> {
    const requestPayload = {
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
    };

    try {
      const client = await this.getClient(server);
      const result = await client.listTools();
      const responsePayload = {
        tools: result.tools.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
        })),
      };

      await this.logTrafficExchange({
        userId,
        server,
        eventType,
        status: "ok",
        summary: `Discovered ${responsePayload.tools.length} tool(s) on ${server.name}`,
        requestPayload,
        responsePayload,
      });

      return {
        server: {
          id: server.id,
          name: server.name,
          slug: server.slug,
          transport: server.transport,
          enabled: server.enabled,
        },
        tools: responsePayload.tools,
      };
    } catch (error) {
      await this.logTrafficExchange({
        userId,
        server,
        eventType,
        status: "error",
        summary: `Failed to inspect tools on ${server.name}`,
        requestPayload,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async getUniqueSlug(userId: string, baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let index = 2;

    while (await storage.getMcpServerBySlug(userId, slug)) {
      slug = `${baseSlug}-${index}`;
      index += 1;
    }

    return slug;
  }

  private async resolveServer(userId: string, identifier: string): Promise<McpServer> {
    this.ensureSchema();

    const byId = await storage.getMcpServerById(identifier);
    if (byId && byId.userId === userId) {
      if (!byId.enabled) {
        throw new Error(`MCP server "${byId.name}" is disabled`);
      }
      return byId;
    }

    const all = await storage.getMcpServers(userId);
    const match = all.find((server) =>
      server.enabled && (server.slug === identifier || server.name === identifier),
    );

    if (!match) {
      throw new Error(`MCP server not found: ${identifier}`);
    }

    return match;
  }

  private async getClient(server: McpServer): Promise<Client> {
    const cached = this.clients.get(server.id);
    if (cached) {
      return cached.client;
    }

    const client = new Client({
      name: "meowstik-mcp-client",
      version: "1.0.0",
    });

    let close: () => Promise<void>;

    if (server.transport === "streamable-http") {
      if (!server.endpointUrl) {
        throw new Error(`MCP server "${server.name}" is missing an endpoint URL`);
      }

      const transport = new StreamableHTTPClientTransport(new URL(resolveRuntimeString(server.endpointUrl)), {
        requestInit: {
          headers: resolveRuntimeMap(normaliseMap(server.headers)),
        },
      });
      await client.connect(transport);
      close = () => transport.close();
    } else if (server.transport === "sse") {
      if (!server.endpointUrl) {
        throw new Error(`MCP server "${server.name}" is missing an endpoint URL`);
      }

      const transport = new SSEClientTransport(new URL(resolveRuntimeString(server.endpointUrl)), {
        requestInit: {
          headers: resolveRuntimeMap(normaliseMap(server.headers)),
        },
      });
      await client.connect(transport);
      close = () => transport.close();
    } else {
      if (!server.command) {
        throw new Error(`MCP server "${server.name}" is missing a command`);
      }

      const transport = new StdioClientTransport({
        command: resolveRuntimeString(server.command),
        args: resolveRuntimeArgs(normaliseArgs(server.args)),
        cwd: resolveCwd(server.cwd ? resolveRuntimeString(server.cwd) : server.cwd),
        env: {
          ...process.env,
          ...resolveRuntimeMap(normaliseMap(server.env)),
        } as Record<string, string>,
        stderr: "inherit",
      });
      await client.connect(transport);
      close = () => transport.close();
    }

    this.clients.set(server.id, { client, close });
    return client;
  }
}

export const mcpService = new McpService();
