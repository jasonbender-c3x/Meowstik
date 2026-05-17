import { Router } from "express";
import { z } from "zod";
import { copilotService } from "../services/copilot-service";
import { asyncHandler, notFound } from "./middleware";

const router = Router();

const createSessionSchema = z.object({
  sessionId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  streaming: z.boolean().optional(),
  instructions: z.string().min(1).optional(),
});

const sendMessageSchema = z.object({
  prompt: z.string().min(1),
  attachments: z.array(z.object({
    type: z.literal("file"),
    path: z.string().min(1),
    displayName: z.string().optional(),
  })).optional(),
  mode: z.enum(["enqueue", "immediate"]).optional(),
  timeoutMs: z.number().int().positive().max(300_000).optional(),
});

function isUnknownSessionError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("Unknown Copilot session:");
}

router.get("/sessions", (_req, res) => {
  res.json({ sessions: copilotService.listActiveSessions() });
});

router.post("/sessions", asyncHandler(async (req, res) => {
  const body = createSessionSchema.parse(req.body ?? {});
  const session = await copilotService.createSession({
    sessionId: body.sessionId,
    model: body.model,
    streaming: body.streaming ?? false,
    instructions: body.instructions,
  });

  res.status(201).json({ session });
}));

router.get("/sessions/:id", asyncHandler(async (req, res) => {
  try {
    res.json({ session: copilotService.getActiveSession(req.params.id) });
  } catch (error) {
    if (isUnknownSessionError(error)) {
      throw notFound(error.message);
    }
    throw error;
  }
}));

router.get("/sessions/:id/messages", asyncHandler(async (req, res) => {
  try {
    const session = copilotService.getActiveSession(req.params.id);
    const messages = await copilotService.getMessages(req.params.id);
    res.json({ session, messages });
  } catch (error) {
    if (isUnknownSessionError(error)) {
      throw notFound(error.message);
    }
    throw error;
  }
}));

router.post("/sessions/:id/messages", asyncHandler(async (req, res) => {
  const body = sendMessageSchema.parse(req.body ?? {});

  try {
    const result = await copilotService.sendMessage(req.params.id, {
      prompt: body.prompt,
      attachments: body.attachments,
      mode: body.mode,
      timeoutMs: body.timeoutMs,
    });

    res.json({
      ...result,
      session: copilotService.getActiveSession(req.params.id),
    });
  } catch (error) {
    if (isUnknownSessionError(error)) {
      throw notFound(error.message);
    }
    throw error;
  }
}));

router.delete("/sessions/:id", asyncHandler(async (req, res) => {
  try {
    await copilotService.disconnectSession(req.params.id);
    res.status(204).end();
  } catch (error) {
    if (isUnknownSessionError(error)) {
      throw notFound(error.message);
    }
    throw error;
  }
}));

export default router;
