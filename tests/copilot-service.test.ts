import { beforeEach, describe, expect, it, vi } from "vitest";

const startMock = vi.fn();
const stopMock = vi.fn();
const createSessionMock = vi.fn();
const resumeSessionMock = vi.fn();

vi.mock("@github/copilot-sdk", () => {
  class CopilotClient {
    constructor(_options?: unknown) {}

    start = startMock;
    stop = stopMock;
    createSession = createSessionMock;
    resumeSession = resumeSessionMock;
  }

  return { CopilotClient };
});

import { CopilotService } from "../server/services/copilot-service";

describe("CopilotService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startMock.mockResolvedValue(undefined);
    stopMock.mockResolvedValue([]);
  });

  it("creates and tracks a persistent Copilot session", async () => {
    const service = new CopilotService();
    const session = {
      sessionId: "session-1",
      workspacePath: "/tmp/copilot-session-1",
      send: vi.fn(),
      sendAndWait: vi.fn(),
      getMessages: vi.fn().mockResolvedValue([]),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    createSessionMock.mockResolvedValue(session);

    const created = await service.createSession({ model: "gpt-5.4-mini", streaming: false });

    expect(startMock).toHaveBeenCalledTimes(1);
    expect(createSessionMock).toHaveBeenCalledWith({
      sessionId: undefined,
      model: "gpt-5.4-mini",
      streaming: false,
      systemMessage: undefined,
    });
    expect(created).toEqual(
      expect.objectContaining({
        sessionId: "session-1",
        model: "gpt-5.4-mini",
        streaming: false,
        workspacePath: "/tmp/copilot-session-1",
      }),
    );
    expect(service.listActiveSessions()).toHaveLength(1);
  });

  it("sends a message through an active session and returns the assistant response", async () => {
    const service = new CopilotService();
    const session = {
      sessionId: "session-2",
      workspacePath: "/tmp/copilot-session-2",
      send: vi.fn(),
      sendAndWait: vi.fn().mockResolvedValue({
        type: "assistant.message",
        data: { content: "Finished the change." },
      }),
      getMessages: vi.fn().mockResolvedValue([]),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    createSessionMock.mockResolvedValue(session);

    await service.createSession();
    const result = await service.sendMessage("session-2", {
      prompt: "Implement the fix",
      mode: "immediate",
      timeoutMs: 30_000,
    });

    expect(session.sendAndWait).toHaveBeenCalledWith(
      {
        prompt: "Implement the fix",
        attachments: undefined,
        mode: "immediate",
      },
      30_000,
    );
    expect(result).toEqual({
      sessionId: "session-2",
      assistantResponse: "Finished the change.",
    });
  });

  it("disconnects sessions and stops the SDK client", async () => {
    const service = new CopilotService();
    const session = {
      sessionId: "session-3",
      workspacePath: "/tmp/copilot-session-3",
      send: vi.fn(),
      sendAndWait: vi.fn(),
      getMessages: vi.fn().mockResolvedValue([]),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    createSessionMock.mockResolvedValue(session);

    await service.createSession();
    await service.disconnectSession("session-3");

    expect(session.disconnect).toHaveBeenCalledTimes(1);
    expect(service.listActiveSessions()).toHaveLength(0);

    await service.stop();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});
