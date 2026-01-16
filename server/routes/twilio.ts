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

/**
 * GET /api/twilio/sms
 * Retrieves a list of SMS messages.
 *
 * Query Parameters:
 *  - limit (number, optional): Maximum number of messages to return. Defaults to 20.
 */
twilioRouter.get("/sms", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const messages = await twilioIntegration.listSmsMessages(limit);
    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching SMS messages:", error);
    res.status(500).json({ success: false, error: "Failed to fetch SMS messages" });
  }
});

/**
 * POST /api/twilio/sms
 * Sends an SMS message.
 *
 * Request Body:
 *  - to (string, required): The recipient's phone number in E.164 format.
 *  - body (string, required): The content of the message.
 */
twilioRouter.post("/sms", async (req: Request, res: Response) => {
  try {
    const { to, body } = req.body;
    if (!to || !body) {
      return res.status(400).json({ success: false, error: "Missing 'to' or 'body' in request" });
    }
    const message = await twilioIntegration.sendSms(to, body);
    res.json({ success: true, sid: message.sid });
  } catch (error) {
    console.error("Error sending SMS:", error);
    res.status(500).json({ success: false, error: "Failed to send SMS" });
  }
});

// ===========================================================================
// Voice Call Routes
// ===========================================================================

/**
 * GET /api/twilio/calls
 * Retrieves a list of voice calls.
 *
 * Query Parameters:
 *  - limit (number, optional): Maximum number of calls to return. Defaults to 20.
 */
twilioRouter.get("/calls", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const calls = await twilioIntegration.listCalls(limit);
    res.json({ success: true, calls });
  } catch (error) {
    console.error("Error fetching calls:", error);
    res.status(500).json({ success: false, error: "Failed to fetch calls" });
  }
});

/**
 * POST /api/twilio/calls
 * Makes a new voice call.
 *
 * Request Body:
 *  - to (string, required): The recipient's phone number.
 *  - message (string, optional): A message to be read using text-to-speech.
 *  - twimlUrl (string, optional): A URL to a TwiML document for call handling.
 */
twilioRouter.post("/calls", async (req: Request, res: Response) => {
  try {
    const { to, message, twimlUrl } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: "Missing 'to' in request" });
    }
    const call = await twilioIntegration.makeCall(to, message, twimlUrl);
    res.json({ success: true, sid: call.sid });
  } catch (error) {
    console.error("Error making call:", error);
    res.status(500).json({ success: false, error: "Failed to make call" });
  }
});


// ===========================================================================
// Webhook Routes
// ===========================================================================

// Zod schema for validating incoming Twilio SMS webhooks
const twilioSmsWebhookSchema = z.object({
  SmsSid: z.string(),
  AccountSid: z.string(),
  MessagingServiceSid: z.string().optional().nullable(),
  From: z.string(),
  To: z.string(),
  Body: z.string(),
  NumMedia: z.string().transform(Number),
  // Add other fields as needed, e.g., media URLs
});

/**
 * POST /api/twilio/webhooks/sms
 * Handles incoming SMS messages from Twilio.
 *
 * This endpoint:
 *  1. Validates the incoming request is from Twilio.
 *  2. Parses and validates the SMS data.
 *  3. Stores the message in the database.
 *  4. Responds to Twilio to acknowledge receipt.
 */
