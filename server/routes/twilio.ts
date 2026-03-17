/**
 * Twilio Webhook Routes
 *
 * Handles inbound calls, SMS, status callbacks, and conference TwiML.
 *
 * Owner notifications:
 *  - Inbound call from non-owner → SMS owner with caller info
 *  - Inbound SMS from non-owner → SMS owner with snippet
 *  - Inbound SMS from owner that starts with "call …" → parse as call command,
 *    look up contact, initiate outbound call, reply with confirmation
 */

import { Router } from "express";
import twilio from "twilio";
import { db } from "../db.js";
import { smsMessages } from "@shared/schema";
import { eq, or, desc } from "drizzle-orm";
import { log } from "../vite.js";

const { VoiceResponse } = twilio.twiml;

export const twilioRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").slice(-10);
}

async function resolveCallerName(fromNumber: string): Promise<string | null> {
  try {
    const { searchContacts } = await import("../integrations/google-contacts.js");
    const results: any[] = await Promise.race([
      searchContacts(fromNumber, 5) as Promise<any[]>,
      new Promise<any[]>((r) => setTimeout(() => r([]), 1200)),
    ]);
    for (const c of results) {
      for (const phone of (c.phoneNumbers ?? []) as Array<{ value: string }>) {
        if (normalizePhone(phone.value) === normalizePhone(fromNumber)) {
          return c.displayName as string;
        }
      }
    }
  } catch {
    /* contacts not configured */
  }
  return null;
}

async function notifyOwner(message: string): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE_NUMBER;
  if (!ownerPhone) return;
  const { sendSMS } = await import("../integrations/twilio.js");
  await sendSMS(ownerPhone, `[Meowstik] ${message}`);
}

// ── Voice call webhook ────────────────────────────────────────────────────────

twilioRouter.post("/voice", async (req, res) => {
  const response = new VoiceResponse();
  const host = req.headers.host;

  const { From, To, CallSid } = req.body;
  const direction = (req.query.direction as string) || "inbound";
  const context = (req.query.context as string) || "";

  log(`📞 [Twilio] ${direction} call: ${From} → ${To} (${CallSid})`);

  const ownerPhone = process.env.OWNER_PHONE_NUMBER ?? "";
  const isFromOwner =
    ownerPhone !== "" && normalizePhone(From) === normalizePhone(ownerPhone);

  // Log inbound call record
  if (direction === "inbound" && CallSid) {
    try {
      const { storage } = await import("../storage.js");
      await storage.insertCallConversation({
        callSid: CallSid,
        fromNumber: From || "unknown",
        toNumber: To || process.env.TWILIO_PHONE_NUMBER || "unknown",
        status: "in-progress",
        turnCount: 0,
      });
    } catch (err) {
      log(`⚠️ [Twilio] Failed to log inbound call: ${err}`);
    }

    // Notify owner of inbound call (fire-and-forget, don't block TwiML)
    if (!isFromOwner) {
      resolveCallerName(From)
        .then((name) => {
          const label = name ? `${name} (${From})` : From;
          return notifyOwner(`📞 Incoming call from ${label} — Meowstik is handling it.`);
        })
        .catch(() => {});
    }
  }

  // Connect to Meowstik via Media Stream → Gemini Live
  const connect = response.connect();
  const stream = connect.stream({
    url: `wss://${host}/streams/twilio`,
    name: "Meowstik_Live_Voice",
  });

  stream.parameter({ name: "direction", value: direction });
  stream.parameter({ name: "fromNumber", value: From || "unknown" });
  if (context) {
    stream.parameter({ name: "context", value: context });
  }

  response.pause({ length: 30 });

  res.type("text/xml");
  res.send(response.toString());
});

// ── Call status callback ──────────────────────────────────────────────────────

twilioRouter.post("/status", async (req, res) => {
  const { CallSid, CallStatus, CallDuration, RecordingUrl, RecordingSid, ErrorMessage } = req.body;
  log(`📞 [Twilio] Call status: ${CallStatus} (${CallSid})`);

  try {
    const { storage } = await import("../storage.js");
    const updates: Record<string, unknown> = { status: CallStatus };
    if (CallDuration) updates.duration = parseInt(CallDuration);
    if (RecordingUrl) updates.recordingUrl = RecordingUrl;
    if (RecordingSid) updates.recordingSid = RecordingSid;
    if (ErrorMessage) updates.errorMessage = ErrorMessage;
    if (["completed", "failed", "busy", "no-answer", "canceled"].includes(CallStatus)) {
      updates.endedAt = new Date();
    }
    await storage.updateCallConversation(CallSid, updates);
  } catch (error) {
    console.error("[Twilio] Failed to update call status:", error);
  }

  res.sendStatus(200);
});

// ── Recording / voicemail callback ────────────────────────────────────────────

