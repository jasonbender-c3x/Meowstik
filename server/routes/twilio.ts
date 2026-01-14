/**
 * Twilio API Routes
 * 
 * Routes for SMS, voice calls, and webhook handling
 */

import { Router, Request, Response } from "express";
import * as twilioIntegration from "../integrations/twilio";
import twilio from "twilio";

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
 * Webhook for incoming SMS - Process real-time SMS messages from Twilio
 * 
 * This endpoint:
 * 1. Validates the X-Twilio-Signature to ensure requests are from Twilio
 * 2. Looks up the sender in Google Contacts
 * 3. Creates a chat with appropriate context (owner, contact, or guest)
 * 4. Processes the message through the AI system
 * 5. Returns a TwiML response
 */
router.post("/webhook/sms", async (req: Request, res: Response) => {
  try {
    const { From, Body, MessageSid } = req.body;
    
    console.log(`[Twilio] Incoming SMS from ${From}: ${Body}`);
    
    // Validate Twilio signature for security
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    if (signature) {
      try {
        const isValid = twilioIntegration.validateWebhookSignature(
          signature,
          url,
          req.body
        );
        
        if (!isValid) {
          console.error("[Twilio] Invalid webhook signature");
          return res.status(403).send("Invalid signature");
        }
      } catch (error) {
        console.error("[Twilio] Signature validation error:", error);
        // Continue processing in development, but log the issue
        if (process.env.NODE_ENV === 'production') {
          return res.status(403).send("Signature validation failed");
        }
      }
    } else {
      console.warn("[Twilio] No X-Twilio-Signature header present");
      // In production, require signature
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).send("Missing signature");
      }
    }
    
    // Process the SMS asynchronously (don't block the webhook response)
    processSmsMessage(From, Body, MessageSid).catch(error => {
      console.error("[Twilio] Error processing SMS in background:", error);
    });
    
    // Return immediate TwiML response to Twilio
    const twiml = new MessagingResponse();
    // Don't send auto-reply - the AI will send a response via SMS when ready
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("[Twilio] SMS webhook error:", error);
    res.status(500).send("Error processing SMS");
  }
});

/**
 * Process incoming SMS message and generate AI response
 */
