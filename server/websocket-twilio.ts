/**
 * Twilio ConversationRelay WebSocket
 *
 * Replaces the old media-stream audio bridge with a simpler text-based relay:
 * Twilio handles speech-to-text and text-to-speech while Meowstik handles the
 * conversational logic and persists call turns.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";
import type { Duplex } from "stream";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage.js";

const OWNER_NAME = "Jason Bender";
const PHONE_MODEL = process.env.GEMINI_PHONE_MODEL || "gemini-2.5-flash";

type CallMode = "inbound" | "outbound" | "owner";

interface ConversationRelaySetupMessage {
  type: "setup";
  sessionId: string;
  callSid: string;
  from: string;
  to: string;
  callerName?: string;
  direction?: string;
  customParameters?: Record<string, string>;
}

interface ConversationRelayPromptMessage {
  type: "prompt";
  voicePrompt: string;
  lang?: string;
  last?: boolean;
}

interface ConversationRelayInterruptMessage {
  type: "interrupt";
  utteranceUntilInterrupt?: string;
  durationUntilInterruptMs?: number;
}

interface ConversationRelayDtmfMessage {
  type: "dtmf";
  digit: string;
}

interface ConversationRelayErrorMessage {
  type: "error";
  description: string;
}

type ConversationRelayMessage =
  | ConversationRelaySetupMessage
  | ConversationRelayPromptMessage
  | ConversationRelayInterruptMessage
  | ConversationRelayDtmfMessage
  | ConversationRelayErrorMessage;

interface SessionTurn {
  speaker: "caller" | "assistant";
  text: string;
}

interface PhoneSession {
  sessionId: string;
  callSid: string;
  conversationId: string | null;
  mode: CallMode;
  fromNumber: string;
  toNumber: string;
  callerName: string | null;
  context: string;
  systemPrompt: string;
  turns: SessionTurn[];
  turnCount: number;
}

const sessions = new Map<string, PhoneSession>();

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

async function resolveCallerName(fromNumber: string): Promise<string | null> {
  try {
    const { searchContacts } = await import("./integrations/google-contacts.js");
    const results: any[] = await Promise.race([
      searchContacts(fromNumber, 5) as Promise<any[]>,
      new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1200)),
    ]);
    for (const contact of results) {
      for (const phone of contact.phoneNumbers ?? []) {
        if (normalizePhone(phone.value) === normalizePhone(fromNumber)) {
          return contact.displayName as string;
        }
      }
    }
  } catch {
    // Google Contacts is optional.
  }
  return null;
}

function sanitizeSpeech(text: string): string {
  return text
    .replace(/[*_`#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSystemPrompt(session: {
  mode: CallMode;
  fromNumber: string;
  callerName: string | null;
  context: string;
  meowstikNumber: string;
}): string {
  const { mode, fromNumber, callerName, context, meowstikNumber } = session;

  if (mode === "owner") {
    return `You are Meowstik, ${OWNER_NAME}'s AI personal assistant. ${OWNER_NAME} is speaking to you by phone.

Speak naturally and briefly, like a trusted assistant on a live call.
- Be warm, direct, and useful.
- Keep responses concise for speech.
- No markdown, bullets, emojis, or stage directions.
- If a request would require tools or outside actions you cannot perform during this call, be honest and offer the next best helpful step.
${context ? `Context: ${context}` : ""}`;
  }

  if (mode === "outbound") {
    return `You are Meowstik, the AI assistant for ${OWNER_NAME}. You are on a live outbound phone call with someone ${OWNER_NAME} wanted to reach.

Your job:
- Introduce yourself naturally as Meowstik, ${OWNER_NAME}'s assistant.
- Carry out the mission below conversationally and professionally.
- Keep answers short and natural for phone audio.
- If asked something you cannot verify, say you will check with ${OWNER_NAME} and follow up.
- No markdown, bullets, emojis, or stage directions.

Mission:
${context || `Represent ${OWNER_NAME} professionally and helpfully.`}`;
  }

  const callerLabel = callerName ? `${callerName} (${fromNumber})` : `the caller at ${fromNumber}`;
  return `You are Meowstik, the AI receptionist for ${OWNER_NAME}. You are answering ${meowstikNumber} and speaking with ${callerLabel}.

Your job:
- Be warm, calm, and professional.
- Learn their name if it is not already known.
- Ask why they are calling and help if you can.
- Take a clear message when needed.
- Keep responses concise and natural for a phone call.
- No markdown, bullets, emojis, or stage directions.

If the caller is spam or a solicitor, decline politely and briefly.`;
}

function buildPrompt(session: PhoneSession, userPrompt: string): string {
  const history = session.turns
    .map((turn) => `${turn.speaker === "caller" ? "Caller" : "Meowstik"}: ${turn.text}`)
    .join("\n");

  if (!history) {
    return `Caller: ${userPrompt}\nMeowstik:`;
  }

  return `${history}\nCaller: ${userPrompt}\nMeowstik:`;
}

async function ensureConversationRecord(message: ConversationRelaySetupMessage): Promise<{ id: string; turnCount: number } | null> {
  const existing = await storage.getCallConversationBySid(message.callSid);
  if (existing) {
    return { id: existing.id, turnCount: existing.turnCount ?? 0 };
  }

  const created = await storage.insertCallConversation({
    callSid: message.callSid,
    fromNumber: message.from || "unknown",
    toNumber: message.to || process.env.TWILIO_PHONE_NUMBER || "unknown",
    status: "in_progress",
    turnCount: 0,
  });
  return { id: created.id, turnCount: created.turnCount ?? 0 };
}

async function persistTurn(session: PhoneSession, userSpeech: string, aiResponse: string): Promise<void> {
  if (!session.conversationId) return;

  const nextTurnNumber = session.turnCount + 1;
  await storage.insertCallTurn({
    conversationId: session.conversationId,
    turnNumber: nextTurnNumber,
    userSpeech,
    aiResponse,
  });

  session.turnCount = nextTurnNumber;
  await storage.updateCallConversation(session.callSid, {
    turnCount: nextTurnNumber,
    currentContext: userSpeech,
  });
}

async function generateReply(session: PhoneSession, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "I'm sorry, but my phone brain is not configured yet.";
  }

  const ai = new GoogleGenAI({ apiKey });
  const result = await ai.models.generateContent({
    model: PHONE_MODEL,
    config: {
      systemInstruction: session.systemPrompt,
      temperature: 0.7,
    },
    contents: [{ role: "user", parts: [{ text: buildPrompt(session, userPrompt) }] }],
  });

  const reply = sanitizeSpeech(result.text || "");
  return reply || "I'm sorry, could you say that again?";
}

export function setupTwilioWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    if (url === "/streams/twilio" || url?.startsWith("/streams/twilio")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
        handleTwilioConnection(ws);
      });
    }
  });

  console.log("[twilio] ConversationRelay WebSocket initialized at /streams/twilio");
}

function handleTwilioConnection(ws: WebSocket): void {
  let activeSessionId: string | null = null;

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString()) as ConversationRelayMessage;

      if (message.type === "setup") {
        activeSessionId = message.sessionId;
        const callMode = (message.customParameters?.callMode as CallMode | undefined) || "inbound";
        const callerName =
          message.callerName ||
          (callMode === "owner" ? OWNER_NAME : await resolveCallerName(message.from));
        const conversation = await ensureConversationRecord(message);
        const session: PhoneSession = {
          sessionId: message.sessionId,
          callSid: message.callSid,
          conversationId: conversation?.id ?? null,
          mode: callMode,
          fromNumber: message.from || "unknown",
          toNumber: message.to || process.env.TWILIO_PHONE_NUMBER || "unknown",
          callerName: callerName || null,
          context: message.customParameters?.context || "",
          systemPrompt: buildSystemPrompt({
            mode: callMode,
            fromNumber: message.from || "unknown",
            callerName: callerName || null,
            context: message.customParameters?.context || "",
            meowstikNumber: process.env.TWILIO_PHONE_NUMBER || "this number",
          }),
          turns: [],
          turnCount: conversation?.turnCount ?? 0,
        };

        sessions.set(message.sessionId, session);
        console.log(`[Twilio WS] Setup call=${message.callSid} mode=${callMode}`);
        return;
      }

      if (!activeSessionId) {
        return;
      }

      const session = sessions.get(activeSessionId);
      if (!session) {
        return;
      }

      if (message.type === "prompt") {
        const userPrompt = sanitizeSpeech(message.voicePrompt || "");
        if (!userPrompt) {
          return;
        }

        const reply = await generateReply(session, userPrompt);
        session.turns.push({ speaker: "caller", text: userPrompt });
        session.turns.push({ speaker: "assistant", text: reply });
        await persistTurn(session, userPrompt, reply);

        ws.send(
          JSON.stringify({
            type: "text",
            token: reply,
            last: true,
            interruptible: true,
            preemptible: true,
          }),
        );
        return;
      }

      if (message.type === "dtmf") {
        ws.send(
          JSON.stringify({
            type: "text",
            token: `I received ${message.digit}.`,
            last: true,
          }),
        );
        return;
      }

      if (message.type === "interrupt") {
        console.log(`[Twilio WS] Interrupt on session ${activeSessionId}: ${message.utteranceUntilInterrupt ?? ""}`);
        return;
      }

      if (message.type === "error") {
        console.error(`[Twilio WS] ConversationRelay error: ${message.description}`);
      }
    } catch (error) {
      console.error("[Twilio WS] Message handling error:", error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "text",
            token: "I'm sorry, I hit a problem. Could you try that again?",
            last: true,
          }),
        );
      }
    }
  });

  ws.on("close", () => {
    if (activeSessionId) {
      sessions.delete(activeSessionId);
    }
  });

  ws.on("error", (error) => {
    console.error("[Twilio WS] WebSocket error:", error);
  });
}
