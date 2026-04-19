/**
 * Agentic Loop Service
 *
 * Drives the multi-turn Gemini function-calling loop that underpins every chat
 * request.  The loop calls Gemini, executes all returned tool calls via
 * toolDispatcher, feeds results back, and repeats until:
 *   • the model calls `end_turn` / `end_chat`
 *   • maxIterations is reached  (signals `agenticPaused` to the client)
 *   • maxTotalTools is reached
 *   • the model returns a plain-text response (treated as implicit end_turn)
 *
 * Callers are responsible for:
 *   - Saving user + AI messages to storage
 *   - Building conversation history and userParts
 *   - Composing the system prompt
 *   - Setting SSE headers
 *   - Starting the pre-response filler
 *   - Sending the final `done` SSE event
 */

import type { Response } from "express";
import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  type FunctionCall,
  type Content,
  type Part,
} from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";
import { toolDispatcher } from "./tool-dispatcher";
import { stripAllVoiceTags, parseVoiceStyle } from "./style-parser";
import { withRetryOn503 } from "../utils/retry";
import type { ToolCall } from "@shared/schema";
import type { TtsPipeline } from "./tts-pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolResult {
  toolId: string;
  type: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface AgenticLoopConfig {
  genAI: GoogleGenAI;
  modelMode: string;
  toolDeclarations: FunctionDeclaration[];
  systemPrompt: string;
  /** Conversation history up to (but not including) the current user message */
  history: Content[];
  /** Parts for the current user message (text + inline images) */
  userParts: Part[];
  messageId: string;
  chatId: string;
  maxIterations: number;
  maxToolsPerTurn: number;
  maxTotalTools: number;
  abortSignal: AbortSignal;
  res: Response;
  useVoice: boolean;
  ttsPipeline: TtsPipeline;
  /** Called the first time any text is written to the SSE stream */
  onAssistantOutputStarted: () => void;
}