twilioRouter.post("/webhooks/sms", async (req: Request, res: Response) => {
  // 1. Validate request is from Twilio
  const twilioSignature = req.header("X-Twilio-Signature");

  // Construct the full URL for validation, including the query string
  const fullUrl = 'https://' + req.get('host') + req.originalUrl;

  if (!twilioSignature || !twilioIntegration.validateRequest(twilioSignature, fullUrl, req.body)) {
    return res.status(403).send("Forbidden: Invalid Twilio Signature");
  }

  try {
    // 2. Parse and validate the SMS data
    const parsedData = twilioSmsWebhookSchema.parse(req.body);

    // 3. Store the message in the database
    const smsData: z.infer<typeof insertSmsMessageSchema> = {
      sid: parsedData.SmsSid,
      accountSid: parsedData.AccountSid,
      messagingServiceSid: parsedData.MessagingServiceSid,
      from: parsedData.From,
      to: parsedData.To,
      body: parsedData.Body,
      direction: 'inbound', // This is an inbound message
      status: 'received'
    };
    await storage.insertSmsMessage(smsData);

    // 4. Respond to Twilio
    const smsTwimlResponse = new twilio.twiml.MessagingResponse();
    smsTwimlResponse.message("Thanks for your message! We'll be in touch shortly.");

    res.type("text/xml");
    res.send(smsTwimlResponse.toString());

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error for incoming SMS:", error.errors);
      return res.status(400).json({ success: false, error: "Invalid SMS data format", details: error.errors });
    }
    console.error("Error processing incoming SMS:", error);
    res.status(500).json({ success: false, error: "Failed to process incoming SMS" });
  }
});

/**
 * POST /api/twilio/webhooks/voice
 * Handles incoming voice calls. This is the entry point for call logic.
 *
 * TwiML is used to control the call flow. Here, we greet the caller and
 * then gather their speech input.
 */
twilioRouter.post("/webhooks/voice", (req: Request, res: Response) => {
    const voiceTwimlResponse = new twilio.twiml.VoiceResponse();

    // Start a conversation
    voiceTwimlResponse.say('Hello! I am Meowstik, a conversational AI. How can I help you today?');

    // Listen for the user's response and send it to the /handle-speech endpoint
    voiceTwimlResponse.gather({
      input: ['speech'],
      action: '/api/twilio/webhooks/handle-speech',
      speechTimeout: 'auto',
      speechModel: 'experimental_conversations',
    });

    // If the user doesn't say anything, you can redirect or hang up
    voiceTwimlResponse.say("I didn't hear anything. Goodbye.");
    voiceTwimlResponse.hangup();

    res.type("text/xml");
    res.send(voiceTwimlResponse.toString());
});

/**
 * POST /api/twilio/webhooks/handle-speech
 * Processes the speech captured from the voice webhook.
 *
 * This is where you would integrate with your AI/LLM to generate a response.
 * For now, it just logs the speech and gives a simple reply.
 */
twilioRouter.post("/webhooks/handle-speech", async (req: Request, res: Response) => {
    const speechTwimlResponse = new twilio.twiml.VoiceResponse();

    const speechResult = req.body.SpeechResult;
    const callSid = req.body.CallSid;

    console.log(`Speech captured from call ${callSid}: \"${speechResult}\"`);

    // Here, you would typically:
    // 1. Send `speechResult` to your LLM.
    // 2. Get the LLM's text response.
    // 3. Use that text in the `say` verb below.

    // For now, we'll just echo back what we think they said.
    const responseMessage = `I heard you say: \"${speechResult}\". This is a placeholder response. Goodbye.`;

    speechTwimlResponse.say(responseMessage);
    speechTwimlResponse.hangup();

    // Store the conversation turn
    try {
      await storage.insertCallConversation({
        callSid,
        turn: 1, // This would need to be incremented for a real conversation
        userInput: speechResult,
        aiResponse: responseMessage,
      });
    } catch (error) {
      console.error("Failed to store call conversation:", error);
    }

    res.type("text/xml");
    res.send(speechTwimlResponse.toString());
});


/**
 * POST /api/twilio/webhooks/status
 * Receives status updates for calls and messages.
 *
 * This can be used for tracking delivery status, call duration, etc.
 * For now, it just logs the status update.
 */
twilioRouter.post("/webhooks/status", (req: Request, res: Response) => {
  const { CallStatus, MessageStatus, CallSid, MessageSid } = req.body;

  if (CallSid) {
    console.log(`Call status update for ${CallSid}: ${CallStatus}`);
    // Here you could update the call record in your database
  }

  if (MessageSid) {
    console.log(`Message status update for ${MessageSid}: ${MessageStatus}`);
    // Here you could update the message record in your database
  }

  res.status(204).send(); // 204 No Content is appropriate here
});
