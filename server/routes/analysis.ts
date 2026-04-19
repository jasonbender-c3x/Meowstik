/**
 * Analysis, tooling, and content API routes
 *
 * Mounted at /api by createApiRouter().
 * Covers: JIT tool protocol, codebase analysis, browser automation, documentation.
 */

import { Router } from "express";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// JIT Tool Protocol
// ─────────────────────────────────────────────────────────────────────────────

router.post("/jit/predict", async (req, res) => {
  try {
    const { jitToolProtocol } = await import("../services/jit-tool-protocol");
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Missing 'query' parameter" });
    }
    res.json({ success: true, prediction: await jitToolProtocol.predictTools(query) });
  } catch (error) {
    console.error("JIT prediction error:", error);
    res.status(500).json({ error: "Failed to predict tools" });
  }
});

router.post("/jit/context", async (req, res) => {
  try {
    const { jitToolProtocol } = await import("../services/jit-tool-protocol");
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Missing 'query' parameter" });
    }
    const result = await jitToolProtocol.getOptimizedToolContext(query);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("JIT context error:", error);
    res.status(500).json({ error: "Failed to get tool context" });
  }
});

router.get("/jit/examples", async (_req, res) => {
  try {
    const { jitToolProtocol } = await import("../services/jit-tool-protocol");
    res.json({
      success: true,
      allTools: jitToolProtocol.getAllTools(),
      manifest: jitToolProtocol.getFullManifest(),
    });
  } catch (error) {
    console.error("JIT examples error:", error);
    res.status(500).json({ error: "Failed to get examples" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Codebase Analysis
// ─────────────────────────────────────────────────────────────────────────────

router.post("/codebase/analyze", async (req, res) => {
  try {
    const { codebaseAnalyzer } = await import("../services/codebase-analyzer");
    const { path: rootPath = "." } = req.body;
    const result = await codebaseAnalyzer.analyzeCodebase(rootPath, true);

    const glossaryObj: Record<string, any[]> = {};
    result.glossary.forEach((value, key) => {
      glossaryObj[key] = value;
    });

    res.json({
      success: true,
      rootPath: result.rootPath,
      totalFiles: result.totalFiles,
      totalEntities: result.totalEntities,
      totalChunks: result.totalChunks,
      duration: result.duration,
      errors: result.errors,
      files: result.files.map((f) => ({
        path: f.relativePath,
        extension: f.extension,
        lineCount: f.lineCount,
        entityCount: f.entities.length,
      })),
      glossary: glossaryObj,
      documentation: result.documentation,
    });
  } catch (error) {
    console.error("Error analyzing codebase:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze codebase",
    });
  }
});

router.get("/codebase/progress", async (_req, res) => {
  try {
    const { codebaseAnalyzer } = await import("../services/codebase-analyzer");
    res.json({ success: true, progress: codebaseAnalyzer.getProgress() });
  } catch (error) {
    console.error("Error getting analysis progress:", error);
    res.status(500).json({ success: false, error: "Failed to get progress" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Browser
// ─────────────────────────────────────────────────────────────────────────────

router.post("/browser/load", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: "URL is required" });

    if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
      return res.status(503).json({
        success: false,
        error:
          "Browserbase is not configured. Please add BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.",
        needsConfig: true,
      });
    }

    const browserbase = await import("../integrations/browserbase");
    const result = await browserbase.takeScreenshot(url, { fullPage: false });
    const screenshotUrl = `data:image/png;base64,${result.screenshot.toString("base64")}`;
    const pageResult = await browserbase.loadPage(url, { textOnly: false });

    res.json({
      success: true,
      sessionId: result.sessionId,
      url,
      title: pageResult.title || url,
      screenshotUrl,
    });
  } catch (error) {
    console.error("Error loading page in browser:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load page",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Documentation
// ─────────────────────────────────────────────────────────────────────────────

router.get("/documentation/:path(*)", async (req, res) => {
  try {
    const docPath = req.params.path;
    const fs = await import("fs/promises");
    const path = await import("path");

    if (!docPath.endsWith(".md")) {
      return res.status(400).json({ error: "Only .md files allowed" });
    }

    const fullPath = path.join(process.cwd(), "docs", docPath);
    const resolvedPath = path.resolve(fullPath);
    const docsDir = path.resolve(process.cwd(), "docs");

    if (!resolvedPath.startsWith(docsDir)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const content = await fs.readFile(fullPath, "utf-8");
    res.type("text/plain").send(content);
  } catch (error) {
    console.error("Error reading doc file:", error);
    res.status(404).json({ error: "Document not found" });
  }
});

export default router;
