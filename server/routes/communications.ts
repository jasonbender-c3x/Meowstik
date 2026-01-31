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
          contactName: null,
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
    
    // Lookup contact names from Google Contacts (async, non-blocking)
    // Import once for all lookups
    try {
      const { searchContacts } = await import("../integrations/google-contacts");
      
      // We do this in parallel for better performance
      const lookupPromises = conversations.map(async (conv) => {
        try {
          const contacts = await searchContacts(conv.phoneNumber, 5);
          
          // Find matching contact by phone number
          for (const contact of contacts) {
            if (contact.phoneNumbers) {
              for (const phone of contact.phoneNumbers) {
                const normalizedContact = phone.value.replace(/[^\d+]/g, '');
                const normalizedSearch = conv.phoneNumber.replace(/[^\d+]/g, '');
                
                if (normalizedContact === normalizedSearch || 
                    normalizedContact.endsWith(normalizedSearch.slice(-10))) {
                  conv.contactName = contact.displayName;
                  return;
                }
              }
            }
          }
        } catch (error: any) {
          // Silently fail contact lookup for individual conversation - not critical
          console.warn('[Communications] Failed to lookup contact for', conv.phoneNumber, ':', error.message);
        }
      });
      
      // Wait for all lookups to complete (with timeout)
      await Promise.race([
        Promise.all(lookupPromises),
        new Promise(resolve => setTimeout(resolve, 2000)) // 2 second timeout
      ]);
    } catch (error: any) {
      // Silently fail if Google Contacts not available
      console.warn('[Communications] Google Contacts integration not available:', error.message);
    }
    
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

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    
    // Get recent call conversations from database
    const calls = await storage.getRecentCallConversations(limit);
    
    // Format for frontend
    const formattedCalls = calls.map(call => ({
      id: call.id,
      callSid: call.callSid,
      direction: call.fromNumber === process.env.TWILIO_PHONE_NUMBER ? "outbound" : "inbound",
      from: call.fromNumber,
      to: call.toNumber,
      status: call.status,
      duration: call.duration || 0,
      recordingUrl: null, // TODO: Add recording support
      createdAt: call.startedAt,
    }));
    
    res.json(formattedCalls);
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

    const { to, message, twimlUrl } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: "Missing required field: to" });
    }

    // Initiate call via Twilio
    let call;
    if (message) {
      // Use simple message TTS
      call = await twilioIntegration.makeCallWithMessage(to, message);
    } else if (twimlUrl) {
      // Use custom TwiML
      call = await twilioIntegration.makeCall(to, twimlUrl);
    } else {
      // Use default voice webhook
      const defaultTwimlUrl = `${process.env.BASE_URL || 'https://' + req.get('host')}/api/twilio/webhooks/voice`;
      call = await twilioIntegration.makeCall(to, defaultTwimlUrl);
    }

    // Create call conversation record
    await storage.insertCallConversation({
      callSid: call.sid,
      fromNumber: call.from,
      toNumber: call.to,
      status: "in_progress",
      turnCount: 0,
    });

    res.json({ 
      success: true, 
      callSid: call.sid,
      status: call.status 
    });
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

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    
    // Get recent voicemails from database
    const voicemails = await storage.getRecentVoicemails(limit);
    
    // Format for frontend
    const formattedVoicemails = voicemails.map(vm => ({
      id: vm.id,
      from: vm.fromNumber,
      recordingUrl: vm.recordingUrl,
      transcription: vm.transcription,
      duration: vm.duration || 0,
      heard: vm.heard,
      createdAt: vm.createdAt,
    }));
    
    res.json(formattedVoicemails);
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

    // Mark voicemail as heard
    const updated = await storage.markVoicemailAsHeard(id);
    
    if (!updated) {
      return res.status(404).json({ error: "Voicemail not found" });
    }
    
    res.json({ success: true, voicemail: updated });
  } catch (error) {
    console.error("[Communications] Error marking voicemail:", error);
    res.status(500).json({ error: "Failed to mark voicemail" });
  }
});

export default communicationsRouter;
