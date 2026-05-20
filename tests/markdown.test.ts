import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("renders basic markdown to HTML", () => {
    const result = renderMarkdown("**bold**");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("converts literal \\n sequences to actual newlines", () => {
    // Literal \n (backslash + n) should become a real line break in the output.
    // This covers tool result summaries that were built with escaped string literals.
    const result = renderMarkdown("line one\\nline two");
    // With `breaks: true` in marked, a real newline between two lines becomes <br>.
    expect(result).toContain("<br");
    expect(result).not.toContain("\\n");
  });

  it("converts multiple literal \\n sequences", () => {
    const result = renderMarkdown("Tool results:\\nresult one\\nresult two");
    expect(result).not.toContain("\\n");
  });

  it("handles content without literal \\n sequences unchanged", () => {
    const result = renderMarkdown("Hello world");
    expect(result).toContain("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});
