/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        API ROUTES CONFIGURATION                           ║
 * ║                     Meowstik - Express Route Handlers                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * This file defines all HTTP API endpoints for the Meowstik application.
 * The routes are organized into several logical groups:
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  ROUTE CATEGORIES                                                           │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │  1. Chat Routes (/api/chats)      - Core chat/message CRUD + AI streaming  │
 * │  2. Drive Routes (/api/drive)     - Google Drive file operations           │
 * │  3. Gmail Routes (/api/gmail)     - Email listing, sending, searching      │
 * │  4. Calendar Routes (/api/calendar) - Calendar events management           │
 * │  5. Docs Routes (/api/docs)       - Google Docs operations                 │
 * │  6. Sheets Routes (/api/sheets)   - Google Sheets operations               │
 * │  7. Tasks Routes (/api/tasks)     - Google Tasks management                │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * REQUEST/RESPONSE FLOW:
 * ┌────────────┐    ┌─────────────────┐    ┌───────────────────┐
 * │   Client   │───▶│  Express Route  │───▶│  Storage/Service  │
 * │  Request   │    │   (Validation)  │    │   (Integration)   │
 * └────────────┘    └─────────────────┘    └───────────────────┘
 *                            │                       │
 *                            ▼                       ▼
 *                   ┌─────────────────┐    ┌───────────────────┐
 *                   │   JSON Response │◀───│   Database/API    │
 *                   │   (or SSE)      │    │   (PostgreSQL/    │
 *                   └─────────────────┘    │    Google APIs)   │
 *                                          └───────────────────┘
 *
 * ERROR HANDLING STRATEGY:
 * - All routes wrapped in try/catch blocks
 * - 400 errors for validation failures (bad input)
 * - 404 errors for resource not found
 * - 500 errors for server/integration failures
 * - Detailed error logging to console for debugging
 *
 * @module routes
 * @requires express - HTTP server framework
 * @requires storage - Database abstraction layer
 * @requires @google/genai - Google Gemini AI SDK
 * @requires ./integrations/* - Google Workspace service integrations
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Express type for the application instance.
 * Used for registering route handlers (app.get, app.post, etc.)
 */
import type { Express } from "express";

/**
 * HTTP server creation utility and Server type.
 * The httpServer is passed through and returned to enable WebSocket attachment later.
 */
import { createServer, type Server } from "http";

/**
 * Storage abstraction layer for database operations.
 * Provides type-safe CRUD methods for chats and messages.
 */
import { storage } from "./storage";

/**
 * RAG service for processing document attachments.
 * Chunks and vectorizes documents for retrieval augmented generation.
 */
import { ragService } from "./services/rag-service";

/**
 * Zod validation schemas for request body validation.
 * - insertChatSchema: Validates chat creation requests
 * - insertMessageSchema: Validates message creation requests
 */
import { insertChatSchema, insertMessageSchema, GUEST_USER_ID } from "@shared/schema";

/**
 * Google Generative AI SDK for Gemini model interactions.
 * Provides streaming text generation capabilities.
 */
import { GoogleGenAI, FunctionCallingConfigMode, type FunctionCall } from "@google/genai";
import { geminiFunctionDeclarations } from "./gemini-tools";
import { getToolDeclarations } from "./gemini-tools-guest";

/**
 * Prompt Composer for building system prompts from modular components.
 * Assembles core directives, personality, tools, and RAG context.
 */
import { promptComposer } from "./services/prompt-composer";
import { ragDispatcher } from "./services/rag-dispatcher";
import { type ToolCall } from "@shared/schema";
import { recognizeFamilyMember } from "./services/family-recognition";

import { createApiRouter } from "./routes/index";
import diagRouter from "./routes/diag";

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: AI CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Google Generative AI client instance.
 *
 * Configured with GEMINI_API_KEY from environment variables.
 * This client is used for all AI chat interactions in the application.
 *
 * The '!' operator asserts that GEMINI_API_KEY is defined (non-null assertion).
 * The key should be set in the environment or the application will fail.
 *
 * @see https://ai.google.dev/tutorials/node_quickstart
 */
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: ROUTE REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registers all API routes on the Express application.
 *
 * This function is called during server startup and attaches all route handlers
 * to the Express app instance. It receives the HTTP server to allow for
 * potential WebSocket server attachment later.
 *
 * @param httpServer - The HTTP server instance (passed through for WebSocket support)
 * @param app - The Express application instance to register routes on
 * @returns Promise<Server> - The same HTTP server instance (enables chaining)
 *
 * @example
 * // In server/index.ts:
 * const httpServer = createServer(app);
 * await registerRoutes(httpServer, app);
 * httpServer.listen(5000);
 */
