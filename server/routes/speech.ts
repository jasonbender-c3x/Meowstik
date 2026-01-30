import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";

const router = Router();

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const { speechService } = await import("../services/speech");
    res.json(speechService.getServiceStatus());
  })
);

router.post(
  "/transcribe",
  asyncHandler(async (req, res) => {
    const { speechService } = await import("../services/speech");
    const { audioBase64, mimeType, language } = req.body;
    if (!audioBase64 || !mimeType) {
      throw badRequest("audioBase64 and mimeType are required");
    }
    const result = await speechService.transcribe({
      audioBase64,
      mimeType,
      language,
    });
    res.json(result);
  })
);

router.post(
  "/tts",
  asyncHandler(async (req, res) => {
    const { text, speakers, model, provider } = req.body;
    
    if (!text) {
      throw badRequest("text is required");
    }
    
    if (!speakers || !Array.isArray(speakers) || speakers.length === 0) {
      throw badRequest("speakers array is required");
    }
    
    // Determine TTS provider (from request or environment)
    const ttsProvider = provider || process.env.TTS_PROVIDER || "google";
    
    let result;
    if (ttsProvider === "elevenlabs" || ttsProvider === "11labs") {
      const { generateMultiSpeakerAudio } = await import("../integrations/elevenlabs-tts");
      result = await generateMultiSpeakerAudio({ speakers });
    } else {
      const { generateMultiSpeakerAudio } = await import("../integrations/expressive-tts");
      result = await generateMultiSpeakerAudio({
        text,
        speakers,
        model: model || "flash"
      });
    }
    
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    
    res.json(result);
  })
);

router.get(
  "/voices",
  asyncHandler(async (req, res) => {
    const provider = req.query.provider as string || process.env.TTS_PROVIDER || "google";
    
    let voices;
    if (provider === "elevenlabs" || provider === "11labs") {
      const { getAvailableVoices } = await import("../integrations/elevenlabs-tts");
      voices = getAvailableVoices();
    } else {
      const { getAvailableVoices } = await import("../integrations/expressive-tts");
      voices = getAvailableVoices();
    }
    
    res.json({ voices, provider });
  })
);

export default router;
