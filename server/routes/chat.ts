/**
 * Chat API routes
 *
 * Covers: chat CRUD, message posting (agentic SSE stream), tool-call logs,
 * and message metadata polling.
 *
 * Mounted at /api by createApiRouter().  Routes that begin with /chats are
 * under the /api/chats prefix; /tool-calls/:id and /messages/:id/metadata are
 * also mounted directly at /api so the full paths resolve correctly.
 */

import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { insertChatSchema, insertMessageSchema, GUEST_USER_ID } from "@shared/schema";
import { getToolDeclarations } from "../gemini-tools-guest";
import { promptComposer } from "../services/prompt-composer";
import { recognizeFamilyMember } from "../services/family-recognition";
import { parseVoiceStyle, stripAllVoiceTags } from "../services/style-parser";
import { createTtsPipeline } from "../services/tts-pipeline";
import { runAgenticLoop } from "../services/agentic-loop";
import { withRetryOn503, ModelUnavailableError } from "../utils/retry";

const router = Router();

// Lazily initialised so a missing API key at module load time doesn't crash startup
let _genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!_genAI) {
    _genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return _genAI;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat CRUD
// ─────────────────────────────────────────────────────────────────────────────

router.post("/chats", async (req, res) => {
  try {
    const authStatus = (req as any).authStatus;
    const validatedData = insertChatSchema.parse({
      ...req.body,
      userId: authStatus.userId,
      isGuest: authStatus.isGuest,
    });
    const chat = await storage.createChat(validatedData);
    console.log(`[Chat Created] ${chat.id} - User: ${authStatus.userId || "GUEST"}`);
    res.json(chat);
  } catch (error) {
    console.error("[POST /api/chats] Error creating chat:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/chats", async (req, res) => {
  try {
    const authStatus = (req as any).authStatus;
    const userId = authStatus.userId || GUEST_USER_ID;
    res.json(await storage.getChats(userId));
  } catch (error) {
    console.error("[GET /api/chats] Error fetching chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

router.get("/chats/:id", async (req, res) => {
  try {
    const chat = await storage.getChatById(req.params.id);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const limit = parseInt(req.query.limit as string) || 30;
    const before = req.query.before as string | undefined;
    const messages = await storage.getMessagesByChatId(req.params.id, { limit: limit + 1, before });

    const hasMore = messages.length > limit;
    const returnMessages = hasMore ? messages.slice(1) : messages;

    console.log(`[GET /api/chats/${req.params.id}] Returning ${returnMessages.length} messages, hasMore: ${hasMore}`);
    res.json({ chat, messages: returnMessages, hasMore });
  } catch (error) {
    console.error(`[GET /api/chats/${req.params.id}] Error:`, error);
    res.status(500).json({ error: "Failed to fetch chat" });
  }
});

router.get("/chats/:id/messages", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const before = req.query.before as string;
    if (!before) return res.status(400).json({ error: "before cursor required" });

    const messages = await storage.getMessagesByChatId(req.params.id, { limit: limit + 1, before });
    const hasMore = messages.length > limit;
    res.json({ messages: hasMore ? messages.slice(1) : messages, hasMore });
  } catch (error) {
    console.error(`[GET /api/chats/${req.params.id}/messages] Error:`, error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.patch("/chats/:id", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    await storage.updateChatTitle(req.params.id, title);
    res.json({ success: true });
  } catch (error) {
    console.error(`[PATCH /api/chats/${req.params.id}] Error:`, error);
    res.status(500).json({ error: "Failed to update chat" });
  }
});

router.get("/chats/:id/tool-calls", async (req, res) => {
  try {
    res.json(await storage.getRecentToolCallLogs(req.params.id));
  } catch (error) {
    console.error(`[GET /api/chats/${req.params.id}/tool-calls] Error:`, error);
    res.status(500).json({ error: "Failed to fetch tool calls" });
  }
});

router.get("/tool-calls/:id", async (req, res) => {
  try {
    const toolCall = await storage.getToolCallLogById(req.params.id);
    if (!toolCall) return res.status(404).json({ error: "Tool call not found" });
    res.json(toolCall);
  } catch (error) {
    console.error(`[GET /api/tool-calls/${req.params.id}] Error:`, error);
    res.status(500).json({ error: "Failed to fetch tool call" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Message posting — the core agentic SSE stream
// ─────────────────────────────────────────────────────────────────────────────

router.post("/chats/:id/messages", async (req, res) => {
  const startTime = Date.now();
  try {
    const authStatus = (req as any).authStatus;
    const userId = authStatus.userId;

    // ── 1. Save user message ──────────────────────────────────────────────
    const userMessage = insertMessageSchema.parse({
      chatId: req.params.id,
      role: "user",
      content: req.body.content || "",
    });
    const savedMessage = await storage.addMessage(userMessage);

    const familyMember = recognizeFamilyMember(userMessage.content);
    if (familyMember) {
      console.log(`[family] Session personalised for: ${familyMember.name}`);
    }

    // ── 2. Process attachments ────────────────────────────────────────────
    const reqAttachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
    for (const att of reqAttachments) {
      let content = att.content || "";
      if (!content && att.dataUrl?.includes(",")) {
        const base64Part = att.dataUrl.split(",")[1];
        const isText =
          att.mimeType?.startsWith("text/") ||
          ["application/json", "application/xml", "application/javascript"].includes(att.mimeType);
        try {
          content = isText ? Buffer.from(base64Part, "base64").toString("utf-8") : base64Part;
        } catch {
          content = base64Part;
        }
      }

      try {
        await storage.createAttachment({
          messageId: savedMessage.id,
          type: att.type || "file",
          filename: att.filename || "unnamed",
          mimeType: att.mimeType,
          size: att.size,
          content: content.replace(/\x00/g, ""),
        });
      } catch (attachmentError) {
        console.error(`Failed to save attachment ${att.filename}:`, attachmentError);
      }
    }

    // ── 3. Build conversation history ─────────────────────────────────────
    const RECENT_WINDOW = 25;
    const MAX_CONTENT_LENGTH = 2000;
    const chatMessages = await storage.getMessagesByChatId(req.params.id, { limit: RECENT_WINDOW + 1 });
    const previousMessages = chatMessages.filter((msg) => msg.id !== savedMessage.id);

    const history = previousMessages.map((msg, index) => {
      let content = msg.content;
      const isLastAi = msg.role === "ai" && index === previousMessages.length - 1;
      const metadata = msg.metadata as {
        toolResults?: Array<{ type: string; result: unknown; success: boolean }>;
      } | null;

      if (isLastAi && metadata?.toolResults?.length) {
        const toolSummary = metadata.toolResults
          .filter((tr) => tr.success)
          .map((tr) => {
            const resultStr = JSON.stringify(tr.result);
            const hasNoTruncate =
              typeof tr.result === "object" &&
              tr.result !== null &&
              (tr.result as any).noTruncate === true;
            return `[Tool ${tr.type} returned: ${hasNoTruncate ? resultStr : resultStr.slice(0, 5000)}]`;
          })
          .join("\n");
        content = content + "\n\n" + toolSummary;
      } else if (content.length > MAX_CONTENT_LENGTH) {
        content = content.slice(0, MAX_CONTENT_LENGTH) + "\n...[truncated for context]";
      }

      return { role: msg.role === "user" ? "user" : "model", parts: [{ text: content }] };
    });

    // ── 4. SSE headers ────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // ── 5. Compose system prompt ──────────────────────────────────────────
    const savedAttachments = await storage.getAttachmentsByMessageId(savedMessage.id);
    const verbosityMode = req.body.verbosityMode || "normal";
    const useVoice = verbosityMode !== "mute";

    const composedPrompt = await promptComposer.compose({
      textContent: req.body.content || "",
      voiceTranscript: "",
      attachments: savedAttachments,
      history: chatMessages,
      chatId: req.params.id,
      userId,
    });

    const preResponseSpeechPlan =
      useVoice
        ? promptComposer.getForwardThoughtSpeechPlan({ forceReload: true })
        : { lines: [], rawCache: "" };

    // Apply verbosity mode instructions
    let finalSystemPrompt = composedPrompt.systemPrompt;
    const voiceInstructions: Record<string, string> = {
      low: `\n## VERBOSITY MODE: LOW\nKeep responses brief (1-3 sentences). Use \`say\` for concise spoken summaries.\n`,
      normal: `\n## VERBOSITY MODE: NORMAL\nProvide comprehensive, detailed responses. Use \`say\` to speak complete responses.\n`,
      experimental: `\n## VERBOSITY MODE: EXPERIMENTAL (Dual-Voice)\nStructure responses as a dialogue between two AI personas.\n`,
      mute: `\n## VERBOSITY MODE: MUTE\nMinimize output. Only critical alerts. No voice. Maximum 1 sentence.\n`,
    };

    const verbosityInstruction = voiceInstructions[verbosityMode] || voiceInstructions.normal;
    finalSystemPrompt = verbosityInstruction + "\n\n" + finalSystemPrompt;

    if (verbosityMode === "low") {
      finalSystemPrompt += "\n\n**Content Verbosity: LOW** — Keep responses concise (max 1-3 sentences).\n";
    } else if (verbosityMode === "mute") {
      finalSystemPrompt += "\n\n**Content Verbosity: MINIMAL** — Only critical alerts. Max 1 sentence.\n";
    } else {
      finalSystemPrompt += "\n\n**Content Verbosity: VERBOSE** — Provide comprehensive, detailed explanations.\n";
    }

    const modifiedPrompt = { ...composedPrompt, systemPrompt: finalSystemPrompt };
    console.log(`System prompt composed: ${composedPrompt.systemPrompt.length} chars`);

    // ── 6. Build userParts for multimodal input ───────────────────────────
    const userParts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [];
    if (req.body.content) userParts.push({ text: req.body.content });
    for (const att of reqAttachments) {
      if (att.dataUrl && att.mimeType) {
        const match = att.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (match) userParts.push({ inlineData: { mimeType: att.mimeType, data: match[1] } });
      }
    }
    if (userParts.length === 0) userParts.push({ text: "" });

    // ── 7. Model selection ────────────────────────────────────────────────
    const modelMode = req.body.model === "flash" ? "gemini-3-flash-preview" : "gemini-2.5-pro";
    console.log(`[Chat] Using model: ${modelMode}`);

    // ── 8. I/O logging ────────────────────────────────────────────────────
    const { ioLogger } = await import("../services/io-logger");
    const totalInputTokensEstimate = Math.ceil(
      (modifiedPrompt.systemPrompt.length +
        (req.body.content || "").length +
        chatMessages.reduce((s, m) => s + m.content.length, 0)) /
        4,
    );
    const inputLogFilename = ioLogger.logInput({
      timestamp: new Date().toISOString(),
      messageId: savedMessage.id,
      chatId: req.params.id,
      systemPrompt: modifiedPrompt.systemPrompt,
      userMessage: req.body.content || "",
      conversationHistory: chatMessages.map((m) => ({ role: m.role, content: m.content })),
      attachments: reqAttachments.map((a: any) => ({
        type: a.type || "file",
        filename: a.filename || "unknown",
        size: a.size || 0,
        mimeType: a.mimeType,
      })),
      model: modelMode,
      totalInputTokensEstimate,
    });
    console.log(`[IOLogger] Input logged: ${inputLogFilename}`);

    // ── 9. TTS pipeline + pre-response filler state ───────────────────────
    const ttsPipeline = createTtsPipeline(res, useVoice);
    let stopPreResponseFiller = false;
    let assistantOutputStarted = false;

    const onAssistantOutputStarted = () => {
      if (assistantOutputStarted) return;
      assistantOutputStarted = true;
      stopPreResponseFiller = true;

      const fillerInterruptMode =
        req.body.preResponseFiller?.interruptMode === "finish-current-sentence-then-stop"
          ? "finish-current-sentence-then-stop"
          : "stop-immediately-on-first-model-text";

      if (fillerInterruptMode === "stop-immediately-on-first-model-text") {
        ttsPipeline.writeSpeechControlEvent("stop", "model-output");
      }
    };

    // ── 10. Pre-response filler (fire-and-forget) ─────────────────────────
    const fillerEnabled = req.body.preResponseFiller?.enabled !== false;
    const fillerCadence = req.body.preResponseFiller?.cadence;
    const getFillerDelayMs = () => {
      if (fillerCadence === "fixed-6-seconds") return 6000;
      if (fillerCadence === "fixed-8-seconds") return 8000;
      return 5000 + Math.floor(Math.random() * 5001);
    };

    void (async () => {
      if (!useVoice || !fillerEnabled || preResponseSpeechPlan.lines.length === 0) return;

      await new Promise((resolve) => setTimeout(resolve, 900));

      for (const line of preResponseSpeechPlan.lines) {
        if (stopPreResponseFiller || res.writableEnded || res.destroyed) return;
        try {
          const ttsResult = await ttsPipeline.generateSpeechAudio(line);
          ttsPipeline.writeSpeechEvent({
            utterance: line,
            audioGenerated: !!ttsResult.audioBase64,
            audioBase64: ttsResult.audioBase64,
            mimeType: ttsResult.mimeType || "audio/mpeg",
            duration: ttsResult.duration,
            streaming: true,
          });
        } catch {
          ttsPipeline.writeSpeechEvent({ utterance: line, audioGenerated: false, streaming: true });
        }

        const delayMs = getFillerDelayMs();
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    })();

    // ── 11. Abort signal ──────────────────────────────────────────────────
    const abortController = new AbortController();
    req.on("close", () => abortController.abort());

    // ── 12. Agentic loop ──────────────────────────────────────────────────
    const requestedMax = Number(req.body.maxAgenticTurns);
    const maxIterations =
      Number.isFinite(requestedMax) && requestedMax >= 1 ? Math.min(requestedMax, 30) : 10;

    const toolDeclarations = getToolDeclarations(authStatus.isAuthenticated);
    console.log(
      `[Chat] Auth: ${authStatus.isAuthenticated ? "AUTH" : "GUEST"} — ${toolDeclarations.length} tools`,
    );

    const loopResult = await runAgenticLoop({
      genAI: getGenAI(),
      modelMode,
      toolDeclarations,
      systemPrompt: modifiedPrompt.systemPrompt,
      history,
      userParts,
      messageId: savedMessage.id,
      chatId: req.params.id,
      maxIterations,
      maxToolsPerTurn: 20,
      maxTotalTools: 50,
      abortSignal: abortController.signal,
      res,
      useVoice,
      ttsPipeline,
      onAssistantOutputStarted,
    });

    // ── 13. Flush TTS ─────────────────────────────────────────────────────
    await ttsPipeline.flushStreamingTTS();

    // ── 14. Fallback TTS (only if nothing spoken yet) ─────────────────────
    const sayToolCalled = loopResult.toolResults.some((r) => r.type === "say" && r.success);
    const finalContent = parseVoiceStyle(loopResult.cleanContentForStorage).cleanText;

    if (useVoice && ttsPipeline.speechEventsSent === 0 && !sayToolCalled && finalContent.trim()) {
      console.log(`[Chat][TTS-Fallback] Generating single fallback`);
      try {
        const ttsText = finalContent.length > 500 ? finalContent.substring(0, 500) + "..." : finalContent;
        const ttsResult = await ttsPipeline.generateSpeechAudio(ttsText);
        ttsPipeline.writeSpeechEvent({
          utterance: ttsText,
          audioGenerated: !!ttsResult.audioBase64,
          audioBase64: ttsResult.audioBase64,
          mimeType: ttsResult.mimeType || "audio/mpeg",
          duration: ttsResult.duration,
          fallback: true,
        });
      } catch (ttsError) {
        console.error(`[Chat][TTS-Fallback] Failed:`, ttsError);
        ttsPipeline.writeSpeechEvent({ utterance: finalContent, audioGenerated: false, fallback: true });
      }
    }

    // ── 15. Save AI message ───────────────────────────────────────────────
    const endTime = Date.now();
    const { usageMetadata, toolResults, fullResponse } = loopResult;
    const tokenUsage = {
      promptTokens: usageMetadata.promptTokenCount,
      completionTokens: usageMetadata.candidatesTokenCount,
      totalTokens: usageMetadata.totalTokenCount,
    };
    const messageMetadata: Record<string, unknown> = {};
    if (toolResults.length > 0) messageMetadata.toolResults = toolResults;
    if (tokenUsage.totalTokens > 0) messageMetadata.tokenUsage = tokenUsage;

    const savedAiMessage = await storage.addMessage({
      chatId: req.params.id,
      role: "ai",
      content: finalContent,
      geminiContent: { role: "model", parts: [{ text: fullResponse }] },
      metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
    });

    // ── 16. Debug logging ─────────────────────────────────────────────────
    try {
      const { llmDebugBuffer } = await import("../services/llm-debug-buffer");
      const { ioLogger: logger } = await import("../services/io-logger");

      const breakdown = promptComposer.getSystemPromptBreakdown();
      const outputLogFilename = logger.logOutput({
        timestamp: new Date().toISOString(),
        messageId: savedMessage.id,
        chatId: req.params.id,
        rawResponse: fullResponse,
        cleanContent: finalContent,
        toolCalls: loopResult.allFunctionCalls.map((fc) => ({
          type: fc.name || "",
          parameters: (fc.args as Record<string, unknown>) || {},
        })),
        toolResults: toolResults.map((tr) => ({
          type: tr.type,
          success: tr.success,
          result: tr.result,
          error: tr.error,
        })),
        model: modelMode,
        durationMs: endTime - startTime,
        totalOutputTokensEstimate: Math.ceil(fullResponse.length / 4),
      });
      console.log(`[IOLogger] Output logged: ${outputLogFilename}`);

      await llmDebugBuffer.add({
        chatId: req.params.id,
        messageId: savedMessage.id,
        userId,
        systemPrompt: modifiedPrompt.systemPrompt,
        systemPromptBreakdown: {
          components: breakdown.components.map((c) => ({
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
        conversationHistory: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        attachments: composedPrompt.attachments.map((a) => ({
          type: a.type,
          filename: a.filename,
          mimeType: a.mimeType,
        })),
        rawResponse: fullResponse,
        parsedToolCalls: loopResult.allFunctionCalls.map((fc, i) => ({
          id: `fc_${i}`,
          type: fc.name || "",
          operation: fc.name || "execute",
          parameters: (fc.args as Record<string, unknown>) || {},
          priority: 0,
        })),
        cleanContent: finalContent,
        toolResults,
        model: modelMode,
        durationMs: endTime - startTime,
        tokenEstimate: {
          inputTokens: totalInputTokensEstimate,
          outputTokens: Math.ceil(fullResponse.length / 4),
        },
        ioLogFiles: { inputLog: inputLogFilename, outputLog: outputLogFilename },
      });

      logger.cleanup(50);
    } catch (logError) {
      console.error("Failed to log LLM interaction:", logError);
    }

    // ── 17. Usage DB logging ──────────────────────────────────────────────
    try {
      if (usageMetadata.promptTokenCount > 0) {
        await storage.logLlmUsage({
          chatId: req.params.id,
          messageId: savedMessage.id,
          model: modelMode,
          promptTokens: usageMetadata.promptTokenCount,
          completionTokens: usageMetadata.candidatesTokenCount,
          totalTokens: usageMetadata.totalTokenCount,
          durationMs: endTime - startTime,
          metadata: usageMetadata,
        });
      }
    } catch (usageError) {
      console.error("Failed to log LLM token usage:", usageError);
    }

    // ── 18. Done event ────────────────────────────────────────────────────
    if (!res.writableEnded) {
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
    }
  } catch (error) {
    if (error instanceof ModelUnavailableError) {
      console.warn(`[Chat] AI service unavailable after retries`);
      const msg = "⚠️ The AI service is temporarily unavailable (503). Please try again.";
      try {
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ warning: msg })}\n\n`);
          res.end();
        } else {
          res.status(503).json({ error: msg });
        }
      } catch {
        // Response already closed
      }
      return;
    }

    console.error(`[POST /api/chats/${req.params?.id}/messages] Error:`, error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    try {
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process message" });
      }
    } catch {
      // Response already closed
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Message metadata polling
// ─────────────────────────────────────────────────────────────────────────────

router.get("/messages/:id/metadata", async (req, res) => {
  try {
    const message = await storage.getMessageById(req.params.id);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const metadata = message.metadata as Record<string, unknown> | null;
    res.json({
      metadata,
      hasAutoexecResult: !!(metadata && "autoexecResult" in metadata && metadata.autoexecResult),
    });
  } catch (error) {
    console.error("Error fetching message metadata:", error);
    res.status(500).json({ error: "Failed to fetch message metadata" });
  }
});

export default router;
