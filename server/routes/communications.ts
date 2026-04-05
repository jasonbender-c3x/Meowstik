
/**
 * Communications API Routes — SMS, Calls, Voicemail, Contacts
 * Uses Drizzle ORM directly; no Knex/storage.db usage.
 */

import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { smsMessages, callConversations, voicemails } from "@shared/schema";
import { eq, or, desc, asc } from "drizzle-orm";
import { storage } from "../storage.js";
import * as twilioIntegration from "../integrations/twilio.js";

export const communicationsRouter = Router();

// ============================================================================
// Helpers
// ============================================================================

function normalizePhone(raw: string): string {
  let p = raw.replace(/[^\d+]/g, "");
  if (!p.startsWith("+")) {
    p = p.length === 10 ? `+1${p}` : `+${p}`;
  }
  return p;
}

async function lookupContactName(phoneNumber: string): Promise<string | null> {
  try {
    const { searchContacts } = await import("../integrations/google-contacts.js");
    const contacts = await searchContacts(phoneNumber, 5);
    for (const c of contacts) {
      for (const phone of c.phoneNumbers ?? []) {
        const n = ((phone as any).value as string | undefined)?.replace(/[^\d+]/g, "") ?? "";
        const s = phoneNumber.replace(/[^\d+]/g, "");
        if (n === s || n.slice(-10) === s.slice(-10)) {
          return c.displayName ?? null;
        }
      }
    }
  } catch {
    // Google Contacts not configured — fine
  }
  return null;
}

// ============================================================================
// SMS / Conversations
// ============================================================================

