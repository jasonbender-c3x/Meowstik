/**
 * Twilio API Routes
 * 
 * Routes for SMS, voice calls, and webhook handling
 */

import { Router, Request, Response } from "express";
import * as twilioIntegration from "../integrations/twilio";
import twilio from "twilio";
import { storage } from "../storage";
import { insertSmsMessageSchema } from "@shared/schema";

const VoiceResponse = twilio.twiml.VoiceResponse;
const MessagingResponse = twilio.twiml.MessagingResponse;

const router = Router();

/**
 * Check Twilio configuration status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const configured = twilioIntegration.isConfigured();
    const phoneNumber = twilioIntegration.getPhoneNumber();
    
    if (!configured) {
      return res.json({ 
        configured: false, 
        message: "Twilio credentials not configured" 
      });
    }

    const balance = await twilioIntegration.getBalance();
    
    res.json({
      configured: true,
      phoneNumber,
      balance: balance.balance,
      currency: balance.currency,
    });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to check Twilio status" 
    });
  }
});

/**
 * Send SMS
 */
router.post("/sms/send", async (req: Request, res: Response) => {
  try {
    const { to, body } = req.body;

    if (!to || !body) {
      return res.status(400).json({ error: "Missing 'to' or 'body' field" });
    }

    const result = await twilioIntegration.sendSMS(to, body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to send SMS" 
    });
  }
});

/**
 * Send MMS with media
 */
router.post("/mms/send", async (req: Request, res: Response) => {
  try {
    const { to, body, mediaUrl } = req.body;

    if (!to || !body || !mediaUrl) {
      return res.status(400).json({ error: "Missing 'to', 'body', or 'mediaUrl' field" });
    }

    const result = await twilioIntegration.sendMMS(to, body, mediaUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to send MMS" 
    });
  }
});

/**
 * Get message history
 */
router.get("/messages", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const messages = await twilioIntegration.getMessages(limit);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to get messages" 
    });
  }
});

/**
 * Get specific message
 */
router.get("/messages/:sid", async (req: Request, res: Response) => {
  try {
    const { sid } = req.params;
    const message = await twilioIntegration.getMessage(sid);
    res.json(message);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to get message" 
    });
  }
});

/**
 * Make a voice call with a message
 */
router.post("/call", async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: "Missing 'to' or 'message' field" });
    }

    const result = await twilioIntegration.makeCallWithMessage(to, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to make call" 
    });
  }
});

/**
 * Get call history
 */
router.get("/calls", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const calls = await twilioIntegration.getCalls(limit);
    res.json(calls);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to get calls" 
    });
  }
});

/**
 * Get stored SMS messages with filtering
 */
router.get("/sms/stored", async (req: Request, res: Response) => {
  try {
    const direction = req.query.direction as 'inbound' | 'outbound' | undefined;
    const processed = req.query.processed === 'true' ? true : req.query.processed === 'false' ? false : undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const phoneNumber = req.query.phoneNumber as string | undefined;

    const messages = await storage.getSmsMessages({ 
      direction, 
      processed, 
      limit,
      phoneNumber
    });
    
    res.json({ messages, count: messages.length });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to get SMS messages" 
    });
  }
});

/**
 * Get a specific stored SMS by ID
 */
router.get("/sms/stored/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sms = await storage.getSmsById(id);
    
    if (!sms) {
      return res.status(404).json({ error: "SMS message not found" });
    }
    
    res.json(sms);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to get SMS message" 
    });
  }
});

/**
 * Mark SMS as processed
 */
router.post("/sms/stored/:id/mark-processed", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { chatId, responseMessageSid } = req.body;
    
    await storage.markSmsAsProcessed(id, chatId, responseMessageSid);
    
    res.json({ success: true, message: "SMS marked as processed" });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to mark SMS as processed" 
    });
  }
});

/**
 * Webhook for incoming SMS
 * This endpoint is called by Twilio when an SMS is received
 */
router.post("/webhook/sms", async (req: Request, res: Response) => {
  try {
    const { From, To, Body, MessageSid, AccountSid, NumMedia, MediaUrl0, MediaUrl1, MediaUrl2, MediaUrl3 } = req.body;
    
    console.log(`[Twilio] Incoming SMS from ${From} to ${To}: ${Body}`);
    
    // Validate webhook signature for security
    const signature = req.headers['x-twilio-signature'] as string;
    if (signature && process.env.TWILIO_AUTH_TOKEN) {
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const isValid = twilioIntegration.validateWebhookSignature(signature, url, req.body);
      
      if (!isValid) {
        console.error("[Twilio] Invalid webhook signature");
        return res.status(403).send("Forbidden");
      }
    }
    
    // Collect media URLs if present
    const mediaUrls = [];
    if (NumMedia && parseInt(NumMedia) > 0) {
      if (MediaUrl0) mediaUrls.push(MediaUrl0);
      if (MediaUrl1) mediaUrls.push(MediaUrl1);
      if (MediaUrl2) mediaUrls.push(MediaUrl2);
      if (MediaUrl3) mediaUrls.push(MediaUrl3);
    }
    
    // Store the SMS message in database
    const smsData = {
      messageSid: MessageSid,
      accountSid: AccountSid,
      from: From,
      to: To,
      body: Body || "",
      direction: "inbound" as const,
      status: "received",
      numMedia: parseInt(NumMedia || "0"),
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
      processed: false,
    };
    
    const result = insertSmsMessageSchema.safeParse(smsData);
    if (!result.success) {
      console.error("[Twilio] Invalid SMS data:", result.error);
      return res.status(400).send("Invalid SMS data");
    }
    
    const smsRecord = await storage.createSmsMessage(result.data);
    console.log(`[Twilio] SMS stored with ID: ${smsRecord.id}`);
    
    // Create a TwiML response
    const twiml = new MessagingResponse();
    
    // Send a simple acknowledgment
    twiml.message("Thank you for your message! Meowstik AI has received it and will process your request shortly.");
    
    // TODO: Process SMS asynchronously via queue system
    // This could integrate with the chat system to create AI responses
    // For now, we just store it and acknowledge receipt
    
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("[Twilio] SMS webhook error:", error);
    
    // Still send a valid TwiML response even on error
    const twiml = new MessagingResponse();
    twiml.message("Sorry, there was an error processing your message. Please try again later.");
    res.type("text/xml").send(twiml.toString());
  }
});

/**
 * Webhook for incoming voice calls
 */
router.post("/webhook/voice", async (req: Request, res: Response) => {
  try {
    const { From, CallSid } = req.body;
    
    console.log(`[Twilio] Incoming call from ${From}, SID: ${CallSid}`);
    
    // Create a TwiML response
    const twiml = new VoiceResponse();
    
    // Greet the caller
    twiml.say({ voice: "Polly.Joanna" }, 
      "Hello! Welcome to Meowstik AI. Please hold while I connect you to our AI assistant."
    );
    
    // TODO: Connect to AI voice assistant via WebSocket stream
    // For now, just play a message and hang up
    twiml.say({ voice: "Polly.Joanna" },
      "The AI voice assistant feature is coming soon. Thank you for calling!"
    );
    
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("[Twilio] Voice webhook error:", error);
    res.status(500).send("Error processing call");
  }
});

/**
 * Webhook for call status updates
 */
router.post("/webhook/status", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    
    console.log(`[Twilio] Call ${CallSid} status: ${CallStatus}, duration: ${CallDuration}s`);
    
    res.sendStatus(200);
  } catch (error) {
    console.error("[Twilio] Status webhook error:", error);
    res.status(500).send("Error processing status");
  }
});

export default router;
