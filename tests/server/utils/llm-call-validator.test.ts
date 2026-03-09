/**
 * Tests for LLM Call Validator
 * 
 * Ensures system prompts are never mixed into message history
 */

import { describe, it, expect } from "@jest/globals";
import {
  validateMessageHistory,
  validateLLMCall,
  looksLikeSystemInstruction,
} from "../llm-call-validator";

describe("LLM Call Validator", () => {
  describe("validateMessageHistory", () => {
    it("should accept valid message history with user and model roles", () => {
      const contents = [
        { role: "user", parts: [{ text: "Hello, how are you?" }] },
        { role: "model", parts: [{ text: "I'm doing well, thanks!" }] },
        { role: "user", parts: [{ text: "What's the weather like?" }] },
      ];

      const result = validateMessageHistory(contents);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject message history with system instruction patterns", () => {
      const contents = [
        {
          role: "user",
          parts: [
            {
              text: "You are a helpful assistant. Answer questions concisely and accurately.",
            },
          ],
        },
        { role: "user", parts: [{ text: "What's 2+2?" }] },
      ];

      const result = validateMessageHistory(contents);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("system instruction detected");
    });

    it("should reject messages with invalid roles", () => {
      const contents = [
        { role: "system", parts: [{ text: "You are a helpful assistant." }] },
        { role: "user", parts: [{ text: "Hello" }] },
      ];

      const result = validateMessageHistory(contents as any);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid role 'system'");
    });

    it("should accept short text starting with system patterns (avoid false positives)", () => {
      const contents = [
        { role: "user", parts: [{ text: "You are nice" }] }, // Short, shouldn't trigger
      ];

      const result = validateMessageHistory(contents);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateLLMCall", () => {
    it("should accept properly structured LLM call", () => {
      const config = {
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: "Hello!" }] }],
        config: {
          systemInstruction: "You are a helpful assistant.",
        },
      };

      const result = validateLLMCall(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject LLM call with system prompt in contents", () => {
      const config = {
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "You are a professional programmer. Help me write clean code.",
              },
            ],
          },
        ],
      };

      const result = validateLLMCall(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should require model to be a string", () => {
      const config = {
        model: "" as any,
        contents: [{ role: "user", parts: [{ text: "Hello" }] }],
      };

      const result = validateLLMCall(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Model must be a non-empty string");
    });

    it("should require contents field", () => {
      const config = {
        model: "gemini-3-flash-preview",
        contents: undefined as any,
      };

      const result = validateLLMCall(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Contents is required");
    });
  });

  describe("looksLikeSystemInstruction", () => {
    it("should detect common system instruction patterns", () => {
      expect(looksLikeSystemInstruction("You are a helpful assistant")).toBe(
        true
      );
      expect(
        looksLikeSystemInstruction("You are an expert programmer")
      ).toBe(true);
      expect(looksLikeSystemInstruction("Act as a professional writer")).toBe(
        true
      );
      expect(looksLikeSystemInstruction("System: You must follow rules")).toBe(
        true
      );
      expect(
        looksLikeSystemInstruction("Your role is to analyze data")
      ).toBe(true);
    });

    it("should not flag regular user messages", () => {
      expect(looksLikeSystemInstruction("Hello, how are you?")).toBe(false);
      expect(looksLikeSystemInstruction("What's the weather today?")).toBe(
        false
      );
      expect(looksLikeSystemInstruction("Can you help me?")).toBe(false);
    });

    it("should not flag very short text", () => {
      expect(looksLikeSystemInstruction("You are ok")).toBe(false);
      expect(looksLikeSystemInstruction("Act now")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(looksLikeSystemInstruction("")).toBe(false);
      expect(looksLikeSystemInstruction(null as any)).toBe(false);
      expect(looksLikeSystemInstruction(undefined as any)).toBe(false);
    });
  });

  describe("Real-world test cases", () => {
    it("should validate the main chat endpoint structure (from routes.ts)", () => {
      // This mimics the structure used in routes.ts line 772
      const history = [
        {
          role: "user",
          parts: [{ text: "Tell me about TypeScript" }],
        },
        {
          role: "model",
          parts: [{ text: "TypeScript is a typed superset of JavaScript..." }],
        },
      ];

      const config = {
        model: "gemini-3.1-pro-preview",
        contents: [
          ...history,
          {
            role: "user",
            parts: [{ text: "What are the benefits?" }],
          },
        ],
        config: {
          systemInstruction: "You are a helpful programming assistant.",
        },
      };

      const result = validateLLMCall(config);
      expect(result.valid).toBe(true);
    });

    it("should catch the bug from agent-worker.ts (before fix)", () => {
      // This mimics the OLD incorrect pattern from agent-worker.ts line 179
      const buggyContents = [
        {
          role: "user",
          parts: [{ text: "System: You are a specialized task executor" }],
        },
        { role: "user", parts: [{ text: "Execute the task" }] },
      ];

      const result = validateMessageHistory(buggyContents);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("system instruction detected");
    });

    it("should catch the bug from extension.ts (before fix)", () => {
      // This mimics the OLD incorrect pattern from extension.ts
      const buggyContents = [
        {
          role: "user",
          parts: [
            {
              text: `You are analyzing a screenshot of a web page.
URL: https://example.com
Title: Example

Please describe what you see on this page. Identify:
1. The type of page/website
2. Main content and purpose
3. Any notable UI elements or issues
4. Suggestions if applicable

Be concise but informative.`,
            },
          ],
        },
      ];

      const result = validateMessageHistory(buggyContents);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("system instruction detected");
    });
  });
});
