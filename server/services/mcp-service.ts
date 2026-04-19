import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServer } from "@shared/schema";
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

const MCP_LIBRARY: McpLibraryEntry[] = [
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

  async updateServer(serverId: string, input: {
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

    return storage.updateMcpServer(serverId, {
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

  async deleteServer(serverId: string): Promise<boolean> {
    this.ensureSchema();
    await this.invalidateServer(serverId);
    return storage.deleteMcpServer(serverId);
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

    return Promise.all(
      servers.map(async (server) => {
        const client = await this.getClient(server);
        const result = await client.listTools();

        return {
          server: {
            id: server.id,
            name: server.name,
            slug: server.slug,
            transport: server.transport,
            enabled: server.enabled,
          },
          tools: result.tools.map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: (tool.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
          })),
        };
      }),
    );
  }

  async testServer(userId: string, identifier: string): Promise<{
    ok: boolean;
    server: Pick<McpServer, "id" | "name" | "slug" | "transport">;
    toolCount: number;
  }> {
    const [result] = await this.listTools(userId, identifier);

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
    const client = await this.getClient(server);
    const result = await client.callTool({
      name: toolName,
      arguments: args,
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

      const transport = new StreamableHTTPClientTransport(new URL(server.endpointUrl), {
        requestInit: {
          headers: normaliseMap(server.headers),
        },
      });
      await client.connect(transport);
      close = () => transport.close();
    } else if (server.transport === "sse") {
      if (!server.endpointUrl) {
        throw new Error(`MCP server "${server.name}" is missing an endpoint URL`);
      }

      const transport = new SSEClientTransport(new URL(server.endpointUrl), {
        requestInit: {
          headers: normaliseMap(server.headers),
        },
      });
      await client.connect(transport);
      close = () => transport.close();
    } else {
      if (!server.command) {
        throw new Error(`MCP server "${server.name}" is missing a command`);
      }

      const transport = new StdioClientTransport({
        command: server.command,
        args: normaliseArgs(server.args),
        cwd: resolveCwd(server.cwd),
        env: {
          ...process.env,
          ...normaliseMap(server.env),
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
