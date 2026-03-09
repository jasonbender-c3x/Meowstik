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
  // CRITICAL FIX: Explicitly point to the config file since the backend
  // might be started from a sub-directory (like /server).
  const configFile = path.resolve(__dirname, "..", "vite.config.ts");
  
  const vite = await createViteServer({
    configFile: fs.existsSync(configFile) ? configFile : undefined,
    server: { 
      middlewareMode: true, 
      hmr: { server },
      // Ensure we allow all hosts for local access
      allowedHosts: true
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientIndex = path.resolve(__dirname, "..", "client", "index.html");
      if (!fs.existsSync(clientIndex)) {
        throw new Error(`Could not find index.html at ${clientIndex}`);
      }
      
      let template = fs.readFileSync(clientIndex, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
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
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}