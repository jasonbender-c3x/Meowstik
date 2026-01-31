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
import { insertSmsMessageSchema, GUEST_USER_ID } from "@shared/schemas";
import { z } from "zod";
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import { getToolDeclarations } from "../gemini-tools-guest";
import { ragDispatcher } from "../services/rag-dispatcher";

export const twilioRouter = Router();

// Gemini AI instance for SMS processing
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Owner identification from environment
const OWNER_PHONE = process.env.OWNER_PHONE_NUMBER;
const OWNER_USER_ID = process.env.OWNER_USER_ID;

/**
 * Normalize phone number to E.164 format for comparison
 * Removes all non-digit characters except the leading +
 */
function normalizePhoneNumber(phone: string): string {
  // Keep the + if it exists, remove all other non-digits
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized;
}

/**
 * Lookup sender in Google Contacts (if authenticated)
 * Returns contact name and special relationship if found
 */
async function lookupContact(phoneNumber: string, userId: string | null): Promise<{
  name: string | null;
  isSpecialRelationship: boolean;
  relationshipContext: string | null;
}> {
  // If not authenticated or no userId, can't lookup contacts
  if (!userId || userId === GUEST_USER_ID) {
    return { name: null, isSpecialRelationship: false, relationshipContext: null };
  }

  try {
    const { searchContacts } = await import("../integrations/google-contacts");
    const contacts = await searchContacts(phoneNumber, 10);
    
    // Find matching contact by phone number
    for (const contact of contacts) {
      if (contact.phoneNumbers) {
        for (const phone of contact.phoneNumbers) {
          const contactPhone = normalizePhoneNumber(phone.value);
          const searchPhone = normalizePhoneNumber(phoneNumber);
          
          if (contactPhone === searchPhone || contactPhone.endsWith(searchPhone.slice(-10))) {
            // Check for special relationships
            const name = contact.names?.[0]?.displayName || contact.names?.[0]?.givenName || null;
            const nameLower = name?.toLowerCase() || '';
            
            // Check for family members
            if (nameLower.includes('mom') || nameLower.includes('mother')) {
              return {
                name,
                isSpecialRelationship: true,
                relationshipContext: "The creator's mother"
              };
            }
            if (nameLower.includes('dad') || nameLower.includes('father')) {
              return {
                name,
                isSpecialRelationship: true,
                relationshipContext: "The creator's father"
              };
            }
            
            return { name, isSpecialRelationship: false, relationshipContext: null };
          }
        }
      }
    }
  } catch (error) {
    console.error('[Twilio] Error looking up contact:', error);
  }
  
  // No contact found
  return { name: null, isSpecialRelationship: false, relationshipContext: null };
}

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

  // Validate Twilio signature
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isValidSignature = signature && twilioIntegration.validateWebhookSignature(signature, url, req.body);
  
  if (!isValidSignature) {
    if (isDevelopment) {
      console.warn('[Twilio] Invalid signature in dev mode - continuing anyway');
    } else {
      console.error('[Twilio] Invalid webhook signature');
      return res.status(403).send("Forbidden: Invalid Twilio Signature");
    }
  }

  try {
    const parsedData = twilioSmsWebhookSchema.parse(req.body);
    const from = parsedData.From;
    const body = parsedData.Body;
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Twilio] Incoming SMS from ${from}`);
    console.log(`[Twilio] Message: ${body}`);
    console.log(`${"=".repeat(60)}\n`);

    // Store the incoming SMS
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

    // Respond immediately with TwiML (Twilio requires response within 10s)
    const twiml = new twilio.twiml.MessagingResponse();
    res.type("text/xml");
    res.send(twiml.toString()); // Empty response, we'll send reply via API

    // Process the message asynchronously (don't block Twilio webhook)
    processSmsMessage(from, body, parsedData.SmsSid).catch(error => {
      console.error('[Twilio] Error in async SMS processing:', error);
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Twilio] Validation error:', error.errors);
      return res.status(400).json({ success: false, error: "Invalid SMS data format", details: error.errors });
    }
    console.error('[Twilio] Error processing incoming SMS:', error);
    res.status(500).json({ success: false, error: "Failed to process incoming SMS" });
  }
});

/**
 * Process SMS message through AI and send response
 * This runs asynchronously after the webhook returns
 */
async function processSmsMessage(from: string, messageBody: string, smsSid: string): Promise<void> {
  try {
    // Determine authentication status
    const normalizedFrom = normalizePhoneNumber(from);
    const normalizedOwner = OWNER_PHONE ? normalizePhoneNumber(OWNER_PHONE) : null;
    const isOwner = normalizedOwner && normalizedFrom === normalizedOwner;
    
    let userId: string | null = null;
    let authStatus: { isAuthenticated: boolean; userId?: string; isGuest?: boolean } = {
      isAuthenticated: false,
      isGuest: true
    };
    
    if (isOwner && OWNER_USER_ID) {
      // Owner gets full authenticated access
      userId = OWNER_USER_ID;
      authStatus = { isAuthenticated: true, userId: OWNER_USER_ID };
      console.log(`[Twilio] SMS from owner: ${from}`);
    } else {
      // Guest access for non-owners
      userId = null;
      authStatus = { isAuthenticated: false, isGuest: true };
      console.log(`[Twilio] SMS from guest: ${from}`);
    }
    
    // Lookup contact (even for guests, for context)
    const contact = await lookupContact(from, OWNER_USER_ID || null);
    
    // Build sender context for system prompt
    let senderContext = '';
    if (isOwner) {
      senderContext = `\n\nYou are responding to an SMS from the authenticated owner (${from}).`;
    } else if (contact.name) {
      if (contact.isSpecialRelationship && contact.relationshipContext) {
        senderContext = `\n\nYou are responding to an SMS from ${contact.name} (${contact.relationshipContext}) at ${from}.`;
      } else {
        senderContext = `\n\nYou are responding to an SMS from ${contact.name} (a known contact) at ${from}.`;
      }
    } else {
      senderContext = `\n\nYou are responding to an SMS from an unknown number: ${from}. Be helpful but do not share private information.`;
    }
    
    // Create or retrieve chat session for this phone number
    // Use title pattern to find existing SMS chat
    const smsIdentifier = `SMS: ${from}`;
    const existingChats = await storage.getChatsByUser(userId || GUEST_USER_ID, 100);
    let chat = existingChats.find(c => c.title.includes(from) && c.title.startsWith('SMS'));
    
    if (!chat) {
      const chatTitle = contact.name 
        ? `SMS: ${contact.name} (${from})`
        : smsIdentifier;
      
      chat = await storage.createChat({
        title: chatTitle,
        userId: userId || GUEST_USER_ID,
        isGuest: !isOwner
      });
      console.log(`[Twilio] Created new chat session: ${chat.id}`);
    }
    
    // Save user message to chat
    const userMessage = await storage.createMessage({
      chatId: chat.id,
      role: 'user',
      content: messageBody,
      userId: userId || GUEST_USER_ID
    });
    
    // Get chat history (last 10 messages for context)
    const historyMessages = await storage.getMessagesByChat(chat.id, 10);
    const history = historyMessages
      .filter(m => m.id !== userMessage.id) // Exclude the current message
      .map(m => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.content }]
      }));
    
    // Build system prompt
    const systemPrompt = `You are Meowstik, a helpful AI assistant responding via SMS text message.

