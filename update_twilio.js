const fs = require('fs');

// 1. Update storage.ts
let storage = fs.readFileSync('server/storage.ts', 'utf8');
storage = storage.replace(
  /async getRecentCallConversations/,
  `async updateCallConversation(callSid: string, updates: Partial<CallConversation>): Promise<void> {
    await db.update(callConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(callConversations.callSid, callSid));
  }

  async getRecentCallConversations`
);
fs.writeFileSync('server/storage.ts', storage);

// 2. Update server/routes/communications.ts
let comms = fs.readFileSync('server/routes/communications.ts', 'utf8');
comms = comms.replace(
  /recordingUrl: null, \/\/ TODO: Add recording support/,
  'recordingUrl: call.recordingUrl,'
);
fs.writeFileSync('server/routes/communications.ts', comms);

// 3. Update server/integrations/twilio.ts
let twilioInt = fs.readFileSync('server/integrations/twilio.ts', 'utf8');
twilioInt = twilioInt.replace(
  /url: twimlUrl,\n\s+from: twilioPhoneNumber,\n\s+to,/g,
  `url: twimlUrl,
    from: twilioPhoneNumber,
    to,
    record: true,`
);
twilioInt = twilioInt.replace(
  /twiml,\n\s+from: twilioPhoneNumber,\n\s+to,/g,
  `twiml,
    from: twilioPhoneNumber,
    to,
    record: true,`
);
fs.writeFileSync('server/integrations/twilio.ts', twilioInt);

// 4. Update server/routes/twilio.ts
let twilioRoutes = fs.readFileSync('server/routes/twilio.ts', 'utf8');
twilioRoutes = twilioRoutes.replace(
  /twilioRouter\.post\("\/status", \(req, res\) => {[\s\S]*?res\.sendStatus\(200\);\n}\);/,
  `twilioRouter.post("/status", async (req, res) => {
  const { CallSid, CallStatus, CallDuration, RecordingUrl, RecordingSid, ErrorMessage } = req.body;
  log(\`📞 [Twilio] Call Status Update: \${CallStatus} (\${CallSid})\`);
  
  try {
    const { storage } = await import("../storage.js");
    
    const updates: any = { status: CallStatus };
    if (CallDuration) updates.duration = parseInt(CallDuration);
    if (RecordingUrl) updates.recordingUrl = RecordingUrl;
    if (RecordingSid) updates.recordingSid = RecordingSid;
    if (ErrorMessage) updates.errorMessage = ErrorMessage;
    if (CallStatus === "completed" || CallStatus === "failed" || CallStatus === "busy" || CallStatus === "no-answer" || CallStatus === "canceled") {
      updates.endedAt = new Date();
    }
    
    await storage.updateCallConversation(CallSid, updates);
  } catch (error) {
    console.error("[Twilio Webhook] Failed to update call status:", error);
  }
  
  res.sendStatus(200);
});

// Recording status webhook
twilioRouter.post("/recording", async (req, res) => {
  const { CallSid, RecordingUrl, RecordingSid, RecordingStatus } = req.body;
  log(\`📞 [Twilio] Recording Status: \${RecordingStatus} (\${CallSid})\`);
  
  if (RecordingStatus === "completed" && CallSid && RecordingUrl) {
    try {
      const { storage } = await import("../storage.js");
      await storage.updateCallConversation(CallSid, {
        recordingUrl: RecordingUrl,
        recordingSid: RecordingSid
      });
    } catch (error) {
      console.error("[Twilio Webhook] Failed to update recording:", error);
    }
  }
  
  res.sendStatus(200);
});`
);
fs.writeFileSync('server/routes/twilio.ts', twilioRoutes);
console.log("Updated Twilio integration for call recording and status updates.");