twilioRouter.post("/recording", async (req, res) => {
  const {
    CallSid, RecordingUrl, RecordingSid, RecordingStatus,
    From, To, RecordingDuration, TranscriptionText, TranscriptionStatus,
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
            recordingUrl: RecordingUrl + ".mp3",
            duration: RecordingDuration ? parseInt(RecordingDuration) : null,
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

// ── Conference TwiML ──────────────────────────────────────────────────────────

/**
 * GET/POST /api/twilio/conference/twiml?name=<confName>
 * Returns TwiML to place the caller into a named Twilio Conference room.
 */
twilioRouter.all("/conference/twiml", (req, res) => {
  const confName = (req.query.name ?? req.body?.name ?? "meowstik-default") as string;
  const response = new VoiceResponse();
  const dial = response.dial();
  dial.conference(confName, {
    beep: "false",
    startConferenceOnEnter: true,
    endConferenceOnExit: false,
    waitUrl: "https://twimlets.com/holdmusic?Bucket=com.twilio.music.classical",
  });
  res.type("text/xml");
  res.send(response.toString());
});

// ── Inbound SMS webhook ───────────────────────────────────────────────────────

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

      // Save inbound SMS
      await db.insert(smsMessages).values({
        messageSid: MessageSid || `inbound-${Date.now()}`,
        accountSid,
        from: From,
        to: twilioNumber,
        body: Body,
        direction: "inbound",
        status: "received",
      });

      // ── Owner sending a call command? ──────────────────────────────────────
      if (isFromOwner && /^\s*call\b/i.test(Body)) {
        await handleOwnerCallCommand(From, Body, twilioNumber, accountSid);
        return;
      }

      // ── Notify owner about inbound text from others ────────────────────────
      if (!isFromOwner) {
        const callerName = await resolveCallerName(From);
        const label = callerName ? `${callerName} (${From})` : From;
        await notifyOwner(`💬 Text from ${label}: "${Body.slice(0, 120)}"`).catch(() => {});
      }

      // ── Generate Meowstik AI reply ─────────────────────────────────────────
      if (!process.env.GEMINI_API_KEY) {
        log("⚠️ [Twilio] GEMINI_API_KEY not set — skipping AI reply");
        return;
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const recent = await db
        .select()
        .from(smsMessages)
        .where(or(eq(smsMessages.from, From), eq(smsMessages.to, From)))
        .orderBy(desc(smsMessages.createdAt))
        .limit(8);

      const history = recent
        .reverse()
        .map((m) => `${m.direction === "inbound" ? "Them" : "Meowstik"}: ${m.body}`)
        .join("\n");

      const ownerName = "Jason Bender";
      const systemInstruction = isFromOwner
        ? `You are Meowstik, ${ownerName}'s AI assistant. ${ownerName} is texting you. Help him. Be concise.`
        : `You are Meowstik, the AI phone assistant for ${ownerName}. Someone is texting the Meowstik number. ` +
          `Be helpful and warm. Keep replies to 1-3 sentences. You can take messages for ${ownerName}.`;

      const prompt = history
        ? `Conversation so far:\n${history}\n\nNew message: ${Body}\n\nReply:`
        : `Message: ${Body}\n\nReply:`;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
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

      log(`💬 [Twilio] Meowstik replied to ${From}: "${reply.slice(0, 80)}"`);
    } catch (err) {
      log(`❌ [Twilio] SMS handler error: ${err}`);
    }
  })();
});

// ── Owner SMS Call Command Handler ────────────────────────────────────────────

/**
 * When the owner texts something like:
 *   "Call my mother, tell her we're coming Sunday, ask what time and what to bring"
 *
 * We use Gemini to parse the intent, look up the contact, initiate the call,
 * and reply to the owner with confirmation.
 */
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

    // Step 1: Parse the call command with Gemini
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const parseResult = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        systemInstruction:
          "Extract the call request details from the user's message. " +
          "Return ONLY valid JSON with keys: contact_name (string), phone_number (string or null), mission (string). " +
          "mission should be a complete description of what to do/say/ask on the call.",
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
      // Fallback: treat entire message as mission, extract first word as contact
      const match = command.match(/call\s+(\S+(?:\s+\S+)?)/i);
      parsed.contact_name = match?.[1] ?? "the person";
    }

    // Step 2: Look up contact phone number
    let targetPhone = parsed.phone_number ?? "";
    let resolvedName = parsed.contact_name;

    if (!targetPhone && parsed.contact_name) {
      try {
        const { searchContacts } = await import("../integrations/google-contacts.js");
        const contacts: any[] = await Promise.race([
          searchContacts(parsed.contact_name, 5) as Promise<any[]>,
          new Promise<any[]>((r) => setTimeout(() => r([]), 2500)),
        ]);
        for (const c of contacts) {
          const phone = c.phoneNumbers?.[0]?.value;
          if (phone) {
            targetPhone = phone;
            resolvedName = c.displayName;
            break;
          }
        }
      } catch {
        /* contacts unavailable */
      }
    }

    if (!targetPhone) {
      await sendSMS(
        ownerNumber,
        `[Meowstik] I couldn't find a number for "${parsed.contact_name}". ` +
          `Reply with their number and I'll call them: "Call [name] [number]"`
      );
      return;
    }

    // Normalize to E.164
    const digits = targetPhone.replace(/\D/g, "");
    if (!targetPhone.startsWith("+")) {
      targetPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    }

    // Step 3: Initiate the outbound call
    const fullMission =
      `Calling ${resolvedName} on behalf of Jason Bender.\n\nMISSION:\n${parsed.mission}`;
    const baseUrl =
      process.env.BASE_URL ??
      `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
    const contextParam = encodeURIComponent(fullMission);
    const voiceUrl = `${baseUrl}/api/twilio/voice?direction=outbound&context=${contextParam}`;

    const { makeCall } = await import("../integrations/twilio.js");
    const call = await makeCall(targetPhone, voiceUrl);

    log(`📞 [Twilio] Initiated owner-commanded call to ${resolvedName} (${targetPhone}): ${call.sid}`);

    // Step 4: Confirm to owner via SMS
    const confirmation = `[Meowstik] ✅ Calling ${resolvedName} (${targetPhone}) now.\nMission: ${parsed.mission.slice(0, 100)}${parsed.mission.length > 100 ? "…" : ""}\nI'll text you the results.`;

    await sendSMS(ownerNumber, confirmation);

    // Save the confirmation outbound SMS
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
  } catch (err: any) {
    log(`❌ [Twilio] handleOwnerCallCommand error: ${err}`);
    await sendSMS(ownerNumber, `[Meowstik] Sorry, I hit an error processing your call command: ${err.message}`).catch(() => {});
  }
}

export default twilioRouter;
