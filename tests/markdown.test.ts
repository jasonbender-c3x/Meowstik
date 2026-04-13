import { describe, expect, it } from "vitest";
import { normalizeEscapedNewlines, renderMarkdown } from "@/lib/markdown";

describe("normalizeEscapedNewlines", () => {
  it("converts escaped newlines in normal message text", () => {
    expect(normalizeEscapedNewlines("Line one\\nLine two")).toBe(
      "Line one\nLine two"
    );
  });

  it("preserves escaped newlines inside fenced code blocks", () => {
    const input = "Before\\n```ts\nconst value = \"a\\\\nb\";\n```\\nAfter";

    expect(normalizeEscapedNewlines(input)).toBe(
      "Before\n```ts\nconst value = \"a\\\\nb\";\n```\nAfter"
    );
  });

  it("preserves escaped newlines inside inline code", () => {
    expect(normalizeEscapedNewlines("Use `foo\\\\nbar` here\\nnow")).toBe(
      "Use `foo\\\\nbar` here\nnow"
    );
  });
});

describe("renderMarkdown", () => {
  it("renders escaped newlines as separate paragraphs", () => {
    const html = renderMarkdown("Alpha\\n\\nBeta");

    expect(html).toContain("<p>Alpha</p>");
    expect(html).toContain("<p>Beta</p>");
  });
});