/** GET /api/communications/conversations */
communicationsRouter.get("/conversations", async (_req: Request, res: Response) => {
  try {
    const convData = await storage.getSmsConversations();

    // Enrich with contact names in parallel (2-second timeout)
    const enriched = await Promise.race([
      Promise.all(
        convData.map(async (c) => ({
          id: c.phoneNumber,
          phoneNumber: c.phoneNumber,
          contactName: await lookupContactName(c.phoneNumber),
          lastMessage: c.lastMessage.body,
          lastMessageAt: c.lastMessage.createdAt,
          unreadCount: c.unreadCount,
          lastDirection: c.lastMessage.direction,
        }))
      ),
      new Promise<typeof convData>((resolve) =>
        setTimeout(() => resolve(convData.map(c => ({
          id: c.phoneNumber,
          phoneNumber: c.phoneNumber,
          contactName: null,
          lastMessage: c.lastMessage.body,
          lastMessageAt: c.lastMessage.createdAt,
          unreadCount: c.unreadCount,
          lastDirection: c.lastMessage.direction,
        })) as any), 2000)
      ),
    ]);

    res.json(enriched);
  } catch (error) {
    console.error("[Communications] Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/** GET /api/communications/conversations/:phoneNumber/messages */
communicationsRouter.get("/conversations/:phoneNumber/messages", async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const messages = await storage.getSmsMessagesForNumber(phoneNumber, 100);
    res.json(messages.map(m => ({
      id: m.id,
      from: m.from,
      to: m.to,
      body: m.body,
      direction: m.direction,
      createdAt: m.createdAt,
      status: m.status,
    })));
  } catch (error) {
    console.error("[Communications] Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/** POST /api/communications/sms/send */
communicationsRouter.post("/sms/send", async (req: Request, res: Response) => {
  try {
    let { to, body } = req.body as { to: string; body: string };
    if (!to || !body) {
      return res.status(400).json({ error: "Missing required fields: to, body" });
    }

    to = normalizePhone(to);
    const ourNumber = process.env.TWILIO_PHONE_NUMBER || "unknown";
    const accountSid = process.env.TWILIO_ACCOUNT_SID || "unknown";

    const result = await twilioIntegration.sendSMS(to, body);

    await storage.insertSmsMessage({
      messageSid: result.sid || `outbound-${Date.now()}`,
      accountSid,
      from: ourNumber,
      to,
      body,
      direction: "outbound",
      status: result.status || "sent",
      processed: true,
    });

    res.json({ success: true, messageSid: result.sid });
  } catch (error) {
    console.error("[Communications] Error sending SMS:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ============================================================================
// Calls
// ============================================================================

/** GET /api/communications/calls */
communicationsRouter.get("/calls", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const calls = await storage.getRecentCallConversations(limit);
    const ourNumber = process.env.TWILIO_PHONE_NUMBER || "";

    const formatted = calls.map((c) => ({
      id: c.id,
      callSid: c.callSid,
      direction: c.fromNumber === ourNumber ? "outbound" : "inbound",
      from: c.fromNumber,
      to: c.toNumber,
      status: c.status,
      duration: c.duration ?? 0,
      recordingUrl: c.recordingUrl ?? null,
      createdAt: c.startedAt ?? c.createdAt,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("[Communications] Error fetching calls:", error);
    res.status(500).json({ error: "Failed to fetch calls" });
  }
});

/** POST /api/communications/calls */
communicationsRouter.post("/calls", async (req: Request, res: Response) => {
  try {
    let { to, message, twimlUrl } = req.body as { to: string; message?: string; twimlUrl?: string };

    if (!to) return res.status(400).json({ error: "Missing required field: to" });
    to = normalizePhone(to);

    const defaultTwimlUrl = `${process.env.BASE_URL || `https://${req.get("host")}`}/api/twilio/voice`;

    let call;
    if (message) {
      call = await twilioIntegration.makeCallWithMessage(to, message);
    } else if (twimlUrl) {
      call = await twilioIntegration.makeCall(to, twimlUrl);
    } else {
      call = await twilioIntegration.makeCall(to, defaultTwimlUrl);
    }

    await storage.insertCallConversation({
      callSid: call.sid,
      fromNumber: call.from || process.env.TWILIO_PHONE_NUMBER || "unknown",
      toNumber: call.to || to,
      status: "in_progress",
      turnCount: 0,
    });

    res.json({ success: true, callSid: call.sid, status: call.status });
  } catch (error) {
    console.error("[Communications] Error initiating call:", error);
    res.status(500).json({ error: "Failed to initiate call" });
  }
});

// ============================================================================
// Voicemail
// ============================================================================

/** GET /api/communications/voicemails */
communicationsRouter.get("/voicemails", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const vms = await storage.getRecentVoicemails(limit);

    res.json(vms.map((v) => ({
      id: v.id,
      from: v.fromNumber,
      to: v.toNumber,
      recordingUrl: v.recordingUrl,
      transcription: v.transcription ?? null,
      duration: v.duration ?? 0,
      heard: v.heard,
      createdAt: v.createdAt,
    })));
  } catch (error) {
    console.error("[Communications] Error fetching voicemails:", error);
    res.status(500).json({ error: "Failed to fetch voicemails" });
  }
});

/** PUT /api/communications/voicemails/:id/heard */
communicationsRouter.put("/voicemails/:id/heard", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await storage.markVoicemailAsHeard(id);
    if (!updated) return res.status(404).json({ error: "Voicemail not found" });
    res.json({ success: true, voicemail: updated });
  } catch (error) {
    console.error("[Communications] Error marking voicemail heard:", error);
    res.status(500).json({ error: "Failed to mark voicemail as heard" });
  }
});

// ============================================================================
// Contacts
// ============================================================================

/** GET /api/communications/contacts */
communicationsRouter.get("/contacts", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || "";
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 50;

    const { searchContacts, listContacts } = await import("../integrations/google-contacts.js");
    const contacts = query
      ? await searchContacts(query, pageSize)
      : (await listContacts(pageSize)).contacts;

    res.json(contacts);
  } catch (error: any) {
    console.error("[Communications] Error fetching contacts:", error);
    res.json([]);
  }
});

export default communicationsRouter;



