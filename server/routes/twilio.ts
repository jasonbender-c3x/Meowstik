/**
 * Twilio Webhook Routes
 *
 * Voice calls use ConversationRelay for a simpler, more reliable voice path.
 * SMS handling and owner call-command flows remain in this router.
 */

import { Router } from "express";
import twilio from "twilio";
import { db } from "../db.js";
import { smsMessages } from "@shared/schema";
import { desc, eq, or } from "drizzle-orm";
import { log } from "../vite.js";

const { VoiceResponse } = twilio.twiml;
const OWNER_NAME = "Jason Bender";

export const twilioRouter = Router();

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function getBaseUrl(req: { protocol: string; get(name: string): string | undefined }): string {
  return process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function getConversationRelayUrl(req: { protocol: string; get(name: string): string | undefined }): string {
  const baseUrl = new URL(getBaseUrl(req));
  const protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${baseUrl.host}/streams/twilio`;
}

function getCallMode(opts: { requestedDirection?: string; isOwner: boolean }): "inbound" | "outbound" | "owner" {
  if (opts.requestedDirection === "outbound") return "outbound";
  if (opts.isOwner) return "owner";
  return "inbound";
}

function getWelcomeGreeting(mode: "inbound" | "outbound" | "owner", callerName: string | null): string {
  switch (mode) {
    case "owner":
      return `Hi Jason, it's Meowstik. What can I help you with today?`;
    case "outbound":
      return `Hi, this is Meowstik, ${OWNER_NAME}'s assistant.`;
    case "inbound":
    default:
      return callerName
        ? `Hi ${callerName}, you've reached Meowstik, ${OWNER_NAME}'s AI assistant. How can I help you today?`
        : `Hi, you've reached Meowstik, ${OWNER_NAME}'s AI assistant. How can I help you today?`;
  }
}

