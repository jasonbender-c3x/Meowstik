
/**
 * =============================================================================
 * PROMPT COMPOSER API ROUTES
 * =============================================================================
 *
 * Endpoints for the Prompt Composer UI. Allows introspection and live editing
 * of every component that makes up the assembled system prompt.
 *
 * Routes:
 * - GET  /api/prompt-composer/components   – breakdown of every prompt section
 * - GET  /api/prompt-composer/preview      – full assembled prompt string
 * - GET  /api/prompt-composer/file/:name   – raw content of a prompt file
 * - PUT  /api/prompt-composer/file/:name   – save raw content to a prompt file
 * =============================================================================
 */

import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import * as fs from "fs";
import * as path from "path";
import { PromptComposer } from "../services/prompt-composer";
import { DEFAULT_AGENT_NAME, DEFAULT_DISPLAY_NAME } from "@shared/schema";
import { formatEnvironmentMetadata } from "../utils/environment-metadata";

const router = Router();

/**
 * Explicit allowlist mapping safe identifier → absolute file path.
 * Paths are computed once at module load and are not derived from user input.
 */
const FILE_PATHS: Record<string, string> = {
  "prime-directive": path.resolve(process.cwd(), "prompts", "core-directives.md"),
  personality:       path.resolve(process.cwd(), "prompts", "personality.md"),
  "short-term-memory": path.resolve(process.cwd(), "logs", "Short_Term_Memory.md"),
  cache:             path.resolve(process.cwd(), "logs", "cache.md"),
} as const;

/** Validate that `name` is exactly one of the known keys. */
function resolveFilePath(name: string): string | null {
  return Object.prototype.hasOwnProperty.call(FILE_PATHS, name)
    ? FILE_PATHS[name]
    : null;
}

/** Rate limiter for file-read routes (generous; just prevents abuse). */
const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests" },
});

/** Rate limiter for file-write routes (more conservative). */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests" },
});

/**
 * GET /api/prompt-composer/components
 * Returns a size-annotated breakdown of every assembled prompt section.
 */
router.get("/components", readLimiter, (_req: Request, res: Response) => {
  try {
    const composer = new PromptComposer();
    const breakdown = composer.getSystemPromptBreakdown(
      DEFAULT_AGENT_NAME,
      DEFAULT_DISPLAY_NAME
    );
    res.json({ ok: true, ...breakdown });
  } catch (error: any) {
    console.error("[PromptComposer] /components error:", error);
    res
      .status(500)
      .json({ ok: false, error: error.message ?? "Failed to get components" });
  }
});

/**
 * GET /api/prompt-composer/preview
 * Returns the fully assembled system prompt string.
 */
router.get("/preview", readLimiter, async (_req: Request, res: Response) => {
  try {
    const composer = new PromptComposer();
    const prompt = await composer.getSystemPrompt(
      DEFAULT_AGENT_NAME,
      DEFAULT_DISPLAY_NAME,
      { forceReload: true }
    );
    res.json({ ok: true, prompt });
  } catch (error: any) {
    console.error("[PromptComposer] /preview error:", error);
    res
      .status(500)
      .json({ ok: false, error: error.message ?? "Failed to preview prompt" });
  }
});

/**
 * GET /api/prompt-composer/file/:name
 * Read the raw content of an editable prompt file.
 * Supported names: prime-directive | personality | short-term-memory | cache
 *                  environment-metadata (read-only, computed)
 */
router.get("/file/:name", readLimiter, (req: Request, res: Response) => {
  const name = req.params.name;

  // Special case: environment-metadata is computed at runtime, not a file
  if (name === "environment-metadata") {
    try {
      const content = formatEnvironmentMetadata();
      return res.json({ ok: true, name: "environment-metadata", content });
    } catch (error: any) {
      console.error("[PromptComposer] environment-metadata error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }
  }

  const filePath = resolveFilePath(name);

  if (!filePath) {
    return res.status(404).json({ ok: false, error: "Unknown prompt file" });
  }

  try {
    const content = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf-8")
      : "";
    res.json({ ok: true, name, content });
  } catch (error: any) {
    console.error("[PromptComposer] Failed to read prompt file:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PUT /api/prompt-composer/file/:name
 * Persist new content to an editable prompt file.
 * Body: { content: string }
 */
router.put("/file/:name", writeLimiter, (req: Request, res: Response) => {
  const name = req.params.name;
  const filePath = resolveFilePath(name);

  if (!filePath) {
    return res.status(404).json({ ok: false, error: "Unknown prompt file" });
  }

  const { content } = req.body as { content?: string };
  if (typeof content !== "string") {
    return res.status(400).json({ ok: false, error: "content must be a string" });
  }

  try {
    // Ensure parent directory exists (e.g. logs/)
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, "utf-8");
    res.json({ ok: true, name, message: "Saved successfully" });
  } catch (error: any) {
    console.error("[PromptComposer] Failed to write prompt file:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
