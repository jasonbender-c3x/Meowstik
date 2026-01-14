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
import { GoogleGenAI } from "@google/genai";

const VoiceResponse = twilio.twiml.VoiceResponse;
const MessagingResponse = twilio.twiml.MessagingResponse;

const router = Router();

// Initialize Gemini AI client for conversational responses
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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
 * Webhook for incoming voice calls - PHASE 1: Interactive Conversational Calling
 * 
 * This endpoint implements a multi-turn conversational flow:
 * 1. Greet the caller
 * 2. Use <Gather> with speech input to capture user's spoken response
 * 3. Process speech-to-text result in /webhook/speech-result
 * 4. Generate AI response using Gemini
 * 5. Use <Say> to voice the AI's response
 * 6. Continue gathering until conversation completes
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
        // Search contacts - Google People API searches across names, emails, and phone numbers
        // Limit to 10 results for performance, then filter for exact matches
        const contacts = await googleContacts.searchContacts(from, 10);
        
        // Filter contacts to find exact phone number match
        let matchedContact = null;
        for (const contact of contacts) {
          for (const phoneNumber of contact.phoneNumbers) {
            if (normalizePhoneNumber(phoneNumber) === normalizePhoneNumber(from)) {
              matchedContact = contact;
              break;
            }
          }
          if (matchedContact) break;
        }
        
        if (matchedContact) {
          senderContext.isKnownContact = true;
          senderContext.name = matchedContact.displayName;
          
          // Check for special relationships
          if (matchedContact.displayName.toLowerCase().includes('mother') || 
              matchedContact.displayName.toLowerCase().includes('mom')) {
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
    // Note: Only the owner gets full authentication and tool access
    // Known contacts are treated as guests (limited tools) but with enhanced context
    // in the system prompt to allow answering personal questions about the owner
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
 * Normalize phone number for comparison
 * Removes formatting but preserves country code
 * E.g., "+1 (555) 123-4567" -> "+15551234567"
 * 
 * Note: If a number doesn't have a country code (+), it returns it as-is
 * without assuming a default country. This avoids incorrect matches.
 */
function normalizePhoneNumber(phone: string): string {
  // Remove spaces, hyphens, parentheses but keep the leading +
  return phone.replace(/[\s\-\(\)]/g, '');
}

/**
 * Webhook for incoming voice calls
 */
router.post("/webhook/voice", async (req: Request, res: Response) => {
  try {
    const { From, CallSid, To } = req.body;
    
    console.log(`[Twilio Voice] Incoming call from ${From}, SID: ${CallSid}`);
    
    // Check if this is a new call or continuing conversation
    let conversation = await storage.getCallConversationBySid(CallSid);
    
    if (!conversation) {
      // New call - create conversation record and associated chat
      console.log(`[Twilio Voice] Creating new conversation for call ${CallSid}`);
      
      // Create a chat for this call conversation
      const chat = await storage.createChat({
        title: `Phone Call from ${From}`,
        userId: null,
        isGuest: true,
      });
      
      conversation = await storage.createCallConversation({
        callSid: CallSid,
        fromNumber: From,
        toNumber: To,
        chatId: chat.id,
        status: "in_progress",
        turnCount: 0,
        currentContext: "initial_greeting",
      });
      
      console.log(`[Twilio Voice] Created conversation ${conversation.id} with chat ${chat.id}`);
    }
    
    // Create TwiML response
    const twiml = new VoiceResponse();
    
    // Greet the caller
    twiml.say({ 
      voice: "Polly.Joanna",
      language: "en-US"
    }, "Hello! Welcome to Meowstik AI. I'm your AI assistant. How can I help you today?");
    
    // Gather speech input from user
    const gather = twiml.gather({
      input: ["speech"],
      action: `/api/twilio/webhook/speech-result?conversationId=${conversation.id}`,
      method: "POST",
      speechTimeout: "auto", // Auto-detect when user stops speaking
      speechModel: "phone_call", // Optimized for phone call audio
      enhanced: true, // Use enhanced speech recognition
      language: "en-US",
      hints: "help, support, question, information, AI, assistant", // Context hints for better recognition
    });
    
    // Provide guidance if user doesn't speak
    gather.say({ voice: "Polly.Joanna" }, "Please speak your question or request.");
    
    // If no speech detected after timeout, say goodbye
    twiml.say({ voice: "Polly.Joanna" }, "I didn't hear anything. Goodbye!");
    twiml.hangup();
    
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("[Twilio Voice] Webhook error:", error);
    
    // Send error TwiML response
    const twiml = new VoiceResponse();
    twiml.say({ voice: "Polly.Joanna" }, 
      "I'm sorry, there was an error processing your call. Please try again later."
    );
    twiml.hangup();
    
    res.type("text/xml").send(twiml.toString());
  }
});

/**
 * Webhook for speech result - Processes transcribed speech and generates AI response
 * 
 * This endpoint:
 * 1. Receives transcribed speech from Twilio
 * 2. Saves the user's speech as a message in the conversation
 * 3. Generates an AI response using Gemini with full conversation context
 * 4. Saves the AI response
 * 5. Returns TwiML with <Say> to voice the response
 * 6. Continues the conversation loop with another <Gather>
 */
router.post("/webhook/speech-result", async (req: Request, res: Response) => {
  try {
    const conversationId = req.query.conversationId as string;
    const { 
      SpeechResult, 
      Confidence, 
      CallSid,
      From
    } = req.body;
    
    console.log(`[Twilio Speech] Received speech for conversation ${conversationId}`);
    console.log(`[Twilio Speech] Transcribed: "${SpeechResult}" (confidence: ${Confidence})`);
    
    if (!conversationId) {
      throw new Error("Missing required conversationId parameter in request");
    }
    
    // Retrieve conversation
    const conversation = await storage.getCallConversationById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Save user's speech as a message
    const userMessage = await storage.addMessage({
      chatId: conversation.chatId,
      role: "user",
      content: SpeechResult || "(no speech detected)",
    });
    
    console.log(`[Twilio Speech] Saved user message ${userMessage.id}`);
    
    // Get conversation history for context
    const messages = await storage.getMessagesByChatId(conversation.chatId, { limit: 10 });
    
    // Build conversation history for Gemini
    const history = messages
      .filter(m => m.id !== userMessage.id) // Exclude current message
      .map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));
    
    // Check for conversation termination intent
    const userIntent = SpeechResult.toLowerCase();
    const terminationPhrases = ["goodbye", "bye", "thank you goodbye", "that's all", "hang up", "end call"];
    const shouldTerminate = terminationPhrases.some(phrase => userIntent.includes(phrase));
    
    let aiResponseText = "";
    
    if (shouldTerminate) {
      // User wants to end call
      aiResponseText = "Thank you for calling Meowstik AI. Have a great day! Goodbye.";
      console.log(`[Twilio Speech] User requested call termination`);
    } else {
      // Generate AI response using Gemini
      console.log(`[Twilio Speech] Generating AI response with ${history.length} context messages`);
      
      const systemPrompt = `You are Meowstik, a helpful AI assistant speaking on the phone.
Rules for phone conversations:
- Keep responses concise and natural (2-3 sentences max)
- Speak conversationally, as if talking to someone on the phone
- Ask follow-up questions when appropriate
- Be friendly and helpful
- If the user says goodbye or wants to end the call, politely acknowledge and say goodbye

Current user request: ${SpeechResult}`;
      
      try {
        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash-exp",
          systemInstruction: systemPrompt,
        });
        
        const result = await model.generateContent({
          contents: [
            ...history,
            { role: "user", parts: [{ text: SpeechResult }] }
          ],
        });
        
        aiResponseText = result.response.text()?.trim() || "I'm sorry, I couldn't process that. Could you please repeat your question?";
        console.log(`[Twilio Speech] AI response: "${aiResponseText.substring(0, 100)}..."`);
      } catch (aiError) {
        console.error("[Twilio Speech] Error generating AI response:", aiError);
        aiResponseText = "I'm sorry, I'm having trouble processing that right now. Could you please rephrase your question?";
      }
    }
    
    // Save AI response as a message
    const aiMessage = await storage.addMessage({
      chatId: conversation.chatId,
      role: "ai",
      content: aiResponseText,
    });
    
    console.log(`[Twilio Speech] Saved AI message ${aiMessage.id}`);
    
    // Save this turn to call_turns table
    const turnNumber = conversation.turnCount + 1;
    await storage.createCallTurn({
      conversationId: conversation.id,
      turnNumber,
      userSpeech: SpeechResult,
      speechConfidence: Confidence,
      aiResponse: aiResponseText,
      aiResponseAudio: null, // Using TwiML <Say>, not custom audio
    });
    
    // Update conversation turn count
    await storage.updateCallConversation(conversation.id, {
      turnCount: turnNumber,
      currentContext: shouldTerminate ? "call_ending" : "ongoing",
    });
    
    // Create TwiML response
    const twiml = new VoiceResponse();
    
    // Speak the AI's response
    twiml.say({ 
      voice: "Polly.Joanna",
      language: "en-US"
    }, aiResponseText);
    
    if (shouldTerminate) {
      // End the call
      twiml.hangup();
      
      // Mark conversation as completed
      const now = new Date();
      const duration = Math.floor((now.getTime() - conversation.startedAt.getTime()) / 1000);
      await storage.updateCallConversation(conversation.id, {
        status: "completed",
        endedAt: now,
        duration,
      });
      
      console.log(`[Twilio Speech] Call ended, duration: ${duration}s`);
    } else {
      // Continue the conversation - gather more input
      const gather = twiml.gather({
        input: ["speech"],
        action: `/api/twilio/webhook/speech-result?conversationId=${conversation.id}`,
        method: "POST",
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        language: "en-US",
        hints: "help, support, question, information, AI, assistant",
      });
      
      // Prompt for next input
      gather.say({ voice: "Polly.Joanna" }, "Is there anything else I can help you with?");
      
      // If no speech after prompt, end call
      twiml.say({ voice: "Polly.Joanna" }, "Thank you for calling. Goodbye!");
      twiml.hangup();
    }
    
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("[Twilio Speech] Error processing speech result:", error);
    
    // Send error TwiML response
    const twiml = new VoiceResponse();
    twiml.say({ voice: "Polly.Joanna" }, 
      "I'm sorry, I encountered an error processing your request. Please call back later."
    );
    twiml.hangup();
    
    res.type("text/xml").send(twiml.toString());
  }
});

