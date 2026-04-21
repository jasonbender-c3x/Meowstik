import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs/promises";
import path from "node:path";

const storageMock = vi.hoisted(() => ({
  createToolTask: vi.fn(),
  updateToolTaskStatus: vi.fn(),
  createToolCallLog: vi.fn(),
  updateToolCallLog: vi.fn(),
}));

const gmailMock = vi.hoisted(() => ({
  listEmails: vi.fn(),
  getEmail: vi.fn(),
  searchEmails: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("../server/storage", () => ({
  storage: storageMock,
}));

vi.mock("../server/integrations/web-search", () => ({
  webSearch: vi.fn(),
  formatSearchResult: vi.fn(),
}));

vi.mock("../server/integrations/http-client", () => ({
  httpGet: vi.fn(),
  httpPost: vi.fn(),
  httpPut: vi.fn(),
}));

vi.mock("../server/integrations/google-tasks", () => ({}));
vi.mock("../server/integrations/gmail", () => gmailMock);
vi.mock("../server/integrations/google-calendar", () => ({}));
vi.mock("../server/integrations/google-drive", () => ({}));
vi.mock("../server/integrations/google-docs", () => ({}));
vi.mock("../server/integrations/google-sheets", () => ({}));
vi.mock("../server/integrations/google-contacts", () => ({}));
vi.mock("../server/integrations/github", () => ({}));
vi.mock("../server/integrations/twilio", () => ({}));
vi.mock("../server/services/ssh-service", () => ({}));
vi.mock("../server/integrations/arduino", () => ({}));
vi.mock("../server/integrations/adb", () => ({}));
vi.mock("../server/services/file-queue", () => ({}));
vi.mock("../server/integrations/petoi", () => ({}));
vi.mock("../server/integrations/printer3d", () => ({}));
vi.mock("../server/integrations/kicad", () => ({}));
vi.mock("../server/services/chromecast-service", () => ({}));
vi.mock("../server/services/camera-service", () => ({}));
const clientRouterMock = vi.hoisted(() => ({
  hasConnectedAgent: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("../server/services/client-router", () => ({
  clientRouter: clientRouterMock,
}));
vi.mock("../server/services/copilot-service", () => ({
  copilotService: {},
}));
vi.mock("../server/services/mcp-service", () => ({
  mcpService: {},
}));

import { ToolDispatcher } from "../server/services/tool-dispatcher";

describe("ToolDispatcher append logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    storageMock.createToolTask.mockResolvedValue({ id: "task-1" });
    storageMock.updateToolTaskStatus.mockResolvedValue(undefined);
    storageMock.createToolCallLog.mockResolvedValue({ id: "log-1" });
    storageMock.updateToolCallLog.mockResolvedValue({ id: "log-1" });
    clientRouterMock.hasConnectedAgent.mockReturnValue(false);
    gmailMock.listEmails.mockResolvedValue([]);
    gmailMock.getEmail.mockResolvedValue({ id: "msg-1" });
    gmailMock.searchEmails.mockResolvedValue([]);
    gmailMock.sendEmail.mockResolvedValue({ id: "sent-1" });
  });

  it("marks append tool logs successful using the created tool_call_logs row id", async () => {
    const dispatcher = new ToolDispatcher();
    const logName = `tool-dispatcher-test-${Date.now()}`;
    const logPath = path.join(process.cwd(), "logs", `${logName}.md`);

    try {
      const result = await dispatcher.executeToolCall(
        {
          id: "tool-1",
          type: "append",
          operation: "append",
          parameters: {
            name: logName,
            content: "Remember this.",
          },
        },
        "message-1",
        "chat-1",
      );

      expect(result.success).toBe(true);
      expect(storageMock.updateToolCallLog).toHaveBeenCalledWith(
        "log-1",
        expect.objectContaining({ status: "success" }),
      );
      expect(storageMock.updateToolCallLog).not.toHaveBeenCalledWith(
        "tool-1",
        expect.anything(),
      );

      await expect(fs.readFile(logPath, "utf8")).resolves.toContain("Remember this.");
    } finally {
      await fs.rm(logPath, { force: true });
    }
  });

  it("reports append validation failures against the correct tool_call_logs row id", async () => {
    const dispatcher = new ToolDispatcher();
    const result = await dispatcher.executeToolCall(
      {
        id: "tool-2",
        type: "append",
        operation: "append",
        parameters: {
          name: "   ",
          content: "This write should fail.",
        },
      },
      "message-2",
      "chat-2",
    );

    expect(result.success).toBe(false);
    expect(storageMock.updateToolCallLog).toHaveBeenCalledWith(
      "log-1",
      expect.objectContaining({
        status: "failure",
        errorMessage: "Log name is required",
      }),
    );
    expect(storageMock.updateToolCallLog).not.toHaveBeenCalledWith(
      "tool-2",
      expect.anything(),
    );
  });

  it("accepts legacy append aliases instead of falling back", async () => {
    const dispatcher = new ToolDispatcher();
    const logName = `tool-dispatcher-alias-test-${Date.now()}`;
    const logPath = path.join(process.cwd(), "logs", `${logName}.md`);

    try {
      const result = await dispatcher.executeToolCall(
        {
          id: "tool-3",
          type: "log_append" as any,
          operation: "log_append",
          parameters: {
            name: logName,
            content: "Alias append still works.",
          },
        } as any,
        "message-3",
        "chat-3",
      );

      expect(result.success).toBe(true);
      expect(result.result).not.toEqual(
        expect.objectContaining({
          message: expect.stringContaining("EXECUTED (FALLBACK)"),
        }),
      );
      await expect(fs.readFile(logPath, "utf8")).resolves.toContain("Alias append still works.");
    } finally {
      await fs.rm(logPath, { force: true });
    }
  });

  it("returns editor-targeted payloads for editor: paths instead of writing literal files", async () => {
    const dispatcher = new ToolDispatcher();
    const literalPath = path.join(process.cwd(), "editor:virtual-plan.md");

    try {
      const result = await dispatcher.executeToolCall(
        {
          id: "tool-4",
          type: "put" as any,
          operation: "put",
          parameters: {
            path: "editor:virtual-plan.md",
            content: "# Virtual plan\n",
          },
        } as any,
        "message-4",
        "chat-4",
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual(
        expect.objectContaining({
          destination: "editor",
          path: "virtual-plan.md",
          content: "# Virtual plan\n",
        }),
      );
      await expect(fs.access(literalPath)).rejects.toThrow();
    } finally {
      await fs.rm(literalPath, { force: true });
    }
  });

  it("dispatches gmail_search without falling back", async () => {
    const dispatcher = new ToolDispatcher();
    gmailMock.searchEmails.mockResolvedValue([{ id: "msg-42", subject: "hello" }]);

    const result = await dispatcher.executeToolCall(
      {
        id: "tool-5",
        type: "gmail_search" as any,
        operation: "search",
        parameters: {
          query: "subject:hello",
          maxResults: 5,
        },
      } as any,
      "message-5",
      "chat-5",
    );

    expect(result.success).toBe(true);
    expect(gmailMock.searchEmails).toHaveBeenCalledWith("subject:hello", 5);
    expect(result.result).toEqual(
      expect.objectContaining({
        success: true,
        emails: [{ id: "msg-42", subject: "hello" }],
      }),
    );
    expect(result.result).not.toEqual(
      expect.objectContaining({
        message: expect.stringContaining("EXECUTED (FALLBACK)"),
      }),
    );
  });

  it("fails unknown tools instead of reporting fallback success", async () => {
    const dispatcher = new ToolDispatcher();

    const result = await dispatcher.executeToolCall(
      {
        id: "tool-6",
        type: "gmail_magic" as any,
        operation: "execute",
        parameters: {},
      } as any,
      "message-6",
      "chat-6",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool type: gmail_magic");
    expect(storageMock.updateToolCallLog).toHaveBeenCalledWith(
      "log-1",
      expect.objectContaining({
        status: "failure",
        errorMessage: "Unknown tool type: gmail_magic",
      }),
    );
  });
});