async function processSmsMessage(from: string, body: string, messageSid: string): Promise<void> {
  try {
    const { storage } = await import("../storage");
    const { GoogleGenAI, FunctionCallingConfigMode } = await import("@google/genai");
    const { promptComposer } = await import("../services/prompt-composer");
    const { ragDispatcher } = await import("../services/rag-dispatcher");
    const { getToolDeclarations } = await import("../gemini-tools-guest");
    const googleContacts = await import("../integrations/google-contacts");
    
    // Lookup sender in contacts
    let senderContext = {
      phoneNumber: from,
      name: null as string | null,
      relationship: null as string | null,
      isOwner: false,
      isKnownContact: false,
    };
    
    // Check if this is the owner's number (from environment or user profile)
    const ownerPhone = process.env.OWNER_PHONE_NUMBER;
    if (ownerPhone && normalizePhoneNumber(from) === normalizePhoneNumber(ownerPhone)) {
      senderContext.isOwner = true;
      senderContext.name = "You (Owner)";
      console.log(`[Twilio] SMS from owner: ${from}`);
    } else {
      // Search contacts for this phone number
      try {
        // Try to find contact by phone number
        const contacts = await googleContacts.searchContacts(from, 10);
        
        if (contacts.length > 0) {
          const contact = contacts[0];
          senderContext.isKnownContact = true;
          senderContext.name = contact.displayName;
          
          // Check for special relationships
          if (contact.displayName.toLowerCase().includes('mother') || 
              contact.displayName.toLowerCase().includes('mom')) {
            senderContext.relationship = "The creator's mother";
          }
          
          console.log(`[Twilio] SMS from known contact: ${senderContext.name} (${from})`);
        } else {
          console.log(`[Twilio] SMS from unknown number: ${from}`);
        }
      } catch (contactError) {
        console.error("[Twilio] Error looking up contact:", contactError);
        // Continue as guest if contact lookup fails
      }
    }
    
    // Determine authentication context
    const authStatus = {
      isAuthenticated: senderContext.isOwner,
      userId: senderContext.isOwner ? process.env.OWNER_USER_ID || null : null,
      isGuest: !senderContext.isOwner,
    };
    
    // Create or find existing chat for this phone number
    // Use a consistent chat title format for SMS conversations
    const chatTitle = senderContext.name 
      ? `SMS from ${senderContext.name}` 
      : `SMS from ${from}`;
    
    const chat = await storage.createChat({
      title: chatTitle,
      userId: authStatus.userId,
      isGuest: authStatus.isGuest,
    });
    
    // Format message with sender context
    let messageContent = `SMS from ${from}`;
    if (senderContext.name) {
      messageContent = `SMS from ${from} (${senderContext.name})`;
    }
    if (senderContext.relationship) {
      messageContent = `SMS from ${from} (${senderContext.relationship})`;
    }
    messageContent += `:\n\n${body}`;
    
    // Save user message
    const userMessage = await storage.addMessage({
      chatId: chat.id,
      role: "user",
      content: messageContent,
    });
    
    // Compose system prompt with appropriate context
    const composedPrompt = await promptComposer.compose({
      textContent: messageContent,
      voiceTranscript: "",
      attachments: [],
      history: [],
      chatId: chat.id,
      userId: authStatus.userId,
    });
    
    // Add SMS-specific context to system prompt
    let smsContext = "\n\n## SMS CONVERSATION CONTEXT\n";
    smsContext += `You are responding to an SMS message from ${from}.\n`;
    
    if (senderContext.isOwner) {
      smsContext += "This is your owner. Respond as if they are logged in with full access to their personal information.\n";
    } else if (senderContext.isKnownContact) {
      smsContext += `This is ${senderContext.name}, a contact from your owner's address book.\n`;
      if (senderContext.relationship) {
        smsContext += `Special relationship: ${senderContext.relationship}.\n`;
      }
      smsContext += "You can answer personal questions about your owner's whereabouts and activities.\n";
      smsContext += `Address them as ${senderContext.name}.\n`;
    } else {
      smsContext += "This is an unknown number. Treat them as a guest with limited access.\n";
    }
    
    smsContext += "\nIMPORTANT:\n";
    smsContext += "1. Keep your responses concise and suitable for SMS (avoid very long messages).\n";
    smsContext += `2. Use the \`sms_send\` tool to send your response back to ${from}.\n`;
    smsContext += `3. The recipient phone number is: ${from}\n`;
    smsContext += "4. After sending the SMS, call `send_chat` to log the response in the chat system.\n";
    
    const finalSystemPrompt = composedPrompt.systemPrompt + smsContext;
    
    // Process with AI
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const toolDeclarations = getToolDeclarations(authStatus.isAuthenticated);
    
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash", // Use flash for faster SMS responses
      config: {
        systemInstruction: finalSystemPrompt,
        tools: [{ functionDeclarations: toolDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
          },
        },
      },
      contents: [
        {
          role: "user",
          parts: [{ text: messageContent }],
        },
      ],
    });
    
    // Collect response and execute tool calls
    let fullResponse = "";
    const collectedFunctionCalls: any[] = [];
    
    for await (const chunk of result) {
      const text = chunk.text || "";
      if (text) {
        fullResponse += text;
      }
      
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        collectedFunctionCalls.push(...chunk.functionCalls);
      }
    }
    
    // Convert and execute function calls
    if (collectedFunctionCalls.length > 0) {
      for (const fc of collectedFunctionCalls) {
        const toolCall = {
          id: `fc_sms_${Date.now()}`,
          type: fc.name,
          operation: fc.name || "execute",
          parameters: (fc.args as Record<string, unknown>) || {},
          priority: 0,
        };
        
        console.log(`[Twilio] Executing tool: ${toolCall.type}`);
        
        try {
          await ragDispatcher.executeToolCall(toolCall, userMessage.id);
        } catch (toolError) {
          console.error(`[Twilio] Tool execution error:`, toolError);
        }
      }
    }
    
    // Save AI response
    await storage.addMessage({
      chatId: chat.id,
      role: "ai",
      content: fullResponse || "[AI processed the SMS message]",
    });
    
    console.log(`[Twilio] SMS processing complete for ${from}`);
  } catch (error) {
    console.error("[Twilio] Error in processSmsMessage:", error);
  }
}

/**
 * Normalize phone number for comparison (remove +, spaces, hyphens)
 */
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\+\(\)]/g, '');
}

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