async function resolveCallerName(fromNumber: string): Promise<string | null> {
  try {
    const { searchContacts } = await import("../integrations/google-contacts.js");
    const results: any[] = await Promise.race([
      searchContacts(fromNumber, 5) as Promise<any[]>,
      new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1200)),
    ]);
    for (const contact of results) {
      for (const phone of (contact.phoneNumbers ?? []) as Array<{ value: string }>) {
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

async function notifyOwner(message: string): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE_NUMBER;
  if (!ownerPhone) return;
  const { sendSMS } = await import("../integrations/twilio.js");
  const fullMessage = `[Meowstik] ${message}`;
  const result = await sendSMS(ownerPhone, fullMessage);
  await db.insert(smsMessages).values({
    messageSid: result?.sid || `owner-notice-${Date.now()}`,
    accountSid: process.env.TWILIO_ACCOUNT_SID || "unknown",
    from: process.env.TWILIO_PHONE_NUMBER || "unknown",
    to: ownerPhone,
    body: fullMessage,
    direction: "outbound",
    status: result?.status || "sent",
    processed: true,
  });
}

function formatPhoneLabel(phone: string | null | undefined): string {
  if (!phone) return "unknown number";
  return phone;
}

function extractMediaUrls(payload: Record<string, unknown>): string[] {
  const rawCount = Number.parseInt(String(payload.NumMedia ?? "0"), 10);
  const mediaCount = Number.isFinite(rawCount) ? Math.max(rawCount, 0) : 0;
  const mediaUrls: string[] = [];

  for (let index = 0; index < mediaCount; index += 1) {
    const mediaUrl = payload[`MediaUrl${index}`];
    if (typeof mediaUrl === "string" && mediaUrl.trim()) {
      mediaUrls.push(mediaUrl.trim());
    }
  }

  return mediaUrls;
}

function buildFallbackSmsSummary(input: {
  fromLabel: string;
  body: string;
  isFromOwner: boolean;
  mediaCount: number;
}): {
  summary: string;
  ownerUpdate: string;
  messageForJason: string | null;
  followUpQuestion: string | null;
  replyGuidance: string;
  shouldReply: boolean;
} {
  const cleanBody = input.body.trim().replace(/\s+/g, " ");
  const shortenedBody = cleanBody.length > 160 ? `${cleanBody.slice(0, 157)}...` : cleanBody;
  const mediaNote = input.mediaCount > 0 ? ` They attached ${input.mediaCount} media item${input.mediaCount === 1 ? "" : "s"}.` : "";

  if (input.isFromOwner) {
    return {
      summary: `Jason texted Meowstik.${mediaNote}`,
      ownerUpdate: `Jason texted: "${shortenedBody}"`,
      messageForJason: null,
      followUpQuestion: null,
      replyGuidance: "Answer Jason directly, be concise, and help with the specific request in the latest text.",
      shouldReply: true,
    };
  }

  return {
    summary: `${input.fromLabel} texted Meowstik.${mediaNote}`,
    ownerUpdate: `${input.fromLabel} texted: "${shortenedBody}"`,
    messageForJason: cleanBody || null,
    followUpQuestion: "Do you want me to reply or just pass that along to Jason?",
    replyGuidance:
      "Reply warmly and briefly, answer the sender's latest message directly, and take or relay a message for Jason when appropriate.",
    shouldReply: true,
  };
}

async function summarizeSmsConversation(input: {
  ai: any;
  fromLabel: string;
  body: string;
  isFromOwner: boolean;
  mediaCount: number;
  history: string;
}): Promise<{
  summary: string;
  ownerUpdate: string;
  messageForJason: string | null;
  followUpQuestion: string | null;
  replyGuidance: string;
  shouldReply: boolean;
}> {
  const fallback = buildFallbackSmsSummary(input);

  try {
    const result = await input.ai.models.generateContent({
      model: process.env.GEMINI_SMS_MODEL || "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        systemInstruction:
          `You summarize inbound SMS conversations for ${OWNER_NAME}. ` +
          "Return strict JSON with keys summary, ownerUpdate, messageForJason, followUpQuestion, replyGuidance, shouldReply. " +
          "summary should be 1-2 concise sentences. ownerUpdate should be concise SMS-safe text for Jason. " +
          "messageForJason should capture any explicit relay or request for Jason, or null. " +
          "followUpQuestion should be the best next question for Jason, or null. " +
          "replyGuidance should be a short instruction for how Meowstik should respond. " +
          "shouldReply should be false only for spam, wrong-number dead ends, or messages that clearly do not need a response.",
      },
      contents: [{
        role: "user",
        parts: [{
          text:
            `Sender label: ${input.fromLabel}\n` +
            `Sender is owner: ${input.isFromOwner}\n` +
            `Media count: ${input.mediaCount}\n\n` +
            `${input.history ? `Recent conversation:\n${input.history}\n\n` : ""}` +
            `Latest inbound message:\n${input.body}`,
        }],
      }],
    });

    const parsed = JSON.parse((result.text ?? "{}").replace(/```json|```/g, "").trim()) as {
      summary?: string;
      ownerUpdate?: string;
      messageForJason?: string | null;
      followUpQuestion?: string | null;
      replyGuidance?: string;
      shouldReply?: boolean;
    };

    return {
      summary: parsed.summary?.trim() || fallback.summary,
      ownerUpdate: parsed.ownerUpdate?.trim() || fallback.ownerUpdate,
      messageForJason: parsed.messageForJason?.trim() || fallback.messageForJason,
      followUpQuestion: parsed.followUpQuestion?.trim() || fallback.followUpQuestion,
      replyGuidance: parsed.replyGuidance?.trim() || fallback.replyGuidance,
      shouldReply: typeof parsed.shouldReply === "boolean" ? parsed.shouldReply : fallback.shouldReply,
    };
  } catch (error) {
    console.warn("[Twilio] Failed to summarize SMS with Gemini, using fallback:", error);
    return fallback;
  }
}

function inferCallDirection(opts: {
  fromNumber: string | null | undefined;
  toNumber: string | null | undefined;
  ownerPhone: string;
  twilioPhone: string;
}): "owner" | "outbound" | "inbound" {
  const from = normalizePhone(opts.fromNumber || "");
  const to = normalizePhone(opts.toNumber || "");
  const owner = normalizePhone(opts.ownerPhone || "");
  const twilioPhone = normalizePhone(opts.twilioPhone || "");

  if (owner && from === owner && twilioPhone && to === twilioPhone) {
    return "owner";
  }
  if (twilioPhone && from === twilioPhone) {
    return "outbound";
  }
  return "inbound";
}

