
/**
 * TWILIO MEDIA STREAM WEBSOCKET — Meowstik Voice Brain
 *
 * Handles Twilio Media Streams → Gemini Live bidirectional audio.
 *
 * Modes:
 *  - inbound (someone calls Meowstik): receptionist / screening
 *  - inbound from owner: concierge mode, can make calls, place conferences
 *  - outbound with mission: Meowstik calls someone, delivers msg, engages naturally
 *
 * Gemini tools available during calls:
 *  - notify_owner      → SMS the owner with a message / call result
 *  - make_outbound_call → call a contact on the owner's behalf (from owner-mode calls)
 *  - end_call          → gracefully hang up
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import type { Duplex } from "stream";
import crypto from "crypto";
import * as geminiLive from "./integrations/gemini-live";
import { decodeMuLaw, encodeMuLaw, resample8kTo16k, resample24kTo8k } from "./utils/audio-transcoder";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TwilioMediaStreamMessage {
  event: "start" | "media" | "stop" | "mark" | "clear" | "connected";
  sequenceNumber?: string;
  media?: {
    track: "inbound" | "outbound";
    chunk: string;
    timestamp?: string;
    payload?: string;
  };
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
    mediaFormat: { encoding: "audio/x-mulaw"; sampleRate: 8000; channels: 1 };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").slice(-10);
}

async function resolveCallerName(fromNumber: string): Promise<string | null> {
  try {
    const { searchContacts } = await import("./integrations/google-contacts.js");
    const results: any[] = await Promise.race([
      searchContacts(fromNumber, 5) as Promise<any[]>,
      new Promise<any[]>((r) => setTimeout(() => r([]), 1500)),
    ]);
    for (const c of results) {
      for (const phone of c.phoneNumbers ?? []) {
        if (normalizePhone(phone.value) === normalizePhone(fromNumber)) {
          return c.displayName as string;
        }
      }
    }
  } catch {
    /* Google Contacts not configured */
  }
  return null;
}

async function lookupContactPhone(name: string): Promise<{ name: string; phone: string } | null> {
  try {
    const { searchContacts } = await import("./integrations/google-contacts.js");
    const results: any[] = await Promise.race([
      searchContacts(name, 5) as Promise<any[]>,
      new Promise<any[]>((r) => setTimeout(() => r([]), 2000)),
    ]);
    for (const c of results) {
      const phone = c.phoneNumbers?.[0]?.value;
      if (phone) return { name: c.displayName, phone };
    }
  } catch {
    /* contacts unavailable */
  }
  return null;
}

// ── System Prompts ────────────────────────────────────────────────────────────

const OWNER_NAME = "Jason Bender";

