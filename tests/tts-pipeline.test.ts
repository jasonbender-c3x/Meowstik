import { describe, expect, it } from "vitest";
import {
  appendTtsChunk,
  extractTtsSentences,
  TTS_COMMON_ABBREVIATIONS,
} from "../server/services/tts-pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// appendTtsChunk
// ─────────────────────────────────────────────────────────────────────────────

describe("appendTtsChunk", () => {
  it("returns chunk when buffer is empty", () => {
    expect(appendTtsChunk("", "hello")).toBe("hello");
  });

  it("returns buffer when chunk is empty", () => {
    expect(appendTtsChunk("hello", "")).toBe("hello");
  });

  it("adds space between two word tokens", () => {
    expect(appendTtsChunk("hello", "world")).toBe("hello world");
  });

  it("does not double-space when buffer ends with space", () => {
    expect(appendTtsChunk("hello ", "world")).toBe("hello world");
  });

  it("does not add space when chunk starts with punctuation", () => {
    expect(appendTtsChunk("hello", ".")).toBe("hello.");
    expect(appendTtsChunk("hello", ",")).toBe("hello,");
    expect(appendTtsChunk("hello", "!")).toBe("hello!");
    expect(appendTtsChunk("hello", "?")).toBe("hello?");
  });

  it("does not add space when chunk starts with closing bracket", () => {
    expect(appendTtsChunk("(test", ")")).toBe("(test)");
    expect(appendTtsChunk("[test", "]")).toBe("[test]");
  });

  it("does not add space when buffer ends with opening bracket", () => {
    expect(appendTtsChunk("see (", "note")).toBe("see (note");
  });

  it("does not add space when buffer ends with quote", () => {
    expect(appendTtsChunk('say "', "hi")).toBe('say "hi');
  });

  it("handles adjacent punctuation without adding space", () => {
    expect(appendTtsChunk("end", "; next")).toBe("end; next");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractTtsSentences
// ─────────────────────────────────────────────────────────────────────────────

describe("extractTtsSentences", () => {
  it("returns empty sentences and full buffer when no sentence-end found", () => {
    const { sentences, remainder } = extractTtsSentences("Hello there");
    expect(sentences).toEqual([]);
    expect(remainder).toBe("Hello there");
  });

  it("extracts a single sentence ending with period", () => {
    const { sentences, remainder } = extractTtsSentences("Hello. ");
    expect(sentences).toEqual(["Hello."]);
    expect(remainder).toBe("");
  });

  it("extracts a sentence ending with exclamation mark", () => {
    const { sentences } = extractTtsSentences("Wow! That");
    expect(sentences).toEqual(["Wow!"]);
  });

  it("extracts a sentence ending with question mark", () => {
    const { sentences } = extractTtsSentences("Really? Yes");
    expect(sentences).toEqual(["Really?"]);
  });

  it("extracts multiple sentences and leaves trailing fragment", () => {
    const { sentences, remainder } = extractTtsSentences(
      "Hello there. How are you? I am fine. Trailing"
    );
    expect(sentences).toEqual(["Hello there.", "How are you?", "I am fine."]);
    expect(remainder).toBe("Trailing");
  });

  it("treats double newline as paragraph break (sentence boundary)", () => {
    const { sentences } = extractTtsSentences("First paragraph\n\nSecond");
    expect(sentences).toContain("First paragraph");
  });

  it("does NOT split on abbreviations: Mr.", () => {
    const { sentences } = extractTtsSentences("Mr. Smith said hello.");
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain("Mr. Smith");
  });

  it("does NOT split on abbreviations: Dr.", () => {
    const { sentences } = extractTtsSentences("Dr. Jones is here. Next sentence.");
    expect(sentences[0]).toContain("Dr. Jones");
  });

  it("does NOT split on decimal numbers like 3.14", () => {
    const { sentences } = extractTtsSentences("Pi is 3.14 approximately. Done.");
    expect(sentences[0]).toContain("3.14");
    expect(sentences).toHaveLength(2);
  });

  it("does NOT split when next char after period is lowercase", () => {
    // e.g. mid-sentence ellipsis-like usage
    const { sentences } = extractTtsSentences("It was e.g. five.");
    expect(sentences).toHaveLength(1);
  });

  it("handles closing quote attached to sentence-end punctuation", () => {
    const { sentences } = extractTtsSentences('She said "hello." And then left.');
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toBe('She said "hello."');
  });

  it("returns empty for empty string", () => {
    const { sentences, remainder } = extractTtsSentences("");
    expect(sentences).toEqual([]);
    expect(remainder).toBe("");
  });

  it("handles only whitespace (remainder is trimmed)", () => {
    const { sentences, remainder } = extractTtsSentences("   ");
    expect(sentences).toEqual([]);
    expect(remainder).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TTS_COMMON_ABBREVIATIONS set
// ─────────────────────────────────────────────────────────────────────────────

describe("TTS_COMMON_ABBREVIATIONS", () => {
  it("contains expected abbreviations", () => {
    expect(TTS_COMMON_ABBREVIATIONS.has("mr")).toBe(true);
    expect(TTS_COMMON_ABBREVIATIONS.has("dr")).toBe(true);
    expect(TTS_COMMON_ABBREVIATIONS.has("vs")).toBe(true);
    expect(TTS_COMMON_ABBREVIATIONS.has("etc")).toBe(true);
  });

  it("does not contain non-abbreviations", () => {
    expect(TTS_COMMON_ABBREVIATIONS.has("hello")).toBe(false);
    expect(TTS_COMMON_ABBREVIATIONS.has("world")).toBe(false);
  });
});
