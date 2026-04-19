/**
 * Unit tests for server/services/agentic-loop.ts
 *
 * Strategy:
 *  - Mock @google/genai, tool-dispatcher, style-parser, and retry utility
 *  - Create a minimal fake Express Response to capture SSE writes
 *  - Test the key observable behaviours of runAgenticLoop:
 *      1. Text-only response (no function calls) → returns immediately
 *      2. Function call → end_turn → exits cleanly
 *      3. Implicit end_turn via plain-text loop response
 *      4. maxIterations reached → agenticPaused SSE, pausedAtLimit: true
 *      5. finally always clears the global SSE reference
 *      6. Usage metadata is accumulated across turns
 *      7. Tool errors are captured and included in results
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── Module mocks (hoisted before imports) ───────────────────────────────────

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(),
  FunctionCallingConfigMode: { ANY: "ANY", AUTO: "AUTO" },
}));

vi.mock("../server/services/tool-dispatcher", () => ({
  toolDispatcher: {
    setSseResponse: vi.fn(),
    executeToolCall: vi.fn(),
  },
}));

vi.mock("../server/services/style-parser", () => ({
  stripAllVoiceTags: (s: string) => s,
  parseVoiceStyle: (s: string) => ({ style: "neutral", cleanText: s }),
}));

vi.mock("../server/utils/retry", () => ({
  withRetryOn503: (_fn: () => unknown, _signal: unknown) => _fn(),
}));

// ─── Actual imports (after mocks) ────────────────────────────────────────────

import { runAgenticLoop, type AgenticLoopConfig } from "../server/services/agentic-loop";
import { toolDispatcher } from "../server/services/tool-dispatcher";
import type { TtsPipeline } from "../server/services/tts-pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Fake Express Response that collects SSE writes */
function makeFakeRes() {
  const events: unknown[] = [];
  return {
    writableEnded: false,
    destroyed: false,
    write: vi.fn((data: string) => {
      const match = data.match(/^data: (.+)\n\n$/s);
      if (match) events.push(JSON.parse(match[1]));
    }),
    _events: events,
  } as unknown as import("express").Response & { _events: unknown[] };
}

/** Minimal no-op TtsPipeline */
function makeTtsPipeline(): TtsPipeline {
  return {
    writeSpeechEvent: vi.fn(),
    writeSpeechControlEvent: vi.fn(),
    generateSpeechAudio: vi.fn().mockResolvedValue({}),
    queueSentenceForTTS: vi.fn(),
    queueStreamingTTSFromText: vi.fn(),
    flushStreamingTTS: vi.fn(),
    speechEventsSent: 0,
  };
}

/** Create an async generator that yields the given chunks */
async function* makeStream(chunks: object[]) {
  for (const c of chunks) yield c;
}

/** Build a minimal valid AgenticLoopConfig */
function makeConfig(
  overrides: Partial<AgenticLoopConfig> & {
    genAIMock?: Mock;
  } = {},
): AgenticLoopConfig {
  const { genAIMock, ...rest } = overrides;

  const mockGenAI = {
    models: {
      generateContentStream: genAIMock ?? vi.fn().mockReturnValue(makeStream([])),
    },
  } as unknown as import("@google/genai").GoogleGenAI;

  return {
    genAI: mockGenAI,
    modelMode: "gemini-test",
    toolDeclarations: [],
    systemPrompt: "You are a test assistant.",
    history: [],
    userParts: [{ text: "Hello" }],
    messageId: "msg-1",
    chatId: "chat-1",
    maxIterations: 3,
    maxToolsPerTurn: 5,
    maxTotalTools: 20,
    abortSignal: new AbortController().signal,
    res: makeFakeRes(),
    useVoice: false,
    ttsPipeline: makeTtsPipeline(),
    onAssistantOutputStarted: vi.fn(),
    ...rest,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAgenticLoop — text-only response", () => {
  it("returns immediately when the model sends only text (no function calls)", async () => {
    const genAIMock = vi.fn().mockReturnValue(
      makeStream([
        { text: "Hello there!", usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } },
      ]),
    );

    const config = makeConfig({ genAIMock });
    const result = await runAgenticLoop(config);

    expect(result.fullResponse).toBe("Hello there!");
    expect(result.toolResults).toHaveLength(0);
    expect(result.pausedAtLimit).toBe(false);
    expect(result.usageMetadata.totalTokenCount).toBe(15);
    // Model should have been called exactly once
    expect(genAIMock).toHaveBeenCalledTimes(1);
  });

  it("writes text chunks to the SSE response", async () => {
    const res = makeFakeRes();
    const genAIMock = vi.fn().mockReturnValue(makeStream([{ text: "Hi!" }]));
    const config = makeConfig({ genAIMock, res });

    await runAgenticLoop(config);

    expect(res._events).toContainEqual({ text: "Hi!" });
  });

  it("calls onAssistantOutputStarted exactly once when text is emitted", async () => {
    const onAssistantOutputStarted = vi.fn();
    const genAIMock = vi.fn().mockReturnValue(makeStream([{ text: "A" }, { text: "B" }]));

    await runAgenticLoop(makeConfig({ genAIMock, onAssistantOutputStarted }));

    expect(onAssistantOutputStarted).toHaveBeenCalledTimes(1);
  });
});