export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  console.log("[Routes] registerRoutes entry. app defined?", !!app);
  if (!app) {
    console.error("[Routes] CRITICAL: app is undefined in registerRoutes!");
    return httpServer;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GOOGLE AUTH SETUP
  // Sets up session management and OAuth flow with Google as the identity provider
  // ═════════════════════════════════════════════════════════════════════════
  const { setupAuth, isAuthenticated } = await import("./googleAuth");
  console.log("[Routes] Calling setupAuth...");
  await setupAuth(app);
  console.log("[Routes] setupAuth completed.");
  
  // Import authentication status middleware
  const { checkAuthStatus } = await import("./routes/middleware");
  
  // Apply authentication check to all routes (non-blocking)
  // This determines auth status but doesn't block guest access
  app.use(checkAuthStatus);

  // Auth user endpoint - returns the current user's profile
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub || req.user.googleId;
      if (!userId) {
         return res.status(500).json({ message: "Invalid user session" });
      }

      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CHAT API ROUTES
  // Base path: /api/chats
  //
  // These routes handle the core chat functionality:
  // - Creating new chat conversations
  // - Listing all chats for the user
  // - Getting chat details with message history
  // - Updating chat titles
  // - Sending messages and receiving AI responses (streaming)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/chats
   * Create a new chat conversation.
   *
   * Request Body:
   * - title: string (optional) - The title for the new chat
   *
   * Response: Created Chat object
   * - id: string (UUID)
   * - title: string
   * - userId: string | null (null for guest users)
   * - isGuest: boolean
   * - createdAt: timestamp
   * - updatedAt: timestamp
   *
   * @route POST /api/chats
   * @returns {Chat} 200 - The newly created chat
   * @returns {Error} 400 - Invalid request body
   */
  app.post("/api/chats", async (req, res) => {
    try {
      // Get auth status from middleware
      const authStatus = (req as any).authStatus;
      
      // Validate request body against Zod schema
      // This ensures type safety and proper data structure
      const validatedData = insertChatSchema.parse({
        ...req.body,
        userId: authStatus.userId, // null for guests
        isGuest: authStatus.isGuest, // true for guests
      });

      // Create chat in database via storage layer
      const chat = await storage.createChat(validatedData);
      
      // Log chat creation with auth status
      console.log(
        `[Chat Created] ${chat.id} - User: ${authStatus.userId || "GUEST"} - Guest: ${authStatus.isGuest}`
      );

      // Return created chat as JSON response
      res.json(chat);
    } catch (error) {
      // Validation errors or database errors return 400 Bad Request
      console.error("[POST /api/chats] Error creating chat:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  /**
   * GET /api/chats
   * Retrieve all chat conversations.
   *
   * Returns chats ordered by most recently updated first.
   *
   * @route GET /api/chats
   * @returns {Chat[]} 200 - Array of all chat objects
   * @returns {Error} 500 - Server error fetching chats
   */
  app.get("/api/chats", async (req, res) => {
    try {
      const authStatus = (req as any).authStatus;
      const userId = authStatus.userId || GUEST_USER_ID;
      const chats = await storage.getChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("[GET /api/chats] Error fetching chats:", error);
      res.status(500).json({ error: "Failed to fetch chats" });
    }
  });

  /**
   * GET /api/chats/:id
   * Get a specific chat with its recent message history (paginated).
   *
   * Path Parameters:
   * - id: string (UUID) - The chat ID to retrieve
   *
   * Query Parameters:
   * - limit: number (optional) - Max messages to return (default: 30)
   * - before: string (optional) - Message ID cursor for loading older messages
   *
   * Response:
   * - chat: Chat object with metadata
   * - messages: Array of Message objects (most recent, chronologically ordered)
   * - hasMore: boolean indicating if older messages exist
   *
   * @route GET /api/chats/:id
   * @param {string} id - Chat UUID
   * @returns {Object} 200 - { chat: Chat, messages: Message[], hasMore: boolean }
   * @returns {Error} 404 - Chat not found
   * @returns {Error} 500 - Server error
   */
  app.get("/api/chats/:id", async (req, res) => {
    try {
      // First, fetch the chat metadata
      const chat = await storage.getChatById(req.params.id);

      // Return 404 if chat doesn't exist
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Parse pagination params (default: last 30 messages)
      const limit = parseInt(req.query.limit as string) || 30;
      const before = req.query.before as string | undefined;
      
      // Fetch paginated messages (+1 to check if more exist)
      const messages = await storage.getMessagesByChatId(req.params.id, { 
        limit: limit + 1, 
        before 
      });
      
      console.log(`[GET /api/chats/${req.params.id}] Fetched ${messages.length} messages, limit: ${limit}, before: ${before}`);
      console.log(`[GET /api/chats/${req.params.id}] Message IDs:`, messages.map(m => ({ id: m.id, role: m.role, createdAt: m.createdAt })));
      
      // Check if there are more messages to load
      const hasMore = messages.length > limit;
      const returnMessages = hasMore ? messages.slice(1) : messages; // Remove oldest if over limit
      
      console.log(`[GET /api/chats/${req.params.id}] Returning ${returnMessages.length} messages, hasMore: ${hasMore}`);

      // Return chat metadata, paginated messages, and hasMore flag
      res.json({ chat, messages: returnMessages, hasMore });
    } catch (error) {
      console.error(
        `[GET /api/chats/${req.params.id}] Error fetching chat:`,
        error,
      );
      res.status(500).json({ error: "Failed to fetch chat" });
    }
  });
  
  /**
   * GET /api/chats/:id/messages
   * Get paginated messages for a chat (for loading older history).
   *
   * Query Parameters:
   * - limit: number (optional) - Max messages to return (default: 30)
   * - before: string (required) - Message ID cursor for loading older messages
   *
   * @route GET /api/chats/:id/messages
   * @returns {Object} 200 - { messages: Message[], hasMore: boolean }
   */
  app.get("/api/chats/:id/messages", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      const before = req.query.before as string;
      
      if (!before) {
        return res.status(400).json({ error: "before cursor required" });
      }
      
      // Fetch messages before cursor (+1 to check if more exist)
      const messages = await storage.getMessagesByChatId(req.params.id, { 
        limit: limit + 1, 
        before 
      });
      
      const hasMore = messages.length > limit;
      const returnMessages = hasMore ? messages.slice(1) : messages;
      
      res.json({ messages: returnMessages, hasMore });
    } catch (error) {
      console.error(`[GET /api/chats/${req.params.id}/messages] Error:`, error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  /**
   * PATCH /api/chats/:id
   * Update a chat's title.
   *
   * Path Parameters:
   * - id: string (UUID) - The chat ID to update
   *
   * Request Body:
   * - title: string (required) - New title for the chat
   *
   * @route PATCH /api/chats/:id
   * @param {string} id - Chat UUID
   * @returns {Object} 200 - { success: true }
   * @returns {Error} 400 - Title is required
   * @returns {Error} 500 - Server error
   */
  app.patch("/api/chats/:id", async (req, res) => {
    try {
      // Extract title from request body
      const { title } = req.body;

      // Validate that title is provided
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      // Update chat title in database
      await storage.updateChatTitle(req.params.id, title);

      res.json({ success: true });
    } catch (error) {
      console.error(
        `[PATCH /api/chats/${req.params.id}] Error updating chat:`,
        error,
      );
      res.status(500).json({ error: "Failed to update chat" });
    }
  });
  
  /**
   * GET /api/chats/:id/tool-calls
   * Get recent tool call logs for a chat (last 10).
   *
   * Returns tool call logs with their status and request/response data.
   * Used to display real-time tool call bubbles in the chat UI.
   *
   * Path Parameters:
   * - id: string (UUID) - The chat ID
   *
   * @route GET /api/chats/:id/tool-calls
   * @param {string} id - Chat UUID
   * @returns {ToolCallLog[]} 200 - Array of recent tool call logs
   * @returns {Error} 500 - Server error
   */
  app.get("/api/chats/:id/tool-calls", async (req, res) => {
    try {
      const toolCalls = await storage.getRecentToolCallLogs(req.params.id);
      res.json(toolCalls);
    } catch (error) {
      console.error(
        `[GET /api/chats/${req.params.id}/tool-calls] Error fetching tool calls:`,
        error,
      );
      res.status(500).json({ error: "Failed to fetch tool calls" });
    }
  });
  
  /**
   * GET /api/tool-calls/:id
   * Get a single tool call log by ID.
   *
   * Returns detailed tool call information including request/response data.
   * Used for displaying tool call details in a modal.
   *
   * Path Parameters:
   * - id: string (UUID) - The tool call log ID
   *
   * @route GET /api/tool-calls/:id
   * @param {string} id - Tool call log UUID
   * @returns {ToolCallLog} 200 - Tool call log details
   * @returns {Error} 404 - Tool call not found
   * @returns {Error} 500 - Server error
   */
  app.get("/api/tool-calls/:id", async (req, res) => {
    try {
      const toolCall = await storage.getToolCallLogById(req.params.id);
      
      if (!toolCall) {
        return res.status(404).json({ error: "Tool call not found" });
      }
      
      res.json(toolCall);
    } catch (error) {
      console.error(
        `[GET /api/tool-calls/${req.params.id}] Error fetching tool call:`,
        error,
      );
      res.status(500).json({ error: "Failed to fetch tool call" });
    }
  });

  /**
   * POST /api/chats/:id/messages
   * Send a message and receive streaming AI response.
   *
   * This is the core AI chat endpoint. It:
   * 1. Saves the user's message to the database
   * 2. Builds conversation history for context
   * 3. Streams AI response using Server-Sent Events (SSE)
   * 4. Saves the complete AI response to database
   *
   * STREAMING PROTOCOL (Server-Sent Events):
   * - Content-Type: text/event-stream
   * - Each chunk: data: {"text": "..."}\n\n
   * - Final event: data: {"done": true}\n\n
   *
   * Path Parameters:
   * - id: string (UUID) - Chat ID to add message to
   *
   * Request Body:
   * - content: string (required) - The user's message text
   *
   * @route POST /api/chats/:id/messages
   * @param {string} id - Chat UUID
   * @returns {Stream} 200 - SSE stream of AI response chunks
   * @returns {Error} 500 - Streaming/AI error
   */
  app.post("/api/chats/:id/messages", async (req, res) => {
    const startTime = Date.now();
    try {
      // Get auth status from middleware for consistent user identification
      const authStatus = (req as any).authStatus;
      const userId = authStatus.userId; // Use authStatus instead of direct req.user access
      
      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: Validate and save user's message
      // ─────────────────────────────────────────────────────────────────────

      // Validate message structure with Zod schema
      // Note: content defaults to empty string to support image-only messages
      const userMessage = insertMessageSchema.parse({
        chatId: req.params.id, // From URL parameter
        role: "user", // Messages from this endpoint are always user messages
        content: req.body.content || "",
      });

      // Persist user message to database and get the saved message with ID
      const savedMessage = await storage.addMessage(userMessage);

      // Check for family member catch phrases
      const familyMember = recognizeFamilyMember(userMessage.content);
      if (familyMember) {
        console.log(`[family] Session personalized for: ${familyMember.name}`);
      }

      // Ingest user message for RAG recall (async, don't block)
      // Pass userId for data isolation - guests use "guest" bucket
      ragService
        .ingestMessage(
          userMessage.content,
          req.params.id,
          savedMessage.id,
          "user",
          undefined,
          userId,
        )
        .catch((error) => {
          console.error(
            `[RAG] Failed to ingest user message ${savedMessage.id}:`,
            error,
          );
        });

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1.5: Process and save any attachments
      // ─────────────────────────────────────────────────────────────────────

      const reqAttachments = Array.isArray(req.body.attachments)
        ? req.body.attachments
        : [];
      for (const att of reqAttachments) {
        // Determine content: prefer explicit content field, fallback to dataUrl
        let content = att.content || "";

        // If no direct content but dataUrl exists, extract content
        if (!content && att.dataUrl) {
          const dataUrl = att.dataUrl;
          if (dataUrl.includes(",")) {
            const base64Part = dataUrl.split(",")[1];
            const isTextFile =
              att.mimeType?.startsWith("text/") ||
              att.mimeType === "application/json" ||
              att.mimeType === "application/xml" ||
              att.mimeType === "application/javascript";

            if (isTextFile) {
              // Decode base64 for text files to store readable content
              try {
                content = Buffer.from(base64Part, "base64").toString("utf-8");
              } catch {
                content = base64Part;
              }
            } else {
              // Store base64 for binary files (images, audio, etc.)
              content = base64Part;
            }
          }
        }

        // Sanitize content to remove null bytes that PostgreSQL text columns can't store
        // Null bytes (0x00) cause "invalid byte sequence for encoding UTF8" errors
        const sanitizedContent = content.replace(/\\x00/g, "");

        // Save attachment to database
        let savedAttachment;
        try {
          savedAttachment = await storage.createAttachment({
            messageId: savedMessage.id,
            type: att.type || "file",
            filename: att.filename || "unnamed",
            mimeType: att.mimeType,
            size: att.size,
            content: sanitizedContent,
          });
        } catch (attachmentError) {
          console.error(
            `Failed to save attachment ${att.filename}:`,
            attachmentError,
          );
          // Continue processing without this attachment rather than failing the whole message
          continue;
        }

        // Process for RAG (chunking and vectorization) asynchronously
        // Only text-based files will be ingested
        ragService.processAttachment(savedAttachment).catch((error) => {
          console.error(`RAG processing failed for ${att.filename}:`, error);
        });
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: Build conversation history for AI context
      // ─────────────────────────────────────────────────────────────────────
      
      // OPTIMIZATION: Only fetch a small recent window for immediate context.
      // RAG (in PromptComposer) handles retrieving relevant older context.
      // This prevents loading massive tool outputs that bloat token usage.
      const RECENT_WINDOW = 25; // Last 25 messages for conversational flow
      const MAX_CONTENT_LENGTH = 2000; // Truncate long messages
      
      // Fetch only recent messages (not all history)
      const chatMessages = await storage.getMessagesByChatId(req.params.id, { 
        limit: RECENT_WINDOW + 1 // +1 because we exclude the current message
      });

      // IMPORTANT: Exclude the current message we just saved, since we'll add it separately
      // This prevents the user's message from being sent to the AI twice
      const previousMessages = chatMessages.filter(
        (msg) => msg.id !== savedMessage.id,
      );

      // Transform to Gemini API format with content truncation:
      // - "user" role stays as "user"
      // - "ai" role becomes "model" (Gemini terminology)
      // - Truncate long messages to prevent token overflow from tool outputs
      // - Include tool results from the most recent AI message for continuity
      const history = previousMessages.map((msg, index) => {
        let content = msg.content;
        
        // For the most recent AI message, include tool results from metadata
        // This ensures tool output is available for the next user prompt
        const isLastAiMessage = msg.role === "ai" && 
          index === previousMessages.length - 1;
        const metadata = msg.metadata as { toolResults?: Array<{ type: string; result: unknown; success: boolean }> } | null;
        
        if (isLastAiMessage && metadata?.toolResults?.length) {
          // Append tool results to the most recent AI message
          // Check each tool result for noTruncate flag before applying length limit
          const toolSummary = metadata.toolResults
            .filter(tr => tr.success)
            .map(tr => {
              const resultStr = JSON.stringify(tr.result);
              // Check if this tool result has noTruncate flag (e.g., file_get)
              const hasNoTruncate = typeof tr.result === 'object' && 
                tr.result !== null && 
                'noTruncate' in tr.result && 
                (tr.result as any).noTruncate === true;
              
              // If noTruncate is set, return full result, otherwise limit to 5000 chars
              const limitedResult = hasNoTruncate ? resultStr : resultStr.slice(0, 5000);
              return `[Tool ${tr.type} returned: ${limitedResult}]`;
            })
            .join("\n");
          content = content + "\n\n" + toolSummary;
        } else if (content.length > MAX_CONTENT_LENGTH) {
          // Truncate older messages if too long
          content = content.slice(0, MAX_CONTENT_LENGTH) + "\n...[truncated for context]";
        }
        
        return {
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: content }],
        };
      });

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: Configure SSE (Server-Sent Events) headers
      // ─────────────────────────────────────────────────────────────────────

      // These headers tell the browser to expect a continuous stream
      res.setHeader("Content-Type", "text/event-stream"); // SSE MIME type
      res.setHeader("Cache-Control", "no-cache"); // Don't cache the stream
      res.setHeader("Connection", "keep-alive"); // Keep connection open

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3.5: Compose system prompt using PromptComposer
      // ─────────────────────────────────────────────────────────────────────

      // Get saved attachments for this message
      const savedAttachments = await storage.getAttachmentsByMessageId(
        savedMessage.id,
      );

      // Use PromptComposer to build the complete system prompt with:
      // - Core directives from prompts/core-directives.md
      // - Personality from prompts/personality.md
      // - Tools from prompts/tools.md
      // - RAG context from relevant document chunks
      // - Contextual instructions based on attachments
      // Get verbosity mode from client (mute, low, normal, experimental)
      const verbosityMode = req.body.verbosityMode || "normal";
      const useVoice = verbosityMode !== "mute";
      
      // Determine content verbosity level for prompt context
      const contentVerbosity = (() => {
        switch (verbosityMode) {
          case "mute": return "minimal";
          case "low": return "low";
          default: return "verbose"; // normal and experimental
        }
      })();
      
      const composedPrompt = await promptComposer.compose({
        textContent: req.body.content || "",
        voiceTranscript: "",
        attachments: savedAttachments,
        history: chatMessages,
        chatId: req.params.id,
        userId: userId, // Pass userId for data isolation in RAG context
      });
      
      // Add voice/verbosity instructions based on mode
      let finalSystemPrompt = composedPrompt.systemPrompt;
      if (useVoice) {
        let voiceInstruction = "";
        
        switch (verbosityMode) {
          case "low":
            voiceInstruction = `
## VERBOSITY MODE: LOW (Concise Text & Speech)
The user has LOW verbosity mode enabled. Keep both text and speech responses concise.
- Keep responses brief and focused - aim for 1-3 sentences maximum
- Use the \`say\` tool to provide concise spoken summaries
- Provide only essential information without elaboration
- Example: User asks "What's the weather?" → Response: "It's 72°F and sunny in your area."
`;
            break;
            
          case "normal":
            voiceInstruction = `
## VERBOSITY MODE: NORMAL (Verbose Text & Speech)
The user has NORMAL verbosity mode enabled. Provide comprehensive, detailed responses in both text and speech.
- Use the \`say\` tool to speak your complete responses
- All text sent via \`write\` (except code blocks) should also be spoken
- Provide thorough explanations with context and details
- CALL the tools natively using the function calling interface.
`;
            break;
            
          case "experimental":
            voiceInstruction = `
## VERBOSITY MODE: EXPERIMENTAL (Dual-Voice Discussion)
The user has EXPERIMENTAL mode enabled - generate a two-voice discussion format.
- Structure your response as a dialogue between two AI personas discussing the topic
- Use the \`say\` tool to present this discussion format
- Continue the discussion until the user interrupts (barge-in)
- Make the conversation natural, with back-and-forth exchanges
- Example format:
  Persona A: "That's an interesting question about..."
  Persona B: "I agree, and I'd add that..."
  Persona A: "Exactly! And another key point is..."
`;
            break;
        }
        
        finalSystemPrompt = voiceInstruction + "\n\n" + finalSystemPrompt;
      } else {
        // Mute mode - minimal output, alerts only
        const muteInstruction = `
## VERBOSITY MODE: MUTE (Alerts Only)
The user has MUTE mode enabled. Minimize all output.
- Only respond to critical alerts or explicit user queries
- Keep responses to absolute minimum (1 sentence or less)
- No voice output whatsoever
- Skip conversational niceties and get straight to the essential information
`;
        finalSystemPrompt = muteInstruction + "\n\n" + finalSystemPrompt;
      }
      
      // Add content verbosity instruction
      if (contentVerbosity === "low") {
        const verbosityNote = "\n\n**Content Verbosity: LOW** - Keep all responses concise and focused. Maximum 1-3 sentences.\n";
        finalSystemPrompt = finalSystemPrompt + verbosityNote;
      } else if (contentVerbosity === "minimal") {
        const verbosityNote = "\n\n**Content Verbosity: MINIMAL** - Only respond to critical alerts or explicit queries. Maximum 1 sentence.\n";
        finalSystemPrompt = finalSystemPrompt + verbosityNote;
      } else if (contentVerbosity === "verbose") {
        const verbosityNote = "\n\n**Content Verbosity: VERBOSE** - Provide comprehensive, detailed explanations with context and examples.\n";
        finalSystemPrompt = finalSystemPrompt + verbosityNote;
      }
      
      // Replace composedPrompt.systemPrompt with our modified version
      const modifiedPrompt = { ...composedPrompt, systemPrompt: finalSystemPrompt };

      console.log(
        `System prompt composed: ${composedPrompt.systemPrompt.length} chars, ${composedPrompt.attachments.length} attachments`,
      );

      // ─────────────────────────────────────────────────────────────────────
      // STEP 4: Call Gemini AI with streaming and system instruction
      // ─────────────────────────────────────────────────────────────────────

      // Build parts array for the current user message (text + any images)
      const userParts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      // Add the text content
      if (req.body.content) {
        userParts.push({ text: req.body.content });
      }

      // Add all attachments for multimodal input
      for (const att of reqAttachments) {
        if (att.dataUrl && att.mimeType) {
          // Extract base64 data from dataUrl
          const base64Match = att.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            userParts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: base64Match[1],
              },
            });
          }
        }
      }

      // Fallback if no content was added
      if (userParts.length === 0) {
        userParts.push({ text: "" });
      }

      // Determine model based on user preference: "pro" = gemini-3.1-pro-preview, "flash" = gemini-3-flash-preview
      const modelMode =
        req.body.model === "flash"
          ? "gemini-3-flash-preview"
          : "gemini-3.1-pro-preview";
      console.log(
        `[Routes] Using model: ${modelMode} (mode: ${req.body.model || "pro"})`,
      );
      
      // Log the user message for debugging
      const userMsgText = req.body.content || "";
      console.log(`\n${"=".repeat(60)}`);
      console.log(`[LLM] USER MESSAGE:`);
      console.log(`${"─".repeat(60)}`);
      console.log(userMsgText.slice(0, 500) + (userMsgText.length > 500 ? "..." : ""));
      console.log(`${"=".repeat(60)}\n`);

      // Select appropriate tool set based on authentication (authStatus already declared above)
      const toolDeclarations = getToolDeclarations(authStatus.isAuthenticated);
      
      console.log(
        `[Routes] Auth Status: ${authStatus.isAuthenticated ? "AUTHENTICATED" : "GUEST"} - ` +
        `Tools Available: ${toolDeclarations.length}`
      );

      // ═══════════════════════════════════════════════════════════════════════
      // LOG INPUT: Capture everything sent TO the LLM
      // ═══════════════════════════════════════════════════════════════════════
      const { ioLogger } = await import("./services/io-logger");
      const inputLogTimestamp = new Date().toISOString();
      
      // Calculate token estimates
      const systemPromptTokens = Math.ceil(modifiedPrompt.systemPrompt.length / 4);
      const userMessageTokens = Math.ceil(userMsgText.length / 4);
      const historyTokens = Math.ceil(
        chatMessages.reduce((sum, m) => sum + m.content.length, 0) / 4
      );
      const totalInputTokensEstimate = systemPromptTokens + userMessageTokens + historyTokens;

      const inputLogFilename = ioLogger.logInput({
        timestamp: inputLogTimestamp,
        messageId: savedMessage.id,
        chatId: req.params.id,
        systemPrompt: modifiedPrompt.systemPrompt,
        userMessage: userMsgText,
        conversationHistory: chatMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        attachments: reqAttachments.map(a => ({
          type: a.type || 'file',
          filename: a.filename || 'unknown',
          size: a.size || 0,
          mimeType: a.mimeType,
        })),
        ragContext: modifiedPrompt.ragContext,
        model: modelMode,
        totalInputTokensEstimate,
      });

      console.log(`[IOLogger] Input logged to: ${inputLogFilename}`);

      const result = await genAI.models.generateContentStream({
        model: modelMode,
        config: {
          systemInstruction: modifiedPrompt.systemPrompt,
          // Enable native function calling with appropriate tool set
          // Authenticated users get full tools, guests get limited safe tools
          tools: [{ functionDeclarations: toolDeclarations }],
          toolConfig: {
            functionCallingConfig: {
              // ANY mode forces the model to always call at least one function
              mode: FunctionCallingConfigMode.ANY,
            },
          },
        },
        contents: [...history, { role: "user", parts: userParts }],
      });

      // ─────────────────────────────────────────────────────────────────────
      // STEP 5: Stream response and collect native function calls
      // ─────────────────────────────────────────────────────────────────────
      // With native function calling, the model returns FunctionCall objects
      // directly - no JSON parsing from text needed!

      let fullResponse = "";
      let cleanContentForStorage = "";
      const toolResults: Array<{
        toolId: string;
        type: string;
        success: boolean;
        result?: unknown;
        error?: string;
      }> = [];
      let usageMetadata:
        | {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          }
        | undefined;

      // Collect function calls from response chunks
      const collectedFunctionCalls: FunctionCall[] = [];
      let parsedResponse: { toolCalls?: ToolCall[] } | null = null;
      
      // Streaming TTS: accumulate text into sentences, generate TTS per sentence
      let ttsSentenceBuffer = "";
      let streamingSpeechCount = 0;
      const streamTTSSentence = async (sentence: string) => {
        if (!useVoice || !sentence.trim()) return;
        try {
          // Determine TTS provider
          const provider = process.env.TTS_PROVIDER || "google";
          let ttsResult;
          
          if (provider === "elevenlabs" || provider === "11labs") {
            const { generateSingleSpeakerAudio, DEFAULT_ELEVENLABS_VOICE } = await import("./integrations/elevenlabs-tts");
            ttsResult = await generateSingleSpeakerAudio(sentence.trim(), DEFAULT_ELEVENLABS_VOICE, 1);
          } else {
            const { generateSingleSpeakerAudio, DEFAULT_TTS_VOICE } = await import("./integrations/expressive-tts");
            ttsResult = await generateSingleSpeakerAudio(sentence.trim(), DEFAULT_TTS_VOICE, 1);
          }

          if (ttsResult.audioBase64) {
            streamingSpeechCount++;
            console.log(`[Routes][StreamTTS] ✓ Sentence ${streamingSpeechCount} audio generated via ${provider}, length: ${ttsResult.audioBase64.length}`);
            res.write(
              `data: ${JSON.stringify({
                speech: {
                  utterance: sentence.trim(),
                  audioGenerated: true,
                  audioBase64: ttsResult.audioBase64,
                  mimeType: ttsResult.mimeType || "audio/mpeg",
                  duration: ttsResult.duration,
                  streaming: true,
                  index: streamingSpeechCount,
                },
              })}\n\n`,
            );
          }
        } catch (err) {
          console.error(`[Routes][StreamTTS] Failed to generate sentence audio:`, err);
        }
      };
      
      // Extract complete sentences from buffer, return remaining incomplete text
      const extractSentences = (buffer: string): { sentences: string[]; remainder: string } => {
        const sentences: string[] = [];
        // Split on sentence-ending punctuation, but not on:
        //   - decimal numbers  (digit . digit)       e.g. "3.14"
        //   - domain names     (word . word no space) e.g. "example.com"
        //   - abbreviations    (. followed by lowercase word) e.g. "Dr. smith"
        // Strategy: scan for [.!?] followed by whitespace-or-end, skip if the
        // period is between two word/digit characters (decimal/domain) or if
        // the next non-space char is lowercase (abbreviation continuation).
        const sentenceEnd = /([!?]+[\s\n]*|\.(?!\d)(?!\s*[a-z])[\s\n]*)/;
        const parts = buffer.split(sentenceEnd);
        let accumulated = "";
        for (let i = 0; i < parts.length - 1; i += 2) {
          accumulated += parts[i] + (parts[i + 1] || "");
          const trimmed = accumulated.trim();
          // Only emit sentences that contain at least one alphanumeric character
          // to avoid passing punctuation-only fragments to TTS.
          if (trimmed.length > 0 && /[a-zA-Z0-9]/.test(trimmed)) {
            sentences.push(trimmed);
            accumulated = "";
          }
        }
        // Last part (no terminator yet) is the remainder
        const remainder = accumulated + (parts.length % 2 === 1 ? parts[parts.length - 1] : "");
        // Also split on double newlines in remainder
        if (remainder.includes('\n\n')) {
          const paraParts = remainder.split('\n\n');
          for (let i = 0; i < paraParts.length - 1; i++) {
            const part = paraParts[i].trim();
            if (part.length > 0 && /[a-zA-Z0-9]/.test(part)) sentences.push(part);
          }
          return { sentences, remainder: paraParts[paraParts.length - 1] };
        }
        return { sentences, remainder };
      };
      
      for await (const chunk of result) {
        // FIX: Explicitly capture "Thinking" content from Gemini 2.0 Flash Thinking
        // Check for thought parts in the chunk candidates
        let thoughtText = "";
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            // Check for 'thought' property (Gemini 2.0 Flash Thinking)
            // @ts-ignore - 'thought' might not be in the type definition yet
            if (part.thought) { 
              thoughtText += part.thought; 
            }
          }
        }

        // If we have thought text, wrap it so it persists in storage
        if (thoughtText) {
          const thoughtChunk = `<thinking>${thoughtText}</thinking>\n\n`;
          fullResponse += thoughtChunk;
          cleanContentForStorage += thoughtChunk; // CRITICAL FIX: Add to storage!
          
          // Stream it to the client immediately
          res.write(`data: ${JSON.stringify({ text: thoughtChunk })}\n\n`);
        }

        // Capture any text content (rare with function calling mode)
        const text = chunk.text || "";
        if (text) {
          fullResponse += text;
          cleanContentForStorage += text;
          // Stream text to client if any
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
          
          // Streaming TTS: accumulate and send sentences
          if (useVoice) {
            ttsSentenceBuffer += text;
            const { sentences, remainder } = extractSentences(ttsSentenceBuffer);
            ttsSentenceBuffer = remainder;
            for (const sentence of sentences) {
              await streamTTSSentence(sentence);
            }
          }
        }

        // Capture function calls from the response
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          collectedFunctionCalls.push(...chunk.functionCalls);
          console.log(`[Routes] Received ${chunk.functionCalls.length} function calls from Gemini`);
        }

        // Capture usage metadata from the final chunk
        if (chunk.usageMetadata) {
          usageMetadata = chunk.usageMetadata;
        }
      }
      
      // Flush remaining TTS buffer after stream ends
      if (useVoice && ttsSentenceBuffer.trim().length > 0) {
        await streamTTSSentence(ttsSentenceBuffer.trim());
      }
      
      // Convert Gemini FunctionCall objects to our ToolCall format
      if (collectedFunctionCalls.length > 0) {
        const toolCalls: ToolCall[] = collectedFunctionCalls.map((fc, index) => ({
          id: `fc_${index}_${Date.now()}`,
          type: fc.name as ToolCall["type"],
          operation: fc.name || "execute",
          parameters: (fc.args as Record<string, unknown>) || {},
          priority: 0,
        }));
        parsedResponse = { toolCalls };
        console.log(`[Routes] Converted ${toolCalls.length} function calls to ToolCall format`);
        for (const tc of toolCalls) {
          console.log(`  • ${tc.type}: ${JSON.stringify(tc.parameters).substring(0, 100)}`);
        }
      } else {
        console.log("[Routes] No function calls in response");
      }

      // Note: With native function calling, no JSON parsing needed!
      // Function calls are already extracted above from chunk.functionCalls

      // ─────────────────────────────────────────────────────────────────────
      // AGENTIC LOOP: Execute tools repeatedly until end_turn terminates
      // ─────────────────────────────────────────────────────────────────────
      
      let loopIteration = 0;
      const MAX_LOOP_ITERATIONS = 10; // Safety limit to prevent infinite loops
      const MAX_TOOLS_PER_TURN = 20; // Limit tool calls per turn to prevent runaway
      let totalToolsExecuted = 0;
      const MAX_TOTAL_TOOLS = 50; // Absolute limit across all turns
      let shouldEndTurn = false;
      let agenticHistory = [...history, { role: "user", parts: userParts }];
      
      // Set SSE response for real-time tool call events
      ragDispatcher.setSseResponse(res);
      
      // Helper function to execute tools and return results
      const executeToolsAndGetResults = async (
        toolCalls: ToolCall[],
        messageId: string
      ): Promise<{ results: typeof toolResults; shouldEndTurn: boolean; sendChatContent: string }> => {
        const results: typeof toolResults = [];
        let endTurn = false;
        let sendChatContent = ""; // Accumulate send_chat content for storage
        
        for (const toolCall of toolCalls) {
          console.log(`[Routes] Executing tool call: ${toolCall.type} (${toolCall.id})`);
          try {
            // Pass chatId for tool call logging
            const toolResult = await ragDispatcher.executeToolCall(toolCall, messageId, req.params.id);
            results.push({
              toolId: toolResult.toolId,
              type: toolResult.type,
              success: toolResult.success,
              result: toolResult.result,
              error: toolResult.error,
            });

            // Send tool result to client
            res.write(
              `data: ${JSON.stringify({
                toolResult: {
                  id: toolCall.id,
                  type: toolCall.type,
                  success: toolResult.success,
                  result: toolResult.result,
                  error: toolResult.error,
                },
              })}\n\n`,
            );
            
            // Check for send_chat/write - stream content to client AND accumulate for storage
            if ((toolCall.type === "send_chat" || toolCall.type === "write") && toolResult.success) {
              const sendChatResult = toolResult.result as { content?: string };
              if (sendChatResult?.content) {
                // Stream the send_chat content to the client
                res.write(`data: ${JSON.stringify({ text: sendChatResult.content })}\n\n`);
                // CRITICAL FIX: Accumulate send_chat content so it's saved to database
                sendChatContent += sendChatResult.content;
              }
            }
            
            // Check for end_turn - this terminates the agentic loop
            if (toolCall.type === "end_turn" && toolResult.success) {
              const endTurnResult = toolResult.result as { shouldEndTurn?: boolean };
              if (endTurnResult?.shouldEndTurn) {
                endTurn = true;
              }
            }
            
            // Special handling for say tool - send speech event for HD audio playback
            if (toolCall.type === "say" && toolResult.success) {
              console.log(`[Routes][SAY] Tool result:`, JSON.stringify(toolResult.result).substring(0, 200));
              const sayResult = toolResult.result as { 
                audioBase64?: string; 
                mimeType?: string; 
                duration?: number;
                utterance?: string;
                voice?: string;
                success?: boolean;
              };
              // Check if the say tool itself reported success
              if (sayResult?.success === false) {
                console.log(`[Routes][SAY] Tool execution failed internally, falling back to client-side TTS:`, sayResult);
                // Send speech event WITHOUT audio to trigger client-side fallback
                res.write(
                  `data: ${JSON.stringify({
                    speech: {
                      utterance: sayResult.utterance || "",
                      voice: sayResult.voice,
                      audioGenerated: false, // Explicitly false
                      message: sayResult.message,
                      error: sayResult.error
                    },
                  })}\n\n`,
                );
              } else if (sayResult?.audioBase64) {
                console.log(`[Routes][SAY] ✓ Sending speech event with voice: ${sayResult.voice}, audio length: ${sayResult.audioBase64.length}`);
                res.write(
                  `data: ${JSON.stringify({
                    speech: {
                      utterance: sayResult.utterance || "",
                      voice: sayResult.voice,
                      audioGenerated: true,
                      audioBase64: sayResult.audioBase64,
                      mimeType: sayResult.mimeType || "audio/mpeg",
                      duration: sayResult.duration,
                    },
                  })}\n\n`,
                );
                console.log(`[Routes][SAY] ✓ Speech event sent to client`);
              } else {
                console.log(`[Routes][SAY] ✗ No audioBase64 in result. Keys:`, Object.keys(sayResult || {}));
              }
            }
            
            // Special handling for open_url tool - send event to frontend to open URL
            if (toolCall.type === "open_url" && toolResult.success) {
              console.log(`[Routes][OPEN_URL] Sending open_url event`);
              const openUrlResult = toolResult.result as { url?: string; success?: boolean };
              if (openUrlResult?.url) {
                res.write(
                  `data: ${JSON.stringify({
                    openUrl: {
                      url: openUrlResult.url,
                    },
                  })}\n\n`,
                );
                console.log(`[Routes][OPEN_URL] ✓ Sent URL to open: ${openUrlResult.url}`);
              } else {
                console.log(`[Routes][OPEN_URL] ✗ No URL in result`);
              }
            }
          } catch (err: any) {
            console.error(`[Routes] Tool execution error:`, err);
            results.push({
              toolId: toolCall.id,
              type: toolCall.type,
              success: false,
              error: err.message,
            });
            res.write(
              `data: ${JSON.stringify({
                toolResult: {
                  id: toolCall.id,
                  type: toolCall.type,
                  success: false,
                  error: err.message,
                },
              })}\n\n`,
            );
          }
        }
        
        return { results, shouldEndTurn: endTurn, sendChatContent };
      };
      
      // Execute initial tool calls if we parsed any
      if (parsedResponse && parsedResponse.toolCalls && parsedResponse.toolCalls.length > 0) {
        // Log all tool calls for debugging
        console.log(`\n${"=".repeat(60)}`);
        console.log(`[LLM] AI RESPONSE (Turn ${loopIteration}) - ${parsedResponse.toolCalls.length} TOOL CALLS:`);
        console.log(`${"─".repeat(60)}`);
        for (const tc of parsedResponse.toolCalls) {
          console.log(`  • ${tc.type} (${tc.id})`);
        }
        console.log(`${"=".repeat(60)}\n`);
        
        // Execute tools (with per-turn limit)
        const limitedToolCalls = parsedResponse.toolCalls.slice(0, MAX_TOOLS_PER_TURN);
        if (parsedResponse.toolCalls.length > MAX_TOOLS_PER_TURN) {
          console.warn(`[AGENTIC LOOP] Limiting ${parsedResponse.toolCalls.length} tool calls to ${MAX_TOOLS_PER_TURN}`);
        }
        const execResult = await executeToolsAndGetResults(limitedToolCalls, savedMessage.id);
        toolResults.push(...execResult.results);
        totalToolsExecuted += limitedToolCalls.length;
        shouldEndTurn = execResult.shouldEndTurn;
        // CRITICAL FIX: Add send_chat content to storage so it persists
        if (execResult.sendChatContent) {
          cleanContentForStorage += execResult.sendChatContent;
        }
        
        // Add model response with function calls to agentic history
        // Use proper function call format for multi-turn context
        // Note: The Gemini API supports functionCall parts but TypeScript types don't reflect this
        agenticHistory.push({
          role: "model",
          parts: collectedFunctionCalls.map(fc => ({ functionCall: fc })) as any
        });
        
        // AGENTIC LOOP: Continue if end_turn was NOT called
        while (!shouldEndTurn && loopIteration < MAX_LOOP_ITERATIONS && totalToolsExecuted < MAX_TOTAL_TOOLS) {
          loopIteration++;
          console.log(`\n${"═".repeat(60)}`);
          console.log(`[AGENTIC LOOP] Turn ${loopIteration} - Feeding tool results back to LLM`);
          console.log(`${"═".repeat(60)}\n`);
          
          // Build tool results message for the LLM (compact, strip large binary data)
          const lastToolCount = parsedResponse?.toolCalls?.length || 0;
          const toolResultsText = toolResults
            .slice(-lastToolCount) // Only include results from last turn
            .map(r => {
              // Strip large binary data from results before sending back to LLM
              let resultSummary: unknown = r.result;
              if (typeof r.result === "object" && r.result !== null) {
                const res = r.result as Record<string, unknown>;
                // Remove known large binary fields to save tokens
                const sanitized = { ...res };
                if ("audioBase64" in sanitized) {
                  sanitized.audioBase64 = "[audio generated]";
                }
                if ("base64" in sanitized) {
                  sanitized.base64 = "[binary data]";
                }
                if ("screenshot" in sanitized && typeof sanitized.screenshot === "string" && (sanitized.screenshot as string).length > 100) {
                  sanitized.screenshot = "[screenshot captured]";
                }
                // Check for noTruncate flag (used by file_get tool) - skip content truncation
                const shouldTruncate = !("noTruncate" in sanitized && sanitized.noTruncate === true);
                if ("content" in sanitized && typeof sanitized.content === "string" && shouldTruncate && (sanitized.content as string).length > 2000) {
                  sanitized.content = (sanitized.content as string).substring(0, 2000) + "... [truncated]";
                }
                resultSummary = sanitized;
              }
              // Compact output format
              const summary = r.success ? JSON.stringify(resultSummary) : `ERROR: ${r.error}`;
              // Check if result has noTruncate flag - if so, don't limit summary length
              const hasNoTruncate = typeof r.result === 'object' && 
                r.result !== null && 
                'noTruncate' in r.result && 
                (r.result as { noTruncate?: boolean }).noTruncate === true;
              const limitedSummary = hasNoTruncate ? summary : (summary.length > 500 ? summary.substring(0, 500) + "..." : summary);
              return `• ${r.type}: ${limitedSummary}`;
            })
            .join("\n");
          
          // Provide tool results to the model as a user message
          agenticHistory.push({
            role: "user", 
            parts: [{ text: `Tool results:\n${toolResultsText}\n\nContinue with more tools or call end_turn when ready.` }]
          });
          
          // Call LLM again with native function calling
          const loopResult = await genAI.models.generateContentStream({
            model: modelMode,
            config: {
              systemInstruction: modifiedPrompt.systemPrompt,
              // Use same tool set as initial call (respects auth status)
              tools: [{ functionDeclarations: toolDeclarations }],
              toolConfig: {
                functionCallingConfig: {
                  mode: FunctionCallingConfigMode.ANY,
                },
              },
            },
            contents: agenticHistory,
          });
          
          // Collect function calls from loop response
          let loopResponse = "";
          const loopFunctionCalls: FunctionCall[] = [];
          let loopParsedResponse: { toolCalls?: ToolCall[] } | null = null;
          
          for await (const chunk of loopResult) {
            const text = chunk.text || "";
            if (text) loopResponse += text;
            
            // Collect function calls
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
              loopFunctionCalls.push(...chunk.functionCalls);
            }
            
            if (chunk.usageMetadata) {
              usageMetadata = chunk.usageMetadata;
            }
          }
          
          fullResponse += `\n\n[Turn ${loopIteration}]\n${loopResponse}`;
          
          // Convert function calls to ToolCall format
          if (loopFunctionCalls.length > 0) {
            const toolCalls: ToolCall[] = loopFunctionCalls.map((fc, index) => ({
              id: `fc_loop${loopIteration}_${index}_${Date.now()}`,
              type: fc.name as ToolCall["type"],
              operation: fc.name || "execute",
              parameters: (fc.args as Record<string, unknown>) || {},
              priority: 0,
            }));
            loopParsedResponse = { toolCalls };
            
            console.log(`[AGENTIC LOOP] Turn ${loopIteration} - ${toolCalls.length} function calls`);
            for (const tc of toolCalls) {
              console.log(`  • ${tc.type}: ${JSON.stringify(tc.parameters).substring(0, 80)}`);
            }
            
            // Execute tools (with per-turn limit)
            const limitedLoopToolCalls = toolCalls.slice(0, MAX_TOOLS_PER_TURN);
            if (toolCalls.length > MAX_TOOLS_PER_TURN) {
              console.warn(`[AGENTIC LOOP] Turn ${loopIteration}: Limiting ${toolCalls.length} tool calls to ${MAX_TOOLS_PER_TURN}`);
            }
            const loopExecResult = await executeToolsAndGetResults(limitedLoopToolCalls, savedMessage.id);
            toolResults.push(...loopExecResult.results);
            totalToolsExecuted += limitedLoopToolCalls.length;
            shouldEndTurn = loopExecResult.shouldEndTurn;
            // CRITICAL FIX: Add send_chat content to storage so it persists
            if (loopExecResult.sendChatContent) {
              cleanContentForStorage += loopExecResult.sendChatContent;
            }
            
            // Update history for next iteration - use proper function call format
            agenticHistory.push({
              role: "model",
              parts: loopFunctionCalls.map(fc => ({ functionCall: fc })) as any
            });
            parsedResponse = loopParsedResponse;
          } else {
            // No function calls - LLM responded with plain text, treat as implicit end_turn
            console.log(`[AGENTIC LOOP] Turn ${loopIteration} - No function calls, treating as implicit end_turn`);
            const plainTextResponse = loopResponse.trim();
            if (plainTextResponse) {
              res.write(`data: ${JSON.stringify({ text: plainTextResponse })}\n\n`);
            }
            break;
          }
        }
        
        if (!shouldEndTurn) {
          let warningMessage = "";
          if (loopIteration >= MAX_LOOP_ITERATIONS) {
            console.warn(`[AGENTIC LOOP] Hit max iterations (${MAX_LOOP_ITERATIONS}), forcing termination`);
            warningMessage = "[Loop limit reached - response truncated]";
          } else if (totalToolsExecuted >= MAX_TOTAL_TOOLS) {
            console.warn(`[AGENTIC LOOP] Hit max total tools (${MAX_TOTAL_TOOLS}), forcing termination`);
            warningMessage = "[Tool execution limit reached - response truncated]";
          }
          if (warningMessage) {
            res.write(`data: ${JSON.stringify({ text: warningMessage })}\n\n`);
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 6: Save AI response with clean content
      // ─────────────────────────────────────────────────────────────────────

      // Clean up the accumulated prose-only content
      // Remove any residual tool_code blocks, empty code blocks, and cleanup
      let finalContent = cleanContentForStorage
        // Remove code blocks containing tool call arrays (identified by known tool types)

      // Prepare Gemini content for storage (keep original for multi-turn context)
      // Always use the accumulated fullResponse to ensure complete content is stored
      const geminiContentToStore = {
        role: "model",
        parts: [{ text: fullResponse }],
      };

      // Include tool results and token usage in message metadata
      const tokenUsage = usageMetadata ? {
        promptTokens: usageMetadata.promptTokenCount || 0,
        completionTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
      } : undefined;
      const messageMetadata: Record<string, unknown> = {};
      if (toolResults.length > 0) messageMetadata.toolResults = toolResults;
      if (tokenUsage) messageMetadata.tokenUsage = tokenUsage;

      const endTime = Date.now();

      const savedAiMessage = await storage.addMessage({
        chatId: req.params.id,
        role: "ai",
        content: finalContent,
        geminiContent: geminiContentToStore,
        metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
      });

      // Ingest AI response for RAG recall (async, don't block)
      // Use same userId from earlier in the request for consistency
      ragService
        .ingestMessage(
          finalContent,
          req.params.id,
          savedAiMessage.id,
          "ai",
          undefined,
          userId,
        )
        .catch((error) => {
          console.error(
            `[RAG] Failed to ingest AI message ${savedAiMessage.id}:`,
            error,
          );
        });

      // Log to LLM debug buffer for debugging
      try {
        const { llmDebugBuffer } = await import("./services/llm-debug-buffer");
        const { promptComposer } = await import("./services/prompt-composer");
        const { ioLogger } = await import("./services/io-logger");
        
        // Get system prompt breakdown for detailed token analysis
        const breakdown = promptComposer.getSystemPromptBreakdown();
        
        // Log output to file
        const outputLogFilename = ioLogger.logOutput({
          timestamp: new Date().toISOString(),
          messageId: savedMessage.id,
          chatId: req.params.id,
          rawResponse: fullResponse,
          cleanContent: finalContent,
          toolCalls: (parsedResponse?.toolCalls || []).map(tc => ({
            type: tc.type,
            parameters: tc.parameters,
          })),
          toolResults: toolResults.map(tr => ({
            type: tr.type,
            success: tr.success,
            result: tr.result,
            error: tr.error,
          })),
          model: modelMode,
          durationMs: endTime - (startTime || endTime),
          totalOutputTokensEstimate: Math.ceil(fullResponse.length / 4),
        });
        
        console.log(`[IOLogger] Output logged to: ${outputLogFilename}`);
        
        // Add to debug buffer with enhanced data
        await llmDebugBuffer.add({
          chatId: req.params.id,
          messageId: savedMessage.id,
          userId: userId,
          systemPrompt: modifiedPrompt.systemPrompt,
          systemPromptBreakdown: {
            components: breakdown.components.map(c => ({
              name: c.name,
              charCount: c.charCount,
              lineCount: c.lineCount,
              tokenEstimate: Math.ceil(c.charCount / 4),
            })),
            totalChars: breakdown.totalChars,
            totalLines: breakdown.totalLines,
            estimatedTokens: breakdown.estimatedTokens,
          },
          userMessage: composedPrompt.userMessage,
          conversationHistory: chatMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          attachments: composedPrompt.attachments.map((a) => ({
            type: a.type,
            filename: a.filename,
            mimeType: a.mimeType,
          })),
          rawResponse: fullResponse,
          parsedToolCalls: parsedResponse?.toolCalls || [],
          cleanContent: finalContent,
          toolResults,
          model: modelMode,
          durationMs: endTime - (startTime || endTime),
          tokenEstimate: {
            inputTokens: totalInputTokensEstimate,
            outputTokens: Math.ceil(fullResponse.length / 4),
          },
          ioLogFiles: {
            inputLog: inputLogFilename,
            outputLog: outputLogFilename,
          },
        });
        
        // Cleanup old IO logs (keep last 50)
        ioLogger.cleanup(50);
      } catch (logError) {
        console.error("Failed to log LLM interaction:", logError);
      }

      // Log LLM token usage to database
      try {
        if (usageMetadata && usageMetadata.promptTokenCount !== undefined) {
          await storage.logLlmUsage({
            chatId: req.params.id,
            messageId: savedMessage.id,
            model: modelMode,
            promptTokens: usageMetadata.promptTokenCount || 0,
            completionTokens: usageMetadata.candidatesTokenCount || 0,
            totalTokens: usageMetadata.totalTokenCount || 0,
            durationMs: endTime - startTime,
            metadata: usageMetadata,
          });
          console.log(
            `[Token Usage] Chat ${req.params.id}: ${usageMetadata.promptTokenCount} in, ${usageMetadata.candidatesTokenCount} out, ${usageMetadata.totalTokenCount} total`,
          );
        }
      } catch (usageError) {
        console.error("Failed to log LLM token usage:", usageError);
      }

      // ─────────────────────────────────────────────────────────────────────
      // FALLBACK TTS: Only if zero streaming sentences AND zero say-tool calls
      // ─────────────────────────────────────────────────────────────────────
      const sayToolCalled = toolResults.some(r => r.type === "say" && r.success);
      if (useVoice && !sayToolCalled && streamingSpeechCount === 0 && finalContent && finalContent.trim().length > 0) {
        console.log(`[Routes][TTS-Fallback] No streaming TTS or say tool, generating single fallback`);
        try {
          const provider = process.env.TTS_PROVIDER || "google";
          let ttsResult;
          const ttsText = finalContent.length > 500 
            ? finalContent.substring(0, 500) + "..."
            : finalContent;

          if (provider === "elevenlabs" || provider === "11labs") {
            const { generateSingleSpeakerAudio, DEFAULT_ELEVENLABS_VOICE } = await import("./integrations/elevenlabs-tts");
            ttsResult = await generateSingleSpeakerAudio(ttsText, DEFAULT_ELEVENLABS_VOICE);
          } else {
            const { generateSingleSpeakerAudio, DEFAULT_TTS_VOICE } = await import("./integrations/expressive-tts");
            ttsResult = await generateSingleSpeakerAudio(ttsText, DEFAULT_TTS_VOICE);
          }

          if (ttsResult.audioBase64) {
            console.log(`[Routes][TTS-Fallback] ✓ Generated fallback audio via ${provider}, length: ${ttsResult.audioBase64.length}`);
            res.write(
              `data: ${JSON.stringify({
                speech: {
                  utterance: ttsText,
                  audioGenerated: true,
                  audioBase64: ttsResult.audioBase64,
                  mimeType: ttsResult.mimeType || "audio/mpeg",
                  duration: ttsResult.duration,
                  fallback: true,
                },
              })}\n\n`,
            );
          }
        } catch (ttsError) {
          console.error(`[Routes][TTS-Fallback] Failed:`, ttsError);
        }
      } else if (useVoice) {
        console.log(`[Routes][TTS] Speech already delivered: ${streamingSpeechCount} streaming chunks, sayToolCalled: ${sayToolCalled}`);
      }

      // Send completion event with tool results summary and close the stream
      res.write(
        `data: ${JSON.stringify({
          done: true,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
          savedMessage: {
            id: savedAiMessage.id,
            role: savedAiMessage.role,
            content: savedAiMessage.content,
            createdAt: savedAiMessage.createdAt,
            metadata: savedAiMessage.metadata,
          },
        })}\n\n`,
      );
      res.end();
    } catch (error) {
      // Log error for debugging
      console.error("Error in message streaming:", error);

      // Check if headers were already sent (streaming started)
      if (res.headersSent) {
        // Send error via SSE and end stream gracefully
        try {
          res.write(
            `data: ${JSON.stringify({ error: "An error occurred while processing your message" })}\n\n`,
          );
          res.end();
        } catch (e) {
          // Stream may already be closed, just log and continue
          console.error("Failed to send error via stream:", e);
        }
      } else {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // MESSAGE METADATA POLLING
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/messages/:id/metadata
   * Poll for message metadata (used for async autoexec results).
   *
   * @route GET /api/messages/:id/metadata
   * @param {string} id - Message UUID
   * @returns {Object} 200 - { metadata: object, hasAutoexecResult: boolean }
   * @returns {Error} 404 - Message not found
   */
  app.get("/api/messages/:id/metadata", async (req, res) => {
    try {
      const message = await storage.getMessageById(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const metadata = message.metadata as Record<string, unknown> | null;
      res.json({
        metadata,
        hasAutoexecResult: !!(
          metadata &&
          "autoexecResult" in metadata &&
          metadata.autoexecResult
        ),
      });
    } catch (error) {
      console.error("Error fetching message metadata:", error);
      res.status(500).json({ error: "Failed to fetch message metadata" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // DEBUG ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  app.get("/api/debug/logs", async (_req, res) => {
    try {
      const { logBuffer } = await import("./services/log-buffer");
      const logs = logBuffer.getLogs(50);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/debug/database", async (_req, res) => {
    try {
      const tables = await storage.getDebugDatabaseInfo();
      res.json(tables);
    } catch (error) {
      console.error("Error fetching database info:", error);
      res.status(500).json({ error: "Failed to fetch database info" });
    }
  });

  app.get("/api/debug/database/:tableName", async (req, res) => {
    try {
      const { tableName } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const data = await storage.getTableData(tableName, limit, offset);
      res.json(data);
    } catch (error) {
      console.error("Error fetching table data:", error);
      res.status(500).json({ error: "Failed to fetch table data" });
    }
  });

  app.put("/api/debug/database/:tableName/:recordId", async (req, res) => {
    try {
      const { tableName, recordId } = req.params;
      const success = await storage.updateTableRecord(
        tableName,
        recordId,
        req.body,
      );
      if (!success) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating record:", error);
      res.status(500).json({ error: "Failed to update record" });
    }
  });

  app.delete("/api/debug/database/:tableName/:recordId", async (req, res) => {
    try {
      const { tableName, recordId } = req.params;
      const success = await storage.deleteTableRecord(tableName, recordId);
      if (!success) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting record:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // LLM DEBUG ENDPOINTS
  // IMPORTANT: Specific routes (/persistent, /stats) MUST come before /:id
  // ═════════════════════════════════════════════════════════════════════════

  // LLM Debug endpoints - view prompts and responses (in-memory buffer)
  app.get("/api/debug/llm", async (req, res) => {
    try {
      const { llmDebugBuffer } = await import("./services/llm-debug-buffer");
      const limit = parseInt(req.query.limit as string) || 20;
      const interactions = llmDebugBuffer.getAll(limit);
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching LLM debug data:", error);
      res.status(500).json({ error: "Failed to fetch LLM debug data" });
    }
  });

  /**
   * GET /api/debug/llm/persistent
   * Get persistent LLM interactions from database (paginated)
   * MUST be defined before /api/debug/llm/:id to avoid route conflict
   */
  app.get("/api/debug/llm/persistent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const userId = req.query.userId as string | undefined;
      
      const interactions = await storage.getRecentLlmInteractions(
        limit,
        userId === 'null' ? null : userId
      );
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching persistent LLM interactions:", error);
      res.status(500).json({ error: "Failed to fetch persistent LLM interactions" });
    }
  });

  // Parameterized route MUST come after specific routes
  app.get("/api/debug/llm/:id", async (req, res) => {
    try {
      const { llmDebugBuffer } = await import("./services/llm-debug-buffer");
      const interaction = llmDebugBuffer.getById(req.params.id);
      if (!interaction) {
        return res.status(404).json({ error: "Interaction not found" });
      }
      res.json(interaction);
    } catch (error) {
      console.error("Error fetching LLM interaction:", error);
      res.status(500).json({ error: "Failed to fetch LLM interaction" });
    }
  });

  app.delete("/api/debug/llm", async (_req, res) => {
    try {
      const { llmDebugBuffer } = await import("./services/llm-debug-buffer");
      llmDebugBuffer.clear();
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing LLM debug data:", error);
      res.status(500).json({ error: "Failed to clear LLM debug data" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // LLM INTERACTION PERSISTENCE ENDPOINTS (more specific routes)
  // Query persistent LLM interaction data from database
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/debug/llm/persistent/:id
   * Get a single persistent LLM interaction by ID
   */
  app.get("/api/debug/llm/persistent/:id", async (req, res) => {
    try {
      const interaction = await storage.getLlmInteractionById(req.params.id);
      if (!interaction) {
        return res.status(404).json({ error: "Interaction not found" });
      }
      res.json(interaction);
    } catch (error) {
      console.error("Error fetching persistent LLM interaction:", error);
      res.status(500).json({ error: "Failed to fetch persistent LLM interaction" });
    }
  });

  /**
   * GET /api/debug/llm/persistent/chat/:chatId
   * Get all LLM interactions for a specific chat
   */
  app.get("/api/debug/llm/persistent/chat/:chatId", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const interactions = await storage.getLlmInteractionsByChat(
        req.params.chatId,
        limit
      );
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching chat LLM interactions:", error);
      res.status(500).json({ error: "Failed to fetch chat LLM interactions" });
    }
  });

  /**
   * GET /api/debug/llm/stats
   * Get statistics about LLM interactions
   */
  app.get("/api/debug/llm/stats", async (_req, res) => {
    try {
      const stats = await storage.getLlmInteractionStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching LLM interaction stats:", error);
      res.status(500).json({ error: "Failed to fetch LLM interaction statistics" });
    }
  });

  /**
   * DELETE /api/debug/llm/persistent/cleanup
   * Clean up old LLM interactions (retention policy)
   */
  app.delete("/api/debug/llm/persistent/cleanup", async (req, res) => {
    try {
      const daysOld = parseInt(req.query.daysOld as string) || 30;
      const deletedCount = await storage.deleteOldLlmInteractions(daysOld);
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error("Error cleaning up old LLM interactions:", error);
      res.status(500).json({ error: "Failed to cleanup old LLM interactions" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // IO LOG FILE ENDPOINTS - Direct access to input/output logs
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/debug/io-logs
   * List all IO log files (inputs and outputs)
   */
  app.get("/api/debug/io-logs", async (_req, res) => {
    try {
      const { ioLogger } = await import("./services/io-logger");
      const logs = ioLogger.listLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error listing IO logs:", error);
      res.status(500).json({ error: "Failed to list IO logs" });
    }
  });

  /**
   * GET /api/debug/io-logs/:filename
   * Get the content of a specific IO log file
   */
  app.get("/api/debug/io-logs/:filename", async (req, res) => {
    try {
      const { ioLogger } = await import("./services/io-logger");
      const { filename } = req.params;
      
      // Security: Only allow files that start with 'input-' or 'output-'
      if (!filename.startsWith('input-') && !filename.startsWith('output-')) {
        return res.status(400).json({ error: "Invalid log file name" });
      }
      
      const content = ioLogger.getLog(filename);
      if (!content) {
        return res.status(404).json({ error: "Log file not found" });
      }
      
      // Return as markdown
      res.setHeader('Content-Type', 'text/markdown');
      res.send(content);
    } catch (error) {
      console.error("Error fetching IO log:", error);
      res.status(500).json({ error: "Failed to fetch IO log" });
    }
  });

  /**
   * DELETE /api/debug/io-logs/cleanup
   * Clean up old IO log files (keep last N)
   */
  app.delete("/api/debug/io-logs/cleanup", async (req, res) => {
    try {
      const { ioLogger } = await import("./services/io-logger");
      const keepLast = parseInt(req.query.keepLast as string) || 50;
      ioLogger.cleanup(keepLast);
      res.json({ success: true, message: `Cleaned up old logs, kept last ${keepLast}` });
    } catch (error) {
      console.error("Error cleaning up IO logs:", error);
      res.status(500).json({ error: "Failed to cleanup IO logs" });
    }
  });

  /**
   * GET /api/debug/system-prompt-breakdown
   * Get detailed breakdown of system prompt components
   */
  app.get("/api/debug/system-prompt-breakdown", async (_req, res) => {
    try {
      const { promptComposer } = await import("./services/prompt-composer");
      const breakdown = promptComposer.getSystemPromptBreakdown();
      res.json(breakdown);
    } catch (error) {
      console.error("Error getting system prompt breakdown:", error);
      res.status(500).json({ error: "Failed to get system prompt breakdown" });
    }
  });

  /**
   * DELETE /api/debug/llm/persistent/cleanup
   * Clean up old LLM interactions (retention policy)
   */
  app.delete("/api/debug/llm/persistent/cleanup", async (req, res) => {
    try {
      const olderThanDays = parseInt(req.query.days as string) || 30;
      const deletedCount = await storage.deleteOldLlmInteractions(olderThanDays);
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error("Error cleaning up old LLM interactions:", error);
      res.status(500).json({ error: "Failed to clean up old LLM interactions" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // LLM TOKEN USAGE ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/llm/usage
   * Get LLM token usage statistics
   */
  app.get("/api/llm/usage", async (_req, res) => {
    try {
      const stats = await storage.getLlmUsageStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching LLM usage stats:", error);
      res.status(500).json({ error: "Failed to fetch LLM usage statistics" });
    }
  });

  /**
   * GET /api/llm/usage/recent
   * Get recent LLM usage records
   */
  app.get("/api/llm/usage/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const usage = await storage.getRecentLlmUsage(limit);
      res.json(usage);
    } catch (error) {
      console.error("Error fetching recent LLM usage:", error);
      res.status(500).json({ error: "Failed to fetch recent LLM usage" });
    }
  });

  /**
   * GET /api/llm/usage/chat/:chatId
   * Get LLM usage for a specific chat
   */
  app.get("/api/llm/usage/chat/:chatId", async (req, res) => {
    try {
      const usage = await storage.getLlmUsageByChat(req.params.chatId);
      res.json(usage);
    } catch (error) {
      console.error("Error fetching chat LLM usage:", error);
      res.status(500).json({ error: "Failed to fetch chat LLM usage" });
    }
  });

  // LLM Error Log endpoints
  app.get("/api/debug/errors", async (req, res) => {
    try {
      const { llmErrorBuffer } = await import("./services/llm-error-buffer");
      const limit = parseInt(req.query.limit as string) || 50;
      const service = req.query.service as string | undefined;

      if (service) {
        const errors = llmErrorBuffer.getByService(service as any, limit);
        res.json(errors);
      } else {
        const errors = llmErrorBuffer.getAll(limit);
        res.json(errors);
      }
    } catch (error) {
      console.error("Error fetching LLM errors:", error);
      res.status(500).json({ error: "Failed to fetch LLM errors" });
    }
  });

  app.get("/api/debug/errors/summary", async (_req, res) => {
    try {
      const { llmErrorBuffer } = await import("./services/llm-error-buffer");
      const summary = llmErrorBuffer.getSummaryForAnalysis();
      res.json({ summary, count: llmErrorBuffer.getCount() });
    } catch (error) {
      console.error("Error fetching error summary:", error);
      res.status(500).json({ error: "Failed to fetch error summary" });
    }
  });

  app.post("/api/debug/errors/analyze", async (req, res) => {
    try {
      const { llmErrorBuffer } = await import("./services/llm-error-buffer");
      const { GoogleGenAI } = await import("@google/genai");

      const summary = llmErrorBuffer.getSummaryForAnalysis();

      if (llmErrorBuffer.getCount() === 0) {
        return res.json({
          analysis: "No errors to analyze. The error log is empty.",
          errorCount: 0,
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
      }

      const genAI = new GoogleGenAI({ apiKey });

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are a debugging assistant. Analyze these LLM-related errors and provide:
1. A summary of the most common issues
2. Potential root causes
3. Suggested fixes or workarounds
4. Priority ranking (which errors to fix first)

Be concise but thorough. Format your response in markdown.

${summary}`,
              },
            ],
          },
        ],
      });

      const analysis = response.text || "Unable to generate analysis";

      res.json({
        analysis,
        errorCount: llmErrorBuffer.getCount(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error analyzing errors:", error);
      res.status(500).json({ error: "Failed to analyze errors" });
    }
  });

  app.delete("/api/debug/errors", async (_req, res) => {
    try {
      const { llmErrorBuffer } = await import("./services/llm-error-buffer");
      llmErrorBuffer.clear();
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing LLM errors:", error);
      res.status(500).json({ error: "Failed to clear LLM errors" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // JIT TOOL PROTOCOL ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  app.post("/api/jit/predict", async (req, res) => {
    try {
      const { jitToolProtocol } = await import("./services/jit-tool-protocol");
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Missing 'query' parameter" });
      }

      const prediction = await jitToolProtocol.predictTools(query);
      res.json({ success: true, prediction });
    } catch (error) {
      console.error("JIT prediction error:", error);
      res.status(500).json({ error: "Failed to predict tools" });
    }
  });

  app.post("/api/jit/context", async (req, res) => {
    try {
      const { jitToolProtocol } = await import("./services/jit-tool-protocol");
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

  app.get("/api/jit/examples", async (_req, res) => {
    try {
      const { jitToolProtocol } = await import("./services/jit-tool-protocol");
      const allTools = jitToolProtocol.getAllTools();
      const manifest = jitToolProtocol.getFullManifest();
      res.json({ success: true, allTools, manifest });
    } catch (error) {
      console.error("JIT examples error:", error);
      res.status(500).json({ error: "Failed to get examples" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CODEBASE ANALYSIS ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  app.post("/api/codebase/analyze", async (req, res) => {
    try {
      const { codebaseAnalyzer } = await import("./services/codebase-analyzer");
      const { path: rootPath = ".", skipIngestion } = req.body;

      // Skip RAG ingestion for external codebases (paths outside the project)
      const isExternal = rootPath.startsWith("/tmp") || rootPath.startsWith("/home") || rootPath.includes("github");
      const shouldSkipIngestion = skipIngestion === true || isExternal;

      // Start analysis (may take time for large codebases)
      const result = await codebaseAnalyzer.analyzeCodebase(rootPath, shouldSkipIngestion);

      // Convert Map to object for JSON serialization
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
        files: result.files.map(f => ({
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

  app.get("/api/codebase/progress", async (_req, res) => {
    try {
      const { codebaseAnalyzer } = await import("./services/codebase-analyzer");
      const progress = codebaseAnalyzer.getProgress();
      res.json({ success: true, progress });
    } catch (error) {
      console.error("Error getting analysis progress:", error);
      res.status(500).json({ success: false, error: "Failed to get progress" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // BROWSER ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  app.post("/api/browser/load", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res
          .status(400)
          .json({ success: false, error: "URL is required" });
      }

      if (
        !process.env.BROWSERBASE_API_KEY ||
        !process.env.BROWSERBASE_PROJECT_ID
      ) {
        return res.status(503).json({
          success: false,
          error:
            "Browserbase is not configured. Please add BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID to your environment variables.",
          needsConfig: true,
        });
      }

      const browserbase = await import("./integrations/browserbase");

      const result = await browserbase.takeScreenshot(url, { fullPage: false });
      const screenshotBase64 = result.screenshot.toString("base64");
      const screenshotUrl = `data:image/png;base64,${screenshotBase64}`;

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

  // ═════════════════════════════════════════════════════════════════════════
  // LIVE VOICE CONVERSATION ENDPOINTS
  // Moved to server/routes/live.ts
  // ═════════════════════════════════════════════════════════════════════════

  // ═════════════════════════════════════════════════════════════════════════
  // DOCUMENTATION API
  // Serves markdown documentation files from the docs/ directory
  // ═════════════════════════════════════════════════════════════════════════

  app.get("/api/documentation/:path(*)", async (req, res) => {
    try {
      const docPath = req.params.path;
      const fs = await import("fs/promises");
      const path = await import("path");
      
      // Security: Only allow .md files from docs directory
      if (!docPath.endsWith(".md")) {
        return res.status(400).json({ error: "Only .md files allowed" });
      }
      
      const fullPath = path.join(process.cwd(), "docs", docPath);
      
      // Security: Prevent directory traversal
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

  // ═════════════════════════════════════════════════════════════════════════
  // MODULAR API ROUTERS
  // The following routes are organized into separate modules:
  // - /api/drive - Google Drive file operations
  // - /api/gmail - Gmail operations
  // - /api/calendar - Google Calendar operations
  // - /api/docs - Google Docs operations
  // - /api/sheets - Google Sheets operations
  // - /api/tasks - Google Tasks operations
  // - /api/speech - Speech transcription
  // - /api/drafts - Draft management
  // - /api/attachments - Attachment management
  // ═════════════════════════════════════════════════════════════════════════

  app.use("/api", createApiRouter());
  app.use("/api/diag", diagRouter);

  // ═════════════════════════════════════════════════════════════════════════
  // Return the HTTP server instance
  // This allows the caller to attach WebSocket servers or start listening
  // ═════════════════════════════════════════════════════════════════════════

  return httpServer;
}