function buildCallTranscript(
  turns: Array<{ speaker: string; utterance: string; turnNumber: number }>,
): string {
  return turns
    .filter((turn) => turn.utterance?.trim())
    .sort((a, b) => a.turnNumber - b.turnNumber)
    .map((turn) => `${turn.speaker === "assistant" ? "Meowstik" : "Caller"}: ${turn.utterance.trim()}`)
    .join("\n");
}

function extractCallerMessage(transcript: string): string | null {
  const callerLines = transcript
    .split("\n")
    .filter((line) => line.startsWith("Caller:"))
    .map((line) => line.replace(/^Caller:\s*/, "").trim())
    .filter(Boolean);

  const messageLine = callerLines.find((line) =>
    /\b(tell|message|let\s+(him|jason)\s+know|pass (this )?on|please tell)\b/i.test(line),
  );

  if (messageLine) {
    return messageLine;
  }

  return callerLines[callerLines.length - 1] ?? null;
}

function buildFallbackCallSummary(transcript: string, direction: "owner" | "outbound" | "inbound"): {
  summary: string;
  ownerUpdate: string;
  messageForJason: string | null;
  followUpQuestion: string | null;
} {
  const callerMessage = extractCallerMessage(transcript);
  const summary =
    direction === "outbound"
      ? "Meowstik completed the outbound call and captured the key points."
      : "Meowstik handled the phone call and captured the main details.";
  const ownerUpdate = callerMessage
    ? `Call finished. Message to Jason: ${callerMessage}`
    : `Call finished. ${summary}`;
  const followUpQuestion = callerMessage
    ? "Do you want to reply or follow up on that?"
    : "Do you want to follow up on that call?";

  return {
    summary,
    ownerUpdate,
    messageForJason: callerMessage,
    followUpQuestion,
  };
}

async function summarizeCallTranscript(
  transcript: string,
  direction: "owner" | "outbound" | "inbound",
): Promise<{
  summary: string;
  ownerUpdate: string;
  messageForJason: string | null;
  followUpQuestion: string | null;
}> {
  if (!transcript.trim() || !process.env.GEMINI_API_KEY) {
    return buildFallbackCallSummary(transcript, direction);
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_CALL_MODEL || "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        systemInstruction:
          "You summarize phone calls for Jason Bender. " +
          "Return strict JSON with keys summary, ownerUpdate, messageForJason, followUpQuestion. " +
          "summary should be 1-2 sentences. ownerUpdate should be concise SMS-safe text. " +
          "messageForJason should capture any explicit relay/request left for Jason, or null. " +
          "followUpQuestion should be the best next question for Jason, or null.",
      },
      contents: [{
        role: "user",
        parts: [{
          text:
            `Call direction: ${direction}\n\nTranscript:\n${transcript.slice(0, 12000)}`,
        }],
      }],
    });

    const parsed = JSON.parse((result.text ?? "{}").replace(/```json|```/g, "").trim()) as {
      summary?: string;
      ownerUpdate?: string;
      messageForJason?: string | null;
      followUpQuestion?: string | null;
    };

    const fallback = buildFallbackCallSummary(transcript, direction);
    return {
      summary: parsed.summary?.trim() || fallback.summary,
      ownerUpdate: parsed.ownerUpdate?.trim() || fallback.ownerUpdate,
      messageForJason: parsed.messageForJason?.trim() || fallback.messageForJason,
      followUpQuestion: parsed.followUpQuestion?.trim() || fallback.followUpQuestion,
    };
  } catch (error) {
    console.warn("[Twilio] Failed to summarize call with Gemini, using fallback:", error);
    return buildFallbackCallSummary(transcript, direction);
  }
}

