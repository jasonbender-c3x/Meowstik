import { Router } from "express";
import twilio from "twilio";
import { log } from "../vite.js";

/**
 * [💭 Analysis]
 * Twilio Integration - ESM Compliant.
 * We use the standard accessor to avoid CJS deep-link resolution errors.
 */
const { VoiceResponse } = twilio.twiml;

export const twilioRouter = Router();

twilioRouter.post("/voice", (req, res) => {
  const response = new VoiceResponse();
  const host = req.headers.host;

  log(`📞 [Twilio] Incoming call from: ${req.body.From}`);

  const connect = response.connect();
  connect.stream({
    url: `wss://${host}/ws/twilio`,
    name: "Meowstik_Live_Voice"
  });

  // Keep the stream alive
  response.pause({ length: 30 });

  res.type("text/xml");
  res.send(response.toString());
});

twilioRouter.post("/status", (req, res) => {
  log(`📞 [Twilio] Call Status Update: ${req.body.CallStatus}`);
  res.sendStatus(200);
});

twilioRouter.post("/sms", (req, res) => {
  const { From, Body } = req.body;
  log(`💬 [Twilio] SMS from ${From}: ${Body}`);
  res.type("text/xml");
  res.send("<Response></Response>");
});

export default twilioRouter;