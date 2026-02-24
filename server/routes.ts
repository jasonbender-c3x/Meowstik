import { type Express } from "express";
import { createServer, type Server } from "http";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createApiRouter } from "./routes/index.js";
import { storage } from "./storage.js";
import { promptComposer } from "./services/prompt-composer.js";
import crypto from "crypto";

/**
 * [💭 Analysis] 
 * Sovereign Route Dispatcher - System Revision 3.7.2
 * PATH: server/routes.ts
 * FIX: Using crypto.randomUUID() for proper database IDs.
 * FIX: Enhanced error logging for Gemini API failures.
 */

export async function registerRoutes(app: Express): Promise<Server> {
  // DEBUG LOGGING FOR ALL /api/chats REQUESTS
  app.all("/api/chats*", (req, res, next) => {
    console.log(`🔎 [Route Probe] ${req.method} ${req.url}`);
    next();
  });

  // 0. CHAT SESSION MANAGEMENT (MOVED TO TOP)
  app.get("/api/chats", async (req, res) => {
    console.log("➡️ [GET /api/chats]");
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const user = req.user as any;
    try {
      const userChats = await storage.getChats(user.id);
      res.json(userChats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/chats", async (req, res) => {
    const user = req.user as any;
    const userId = user?.id || "guest";

    // Scenario A: Workspace Initialization (Title only)
    if (req.body.title && !req.body.message && !req.body.content) {
      console.log(`🆕 [Chat] Creating session: ${req.body.title}`);
      try {
        const chat = await storage.createChat({
          id: crypto.randomUUID(),
          title: req.body.title,
          userId: userId,
          isGuest: !req.isAuthenticated(),
        });
        return res.json(chat);
      } catch (e: any) {
        console.error("❌ [Chat Creation Error]:", e);
        return res.status(500).json({ error: e.message });
      }
    }

    // Scenario B: Legacy Direct Chat (Return JSON)
    try {
      let msg = req.body.message || req.body.content || req.body.text;
      if (!msg && req.body.messages && Array.isArray(req.body.messages)) {
          msg = req.body.messages[req.body.messages.length - 1]?.content;
      }
      
      if (!msg) return res.status(400).json({ error: "Empty message payload." });
      if (!process.env.GEMINI_API_KEY) return res.json({ role: "model", content: "Missing GEMINI_API_KEY" });

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const systemInstruction = await promptComposer.buildSystemPrompt({ userId });
      
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        systemInstruction: systemInstruction 
      });
      const result = await model.generateContent(msg);
      res.json({ role: "model", content: result.response.text() });
    } catch (error: any) {
      console.error("❌ [Chat Error]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. STREAMING CHAT INTERFACE
  app.post("/api/chats/:id/messages", async (req, res) => {
    console.log(`💬 [Chat] Message incoming for ${req.params.id}`);
    const chatId = req.params.id;
    const { content, context } = req.body;

    if (!content) return res.status(400).json({ error: "No content" });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY missing from environment" });

    try {
      // 1. Verify chat exists
      const chat = await storage.getChat(chatId);
      if (!chat) return res.status(404).json({ error: "Chat not found" });

      // 2. Persist User Message
      await storage.addMessage({
        id: crypto.randomUUID(),
        chatId,
        role: "user",
        content,
        metadata: context ? { context } : null,
      });

      // 3. Prepare AI Stream
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      
      // Build System Prompt
      const systemInstruction = await promptComposer.buildSystemPrompt({
        userId: chat.userId || undefined,
      });
      
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        systemInstruction: systemInstruction 
      });
      
      const prompt = context ? `Context: ${context}\n\nUser: ${content}` : content;
      const result = await model.generateContentStream(prompt);

      // Disable buffering for Codespaces/Nginx
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      let fullResponse = "";
      try {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          console.log(`📡 [Stream] Chunk: ${chunkText.substring(0, 20)}...`);
          fullResponse += chunkText;
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
          // @ts-ignore - Some versions of express/node might need this
          if (res.flush) res.flush();
        }

        res.write("data: [DONE]\n\n");

        // 4. Persist AI Message
        await storage.addMessage({
          id: crypto.randomUUID(),
          chatId,
          role: "assistant",
          content: fullResponse,
        });

      } catch (streamError: any) {
        console.error("❌ [Gemini Stream Error]:", streamError);
        // If it's a 403 or similar, the error message from Google is helpful
        const errorMessage = streamError.message || "AI Stream interrupted";
        if (!res.headersSent) {
          res.status(500).json({ error: errorMessage });
        } else {
          res.write(`\n\n[ERROR]: ${errorMessage}\nIf you see a 403 error, please enable the "Generative Language API" in your Google Cloud Console.`);
        }
      }

      res.end();
    } catch (error: any) {
      console.error("❌ [Post Message Fatal]:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.end();
      }
    }
  });

  // 4. Modular API Routes
  app.use("/api", createApiRouter());

  app.get("/api/chats/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.id);
      res.json(messages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log(`🧠 [System] Sovereign Routes Registered.`);
  return createServer(app);
}