describe("runAgenticLoop — end_turn function call", () => {
  it("executes a single function call and exits cleanly when end_turn fires", async () => {
    const functionCalls = [{ name: "end_turn", args: {} }];
    const genAIMock = vi.fn().mockReturnValue(
      makeStream([{ functionCalls, usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 } }]),
    );

    (toolDispatcher.executeToolCall as Mock).mockResolvedValue({
      toolId: "tc-1",
      type: "end_turn",
      success: true,
      result: { shouldEndTurn: true },
    });

    const result = await runAgenticLoop(makeConfig({ genAIMock }));

    expect(toolDispatcher.executeToolCall).toHaveBeenCalledTimes(1);
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0].type).toBe("end_turn");
    expect(result.pausedAtLimit).toBe(false);
    // The multi-turn Gemini call should NOT have been made (end_turn stops the loop)
    expect(genAIMock).toHaveBeenCalledTimes(1);
  });
});

describe("runAgenticLoop — implicit end_turn via plain text in loop", () => {
  it("stops the loop when a turn returns text instead of function calls", async () => {
    const fc = [{ name: "some_tool", args: {} }];

    // First call: function call. Second call: plain text.
    const genAIMock = vi
      .fn()
      .mockReturnValueOnce(makeStream([{ functionCalls: fc }]))
      .mockReturnValueOnce(makeStream([{ text: "Done." }]));

    (toolDispatcher.executeToolCall as Mock).mockResolvedValue({
      toolId: "tc-1",
      type: "some_tool",
      success: true,
      result: { data: "ok" },
    });

    const result = await runAgenticLoop(makeConfig({ genAIMock }));

    expect(genAIMock).toHaveBeenCalledTimes(2);
    expect(result.pausedAtLimit).toBe(false);
  });
});

describe("runAgenticLoop — maxIterations pause", () => {
  it("emits agenticPaused SSE event and sets pausedAtLimit when iterations are exhausted", async () => {
    const fc = [{ name: "keep_going", args: {} }];
    // Every call returns a new function call (never ends naturally)
    const genAIMock = vi.fn().mockImplementation(() => makeStream([{ functionCalls: fc }]));

    (toolDispatcher.executeToolCall as Mock).mockResolvedValue({
      toolId: "tc-x",
      type: "keep_going",
      success: true,
      result: {},
    });

    const res = makeFakeRes();
    const config = makeConfig({ genAIMock, res, maxIterations: 2 });
    const result = await runAgenticLoop(config);

    expect(result.pausedAtLimit).toBe(true);
    // SSE stream must contain the agenticPaused event
    const pausedEvent = (res._events as any[]).find((e) => "agenticPaused" in e);
    expect(pausedEvent).toBeDefined();
    expect(pausedEvent.agenticPaused.turns).toBeGreaterThanOrEqual(1);
  });
});

describe("runAgenticLoop — finally block", () => {
  it("always clears toolDispatcher SSE reference even on success", async () => {
    const genAIMock = vi.fn().mockReturnValue(makeStream([{ text: "ok" }]));
    await runAgenticLoop(makeConfig({ genAIMock }));
    expect(toolDispatcher.setSseResponse).toHaveBeenLastCalledWith(null);
  });

  it("clears toolDispatcher SSE reference even when an error is thrown", async () => {
    const genAIMock = vi.fn().mockReturnValue(
      (async function* () {
        throw new Error("Gemini exploded");
      })(),
    );

    await expect(runAgenticLoop(makeConfig({ genAIMock }))).rejects.toThrow("Gemini exploded");
    expect(toolDispatcher.setSseResponse).toHaveBeenLastCalledWith(null);
  });
});

describe("runAgenticLoop — usage metadata accumulation", () => {
  it("sums usage metadata across the initial call and loop turns", async () => {
    const fc = [{ name: "some_tool", args: {} }];
    const genAIMock = vi
      .fn()
      .mockReturnValueOnce(
        makeStream([
          { functionCalls: fc, usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } },
        ]),
      )
      .mockReturnValueOnce(
        makeStream([
          { text: "Done.", usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 8, totalTokenCount: 28 } },
        ]),
      );

    (toolDispatcher.executeToolCall as Mock).mockResolvedValue({
      toolId: "tc-1",
      type: "some_tool",
      success: true,
      result: {},
    });

    const result = await runAgenticLoop(makeConfig({ genAIMock }));

    expect(result.usageMetadata.promptTokenCount).toBe(30);
    expect(result.usageMetadata.candidatesTokenCount).toBe(13);
    expect(result.usageMetadata.totalTokenCount).toBe(43);
  });
});

describe("runAgenticLoop — tool errors", () => {
  it("captures tool errors and includes them in toolResults without crashing", async () => {
    const fc = [{ name: "bad_tool", args: {} }];
    const genAIMock = vi
      .fn()
      .mockReturnValueOnce(makeStream([{ functionCalls: fc }]))
      .mockReturnValueOnce(makeStream([{ text: "Handled." }]));

    (toolDispatcher.executeToolCall as Mock).mockRejectedValue(new Error("Tool blew up"));

    const result = await runAgenticLoop(makeConfig({ genAIMock }));

    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0].success).toBe(false);
    expect(result.toolResults[0].error).toBe("Tool blew up");
  });
});
