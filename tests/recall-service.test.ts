import { describe, expect, it } from "vitest";
import type { RecallResult } from "../server/services/recall-service";
import {
  buildRecallMatchQuery,
  chunkRecallContent,
  formatRelevantRecallSection,
  isSearchableTextAttachment,
} from "../server/services/recall-service";

describe("recall-service helpers", () => {
  it("chunks long recall documents into bounded segments", () => {
    const chunks = chunkRecallContent(
      [
        "The deployment pipeline failed because the preview script pointed to an old port.",
        "We fixed it by updating the runtime config and re-linking the publishing service.",
        "The environment page also needed DATABASE_URL and GOOGLE_CLIENT_ID.",
      ].join("\n\n"),
      { maxChars: 90, overlap: 20 },
    );

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.length <= 90)).toBe(true);
  });

  it("builds an FTS-friendly match query from meaningful terms", () => {
    expect(buildRecallMatchQuery("Please fix the auth token regression in publishing")).toBe(
      `"please" OR "fix" OR "auth" OR "token" OR "regression" OR "publishing"`,
    );
  });

  it("detects searchable text attachments without treating binary files as text", () => {
    expect(
      isSearchableTextAttachment({
        filename: "notes.md",
        mimeType: "text/markdown",
        content: "# Release notes",
      } as never),
    ).toBe(true);

    expect(
      isSearchableTextAttachment({
        filename: "diagram.png",
        mimeType: "image/png",
        content: "iVBORw0KGgoAAAANSUhEUgAA",
      } as never),
    ).toBe(false);
  });

  it("formats a bounded relevant recall section", () => {
    const results: RecallResult[] = [
      {
        sourceType: "summary",
        sourceId: "sum-1",
        chatId: "chat-1",
        title: "Publishing fixes",
        excerpt: "We already solved the preview-port mismatch and missing env vars on the publishing flow.",
        score: -2.1,
      },
      {
        sourceType: "attachment",
        sourceId: "att-1",
        chatId: "chat-2",
        title: "deploy-notes.md",
        excerpt: "Remember to prefer preview over start when both scripts exist.",
        score: -1.7,
      },
    ];

    expect(formatRelevantRecallSection(results)).toContain("# Relevant Recall");
    expect(formatRelevantRecallSection(results)).toContain("Conversation summary: Publishing fixes");
    expect(formatRelevantRecallSection(results)).toContain("Attachment: deploy-notes.md");
  });
});