async function finalizeCallHandoff(callSid: string): Promise<void> {
  const { storage } = await import("../storage.js");
  const call = await storage.getCallConversationBySid(callSid);
  if (!call) return;

  const ownerPhone = process.env.OWNER_PHONE_NUMBER ?? "";
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER ?? "";
  const direction = inferCallDirection({
    fromNumber: call.fromNumber,
    toNumber: call.toNumber,
    ownerPhone,
    twilioPhone,
  });
  const turns = await storage.getCallTurns(call.id);
  const transcript = buildCallTranscript(turns);
  if (!transcript.trim()) {
    const summary =
      call.status === "no-answer" || call.status === "busy" || call.status === "failed" || call.status === "canceled"
        ? `Call ended with status: ${call.status}.`
        : "Call finished without a usable transcript.";
    await storage.updateCallConversation(callSid, {
      transcriptionStatus: "empty",
      currentContext: summary,
    });
    if (direction !== "owner" && ownerPhone) {
      await notifyOwner(summary).catch((error) => {
        console.warn("[Twilio] Failed to send owner empty-call summary:", error);
      });
    }
    return;
  }

  const summary = await summarizeCallTranscript(transcript, direction);
  const contextParts = [summary.summary];
  if (summary.messageForJason) {
    contextParts.push(`Message for Jason: ${summary.messageForJason}`);
  }
  if (summary.followUpQuestion) {
    contextParts.push(`Follow-up: ${summary.followUpQuestion}`);
  }

  await storage.updateCallConversation(callSid, {
    transcription: transcript,
    transcriptionStatus: "completed",
    currentContext: contextParts.join("\n"),
  });

  if (direction !== "owner" && ownerPhone) {
    const fromLabel = formatPhoneLabel(call.fromNumber);
    const toLabel = formatPhoneLabel(call.toNumber);
    const heading =
      direction === "outbound"
        ? `Outbound call with ${toLabel} finished.`
        : `Call from ${fromLabel} finished.`;
    await notifyOwner(`${heading} ${summary.ownerUpdate}`).catch((error) => {
      console.warn("[Twilio] Failed to send owner call summary:", error);
    });
  }
}

async function ensureCallConversation(callSid: string, fromNumber: string, toNumber: string, status: string): Promise<void> {
  const { storage } = await import("../storage.js");
  const existing = await storage.getCallConversationBySid(callSid);
  if (existing) {
    await storage.updateCallConversation(callSid, { fromNumber, toNumber, status });
    return;
  }

  await storage.insertCallConversation({
    callSid,
    fromNumber,
    toNumber,
    status,
    turnCount: 0,
  });
}

twilioRouter.post("/voice", async (req, res) => {
  const response = new VoiceResponse();
  const { From, To, CallSid } = req.body;
  const requestedDirection =
    typeof req.query.direction === "string" ? req.query.direction : undefined;
  const context = typeof req.query.context === "string" ? req.query.context : "";

  const ownerPhone = process.env.OWNER_PHONE_NUMBER ?? "";
  const isFromOwner =
    ownerPhone !== "" && normalizePhone(From || "") === normalizePhone(ownerPhone);
  const callMode = getCallMode({ requestedDirection, isOwner: isFromOwner });
  const callerName = From ? await resolveCallerName(From) : null;

  log(`📞 [Twilio] ${callMode} call: ${From} → ${To} (${CallSid})`);

  if (CallSid) {
    try {
      await ensureCallConversation(
        CallSid,
        From || "unknown",
        To || process.env.TWILIO_PHONE_NUMBER || "unknown",
        "in_progress",
      );
    } catch (error) {
      log(`⚠️ [Twilio] Failed to ensure call conversation: ${error}`);
    }
  }

  if (callMode === "inbound" && !isFromOwner && From) {
    const label = callerName ? `${callerName} (${From})` : From;
    void notifyOwner(`📞 Incoming call from ${label} — Meowstik is handling it.`).catch(() => {});
  }

  const connect = response.connect();
  const conversationRelay = connect.conversationRelay({
    url: getConversationRelayUrl(req),
    welcomeGreeting: getWelcomeGreeting(callMode, callerName),
    welcomeGreetingInterruptible: "speech",
    language: "en-US",
    ttsProvider: "Google",
    voice: "en-US-Journey-O",
    transcriptionProvider: "Google",
    speechModel: "telephony",
    interruptible: "speech",
    reportInputDuringAgentSpeech: "speech",
    preemptible: true,
  });

  conversationRelay.parameter({ name: "callMode", value: callMode });
  if (context) {
    conversationRelay.parameter({ name: "context", value: context });
  }

  res.type("text/xml");
  res.send(response.toString());
});