function buildSystemPrompt(opts: {
  direction: string;
  fromNumber: string;
  callerName: string | null;
  isOwner: boolean;
  context: string;
  meowstikNumber: string;
}): string {
  const { direction, fromNumber, callerName, isOwner, context, meowstikNumber } = opts;

  if (isOwner) {
    return `You are Meowstik, ${OWNER_NAME}'s AI personal assistant and phone concierge.
${OWNER_NAME} is calling you right now. Greet him warmly by name.

You can help Jason with any request during this call, including:
- Making calls on his behalf: use the make_outbound_call tool
  Example: "Call my mother, tell her we're coming Sunday, ask what time and what to bring"
- Setting up conference calls (tell him you'll arrange it)
- Taking notes or sending messages
- Answering questions

TOOL USAGE:
- make_outbound_call: When Jason asks you to call someone on his behalf.
  You will look up the contact, call them, deliver the message, handle the conversation,
  then text Jason the result via notify_owner.
- notify_owner: Send Jason an SMS (useful if you need to follow up).
- end_call: When the conversation is naturally complete.

Be warm, efficient, and conversational. You are Jason's trusted assistant.
${context ? "Context: " + context : ""}`;
  }

  if (direction === "outbound") {
    // Mission-driven outbound call
    return `You are Meowstik, the AI phone assistant for ${OWNER_NAME}.
You are placing a call on ${OWNER_NAME}'s behalf.

YOUR MISSION FOR THIS CALL:
${context || "Represent " + OWNER_NAME + " professionally and helpfully."}

HOW TO HANDLE THE CALL:
1. Introduce yourself naturally: "Hi, this is Meowstik, ${OWNER_NAME}'s personal assistant."
2. Carry out your mission conversationally and warmly — not robotically.
3. If the other person makes small talk, engage genuinely and naturally. Be personable.
4. If they ask a question you cannot answer ("When exactly is Jason coming?"), say:
   "Let me check with Jason and get back to you on that."
5. When your mission is complete (you have the information or delivered the message):
   - Use the notify_owner tool to text Jason the key result
     (e.g., "Your mom says Sunday at 3pm works! She asked you to bring dessert.")
   - Thank them warmly and say goodbye.
   - Use the end_call tool.

IMPORTANT:
- Sound like a real, warm, helpful person — not a robot.
- If they want to speak with ${OWNER_NAME} directly, take their message and tell them
  he will call back shortly. Use notify_owner to alert Jason.
- Keep responses concise and natural for a phone call.`;
  }

  // Default: inbound from external caller
  const callerLabel = callerName ? `${callerName} (${fromNumber})` : `a caller from ${fromNumber}`;
  return `You are Meowstik, the AI receptionist answering the phone for ${OWNER_NAME} (${meowstikNumber}).
You are speaking with ${callerLabel}.

YOUR DUTIES:
1. Greet them warmly${callerName ? ` by name ("Hi ${callerName}!")` : " and ask for their name"}.
2. Ask the reason for their call.
3. Engage naturally — if they want to chat, be genuinely warm and pleasant.
4. Determine urgency:
   - URGENT or family/close contact: Tell them you will alert ${OWNER_NAME} immediately.
     Use notify_owner: "Urgent call from [name]: [reason]. They're on the line now."
   - Normal: Take a complete message. Use notify_owner: "[Name] called: [reason]. Number: [phone]."
   - Sales/spam: Politely decline ("Jason is not accepting new solicitations, but thank you!") and use end_call.
5. Always be polite, warm, and helpful — you represent ${OWNER_NAME} professionally.

TOOLS:
- notify_owner: Alert Jason by SMS (for messages, urgent calls, or interesting info)
- end_call: Hang up gracefully when done

Keep responses concise and natural for phone conversation.`;
}

// ── Gemini Tool Declarations ──────────────────────────────────────────────────

const BASE_TOOLS = [
  {
    name: "notify_owner",
    description:
      `Send an SMS notification to ${OWNER_NAME} with information from this call. ` +
      "Use this to: relay messages, report call results (e.g. what time mom said), " +
      "alert Jason about urgent callers, or confirm completed tasks.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description:
            "The SMS message to send. Be specific and actionable. " +
            "Include names, times, questions answered, and anything Jason needs to know.",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "end_call",
    description:
      "End the phone call gracefully after completing the mission or conversation. " +
      "Always say a warm goodbye before using this tool.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why the call is ending: mission_complete, message_taken, spam_declined, or owner_requested",
        },
      },
      required: ["reason"],
    },
  },
];

const OWNER_TOOLS = [
  ...BASE_TOOLS,
  {
    name: "make_outbound_call",
    description:
      `Place a call on ${OWNER_NAME}'s behalf. You will call the person, deliver the message, ` +
      "handle the full conversation (including small talk), then text Jason the results via notify_owner. " +
      "Use this when Jason says things like 'Call my mother' or 'Get John on the line'.",
    parameters: {
      type: "object",
      properties: {
        contact_name: {
          type: "string",
          description: "The name of the person to call (e.g., 'mom', 'John Smith', 'Dr. Wilson')",
        },
        phone_number: {
          type: "string",
          description: "Phone number if Jason provided it directly (optional, leave blank to look up from contacts)",
        },
        mission: {
          type: "string",
          description:
            "Full description of what to do on the call: what to say, what to ask, any context. " +
            "Be thorough — this is what Meowstik will use to drive the entire conversation.",
        },
      },
      required: ["contact_name", "mission"],
    },
  },
];

// ── WebSocket Setup ───────────────────────────────────────────────────────────

