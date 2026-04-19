/**
 * =============================================================================
 * SCHEDULED CHAT RUNNER
 * =============================================================================
 *
 * Injects scheduled prompts into a persistent "⏰ Meowstik Reminders" chat
 * and runs a full agentic tool loop — so reminder responses can spawn todos,
 * create tasks, trigger jobs, and take real actions.
 *
 * Flow:
 *   Cron fires → buildPrompt → find/create Reminders chat
 *             → store user message → Gemini (with tools) → execute tool calls
 *             → feed results back → repeat until done → store final AI reply
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import type { FunctionCall } from "@google/genai";
import { storage } from "../storage.js";
import { toolDispatcher } from "./tool-dispatcher.js";
import { geminiFunctionDeclarations } from "../gemini-tools.js";
import type { Schedule, Trigger, ToolCall } from "@shared/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REMINDERS_CHAT_TITLE = "⏰ Meowstik Reminders";
const MAX_LOOP_ITERATIONS = Number(process.env.MAX_AGENTIC_TURNS) || 10;

// ── Gemini client (lazy init) ────────────────────────────────────────────────
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

// ── System prompt (loaded once) ──────────────────────────────────────────────
let _systemPrompt: string | null = null;
async function getSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  try {
    const p = path.join(__dirname, "../../prompts/core-directives.md");
    _systemPrompt = await fs.readFile(p, "utf8");
  } catch {
    _systemPrompt = "You are Meowstik, an AI assistant. Be concise and helpful.";
  }
  return _systemPrompt;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Find the reminders chat for userId, or create it. */
async function getOrCreateRemindersChat(userId: string): Promise<string> {
  const existing = await storage.getChats(userId);
  const found = existing.find(c => c.title === REMINDERS_CHAT_TITLE);
  if (found) return found.id;

  const chat = await storage.createChat({
    userId,
    title: REMINDERS_CHAT_TITLE,
    isGuest: false,
  });
  return chat.id;
}

/** Interpolate {{name}}, {{description}}, {{timestamp}} in a template string. */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

/** Convert a Gemini FunctionCall to our internal ToolCall shape. */
function toToolCall(fc: FunctionCall, index: number, prefix = "sc"): ToolCall {
  return {
    id: `${prefix}_${index}_${Date.now()}`,
    type: fc.name as ToolCall["type"],
    operation: fc.name || "execute",
    parameters: (fc.args as Record<string, unknown>) ?? {},
    priority: 0,
  };
}

/**
 * Run a mini agentic loop against Gemini (non-streaming).
 * Executes tool calls, feeds results back, repeats until text-only reply or limit.
 * Returns the accumulated text for storage in the chat.
 */