twilioRouter.post("/status", async (req, res) => {
  const { CallSid, CallStatus, CallDuration, RecordingUrl, RecordingSid, ErrorMessage } = req.body;
  log(`📞 [Twilio] Call status: ${CallStatus} (${CallSid})`);

  try {
    const { storage } = await import("../storage.js");
    const call = CallSid ? await storage.getCallConversationBySid(CallSid) : undefined;
    const updates: Record<string, unknown> = { status: CallStatus };
    if (CallDuration) updates.duration = parseInt(CallDuration, 10);
    if (RecordingUrl) updates.recordingUrl = RecordingUrl;
    if (RecordingSid) updates.recordingSid = RecordingSid;
    if (ErrorMessage) updates.errorMessage = ErrorMessage;
    if (["completed", "failed", "busy", "no-answer", "canceled"].includes(CallStatus)) {
      updates.endedAt = new Date();
    }
    await storage.updateCallConversation(CallSid, updates);

    const ownerPhone = process.env.OWNER_PHONE_NUMBER ?? "";
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER ?? "";
    if (CallStatus === "answered" && call) {
      const direction = inferCallDirection({
        fromNumber: call.fromNumber,
        toNumber: call.toNumber,
        ownerPhone,
        twilioPhone,
      });
      if (direction !== "owner") {
        const counterparty =
          direction === "outbound" ? formatPhoneLabel(call.toNumber) : formatPhoneLabel(call.fromNumber);
        void notifyOwner(`📞 Call answered with ${counterparty}.`).catch(() => {});
      }
    }

    if (CallSid && ["completed", "failed", "busy", "no-answer", "canceled"].includes(CallStatus)) {
      void finalizeCallHandoff(CallSid).catch((error) => {
        console.error("[Twilio] Failed to finalize call handoff:", error);
      });
    }
  } catch (error) {
    console.error("[Twilio] Failed to update call status:", error);
  }

  res.sendStatus(200);
});

twilioRouter.post("/recording", async (req, res) => {
  const {
    CallSid,
    RecordingUrl,
    RecordingSid,
    RecordingStatus,
    From,
    To,
    RecordingDuration,
    TranscriptionText,
    TranscriptionStatus,
  } = req.body;

  log(`📞 [Twilio] Recording: ${RecordingStatus} (${CallSid})`);

  if (RecordingStatus === "completed" && RecordingUrl) {
    try {
      const { storage } = await import("../storage.js");

      if (RecordingSid && From) {
        try {
          await storage.insertVoicemail({
            recordingSid: RecordingSid,
            callSid: CallSid || null,
            fromNumber: From || "unknown",
            toNumber: To || process.env.TWILIO_PHONE_NUMBER || "unknown",
            recordingUrl: `${RecordingUrl}.mp3`,
            duration: RecordingDuration ? parseInt(RecordingDuration, 10) : null,
            transcription: TranscriptionText || null,
            transcriptionStatus: TranscriptionStatus || "pending",
          });
          log(`📬 [Twilio] Voicemail saved from ${From}`);
        } catch (vmErr: any) {
          if (!vmErr?.message?.includes("unique")) {
            console.error("[Twilio] Failed to save voicemail:", vmErr);
          }
        }
      }

      if (CallSid) {
        await storage.updateCallConversation(CallSid, {
          recordingUrl: RecordingUrl,
          recordingSid: RecordingSid,
        });
      }
    } catch (error) {
      console.error("[Twilio] Failed to handle recording:", error);
    }
  }

  res.sendStatus(200);
});

