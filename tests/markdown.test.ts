import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("renders basic markdown to HTML", () => {
    const result = renderMarkdown("**bold**");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("converts literal \\n sequences to actual newlines and renders line breaks", () => {
    // Literal \n (backslash + n) should become a real line break in the output.
    // This covers tool result summaries that were built with escaped string literals.
    const result = renderMarkdown("line one\\nline two");
    // With `breaks: true` in marked, a real newline between two lines becomes <br>.
    expect(result).toContain("<br");
    expect(result).toContain("line one");
    expect(result).toContain("line two");
    expect(result).not.toContain("\\n");
  });

  it("converts multiple literal \\n sequences and preserves all text fragments", () => {
    const result = renderMarkdown("Tool results:\\nresult one\\nresult two");
    expect(result).not.toContain("\\n");
    expect(result).toContain("Tool results:");
    expect(result).toContain("result one");
    expect(result).toContain("result two");
    // Actual line breaks should produce <br> tags (marked `breaks: true`)
    expect(result).toContain("<br");
  });

  it("handles content without literal \\n sequences unchanged", () => {
    const result = renderMarkdown("Hello world");
    expect(result).toContain("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});