/**
 * Webhook for call status updates
 */
router.post("/webhook/status", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    
    console.log(`[Twilio] Call ${CallSid} status: ${CallStatus}, duration: ${CallDuration}s`);
    
    // Update conversation status based on call status
    const conversation = await storage.getCallConversationBySid(CallSid);
    if (conversation && CallStatus === "completed") {
      await storage.updateCallConversation(conversation.id, {
        status: "completed",
        endedAt: new Date(),
        duration: parseInt(CallDuration) || 0,
      });
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error("[Twilio] Status webhook error:", error);
    res.status(500).send("Error processing status");
  }
});

/**
 * Get call conversation history
 */
router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const conversations = await storage.getRecentCallConversations(limit);
    res.json(conversations);
  } catch (error) {
    console.error("[Twilio] Error fetching conversations:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to fetch conversations" 
    });
  }
});

/**
 * Get specific call conversation with turns
 */
router.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conversation = await storage.getCallConversationById(id);
    
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    const turns = await storage.getCallTurns(id);
    const chat = conversation.chatId 
      ? await storage.getChatById(conversation.chatId)
      : null;
    
    res.json({
      conversation,
      turns,
      chat,
    });
  } catch (error) {
    console.error("[Twilio] Error fetching conversation:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to fetch conversation" 
    });
  }
});

export default router;
