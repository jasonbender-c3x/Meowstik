/**
 * Twilio API Routes
 *
 * Routes for SMS, voice calls, and webhook handling
 * Implements Phase 1: Interactive Conversational Calling via Speech Capture
 */

import { Router, Request, Response } from "express";
import * as twilioIntegration from "../integrations/twilio";
import twilio from "twilio";
import { storage } from "../storage";
import { insertSmsMessageSchema } from "@shared/schemas";
import { z } from "zod";

export const twilioRouter = Router();

// ===========================================================================
// SMS Routes
// ===========================================================================

twilioRouter.get("/sms", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const messages = await twilioIntegration.getMessages(limit);
    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching SMS messages:", error);
    res.status(500).json({ success: false, error: "Failed to fetch SMS messages" });
  }
});

twilioRouter.post("/sms", async (req: Request, res: Response) => {
  try {
    const { to, body } = req.body;
    if (!to || !body) {
      return res.status(400).json({ success: false, error: "Missing 'to' or 'body' in request" });
    }
    const message = await twilioIntegration.sendSMS(to, body);
    res.json({ success: true, sid: message.sid });
  } catch (error) {
    console.error("Error sending SMS:", error);
    res.status(500).json({ success: false, error: "Failed to send SMS" });
  }
});

// ===========================================================================
// Voice Call Routes
// ===========================================================================

twilioRouter.get("/calls", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const calls = await twilioIntegration.getCalls(limit);
    res.json({ success: true, calls });
  } catch (error) {
    console.error("Error fetching calls:", error);
    res.status(500).json({ success: false, error: "Failed to fetch calls" });
  }
});

twilioRouter.post("/calls", async (req: Request, res: Response) => {
  try {
    const { to, message, twimlUrl } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: "Missing 'to' in request" });
    }
    // Use makeCallWithMessage if a message is provided, otherwise use makeCall with twimlUrl
    let call;
    if (message) {
      call = await twilioIntegration.makeCallWithMessage(to, message);
    } else if (twimlUrl) {
      call = await twilioIntegration.makeCall(to, twimlUrl);
    } else {
      return res.status(400).json({ success: false, error: "Either 'message' or 'twimlUrl' is required" });
    }
    res.json({ success: true, sid: call.sid });
  } catch (error) {
    console.error("Error making call:", error);
    res.status(500).json({ success: false, error: "Failed to make call" });
  }
});

// ===========================================================================
// Webhook Routes
// ===========================================================================

const twilioSmsWebhookSchema = z.object({
  SmsSid: z.string(),
  AccountSid: z.string(),
  MessagingServiceSid: z.string().optional().nullable(),
  From: z.string(),
  To: z.string(),
  Body: z.string(),
  NumMedia: z.string().transform(Number),
});

twilioRouter.post("/webhooks/sms", async (req: Request, res: Response) => {
  const signature = req.header("X-Twilio-Signature");
  const url = 'https://' + req.get('host') + req.originalUrl;

  if (!signature || !twilioIntegration.validateWebhookSignature(signature, url, req.body)) {
    return res.status(403).send("Forbidden: Invalid Twilio Signature");
  }

  try {
    const parsedData = twilioSmsWebhookSchema.parse(req.body);
    const smsData: z.infer<typeof insertSmsMessageSchema> = {
      sid: parsedData.SmsSid,
      accountSid: parsedData.AccountSid,
      messagingServiceSid: parsedData.MessagingServiceSid,
      from: parsedData.From,
      to: parsedData.To,
      body: parsedData.Body,
      direction: 'inbound',
      status: 'received'
    };
    await storage.insertSmsMessage(smsData);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("Thanks for your message! We'll be in touch shortly.");

    res.type("text/xml");
    res.send(twiml.toString());

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error for incoming SMS:", error.errors);
      return res.status(400).json({ success: false, error: "Invalid SMS data format", details: error.errors });
    }
    console.error("Error processing incoming SMS:", error);
    res.status(500).json({ success: false, error: "Failed to process incoming SMS" });
  }
});

twilioRouter.post("/webhooks/voice", (req: Request, res: Response) => {
    const voiceTwiml = new twilio.twiml.VoiceResponse();
    voiceTwiml.say('Hello! I am Meowstik, a conversational AI. How can I help you today?');
    voiceTwiml.gather({
      input: ['speech'],
      action: '/api/twilio/webhooks/handle-speech',
      speechTimeout: 'auto',
      speechModel: 'experimental_conversations',
    });
    voiceTwiml.say("I didn't hear anything. Goodbye.");
    voiceTwiml.hangup();

    res.type("text/xml");
    res.send(voiceTwiml.toString());
});

twilioRouter.post("/webhooks/handle-speech", async (req: Request, res: Response) => {
    const speechTwiml = new twilio.twiml.VoiceResponse();
    const speechResult = req.body.SpeechResult;
    const callSid = req.body.CallSid;

    console.log(`Speech captured from call ${callSid}: "${speechResult}"`);
    const responseMessage = `I heard you say: "${speechResult}". This is a placeholder response. Goodbye.`;

    speechTwiml.say(responseMessage);
    speechTwiml.hangup();

    try {
      await storage.insertCallConversation({
        callSid,
        turn: 1,
        userInput: speechResult,
        aiResponse: responseMessage,
      });
    } catch (error) {
      console.error("Failed to store call conversation:", error);
    }

    res.type("text/xml");
    res.send(speechTwiml.toString());
});

twilioRouter.post("/webhooks/status", (req: Request, res: Response) => {
  const { CallStatus, MessageStatus, CallSid, MessageSid } = req.body;
  if (CallSid) {
    console.log(`Call status update for ${CallSid}: ${CallStatus}`);
  }
  if (MessageSid) {
    console.log(`Message status update for ${MessageSid}: ${MessageStatus}`);
  }
  res.status(204).send();
});
