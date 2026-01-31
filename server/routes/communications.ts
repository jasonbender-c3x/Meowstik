/**
 * Communications API Routes
 * Unified endpoint for SMS, Calls, and Voicemail
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import * as twilioIntegration from "../integrations/twilio";

export const communicationsRouter = Router();

// ============================================================================
// SMS / Conversations
// ============================================================================

/**
 * GET /api/communications/conversations
 * List all conversations with unread counts
 */
communicationsRouter.get("/conversations", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get all SMS messages grouped by phone number
    const messages = await storage.db
      .select("*")
      .from("sms_messages")
      .where({ user_id: userId })
      .orderBy("created_at", "desc");

    // Group by phone number to create conversations
    const conversationsMap = new Map();
    
    for (const msg of messages) {
      const phoneNumber = msg.direction === "inbound" ? msg.from_number : msg.to_number;
      
      if (!conversationsMap.has(phoneNumber)) {
        conversationsMap.set(phoneNumber, {
          id: phoneNumber,
          phoneNumber,
          contactName: null, // TODO: lookup from Google Contacts
          lastMessage: msg.body,
          lastMessageAt: msg.created_at,
          unreadCount: msg.direction === "inbound" && !msg.read_at ? 1 : 0,
        });
      } else {
        const conv = conversationsMap.get(phoneNumber);
        if (msg.direction === "inbound" && !msg.read_at) {
          conv.unreadCount++;
        }
      }
    }

    const conversations = Array.from(conversationsMap.values());
    res.json(conversations);
  } catch (error) {
    console.error("[Communications] Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/**
 * GET /api/communications/conversations/:phoneNumber/messages
 * Get messages for a specific conversation
 */
communicationsRouter.get("/conversations/:phoneNumber/messages", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { phoneNumber } = req.params;
    
    const messages = await storage.db
      .select("*")
      .from("sms_messages")
      .where({ user_id: userId })
      .where(function() {
        this.where({ from_number: phoneNumber }).orWhere({ to_number: phoneNumber });
      })
      .orderBy("created_at", "asc")
      .limit(100);

    res.json(messages.map(msg => ({
      id: msg.id,
      from: msg.from_number,
      to: msg.to_number,
      body: msg.body,
      direction: msg.direction,
      createdAt: msg.created_at,
      status: msg.status,
    })));
  } catch (error) {
    console.error("[Communications] Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**
 * POST /api/communications/sms/send
 * Send an SMS message
 */
communicationsRouter.post("/sms/send", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { to, body } = req.body;
    
    if (!to || !body) {
      return res.status(400).json({ error: "Missing required fields: to, body" });
    }

    // Send via Twilio
    const result = await twilioIntegration.sendSMS(to, body);

    // Store in database
    await storage.db.insert({
      id: crypto.randomUUID(),
      user_id: userId,
      message_sid: result.sid,
      from_number: process.env.TWILIO_PHONE_NUMBER,
      to_number: to,
      body,
      direction: "outbound",
      status: result.status,
      created_at: new Date(),
    }).into("sms_messages");

    res.json({ success: true, messageSid: result.sid });
  } catch (error) {
    console.error("[Communications] Error sending SMS:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ============================================================================
// Calls
// ============================================================================

/**
 * GET /api/communications/calls
 * List call history
 */
communicationsRouter.get("/calls", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // TODO: Implement calls table and fetch logic
    // For now, return empty array
    res.json([]);
  } catch (error) {
    console.error("[Communications] Error fetching calls:", error);
    res.status(500).json({ error: "Failed to fetch calls" });
  }
});

/**
 * POST /api/communications/calls
 * Initiate an outbound call
 */
communicationsRouter.post("/calls", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { to } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: "Missing required field: to" });
    }

    // TODO: Implement Twilio call initiation
    res.status(501).json({ error: "Call initiation not yet implemented" });
  } catch (error) {
    console.error("[Communications] Error initiating call:", error);
    res.status(500).json({ error: "Failed to initiate call" });
  }
});

// ============================================================================
// Voicemail
// ============================================================================

/**
 * GET /api/communications/voicemails
 * List voicemails
 */
communicationsRouter.get("/voicemails", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // TODO: Implement voicemails table and fetch logic
    res.json([]);
  } catch (error) {
    console.error("[Communications] Error fetching voicemails:", error);
    res.status(500).json({ error: "Failed to fetch voicemails" });
  }
});

/**
 * PUT /api/communications/voicemails/:id/heard
 * Mark voicemail as heard
 */
communicationsRouter.put("/voicemails/:id/heard", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    // TODO: Implement voicemail mark as heard
    res.json({ success: true });
  } catch (error) {
    console.error("[Communications] Error marking voicemail:", error);
    res.status(500).json({ error: "Failed to mark voicemail" });
  }
});

export default communicationsRouter;
