import { logError, logAccess } from './utils/logger.js';
import './load-env.js'; 
import express, { type Request, Response, NextFunction } from "express";
// import session from "express-session"; // Moved to googleAuth.ts
import { registerRoutes } from "./routes.js"; 
import { setupVite, serveStatic } from "./vite.js";
import { bootGreeting } from './services/boot-greeting.js';
import { createServer } from "http";
import { storage } from "./storage.js";
import { pool } from "./db.js";
import { setupAuth } from "./routes/auth.js";
import { WebSocketServer } from "ws";
import { setupTerminalWebSocket } from "./websocket-terminal.js";
import { setupCollabWebSocket } from "./websocket-collab.js";
import { setupDesktopWebSocket } from "./websocket-desktop.js";
import { setupLiveWebSocket } from "./websocket-live.js";

// --- SONAR: GLOBAL ERROR CATCHERS ---
process.on('uncaughtException', (err) => {
  console.error('🔥 [SONAR FATAL] Uncaught Exception:', err); logError(err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 [SONAR FATAL] Unhandled Rejection:', reason); logError(reason);
});

const app = express();
app.set("trust proxy", 1);

// --- SONAR: INBOUND REQUEST LOGGER ---
// This guarantees every single click/refresh is logged to your terminal.
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`➡️  [REQ] ${req.method} ${req.url}`); logAccess(`➡️ [REQ] ${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`⬅️  [RES] ${req.method} ${req.url} - Status: ${res.statusCode} (${Date.now() - start}ms)`); logAccess(`⬅️ [RES] ${req.method} ${req.url} - Status: ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Client-Side Error Reporting Endpoint
app.post("/api/client-log", (req, res) => {
  console.error("🔥 [CLIENT ERROR REPORTED]:", JSON.stringify(req.body, null, 2));
  res.status(200).send("Logged");
});

// app.use(session({ ... })) REMOVED: Session is handled in setupAuth inside registerRoutes
// to ensure we use the Postgres-backed session store and avoid double-init.

console.log("⏳ [Boot] Setting up Auth...");
console.log(`🔑 [Auth] Using Google Client ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 10)}...`);
console.log(`🌐 [Auth] Using Redirect URI: ${process.env.GOOGLE_REDIRECT_URI}`);
// setupAuth(app); // REMOVED: Called inside registerRoutes to avoid duplicate session middleware

// Health Check Route (To verify the backend independently)
app.get("/api/health", (req, res) => {
  res.json({ status: "alive", message: "Sonar is pinging." });
});

// Bypass Ignition
app.get("/api/auth/ignite", async (req, res) => {
    console.log("🔥 [Ignite] Ignition sequence triggered...");
    try {
        const email = (process.env.HOME_DEV_EMAIL || "jason@meowstik.local").trim();
        let user = await storage.getUserByEmail(email);
        
        if (!user) {
             console.log(`⚠️ [Ignite] Creator missing. Auto-creating: ${email}`);
             user = await storage.createUser({
                username: "creator_" + Math.random().toString(36).substring(7),
                email: email,
                password: "init",
                displayName: "Creator",
                role: "admin",
                googleId: "dev",
                avatarUrl: "",
                googleAccessToken: "",
                googleRefreshToken: ""
            });
        }

        console.log(`✅ [Ignite] Logging in as: ${email}`);
        req.login(user, (err) => {
            if (err) {
                console.error("❌ [Ignite] Login failed:", err);
                return res.status(500).send(`Login Error: ${err.message}`);
            }
            res.redirect("/");
        });
    } catch (e: any) {
        console.error("❌ [Ignite] Error:", e);
        res.status(500).send(`Ignition Failed: ${e.message}`);
    }
});

(async () => {
  console.log("⏳ [Boot] Creating HTTP Server...");
  const server = createServer(app);

  try {
    console.log("⏳ [Boot] Registering API Routes...");
    await registerRoutes(server, app);
    console.log("✅ [Boot] API Routes Registered.");
  } catch (e) {
    console.error("❌ [Boot] Failed to register routes:", e);
  }

  // Setup WebSockets
  setupTerminalWebSocket(server);
  setupCollabWebSocket(server);
  setupDesktopWebSocket(server);
  setupLiveWebSocket(server);

  if (app.get("env") === "development") {
    console.log("⏳ [Boot] Starting Vite Middleware (This can take 5-10 seconds)...");
    try {
      console.log("Pre-Vite Upgrade Listeners:", server.listenerCount('upgrade'));
      await setupVite(app, server);
      console.log("Post-Vite Upgrade Listeners:", server.listenerCount('upgrade'));
      console.log("✅ [Boot] Vite Middleware Online.");
    } catch (e) {
      console.error("❌ [Boot] VITE FAILED TO START. The frontend will be broken.", e);
    }
  } else {
    serveStatic(app);
  }

  const PORT = Number(process.env.PORT) || 5000;
  
  console.log("Final Upgrade Listeners:", server.listenerCount('upgrade'));

  server.listen(PORT, "0.0.0.0", async () => {
    console.log(`\n========================================`);
    console.log(`🚀 MEOWSTIK CORE ONLINE: http://localhost:${PORT}`);
    console.log(`========================================\n`);
    
    // DB Check
    console.log("⏳ [Boot] Pinging Database...");
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        console.log('✅ [Boot] Database Link Established');
        // Trigger boot greeting (DISABLED: User requested removal of automated message)
        // bootGreeting().catch(err => console.error('❌ [Boot] Greeting failed:', err));
        client.release();
    } catch(e: any) {
        console.error('⚠️  [Boot] Database Link Failed:', e.message);
    }
  });
})();