export interface AgenticLoopResult {
  fullResponse: string;
  cleanContentForStorage: string;
  toolResults: ToolResult[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  /** All function calls collected across every turn, for debug logging */
  allFunctionCalls: FunctionCall[];
  /** Whether the loop was paused at maxIterations (rather than ended cleanly) */
  pausedAtLimit: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Sanitise large binary/content fields before sending tool results back to LLM */
function sanitiseResultForContext(result: unknown): unknown {
  if (typeof result !== "object" || result === null) return result;

  const obj = result as Record<string, unknown>;
  const sanitised = { ...obj };

  if ("audioBase64" in sanitised) sanitised.audioBase64 = "[audio generated]";
  if ("base64" in sanitised) sanitised.base64 = "[binary data]";
  if (
    "screenshot" in sanitised &&
    typeof sanitised.screenshot === "string" &&
    sanitised.screenshot.length > 100
  ) {
    sanitised.screenshot = "[screenshot captured]";
  }

  const shouldTruncate = !(sanitised.noTruncate === true);
  if (
    "content" in sanitised &&
    typeof sanitised.content === "string" &&
    shouldTruncate &&
    sanitised.content.length > 2000
  ) {
    sanitised.content = sanitised.content.substring(0, 2000) + "... [truncated]";
  }

  return sanitised;
}

const TOOL_FAILURE_GUIDANCE =
  "\n\nThis tool call failed. Consider: taking a different approach, " +
  "diagnosing the error and retrying, or informing the creator — all valid.";

function formatToolResultForLLM(r: ToolResult): string {
  if (r.success) {
    const sanitised = sanitiseResultForContext(r.result);
    const summary = JSON.stringify(sanitised);
    const hasNoTruncate =
      typeof r.result === "object" &&
      r.result !== null &&
      (r.result as Record<string, unknown>).noTruncate === true;
    const limited =
      hasNoTruncate || summary.length <= 500
        ? summary
        : summary.substring(0, 500) + "...";
    return `• ${r.type}: ${limited}`;
  }
  const errText =
    r.error && r.error.length > 1000
      ? r.error.substring(0, 1000) + "... [truncated]"
      : r.error;
  return `• ${r.type}: ERROR: ${errText}${TOOL_FAILURE_GUIDANCE}`;
}

function sseWrite(res: Response, data: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core loop
// ─────────────────────────────────────────────────────────────────────────────

export async function runAgenticLoop(config: AgenticLoopConfig): Promise<AgenticLoopResult> {
  const {
    genAI,
    modelMode,
    toolDeclarations,
    systemPrompt,
    history,
    userParts,
    messageId,
    chatId,
    maxIterations,
    maxToolsPerTurn,
    maxTotalTools,
    abortSignal,
    res,
    useVoice,
    ttsPipeline,
    onAssistantOutputStarted,
  } = config;

  let fullResponse = "";
  let cleanContentForStorage = "";
  const toolResults: ToolResult[] = [];
  const allFunctionCalls: FunctionCall[] = [];
  const usageMetadata = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

  let assistantStarted = false;
  const markStarted = () => {
    if (assistantStarted) return;
    assistantStarted = true;
    onAssistantOutputStarted();
  };

  // toolDispatcher.setSseResponse is global mutable state; clear it in finally
  toolDispatcher.setSseResponse(res);

  try {
    // ───────────────────────────────────────────────────
    // INITIAL GEMINI CALL
    // ───────────────────────────────────────────────────

    const initialResult = await withRetryOn503(
      () =>
        genAI.models.generateContentStream({
          model: modelMode,
          config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: toolDeclarations }],
            toolConfig: {
              functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
            },
          },
          contents: [...history, { role: "user", parts: userParts }],
        }),
      abortSignal,
    );

    // Collect initial stream
    const collectedFunctionCalls: FunctionCall[] = [];
    let initialTurnUsage: typeof usageMetadata | undefined;

    for await (const chunk of initialResult) {
      // Thinking content (Gemini 2.x flash thinking)
      if (chunk.candidates?.[0]?.content?.parts) {
        for (const part of chunk.candidates[0].content.parts) {
          // @ts-ignore — 'thought' not yet in type definitions
          if (part.thought) {
            const thoughtChunk = `<thinking>${part.thought}</thinking>\n\n`;
            fullResponse += thoughtChunk;
            cleanContentForStorage += thoughtChunk;
            markStarted();
            sseWrite(res, { text: thoughtChunk });
          }
        }
      }

      const text = chunk.text || "";
      if (text) {
        fullResponse += text;
        cleanContentForStorage += text;
        markStarted();
        sseWrite(res, { text });
      }

      if (chunk.functionCalls?.length) {
        collectedFunctionCalls.push(...chunk.functionCalls);
        console.log(`[AgenticLoop] Initial turn: ${chunk.functionCalls.length} function call(s)`);
      }

      if (chunk.usageMetadata) {
        initialTurnUsage = chunk.usageMetadata as any;
      }
    }

    if (initialTurnUsage) {
      usageMetadata.promptTokenCount += initialTurnUsage.promptTokenCount || 0;
      usageMetadata.candidatesTokenCount += initialTurnUsage.candidatesTokenCount || 0;
      usageMetadata.totalTokenCount += initialTurnUsage.totalTokenCount || 0;
    }

    allFunctionCalls.push(...collectedFunctionCalls);

    // No function calls — model responded with text only; treat as done
    if (collectedFunctionCalls.length === 0) {
      console.log("[AgenticLoop] No function calls in initial response");
      return {
        fullResponse,
        cleanContentForStorage,
        toolResults,
        usageMetadata,
        allFunctionCalls,
        pausedAtLimit: false,
      };
    }

    // ───────────────────────────────────────────────────
    // TOOL EXECUTION HELPER
    // ───────────────────────────────────────────────────

    const executeTools = async (
      toolCalls: ToolCall[],
    ): Promise<{ results: ToolResult[]; shouldEndTurn: boolean; sendChatContent: string }> => {
      const results: ToolResult[] = [];
      let endTurn = false;
      let sendChatContent = "";

      for (const toolCall of toolCalls) {
        console.log(`[AgenticLoop] Executing: ${toolCall.type} (${toolCall.id})`);
        try {
          const toolResult = await toolDispatcher.executeToolCall(toolCall, messageId, chatId);
          results.push({
            toolId: toolResult.toolId,
            type: toolResult.type,
            success: toolResult.success,
            result: toolResult.result,
            error: toolResult.error,
          });

          sseWrite(res, {
            toolResult: {
              id: toolCall.id,
              type: toolCall.type,
              success: toolResult.success,
              result: toolResult.result,
              error: toolResult.error,
            },
          });

          // send_chat / write — stream content to client and accumulate
          if (
            (toolCall.type === "send_chat" || toolCall.type === "write") &&
            toolResult.success
          ) {
            const content = (toolResult.result as { content?: string })?.content;
            if (content) {
              const cleanContent = stripAllVoiceTags(content);
              markStarted();
              sseWrite(res, { text: cleanContent });
              sendChatContent += cleanContent;
              ttsPipeline.queueStreamingTTSFromText(cleanContent);
            }
          }

          // end_turn / end_chat
          if (
            (toolCall.type === "end_turn" || toolCall.type === "end_chat") &&
            toolResult.success
          ) {
            const r = toolResult.result as { shouldEndTurn?: boolean };
            if (r?.shouldEndTurn) endTurn = true;
          }

          // say — generate TTS and show text in chat
          if (toolCall.type === "say" && toolResult.success) {
            const { utterance, voice } = toolCall.parameters as {
              utterance: string;
              voice?: string;
            };
            const { cleanText: cleanUtterance } = parseVoiceStyle(utterance || "");

            if (cleanUtterance.trim()) {
              markStarted();
              sseWrite(res, { text: cleanUtterance });
              sendChatContent += cleanUtterance + "\n\n";

              if (useVoice) {
                try {
                  const ttsResult = await ttsPipeline.generateSpeechAudio(utterance, voice);
                  if (ttsResult.audioBase64) {
                    console.log(`[AgenticLoop][SAY] ✓ Audio generated`);
                    sseWrite(res, {
                      speech: {
                        utterance: cleanUtterance,
                        audioGenerated: true,
                        audioBase64: ttsResult.audioBase64,
                        mimeType: ttsResult.mimeType || "audio/mpeg",
                        duration: ttsResult.duration,
                      },
                    });
                  } else {
                    ttsPipeline.writeSpeechEvent({ utterance: cleanUtterance, audioGenerated: false });
                  }
                } catch (ttsErr) {
                  console.error(`[AgenticLoop][SAY] TTS failed:`, ttsErr);
                  ttsPipeline.writeSpeechEvent({ utterance: cleanUtterance, audioGenerated: false });
                }
              }
            }
          }

          // soundboard
          if (toolCall.type === "soundboard" && toolResult.success) {
            const { sound, volume } = toolResult as { sound: string; volume: number };
            if (sound) {
              console.log(`[AgenticLoop][SOUNDBOARD] Playing: ${sound} @ vol ${volume}`);
              sseWrite(res, { soundboard: { sound, volume } });
            }
          }

          // open_url
          if (toolCall.type === "open_url" && toolResult.success) {
            const openUrlResult = toolResult.result as { url?: string };
            if (openUrlResult?.url) {
              console.log(`[AgenticLoop][OPEN_URL] Opening: ${openUrlResult.url}`);
              sseWrite(res, { openUrl: { url: openUrlResult.url } });
            }
          }
        } catch (err: any) {
          console.error(`[AgenticLoop] Tool execution error (${toolCall.type}):`, err);
          results.push({ toolId: toolCall.id, type: toolCall.type, success: false, error: err.message });
          sseWrite(res, {
            toolResult: { id: toolCall.id, type: toolCall.type, success: false, error: err.message },
          });
        }
      }

      return { results, shouldEndTurn: endTurn, sendChatContent };
    };

    // ───────────────────────────────────────────────────
    // INITIAL TOOL EXECUTION
    // ───────────────────────────────────────────────────

    const toToolCalls = (fcs: FunctionCall[], prefix: string): ToolCall[] =>
      fcs.map((fc, i) => ({
        id: `${prefix}_${i}_${Date.now()}`,
        type: fc.name as ToolCall["type"],
        operation: fc.name || "execute",
        parameters: (fc.args as Record<string, unknown>) || {},
        priority: 0,
      }));

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[LLM] Turn 0 — ${collectedFunctionCalls.length} function calls`);
    console.log(`${"─".repeat(60)}`);
    for (const fc of collectedFunctionCalls) {
      console.log(`  • ${fc.name}: ${JSON.stringify(fc.args).substring(0, 100)}`);
    }
    console.log(`${"=".repeat(60)}\n`);

    const limitedInitial = collectedFunctionCalls.slice(0, maxToolsPerTurn);
    if (collectedFunctionCalls.length > maxToolsPerTurn) {
      console.warn(
        `[AgenticLoop] Limiting initial ${collectedFunctionCalls.length} calls to ${maxToolsPerTurn}`,
      );
    }

    const initialExec = await executeTools(toToolCalls(limitedInitial, "fc"));
    toolResults.push(...initialExec.results);
    let totalToolsExecuted = limitedInitial.length;
    let shouldEndTurn = initialExec.shouldEndTurn;
    if (initialExec.sendChatContent) cleanContentForStorage += initialExec.sendChatContent;

    // Agentic history: grow each turn with model function-call parts + user result parts
    let agenticHistory: Content[] = [
      ...history,
      { role: "user", parts: userParts },
      { role: "model", parts: collectedFunctionCalls.map((fc) => ({ functionCall: fc })) as any },
    ];

    let currentFunctionCalls = collectedFunctionCalls;
    let currentToolResults = initialExec.results;
    let loopIteration = 0;
    let pausedAtLimit = false;

    // ───────────────────────────────────────────────────
    // MULTI-TURN LOOP
    // ───────────────────────────────────────────────────

    while (
      !shouldEndTurn &&
      loopIteration < maxIterations &&
      totalToolsExecuted < maxTotalTools
    ) {
      loopIteration++;
      console.log(`\n${"═".repeat(60)}`);
      console.log(`[AgenticLoop] Turn ${loopIteration} — feeding tool results back`);
      console.log(`${"═".repeat(60)}\n`);

      // Build compact tool-result summary for the model
      const toolResultsText = currentToolResults
        .slice(-currentFunctionCalls.length)
        .map(formatToolResultForLLM)
        .join("\n");

      agenticHistory.push({
        role: "user",
        parts: [
          {
            text: `Tool results:\n${toolResultsText}\n\nContinue with more tools or call end_turn when ready.`,
          },
        ],
      });

      const loopStream = await withRetryOn503(
        () =>
          genAI.models.generateContentStream({
            model: modelMode,
            config: {
              systemInstruction: systemPrompt,
              tools: [{ functionDeclarations: toolDeclarations }],
              toolConfig: {
                functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
              },
            },
            contents: agenticHistory,
          }),
        abortSignal,
      );

      let loopResponse = "";
      const loopFunctionCalls: FunctionCall[] = [];
      let loopTurnUsage: typeof usageMetadata | undefined;

      for await (const chunk of loopStream) {
        const text = chunk.text || "";
        if (text) loopResponse += text;
        if (chunk.functionCalls?.length) loopFunctionCalls.push(...chunk.functionCalls);
        if (chunk.usageMetadata) loopTurnUsage = chunk.usageMetadata as any;
      }

      if (loopTurnUsage) {
        usageMetadata.promptTokenCount += loopTurnUsage.promptTokenCount || 0;
        usageMetadata.candidatesTokenCount += loopTurnUsage.candidatesTokenCount || 0;
        usageMetadata.totalTokenCount += loopTurnUsage.totalTokenCount || 0;
      }

      fullResponse += `\n\n[Turn ${loopIteration}]\n${loopResponse}`;
      allFunctionCalls.push(...loopFunctionCalls);

      if (loopFunctionCalls.length === 0) {
        // Plain text response — implicit end_turn
        console.log(`[AgenticLoop] Turn ${loopIteration} — no function calls, implicit end_turn`);
        const plainText = stripAllVoiceTags(loopResponse.trim());
        if (plainText) {
          markStarted();
          sseWrite(res, { text: plainText });
        }
        break;
      }

      console.log(`[AgenticLoop] Turn ${loopIteration} — ${loopFunctionCalls.length} function calls`);
      for (const fc of loopFunctionCalls) {
        console.log(`  • ${fc.name}: ${JSON.stringify(fc.args).substring(0, 80)}`);
      }

      const limitedLoop = loopFunctionCalls.slice(0, maxToolsPerTurn);
      if (loopFunctionCalls.length > maxToolsPerTurn) {
        console.warn(
          `[AgenticLoop] Turn ${loopIteration}: limiting ${loopFunctionCalls.length} calls to ${maxToolsPerTurn}`,
        );
      }

      const loopExec = await executeTools(toToolCalls(limitedLoop, `fc_loop${loopIteration}`));
      toolResults.push(...loopExec.results);
      totalToolsExecuted += limitedLoop.length;
      shouldEndTurn = loopExec.shouldEndTurn;
      if (loopExec.sendChatContent) cleanContentForStorage += loopExec.sendChatContent;

      agenticHistory.push({
        role: "model",
        parts: loopFunctionCalls.map((fc) => ({ functionCall: fc })) as any,
      });

      currentFunctionCalls = loopFunctionCalls;
      currentToolResults = loopExec.results;
    }

    // Signal pause if we exited because of limits
    if (!shouldEndTurn) {
      if (loopIteration >= maxIterations) {
        console.warn(`[AgenticLoop] Reached max iterations (${maxIterations}), pausing`);
        sseWrite(res, { agenticPaused: { turns: loopIteration } });
        pausedAtLimit = true;
      } else if (totalToolsExecuted >= maxTotalTools) {
        console.warn(`[AgenticLoop] Reached max total tools (${maxTotalTools}), terminating`);
        markStarted();
        sseWrite(res, { text: "[Tool execution limit reached — response truncated]" });
      }
    }

    return {
      fullResponse,
      cleanContentForStorage,
      toolResults,
      usageMetadata,
      allFunctionCalls,
      pausedAtLimit,
    };
  } finally {
    // Always clear the global SSE reference to prevent cross-request contamination
    toolDispatcher.setSseResponse(null);
  }
}
