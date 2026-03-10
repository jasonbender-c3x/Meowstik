import { Router } from "express";
import driveRouter from "./drive";
import gmailRouter from "./gmail";
import calendarRouter from "./calendar";
import docsRouter from "./docs";
import sheetsRouter from "./sheets";
import tasksRouter from "./tasks";
import speechRouter from "./speech";
import authRouter from "./auth";
import terminalRouter from "./terminal";
import musicRouter from "./music";
import imageRouter from "./image";
import pythonRouter from "./python";
import playwrightRouter from "./playwright";
// import webScraperRouter from "./web-scraper";
import knowledgeIngestionRouter from "./knowledge-ingestion";
import statusRouter from "./status";
import feedbackRouter from "./feedback";
import evolutionRouter from "./evolution";
import queueRouter from "./queue";
import orchestrationRouter from "./orchestration";
import extensionRouter from "./extension";
import agentRouter from "./agent";
import agentsRouter from "./agents";
import liveRouter from "./live";
import desktopRouter from "./desktop";
import computerUseRouter from "./computer-use";
import collabRouter from "./collab";
import jobsRouter from "./jobs";
import { twilioRouter } from "./twilio";
import communicationsRouter from "./communications";
import ragDebugRouter from "./rag-debug";
import orchestratorRouter from "./orchestrator";
import databaseAdminRouter from "./database-admin";
import brandingRouter from "./branding";
import userAgentsRouter from "./user-agents";
import hardwareRouter from "./hardware";
import todoRouter from "./todo";
import { errorHandler } from "./middleware";

export function createApiRouter(): Router {
  const router = Router();

  router.use("/auth", authRouter);
  router.use("/drive", driveRouter);
  router.use("/gmail", gmailRouter);
  router.use("/calendar", calendarRouter);
  router.use("/docs", docsRouter);
  router.use("/sheets", sheetsRouter);
  router.use("/tasks", tasksRouter);
  router.use("/speech", speechRouter);
  router.use("/tts", speechRouter); // Alias for compatibility with Voice Lab
  router.use("/terminal", terminalRouter);
  router.use("/music", musicRouter);
  router.use("/image", imageRouter);
  router.use("/python", pythonRouter);
  router.use("/playwright", playwrightRouter);
  // router.use("/web", webScraperRouter);
  router.use("/knowledge", knowledgeIngestionRouter);
  router.use("/status", statusRouter);
  router.use("/feedback", feedbackRouter);
  router.use("/evolution", evolutionRouter);
  router.use("/queue", queueRouter);
  router.use("/orchestration", orchestrationRouter);
  router.use("/extension", extensionRouter);
  router.use("/agent", agentRouter);
  router.use("/agents", agentsRouter);
  router.use("/live", liveRouter);
  router.use("/desktop", desktopRouter);
  router.use("/computer-use", computerUseRouter);
  router.use("/collab", collabRouter);
  router.use("/jobs", jobsRouter);
  router.use("/twilio", twilioRouter);
  router.use("/communications", communicationsRouter);
  router.use("/debug/rag", ragDebugRouter);
  router.use("/orchestrator", orchestratorRouter);
  router.use("/database", databaseAdminRouter);
  router.use("/branding", brandingRouter);
  router.use("/user-agents", userAgentsRouter);
  router.use("/hardware", hardwareRouter);
  router.use("/todos", todoRouter);

  router.use(errorHandler);

  return router;
}

export { errorHandler };
