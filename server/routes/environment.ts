import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "./middleware";
import { getEnvironmentMetadata } from "../utils/environment-metadata";
import {
  buildEnvironmentVariableSnapshot,
  ENVIRONMENT_CATALOG,
  ENVIRONMENT_OVERRIDES_PATH,
  ENVIRONMENT_STATE_PATH,
  environmentManager,
  getStaleRuntimeServiceIds,
} from "../services/environment-manager";
import { runtimeManager } from "../services/runtime-manager";

const router = Router();

const variableKeySchema = z
  .string()
  .trim()
  .min(1, "Variable key is required")
  .max(100, "Variable key is too long")
  .regex(/^[A-Z_][A-Z0-9_]*$/, "Variable keys must match /^[A-Z_][A-Z0-9_]*$/");

const variableBaseSchema = z.object({
  value: z.string().max(200_000, "Variable value is too long"),
  scope: z.enum(["server", "runtime", "all"]),
  description: z.string().trim().max(500, "Description is too long").nullable().optional(),
});

const variableCreateSchema = variableBaseSchema.extend({
  key: variableKeySchema,
});

function requireAuthenticated(req: any, res: any): boolean {
  if (!req.authStatus?.userId || req.authStatus?.isGuest) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }

  return true;
}

router.use((req, res, next) => {
  if (!requireAuthenticated(req, res)) {
    return;
  }

  next();
});

router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const [state, services] = await Promise.all([
      environmentManager.getState(),
      runtimeManager.listServices(),
    ]);

    const processStartedAt = new Date(Date.now() - process.uptime() * 1000);
    const staleRuntimeServiceIds = getStaleRuntimeServiceIds(state.lastRuntimeChangeAt, services);
    const staleRuntimeServiceSet = new Set(staleRuntimeServiceIds);
    const definitionMap = new Map(state.variables.map((variable) => [variable.key, variable]));
    const catalogKeys = new Set(ENVIRONMENT_CATALOG.map((item) => item.key));

    const catalog = ENVIRONMENT_CATALOG.map((item) =>
      buildEnvironmentVariableSnapshot({
        catalogItem: item,
        definition: definitionMap.get(item.key),
        liveValue: process.env[item.key],
        processStartedAt,
        lastServerChangeAt: state.lastServerChangeAt,
        staleRuntimeServiceIds,
      })
    );

    const managed = state.variables
      .filter((variable) => !catalogKeys.has(variable.key))
      .map((variable) =>
        buildEnvironmentVariableSnapshot({
          definition: variable,
          liveValue: process.env[variable.key],
          processStartedAt,
          lastServerChangeAt: state.lastServerChangeAt,
          staleRuntimeServiceIds,
        })
      )
      .sort((left, right) => left.key.localeCompare(right.key));

    res.json({
      summary: {
        ...getEnvironmentMetadata(),
        cwd: process.cwd(),
        processStartTime: processStartedAt.toISOString(),
        overrideFilePath: ENVIRONMENT_OVERRIDES_PATH,
        stateFilePath: ENVIRONMENT_STATE_PATH,
        managedVariableCount: state.variables.length,
        configuredCatalogCount: catalog.filter((item) => item.status !== "missing").length,
        serverRestartNeeded:
          !!state.lastServerChangeAt && Date.parse(state.lastServerChangeAt) > processStartedAt.getTime(),
        lastChangedAt: state.lastChangedAt,
        lastServerChangeAt: state.lastServerChangeAt,
        lastRuntimeChangeAt: state.lastRuntimeChangeAt,
        staleRuntimeServiceIds,
        staleRuntimeServices: services
          .filter((service) => staleRuntimeServiceSet.has(service.id))
          .map((service) => ({
            id: service.id,
            name: service.name,
            startedAt: service.startedAt,
          })),
      },
      catalog,
      managed,
    });
  })
);

router.get(
  "/variables/:key/value",
  asyncHandler(async (req, res) => {
    const normalizedKey = req.params.key.trim().toUpperCase();
    const variable = await environmentManager.getVariable(normalizedKey);
    if (!variable) {
      return res.status(404).json({ error: "Managed environment variable not found" });
    }

    res.json({ key: normalizedKey, value: variable.value });
  })
);

router.post(
  "/variables",
  asyncHandler(async (req, res) => {
    const parsed = variableCreateSchema.safeParse(req.body);
    if (req.body && typeof req.body === "object") {
      req.body.value = "[REDACTED]";
    }

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid environment variable" });
    }

    const variable = await environmentManager.upsertVariable(parsed.data);
    res.status(201).json({ success: true, key: variable.key });
  })
);

router.put(
  "/variables/:key",
  asyncHandler(async (req, res) => {
    const normalizedKey = req.params.key.trim().toUpperCase();
    const keyCheck = variableKeySchema.safeParse(normalizedKey);
    if (!keyCheck.success) {
      return res.status(400).json({ error: keyCheck.error.errors[0]?.message || "Invalid variable key" });
    }

    const existing = await environmentManager.getVariable(normalizedKey);
    if (!existing) {
      return res.status(404).json({ error: "Managed environment variable not found" });
    }

    const parsed = variableBaseSchema.safeParse(req.body);
    if (req.body && typeof req.body === "object") {
      req.body.value = "[REDACTED]";
    }

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid environment variable update" });
    }

    const variable = await environmentManager.updateVariable(normalizedKey, parsed.data);
    res.json({ success: true, key: variable.key });
  })
);

router.delete(
  "/variables/:key",
  asyncHandler(async (req, res) => {
    await environmentManager.deleteVariable(req.params.key);
    res.json({ success: true });
  })
);

export default router;
