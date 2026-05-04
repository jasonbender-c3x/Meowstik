import { Router } from "express";
import { z } from "zod";
import { GUEST_USER_ID } from "@shared/schema";
import { mcpService } from "../services/mcp-service";
import { badRequest, notFound } from "./middleware";

const router = Router();

const transportSchema = z.enum(["stdio", "streamable-http", "sse"]);

const mcpServerBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  transport: transportSchema.optional(),
  endpointUrl: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  headers: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
  libraryKey: z.string().optional(),
});

const mcpCallSchema = z.object({
  serverId: z.string().min(1),
  toolName: z.string().min(1),
  arguments: z.record(z.unknown()).optional(),
});

const mcpLoggingSettingsSchema = z.object({
  level: z.enum(["errors", "basic", "verbose"]).optional(),
  captureResponses: z.boolean().optional(),
  verboseBudget: z.number().int().min(0).max(50).optional(),
});

const mcpArmVerboseSchema = z.object({
  operations: z.number().int().min(1).max(50),
});

function getUserId(req: any): string {
  return req.authStatus?.userId || GUEST_USER_ID;
}

router.get("/library", (_req, res) => {
  res.json({ library: mcpService.getLibrary() });
});

router.get("/servers", async (req, res) => {
  const userId = getUserId(req);
  const servers = await mcpService.listServers(userId);
  res.json({ servers });
});

router.get("/logging", async (req, res) => {
  const userId = getUserId(req);
  const settings = await mcpService.getLoggingSettings(userId);
  res.json({ settings });
});

router.put("/logging", async (req, res) => {
  const userId = getUserId(req);
  const body = mcpLoggingSettingsSchema.parse(req.body ?? {});
  const settings = await mcpService.updateLoggingSettings(userId, body);
  res.json({ settings });
});

router.post("/logging/arm-verbose", async (req, res) => {
  const userId = getUserId(req);
  const body = mcpArmVerboseSchema.parse(req.body ?? {});
  const settings = await mcpService.armVerboseLogging(userId, body.operations);
  res.json({ settings });
});

router.get("/logs", async (req, res) => {
  const userId = getUserId(req);
  const limit = Number.parseInt(String(req.query.limit ?? "50"), 10);
  const logs = await mcpService.listTrafficLogs(userId, Number.isFinite(limit) ? limit : 50);
  res.json({ logs });
});

router.delete("/logs", async (req, res) => {
  const userId = getUserId(req);
  await mcpService.clearTrafficLogs(userId);
  res.status(204).end();
});

router.post("/servers", async (req, res) => {
  const userId = getUserId(req);
  const body = mcpServerBodySchema.parse(req.body ?? {});

  if (body.libraryKey) {
    const created = await mcpService.createServerFromLibrary(userId, body.libraryKey);
    return res.status(201).json({ server: created });
  }

  if ((body.transport === "streamable-http" || body.transport === "sse") && !body.endpointUrl) {
    throw badRequest("endpointUrl is required for HTTP or SSE MCP servers");
  }

  if (body.transport === "stdio" && !body.command) {
    throw badRequest("command is required for stdio MCP servers");
  }

  const created = await mcpService.createServer({
    userId,
    name: body.name,
    description: body.description,
    transport: body.transport,
    endpointUrl: body.endpointUrl,
    command: body.command,
    args: body.args,
    cwd: body.cwd,
    headers: body.headers,
    env: body.env,
    enabled: body.enabled,
  });

  res.status(201).json({ server: created });
});

router.patch("/servers/:id", async (req, res) => {
  const body = mcpServerBodySchema.parse(req.body ?? {});
  const updated = await mcpService.updateServer(req.params.id, body);

  if (!updated) {
    throw notFound("MCP server not found");
  }

  res.json({ server: updated });
});

router.delete("/servers/:id", async (req, res) => {
  const deleted = await mcpService.deleteServer(req.params.id);
  if (!deleted) {
    throw notFound("MCP server not found");
  }

  res.status(204).end();
});

router.get("/servers/:id/tools", async (req, res) => {
  const userId = getUserId(req);
  const [tools] = await mcpService.listTools(userId, req.params.id);
  res.json(tools);
});

router.post("/servers/:id/test", async (req, res) => {
  const userId = getUserId(req);
  const result = await mcpService.testServer(userId, req.params.id);
  res.json(result);
});

router.post("/call", async (req, res) => {
  const userId = getUserId(req);
  const body = mcpCallSchema.parse(req.body ?? {});
  const result = await mcpService.callTool(userId, body.serverId, body.toolName, body.arguments ?? {});
  res.json(result);
});

export default router;
