import { type Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./routes/auth.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createApiRouter } from "./routes/index.js";

/**
 * [💭 Analysis] 
 * Sovereign Route Dispatcher - System Revision 3.6.0
 * PATH: server/routes.ts
 * FIX: Resolved catastrophic merge conflict.
 * FIX: Unified modular routes under /api via createApiRouter.
 */

export async function registerRoutes(app: Express): Promise<Server> {
  // 1. Auth Setup (Ensures session & passport are ready)
  if (typeof setupAuth === 'function') {
    setupAuth(app);
  }

  // 2. Modular API Routes (The bulk of the system)
  // This includes /api/auth, /api/twilio, /api/agent, etc.
  app.use("/api", createApiRouter());

  // 3. INLINE CHAT BRAIN (Legacy/Direct interface)
  app.post("/api/chats", async (req, res) => {
    console.log(`🧠 [Chat] Received request.`);
    try {
      let msg = req.body.message || req.body.content || req.body.text;
      
      if (!msg && req.body.messages && Array.isArray(req.body.messages)) {
          msg = req.body.messages[req.body.messages.length - 1]?.content;
      }
      
      if (!msg) {
        return res.status(400).json({ error: "Empty message payload." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.json({ role: "model", content: "Missing GEMINI_API_KEY in .env" });
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const result = await model.generateContent(msg);
      res.json({ role: "model", content: result.response.text() });
      
    } catch (error: any) {
      console.error(`❌ [Chat] Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  console.log(`🧠 [System] Routes Registered Successfully.`);

  return createServer(app);
}