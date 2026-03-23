
import './load-env.js'; 
import { exec } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from 'url';
import express, { type Request, Response, NextFunction } from "express";
// import session from "express-session"; // Moved to googleAuth.ts
import { registerRoutes } from "./routes.js"; 
import { setupVite, serveStatic } from "./vite.js";
import { createServer } from "http";
import { storage } from "./storage.js";
import { pool } from "./db.js";
import { setupAuth } from "./routes/auth.js";
import { WebSocketServer } from "ws";
import { setupLiveWebSocket } from "./websocket-live.js";
import { setupTerminalWebSocket } from "./websocket-terminal.js";
import { setupTwilioWebSocket } from "./websocket-twilio.js";
import { setupExtensionWebSocket } from "./websocket-extension.js";
import { setupVSCodeWebSocket } from "./websocket-vscode.js";
import { desktopService } from "./services/desktop-service.js";

// --- SONAR: GLOBAL ERROR CATCHERS ---
process.on('uncaughtException', (err) => {
  console.error('🔥 [SONAR FATAL] Uncaught Exception:', err);
  exec("python3 /home/runner/meowstik_mood.py error", (e) => { if (e) console.error(e); });
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 [SONAR FATAL] Unhandled Rejection:', reason);
  exec("python3 /home/runner/meowstik_mood.py error", (e) => { if (e) console.error(e); });
});

const app = express();
app.set("trust proxy", 1);

// --- SONAR: INBOUND REQUEST LOGGER ---
// This guarantees every single click/refresh is logged to your terminal.
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`➡️  [REQ] ${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`⬅️  [RES] ${req.method} ${req.url} - Status: ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// app.use(session({ ... })) REMOVED: Session is handled in setupAuth inside registerRoutes
// to ensure we use the Postgres-backed session store and avoid double-init.

console.log("⏳ [Boot] Setting up Auth...");
console.log(`🔑 [Auth] Using Google Client ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 10)}...`);
console.log(`🌐 [Auth] Using Redirect URI: ${process.env.GOOGLE_REDIRECT_URI}`);
setupAuth(app); 

// Health Check Route (To verify the backend independently)
app.get("/api/health", (req, res) => {
  res.json({ status: "alive", message: "Sonar is pinging." });
});

const server = createServer(app);

async function startServer() {


  
  // Set up Twilio WebSocket for live phone conversations
  setupTwilioWebSocket(server);
  setupExtensionWebSocket(server);
  setupVSCodeWebSocket(server);
  setupLiveWebSocket(server);
  setupTerminalWebSocket(server);

  try {
    console.log("⏳ [Boot] Registering API Routes...");
    await registerRoutes(server, app);
    console.log("✅ [Boot] API Routes Registered.");
  } catch (e) {
    console.error("❌ [Boot] Failed to register routes:", e);
  }

  if (app.get("env") === "development") {
    console.log("⏳ [Boot] Starting Vite Middleware (This can take 5-10 seconds)...");
    try {
      await setupVite(app, server);
      console.log("✅ [Boot] Vite Middleware Online.");
    } catch (e) {
      console.error("❌ [Boot] VITE FAILED TO START. The frontend will be broken.", e);
    }
  } else {
    serveStatic(app);
  }

  const PORT = Number(process.env.PORT) || 5000;
  
  // Kill any process on the port before starting
  try {
    const execAsync = promisify(exec);
    
    // Screen Recording Check (User Request)
    try {
        const { stdout: pgrepOut } = await execAsync("pgrep -f ffmpeg");
        if (pgrepOut) {
            console.log("🎥 [Boot] Screen recording process found (ffmpeg).");
        } else {
             // User requested to "start it if not found", but we don't have the explicit command.
             // We'll log a clear warning so they can provide the command or we can find it later.
             console.log("⚠️  [Boot] Screen recording process (ffmpeg) NOT found.");
             // Placeholder for start command:
             // await execAsync("nohup ffmpeg -f x11grab ... &"); 
        }
    } catch (e) {
        console.log("⚠️  [Boot] Screen recording process (ffmpeg) NOT found.");
    }

    const { stdout } = await execAsync(`lsof -t -i:${PORT}`);
    if (stdout) {
      const pids = stdout.trim().split('\n');
      for (const pid of pids) {
          if (parseInt(pid) !== process.pid) {
            console.log(`⚠️  [Boot] Killing process ${pid} on port ${PORT}...`);
            try {
                await execAsync(`kill -9 ${pid}`);
            } catch (e) {
                console.log(`⚠️  [Boot] Failed to kill process ${pid}:`, e);
            }
          }
      }
    }
  } catch (e) {
    // lsof returns exit code 1 if no process found
  }

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`❌ [Boot] Port ${PORT} is already in use!`);
    } else {
      console.error('❌ [Boot] Server error:', e);
    }
    process.exit(1);
  });

  server.listen(PORT, "0.0.0.0", async () => {
    // Start Desktop Capture (if explicitly enabled)
    if (process.env.ENABLE_DESKTOP_AGENT === 'true') {
        console.log("🖥️ [Boot] Starting Desktop Agent Service...");
        desktopService.startCapture();
    }

    console.log(`\n========================================`);
    console.log(`🚀 MEOWSTIK CORE ONLINE: http://localhost:${PORT}`);
    console.log(`========================================\n`);
    
    // DB Check
    console.log("⏳ [Boot] Pinging Database...");
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        console.log('✅ [Boot] Database Link Established');
        client.release();
        
        // Signal success to mood light
        exec("python3 /home/runner/meowstik_mood.py success", (e) => { 
            if (e) console.error("Failed to set mood light:", e); 
            else console.log("✅ [Mood] Light set to SUCCESS (Green)");
        });
        
    } catch(e: any) {
        console.error('⚠️  [Boot] Database Link Failed:', e.message);
        exec("python3 /home/runner/meowstik_mood.py error", (e) => { if (e) console.error(e); });
    }
  });
}

// Auto-start if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    startServer();
}



