import { describe, expect, it } from "vitest";
import type { Message } from "@shared/schema";
import { upsertTempAIMessage } from "../client/src/features/chat/useChat";

function buildMessage(id: string, role: "user" | "ai", content: string): Message {
  return {
    id,
    chatId: "chat-1",
    role,
    content,
    createdAt: new Date(),
  } as unknown as Message;
}

describe("upsertTempAIMessage", () => {
  it("updates only the matching temp AI message", () => {
    const existing = [
      buildMessage("user-1", "user", "hello"),
      buildMessage("temp-ai-chat-1-1", "ai", "first draft"),
      buildMessage("temp-ai-chat-1-2", "ai", "second draft"),
    ];

    const updated = upsertTempAIMessage(
      existing,
      "temp-ai-chat-1-1",
      "chat-1",
      "first final"
    );

    expect(updated).toHaveLength(3);
    expect(updated.find((m) => m.id === "temp-ai-chat-1-1")?.content).toBe(
      "first final"
    );
    expect(updated.find((m) => m.id === "temp-ai-chat-1-2")?.content).toBe(
      "second draft"
    );
  });

  it("appends a temp AI message when one does not exist yet", () => {
    const existing = [buildMessage("user-1", "user", "hello")];

    const updated = upsertTempAIMessage(
      existing,
      "temp-ai-chat-1-9",
      "chat-1",
      "new ai response"
    );

    expect(updated).toHaveLength(2);
    expect(updated[1].id).toBe("temp-ai-chat-1-9");
    expect(updated[1].content).toBe("new ai response");
  });
});