IMPORTANT SMS GUIDELINES:
- Keep responses CONCISE and BRIEF (1-3 sentences max)
- Use conversational, friendly tone
- Format for SMS readability (short paragraphs, minimal formatting)
- If you need to send a long response, break it into multiple messages using sms_send tool
${senderContext}

When responding:
1. Always use the sms_send tool to send your reply
2. Make sure to set the "to" parameter to the sender's number: ${from}
3. After sending, call end_turn to complete the conversation`;
    
    // Select tool declarations based on authentication
    const toolDeclarations = getToolDeclarations(authStatus.isAuthenticated);
    
    console.log(`[Twilio] Processing with ${toolDeclarations.length} available tools`);
    console.log(`[Twilio] Auth: ${authStatus.isAuthenticated ? 'AUTHENTICATED' : 'GUEST'}`);
    
    // Call Gemini AI
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: toolDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
          },
        },
      },
      contents: [...history, { role: "user", parts: [{ text: messageBody }] }],
    });
    
    // Collect function calls
    const functionCalls = result.functionCalls || [];
    console.log(`[Twilio] Received ${functionCalls.length} function calls from Gemini`);
    
    // Execute tool calls
    let assistantResponse = '';
    for (const fc of functionCalls) {
      console.log(`[Twilio] Executing tool: ${fc.name}`);
      
      const toolCall = {
        id: `fc_${Date.now()}`,
        type: fc.name as any,
        operation: fc.name || "execute",
        parameters: (fc.args as Record<string, unknown>) || {},
        priority: 0,
      };
      
      try {
        const toolResult = await ragDispatcher.executeToolCall(toolCall, userMessage.id, chat.id);
        
        if (toolResult.success) {
          console.log(`[Twilio] ✓ Tool ${fc.name} executed successfully`);
          
          // Capture send_chat content for storage
          if (fc.name === 'send_chat' || fc.name === 'sms_send') {
            const result = toolResult.result as { content?: string };
            if (result?.content) {
              assistantResponse += result.content;
            }
          }
        } else {
          console.error(`[Twilio] ✗ Tool ${fc.name} failed:`, toolResult.error);
        }
      } catch (error) {
        console.error(`[Twilio] Error executing tool ${fc.name}:`, error);
      }
    }
    
    // Save assistant response to chat if we have any
    if (assistantResponse) {
      await storage.createMessage({
        chatId: chat.id,
        role: 'assistant',
        content: assistantResponse,
        userId: userId || GUEST_USER_ID
      });
    }
    
    console.log(`[Twilio] SMS processing complete for ${from}`);
    
  } catch (error) {
    console.error('[Twilio] Error in processSmsMessage:', error);
    
    // Send error message to sender
    try {
      await twilioIntegration.sendSMS(from, "Sorry, I encountered an error processing your message. Please try again later.");
    } catch (sendError) {
      console.error('[Twilio] Failed to send error SMS:', sendError);
    }
  }
}

twilioRouter.post("/webhooks/voice", (req: Request, res: Response) => {
    const voiceTwiml = new twilio.twiml.VoiceResponse();
    
    // Enable call recording with transcription
    voiceTwiml.record({
      action: '/api/twilio/webhooks/handle-speech',
      transcribe: true,
      transcribeCallback: '/api/twilio/webhooks/call-transcription',
      recordingStatusCallback: '/api/twilio/webhooks/call-recording',
      maxLength: 3600, // 1 hour max
      playBeep: false,
    });
    
    // Initial greeting (will be part of recording)
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

/**
 * POST /api/twilio/webhooks/voicemail-recording
 * Handle voicemail recording completion
 */
twilioRouter.post("/webhooks/voicemail-recording", async (req: Request, res: Response) => {
  try {
    const { RecordingSid, RecordingUrl, RecordingDuration, CallSid, From, To } = req.body;
    
    console.log(`[Twilio Voicemail] Recording received: ${RecordingSid}`);
    
    // Store voicemail in database
    await storage.createVoicemail({
      recordingSid: RecordingSid,
      callSid: CallSid,
      fromNumber: From,
      toNumber: To,
      recordingUrl: RecordingUrl,
      duration: parseInt(RecordingDuration || '0'),
      transcriptionStatus: 'pending',
    });
    
    console.log(`[Twilio Voicemail] Saved to database: ${RecordingSid}`);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Twilio Voicemail] Error processing recording:', error);
    res.status(500).send('Error processing recording');
  }
});

/**
 * POST /api/twilio/webhooks/voicemail-transcription
 * Handle voicemail transcription completion
 */
twilioRouter.post("/webhooks/voicemail-transcription", async (req: Request, res: Response) => {
  try {
    const { RecordingSid, TranscriptionText, TranscriptionStatus } = req.body;
    
    console.log(`[Twilio Voicemail] Transcription received: ${RecordingSid}`);
    
    // Find voicemail by recording SID and update transcription
    const voicemail = await storage.getVoicemailByRecordingSid(RecordingSid);
    if (voicemail) {
      await storage.updateVoicemailTranscription(
        voicemail.id, 
        TranscriptionText || '', 
        TranscriptionStatus === 'completed' ? 'completed' : 'failed'
      );
      console.log(`[Twilio Voicemail] Transcription updated: ${RecordingSid}`);
    } else {
      console.warn(`[Twilio Voicemail] Voicemail not found for recording: ${RecordingSid}`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Twilio Voicemail] Error processing transcription:', error);
    res.status(500).send('Error processing transcription');
  }
});

/**
 * POST /api/twilio/webhooks/call-recording
 * Handle call recording completion
 */
twilioRouter.post("/webhooks/call-recording", async (req: Request, res: Response) => {
  try {
    const { RecordingSid, RecordingUrl, RecordingDuration, CallSid } = req.body;
    
    console.log(`[Twilio Call] Recording completed for call ${CallSid}: ${RecordingSid}`);
    
    // Update call conversation with recording details
    await storage.updateCallConversationBySid(CallSid, {
      recordingUrl: RecordingUrl,
      recordingSid: RecordingSid,
      duration: parseInt(RecordingDuration || '0'),
      transcriptionStatus: 'pending',
    });
    
    console.log(`[Twilio Call] Recording URL saved: ${RecordingUrl}`);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Twilio Call] Error processing call recording:', error);
    res.status(500).send('Error processing recording');
  }
});

/**
 * POST /api/twilio/webhooks/call-transcription
 * Handle call transcription completion
 */
twilioRouter.post("/webhooks/call-transcription", async (req: Request, res: Response) => {
  try {
    const { RecordingSid, TranscriptionText, TranscriptionStatus, CallSid } = req.body;
    
    console.log(`[Twilio Call] Transcription received for call ${CallSid}: ${RecordingSid}`);
    
    // Find call conversation by recording SID and update transcription
    const conversation = await storage.getCallConversationByRecordingSid(RecordingSid);
    if (conversation) {
      await storage.updateCallConversation(conversation.id, {
        transcription: TranscriptionText || '',
        transcriptionStatus: TranscriptionStatus === 'completed' ? 'completed' : 'failed',
      });
      console.log(`[Twilio Call] Transcription updated for call ${CallSid}`);
    } else {
      // Fallback: try to find by call SID
      const conversationByCallSid = await storage.getCallConversationBySid(CallSid);
      if (conversationByCallSid) {
        await storage.updateCallConversation(conversationByCallSid.id, {
          transcription: TranscriptionText || '',
          transcriptionStatus: TranscriptionStatus === 'completed' ? 'completed' : 'failed',
        });
        console.log(`[Twilio Call] Transcription updated for call ${CallSid} (via CallSid)`);
      } else {
        console.warn(`[Twilio Call] Call conversation not found for recording: ${RecordingSid}`);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Twilio Call] Error processing call transcription:', error);
    res.status(500).send('Error processing transcription');
  }
});