async function runAgenticLoop(userPrompt: string, chatId: string, messageId: string): Promise<string> {
  const ai = getAI();
  const systemPrompt = await getSystemPrompt();
  const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";

  type Part = { text?: string; functionCall?: FunctionCall };
  type Content = { role: string; parts: Part[] };

  const history: Content[] = [
    { role: "user", parts: [{ text: userPrompt }] },
  ];

  let accumulatedText = "";
  let iteration = 0;
  let pausedAtLimit = false;

  while (iteration < MAX_LOOP_ITERATIONS) {
    const response = await ai.models.generateContent({
      model,
      contents: history as any,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: geminiFunctionDeclarations }],
      },
    });

    const responseText = response.text ?? "";
    const functionCalls: FunctionCall[] = (response as any).functionCalls ?? [];

    if (functionCalls.length === 0) {
      // No tool calls — we're done
      accumulatedText += (accumulatedText ? "\n\n" : "") + responseText;
      break;
    }

    // Accumulate any text from this turn
    if (responseText) accumulatedText += (accumulatedText ? "\n\n" : "") + responseText;

    // Add model turn to history (with function call parts)
    history.push({
      role: "model",
      parts: functionCalls.map(fc => ({ functionCall: fc })),
    });

    // Execute each tool call
    const toolCalls = functionCalls.map((fc, i) => toToolCall(fc, i, `sc${iteration}`));
    const results: string[] = [];

    for (const toolCall of toolCalls) {
      console.log(`[ScheduledChat] Tool call: ${toolCall.type} ${JSON.stringify(toolCall.parameters).substring(0, 80)}`);

      if (toolCall.type === "end_turn") {
        // Model is done
        history.push({ role: "user", parts: [{ text: "Tool results:\n• end_turn: done" }] });
        iteration = MAX_LOOP_ITERATIONS; // break outer loop
        break;
      }

      try {
        const result = await toolDispatcher.executeToolCall(toolCall, messageId, chatId);
        const summary = result.success
          ? JSON.stringify(result.result).substring(0, 400)
          : `ERROR: ${result.error}`;
        results.push(`• ${toolCall.type}: ${summary}`);
      } catch (err) {
        results.push(`• ${toolCall.type}: ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (iteration >= MAX_LOOP_ITERATIONS) {
      pausedAtLimit = true;
      break;
    }

    // Feed tool results back to Gemini for next turn
    history.push({
      role: "user",
      parts: [{ text: `Tool results:\n${results.join("\n")}\n\nContinue with more tools or call end_turn when ready.` }],
    });

    iteration++;
  }

  if (pausedAtLimit) {
    accumulatedText += (accumulatedText ? "\n\n" : "") +
      `⏸️ Reached the ${MAX_LOOP_ITERATIONS}-turn tool limit. Open the Reminders chat and reply **"continue"** to resume, or **"stop"** to end here.`;
  }

  return accumulatedText || "(no response)";
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Inject a scheduled prompt into the Reminders chat and run an agentic loop.
 * Called by cron-scheduler when a schedule's taskTemplate has chatMode: true.
 */
export async function injectScheduledPrompt(
  name: string,
  description: string | null | undefined,
  promptTemplate: string,
  userId: string,
): Promise<void> {
  const timestamp = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const userPrompt = interpolate(promptTemplate, {
    name,
    description: description ?? "",
    timestamp,
  });

  const chatId = await getOrCreateRemindersChat(userId);

  // Store the trigger message and capture its ID (needed for tool_tasks.message_id)
  const userMsg = await storage.addMessage({
    chatId,
    role: "user",
    content: `[Scheduled: ${name}] ${userPrompt}`,
  });

  // Run full agentic loop (Gemini + tool execution)
  let aiText: string;
  try {
    aiText = await runAgenticLoop(userPrompt, chatId, userMsg.id);
  } catch (err) {
    aiText = `⚠️ Scheduled prompt failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Store AI reply
  await storage.addMessage({
    chatId,
    role: "ai",
    content: aiText,
  });

  console.log(`[ScheduledChat] Injected "${name}" into chat ${chatId}`);
}

/**
 * Fire a schedule in chat-injection mode.
 */
export async function runScheduleAsChatMessage(schedule: Schedule): Promise<void> {
  const template = schedule.taskTemplate as {
    prompt?: string;
    userId?: string;
  };

  let userId = template.userId;
  if (!userId) {
    const allUsers = await storage.getUsers();
    userId = allUsers[0]?.id;
  }
  if (!userId) {
    console.warn(`[ScheduledChat] No userId for schedule "${schedule.name}" — skipping`);
    return;
  }

  const promptTemplate =
    template.prompt ??
    "SCHEDULED CHECK-IN at {{timestamp}}: {{name}}. {{description}}";

  await injectScheduledPrompt(schedule.name, schedule.description, promptTemplate, userId);
}

/**
 * Fire a trigger in chat-injection mode.
 */
export async function runTriggerAsChatMessage(
  trigger: Trigger,
  context: Record<string, unknown>,
): Promise<void> {
  const template = trigger.taskTemplate as {
    prompt?: string;
    userId?: string;
  };

  let userId = template.userId;
  if (!userId) {
    const allUsers = await storage.getUsers();
    userId = allUsers[0]?.id;
  }
  if (!userId) {
    console.warn(`[ScheduledChat] No userId for trigger "${trigger.name}" — skipping`);
    return;
  }

  const contextStr = Object.entries(context)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const promptTemplate =
    template.prompt ??
    "TRIGGERED at {{timestamp}}: {{name}}. {{description}} Context: " + contextStr;

  await injectScheduledPrompt(trigger.name, trigger.description, promptTemplate, userId);
}