export function setupTwilioWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    if (url === "/streams/twilio" || url?.startsWith("/streams/twilio")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
        handleTwilioConnection(ws);
      });
    }
  });

  console.log("[twilio] Twilio WebSocket server initialized at /streams/twilio");
}

// ── Connection Handler ────────────────────────────────────────────────────────

function handleTwilioConnection(ws: WebSocket): void {
  let streamSid: string | null = null;
  let callSid: string | null = null;
  const sessionId: string = crypto.randomUUID();
  let isSessionActive = false;
  let isOwnerCall = false;

  console.log("[Twilio WS] New Media Stream connection");

  // ── Gemini response loop ──────────────────────────────────────────────────

  const startGeminiResponseStream = async () => {
    if (!streamSid) return;
    console.log(`[Twilio WS] Starting Gemini response stream (${sessionId})`);

    try {
      for await (const response of geminiLive.receiveResponses(sessionId)) {
        if (ws.readyState !== WebSocket.OPEN) break;

        if (response.type === "audio" && response.data) {
          try {
            const pcmBuffer = Buffer.from(response.data, "base64");
            const downsampled = resample24kTo8k(pcmBuffer);
            const mulaw = encodeMuLaw(downsampled);
            ws.send(
              JSON.stringify({
                event: "media",
                streamSid,
                media: { payload: mulaw.toString("base64") },
              })
            );
          } catch (err) {
            console.error("[Twilio WS] Audio transcode error:", err);
          }
        } else if (response.type === "functionCall" && response.functionCall) {
          await handleFunctionCall(
            sessionId,
            callSid,
            isOwnerCall,
            response.functionCall.name,
            response.functionCall.args as Record<string, unknown>
          );
        } else if (response.type === "end") {
          console.log("[Twilio WS] Gemini session ended");
          break;
        }
      }
    } catch (error) {
      console.error("[Twilio WS] Gemini response loop error:", error);
    }
  };

  // ── Message handler ───────────────────────────────────────────────────────

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as TwilioMediaStreamMessage;

      if (msg.event === "start") {
        streamSid = msg.start!.streamSid;
        callSid = msg.start!.callSid;
        const params = msg.start!.customParameters ?? {};
        const fromNumber = params.fromNumber ?? "Unknown";
        const direction = params.direction ?? "inbound";
        const context = decodeURIComponent(params.context ?? "");

        console.log(
          `[Twilio WS] Stream=${streamSid} call=${callSid} dir=${direction} from=${fromNumber}`
        );

        // Identify caller
        const ownerNumber = process.env.OWNER_PHONE_NUMBER ?? "";
        isOwnerCall =
          ownerNumber !== "" &&
          normalizePhone(fromNumber) === normalizePhone(ownerNumber);

        const callerName = isOwnerCall
          ? OWNER_NAME
          : await resolveCallerName(fromNumber);

        console.log(
          `[Twilio WS] Caller: ${callerName ?? "unknown"} isOwner=${isOwnerCall} dir=${direction}`
        );

        const meowstikNumber = process.env.TWILIO_PHONE_NUMBER ?? "this number";
        const systemPrompt = buildSystemPrompt({
          direction,
          fromNumber,
          callerName,
          isOwner: isOwnerCall,
          context,
          meowstikNumber,
        });

        // Owner calls get extra tools (make_outbound_call)
        const tools = isOwnerCall ? OWNER_TOOLS : BASE_TOOLS;

        const result = await geminiLive.createLiveSession(sessionId, {
          systemInstruction: systemPrompt,
          voiceName: "Aoede",
          language: "en-US",
          tools,
        });

        if (result.success) {
          isSessionActive = true;
          startGeminiResponseStream();
        } else {
          console.error("[Twilio WS] Failed to create Gemini session:", result.error);
          ws.close();
        }
      } else if (msg.event === "media" && msg.media?.track === "inbound") {
        if (isSessionActive && msg.media.payload) {
          const mulawChunk = Buffer.from(msg.media.payload, "base64");
          const pcm8k = decodeMuLaw(mulawChunk);
          const pcm16k = resample8kTo16k(pcm8k);
          await geminiLive.sendAudio(sessionId, pcm16k.toString("base64"), "audio/pcm");
        }
      } else if (msg.event === "stop") {
        console.log(`[Twilio WS] Stream stopped: ${streamSid}`);
        isSessionActive = false;
        geminiLive.closeLiveSession(sessionId).catch(() => {});
      }
    } catch (error) {
      console.error("[Twilio WS] Message error:", error);
    }
  });

  ws.on("close", () => {
    console.log("[Twilio WS] WebSocket closed");
    isSessionActive = false;
    geminiLive.closeLiveSession(sessionId).catch(() => {});
  });

  ws.on("error", (err) => {
    console.error("[Twilio WS] WebSocket error:", err);
  });
}

