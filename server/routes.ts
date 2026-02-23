import { type Express } from "express";
import { createServer, type Server } from "http";
import authRouter, { setupAuth } from "./routes/auth.js";
import googleAuthRouter from "./routes/google-auth.js";
import twilioRouter from "./routes/twilio.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function registerRoutes(app: Express): Promise<Server> {
  // 1. Auth Setup
  if (typeof setupAuth === 'function') {
    setupAuth(app);
  }

  // 2. Core Routes
  app.use("/api/auth", authRouter);
  app.use("/api/auth/google", googleAuthRouter);
  app.use("/api/twilio", twilioRouter);

  // 3. INLINE CHAT BRAIN
  app.post("/api/chats", async (req, res) => {
    console.log(`🧠 [Chat] Received payload.`);
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
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const result = await model.generateContent(msg);
      res.json({ role: "model", content: result.response.text() });
      
    } catch (error: any) {
      console.error(`❌ [Chat] Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });
  console.log(`🧠 [Route] CHAT BRAIN ONLINE AT /api/chats`);

  // 4. Status
  app.get("/api/status", (req, res) => {
     res.json({ status: "online", agent: "Meowstik" });
  });

  return createServer(app);
}