twilioRouter.post("/sms", async (req, res) => {
  const { From, To, Body, MessageSid, AccountSid } = req.body;
  log(`💬 [Twilio] SMS from ${From}: ${Body}`);

  res.type("text/xml");
  res.send("<Response></Response>");

  (async () => {
    try {
      const twilioNumber = To || process.env.TWILIO_PHONE_NUMBER || "unknown";
      const accountSid = AccountSid || process.env.TWILIO_ACCOUNT_SID || "unknown";
      const ownerPhone = process.env.OWNER_PHONE_NUMBER ?? "";
      const isFromOwner =
        ownerPhone !== "" && normalizePhone(From) === normalizePhone(ownerPhone);
      const inboundMessageSid = MessageSid || `inbound-${Date.now()}`;
      const mediaUrls = extractMediaUrls(req.body as Record<string, unknown>);

      await db.insert(smsMessages).values({
        messageSid: inboundMessageSid,
        accountSid,
        from: From,
        to: twilioNumber,
        body: Body,
        direction: "inbound",
        status: "received",
        numMedia: mediaUrls.length,
        mediaUrls,
      });

      if (isFromOwner && /^\s*call\b/i.test(Body)) {
        await handleOwnerCallCommand(From, Body, twilioNumber, accountSid);
        return;
      }

      const recent = await db
        .select()
        .from(smsMessages)
        .where(or(eq(smsMessages.from, From), eq(smsMessages.to, From)))
        .orderBy(desc(smsMessages.createdAt))
        .limit(8);

      const history = recent
        .reverse()
        .map((message) => `${message.direction === "inbound" ? "Them" : "Meowstik"}: ${message.body}`)
        .join("\n");

      const callerName = await resolveCallerName(From);
      const fromLabel = isFromOwner ? OWNER_NAME : callerName ? `${callerName} (${From})` : From;

      let smsSummary = buildFallbackSmsSummary({
        fromLabel,
        body: Body,
        isFromOwner,
        mediaCount: mediaUrls.length,
      });
      let ai: any = null;

      if (process.env.GEMINI_API_KEY) {
        const { GoogleGenAI } = await import("@google/genai");
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        smsSummary = await summarizeSmsConversation({
          ai,
          fromLabel,
          body: Body,
          isFromOwner,
          mediaCount: mediaUrls.length,
          history,
        });
      }

      if (!isFromOwner) {
        const update = smsSummary.followUpQuestion
          ? `${smsSummary.ownerUpdate} ${smsSummary.followUpQuestion}`
          : smsSummary.ownerUpdate;
        await notifyOwner(`💬 ${update}`).catch((error) => {
          console.warn("[Twilio] Failed to notify owner about inbound SMS:", error);
        });
      }

      try {
        const { triggerService } = await import("../services/trigger-service.js");
        await triggerService.handleSmsTriggers({
          messageSid: inboundMessageSid,
          from: From,
          to: twilioNumber,
          body: Body,
          senderName: callerName,
          summary: smsSummary.summary,
          ownerUpdate: smsSummary.ownerUpdate,
          messageForJason: smsSummary.messageForJason,
          followUpQuestion: smsSummary.followUpQuestion,
          mediaUrls,
          isFromOwner,
        });
      } catch (error) {
        console.warn("[Twilio] Failed to fire SMS triggers:", error);
      }

      if (!process.env.GEMINI_API_KEY) {
        log("⚠️ [Twilio] GEMINI_API_KEY not set — skipping AI reply");
        return;
      }

      const systemInstruction = isFromOwner
        ? `You are Meowstik, ${OWNER_NAME}'s AI assistant. ${OWNER_NAME} is texting you. Help him directly and be concise. ${smsSummary.replyGuidance}`
        : `You are Meowstik, the AI phone assistant for ${OWNER_NAME}. Someone is texting the Meowstik number. ` +
          `Be helpful and warm, keep replies to one to three sentences, and take messages for ${OWNER_NAME} when appropriate. ` +
          `Sender: ${fromLabel}. ${smsSummary.replyGuidance}`;

      const prompt = history
        ? `Conversation so far:\n${history}\n\nContext summary:\n${smsSummary.summary}\n` +
          `${smsSummary.messageForJason ? `Message for Jason: ${smsSummary.messageForJason}\n` : ""}` +
          `${smsSummary.followUpQuestion ? `Possible follow-up for Jason: ${smsSummary.followUpQuestion}\n` : ""}` +
          `\nNew message: ${Body}\n\nReply:`
        : `Context summary:\n${smsSummary.summary}\n\nMessage: ${Body}\n\nReply:`;

      if (!smsSummary.shouldReply) {
        log(`💬 [Twilio] Skipping AI reply to ${From}; summary determined no response is needed.`);
        return;
      }

      const result = await ai.models.generateContent({
        model: process.env.GEMINI_SMS_MODEL || "gemini-2.0-flash",
        config: { systemInstruction },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const reply = result.text?.trim();
      if (!reply) return;

      const { sendSMS } = await import("../integrations/twilio.js");
      const sent = await sendSMS(From, reply);

      await db.insert(smsMessages).values({
        messageSid: sent?.sid || `ai-reply-${Date.now()}`,
        accountSid,
        from: twilioNumber,
        to: From,
        body: reply,
        direction: "outbound",
        status: "sent",
        processed: true,
      });

      await db.update(smsMessages)
        .set({ responseMessageSid: sent?.sid || null })
        .where(eq(smsMessages.messageSid, inboundMessageSid));

      log(`💬 [Twilio] Meowstik replied to ${From}: "${reply.slice(0, 80)}"`);
    } catch (error) {
      log(`❌ [Twilio] SMS handler error: ${error}`);
    }
  })();
});

async function handleOwnerCallCommand(
  ownerNumber: string,
  command: string,
  twilioNumber: string,
  accountSid: string,
): Promise<void> {
  const { sendSMS } = await import("../integrations/twilio.js");

  try {
    if (!process.env.GEMINI_API_KEY) {
      await sendSMS(ownerNumber, "[Meowstik] GEMINI_API_KEY not set, cannot process call command.");
      return;
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const parseResult = await ai.models.generateContent({
      model: process.env.GEMINI_SMS_MODEL || "gemini-2.0-flash",
      config: {
        systemInstruction:
          "Extract the call request details from the user's message. " +
          "Return ONLY valid JSON with keys: contact_name (string), phone_number (string or null), mission (string). " +
          "mission should be a complete description of what to do, say, or ask on the call.",
      },
      contents: [{ role: "user", parts: [{ text: command }] }],
    });

    let parsed: { contact_name: string; phone_number: string | null; mission: string } = {
      contact_name: "",
      phone_number: null,
      mission: command,
    };

    try {
      const raw = (parseResult.text ?? "").replace(/```json|```/g, "").trim();
      parsed = JSON.parse(raw);
    } catch {
      const match = command.match(/call\s+(\S+(?:\s+\S+)?)/i);
      parsed.contact_name = match?.[1] ?? "the person";
    }

    let targetPhone = parsed.phone_number ?? "";
    let resolvedName = parsed.contact_name;

    if (!targetPhone && parsed.contact_name) {
      try {
        const { searchContacts } = await import("../integrations/google-contacts.js");
        const contacts: any[] = await Promise.race([
          searchContacts(parsed.contact_name, 5) as Promise<any[]>,
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2500)),
        ]);
        for (const contact of contacts) {
          const phone = contact.phoneNumbers?.[0]?.value;
          if (phone) {
            targetPhone = phone;
            resolvedName = contact.displayName;
            break;
          }
        }
      } catch {
        // Google Contacts is optional.
      }
    }

    if (!targetPhone) {
      await sendSMS(
        ownerNumber,
        `[Meowstik] I couldn't find a number for "${parsed.contact_name}". Reply with their number and I'll call them: "Call [name] [number]"`,
      );
      return;
    }

    const digits = targetPhone.replace(/\D/g, "");
    if (!targetPhone.startsWith("+")) {
      targetPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    }

    const fullMission = `Calling ${resolvedName} on behalf of ${OWNER_NAME}.\n\nMISSION:\n${parsed.mission}`;
    const baseUrl = process.env.BASE_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
    const contextParam = encodeURIComponent(fullMission);
    const voiceUrl = `${baseUrl}/api/twilio/voice?direction=outbound&context=${contextParam}`;

    const { makeCall } = await import("../integrations/twilio.js");
    const call = await makeCall(targetPhone, voiceUrl);

    log(`📞 [Twilio] Initiated owner-commanded call to ${resolvedName} (${targetPhone}): ${call.sid}`);

    const confirmation = `[Meowstik] ✅ Calling ${resolvedName} (${targetPhone}) now.\nMission: ${parsed.mission.slice(0, 100)}${parsed.mission.length > 100 ? "…" : ""}\nI'll text you the results.`;
    await sendSMS(ownerNumber, confirmation);

    await db.insert(smsMessages).values({
      messageSid: `cmd-confirm-${Date.now()}`,
      accountSid,
      from: twilioNumber,
      to: ownerNumber,
      body: confirmation,
      direction: "outbound",
      status: "sent",
      processed: true,
    });
  } catch (error: any) {
    log(`❌ [Twilio] handleOwnerCallCommand error: ${error}`);
    await sendSMS(ownerNumber, `[Meowstik] Sorry, I hit an error processing your call command: ${error.message}`).catch(() => {});
  }
}

export default twilioRouter;
