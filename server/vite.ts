
import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * [💭 Analysis]
 * Core Logging Utility.
 * Explicitly exported to be used by routes.ts and index.ts.
 */
export function log(message: string, source = "express") {
  const formatted = `${new Date().toLocaleTimeString()} [${source}] ${message}`;
  console.log(formatted);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server },
      watch: {
        ignored: [
          "/mnt/**",
          "**/node_modules/**",
          "**/.git/**",
          "**/data/**",
          "**/logs/**",
          "**/sessions/**",
        ],
      },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    const pathUrl = req.url;
    
    // Ignore API routes - let them fall through to the API handlers
    // Check both originalUrl and current url to be safe
    if (url.startsWith("/api") || pathUrl.startsWith("/api")) {
      return next();
    }

    try {
      const clientIndex = path.resolve(__dirname, "..", "client", "index.html");
      let template = fs.readFileSync(clientIndex, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      if (!res.headersSent) {
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      }
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Could not find build directory: ${distPath}. Run 'npm run build' first.`);
  }
  app.use(express.static(distPath));
  app.use("*", (req, res, next) => {
    // Ignore API routes in static serving too
    if (req.originalUrl.startsWith("/api") || req.url.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}