// ── Function Call Execution ───────────────────────────────────────────────────

async function handleFunctionCall(
  sessionId: string,
  callSid: string | null,
  isOwnerCall: boolean,
  name: string,
  args: Record<string, unknown>
): Promise<void> {
  console.log(`[Twilio WS] Tool call: ${name}`, JSON.stringify(args).slice(0, 120));

  let result: Record<string, unknown> = { success: false };

  try {
    switch (name) {
      case "notify_owner": {
        const message = String(args.message ?? "");
        const ownerPhone = process.env.OWNER_PHONE_NUMBER;
        if (!ownerPhone) {
          result = { success: false, error: "OWNER_PHONE_NUMBER not configured" };
          break;
        }
        if (!message) {
          result = { success: false, error: "No message provided" };
          break;
        }
        const { sendSMS } = await import("./integrations/twilio.js");
        await sendSMS(ownerPhone, `[Meowstik] ${message}`);
        console.log(`[Twilio WS] Owner notified: ${message.slice(0, 80)}`);
        result = { success: true };
        break;
      }

      case "make_outbound_call": {
        if (!isOwnerCall) {
          result = { success: false, error: "Only the owner can request outbound calls" };
          break;
        }

        const contactName = String(args.contact_name ?? "");
        const providedPhone = String(args.phone_number ?? "").trim();
        const mission = String(args.mission ?? "");

        if (!mission) {
          result = { success: false, error: "No mission provided for the call" };
          break;
        }

        // Resolve phone number
        let targetPhone = providedPhone;
        let resolvedName = contactName;

        if (!targetPhone) {
          const contact = await lookupContactPhone(contactName);
          if (contact) {
            targetPhone = contact.phone;
            resolvedName = contact.name;
          }
        }

        if (!targetPhone) {
          result = {
            success: false,
            error: `Could not find a phone number for "${contactName}". Ask Jason for the number.`,
          };
          break;
        }

        // Normalize to E.164
        const digits = targetPhone.replace(/\D/g, "");
        if (!targetPhone.startsWith("+")) {
          targetPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
        }

        // Build the full mission context for the outbound Gemini session
        const fullMission =
          `Call from ${OWNER_NAME}'s AI assistant Meowstik.\n` +
          `Calling: ${resolvedName} (${targetPhone})\n\n` +
          `MISSION:\n${mission}`;

        // Initiate the outbound call
        const baseUrl =
          process.env.BASE_URL ??
          `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
        const contextParam = encodeURIComponent(fullMission);
        const voiceUrl = `${baseUrl}/api/twilio/voice?direction=outbound&context=${contextParam}`;

        const { makeCall } = await import("./integrations/twilio.js");
        const call = await makeCall(targetPhone, voiceUrl);

        console.log(
          `[Twilio WS] Outbound call initiated to ${resolvedName} (${targetPhone}): ${call.sid}`
        );

        result = {
          success: true,
          callSid: call.sid,
          contact: resolvedName,
          phone: targetPhone,
          message: `Calling ${resolvedName} now. I'll text you the result when we're done.`,
        };
        break;
      }

      case "end_call": {
        console.log(`[Twilio WS] end_call: ${args.reason}`);
        // Twilio will hang up naturally when the stream closes / TwiML completes
        result = { success: true, action: "call_will_end" };
        break;
      }

      default:
        result = { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    console.error(`[Twilio WS] Tool execution error (${name}):`, err);
    result = { success: false, error: err.message ?? "Execution failed" };
  }

  // Return result to Gemini so it can continue the conversation
  await geminiLive.sendFunctionResult(sessionId, name, result);
}



