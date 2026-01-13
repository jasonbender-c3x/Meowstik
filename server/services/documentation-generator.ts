/**
 * =============================================================================
 * MEOWSTIK - DOCUMENTATION GENERATOR SERVICE
 * =============================================================================
 * 
 * Generates various types of documentation using Google's Gemini AI.
 * Supports API references, tutorials, guides, and overviews.
 * 
 * FEATURES:
 * - Lazy initialization of Gemini client
 * - Clear error messages for missing API keys
 * - Multiple documentation formats
 * - Fail-fast validation
 * 
 * This service uses lazy initialization to ensure API key validation
 * happens only when documentation generation is actually needed.
 * =============================================================================
 */

import { GoogleGenAI } from "@google/genai";

const DOCUMENTATION_MODEL = "gemini-2.0-flash-exp";

export interface DocumentationOptions {
  /** Title of the documentation */
  title?: string;
  /** Target audience level */
  audienceLevel?: "beginner" | "intermediate" | "advanced";
  /** Include code examples */
  includeExamples?: boolean;
  /** Maximum length in tokens */
  maxLength?: number;
}

export interface GeneratedDocumentation {
  /** The generated documentation content */
  content: string;
  /** Estimated token count */
  tokenCount?: number;
  /** Format of the documentation */
  format: string;
}

let genAI: GoogleGenAI | null = null;

/**
 * Get or create the Gemini AI client
 * @throws {Error} If GEMINI_API_KEY is not set
 */
function getGeminiClient(): GoogleGenAI {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required for documentation generation. " +
        "Please set it in your environment or .env file."
      );
    }
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAI;
}

/**
 * Generate API reference documentation
 */
export async function generateApiReference(
  codeContent: string,
  options: DocumentationOptions = {}
): Promise<GeneratedDocumentation> {
  const client = getGeminiClient();

  const prompt = `Generate comprehensive API reference documentation for the following code.
${options.title ? `Title: ${options.title}` : ""}
${options.audienceLevel ? `Target Audience: ${options.audienceLevel}` : ""}
${options.includeExamples ? "Include practical code examples." : ""}

Code:
${codeContent}

Generate clear, well-structured API documentation with:
- Overview of the API
- Function/method signatures
- Parameter descriptions
- Return value descriptions
- Usage examples
${options.includeExamples ? "- Code snippets" : ""}

Format in Markdown.`;

  try {
    const result = await client.models.generateContent({
      model: DOCUMENTATION_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxLength || 2048,
      },
    });

    const content = result.text || result.response?.text?.() || "";
    
    return {
      content,
      format: "markdown",
      tokenCount: result.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    console.error("API reference generation error:", error);
    throw error;
  }
}

/**
 * Generate tutorial documentation
 */
export async function generateTutorial(
  topic: string,
  codeContent: string,
  options: DocumentationOptions = {}
): Promise<GeneratedDocumentation> {
  const client = getGeminiClient();

  const prompt = `Generate a comprehensive tutorial for: ${topic}
${options.title ? `Title: ${options.title}` : ""}
${options.audienceLevel ? `Target Audience: ${options.audienceLevel}` : ""}
${options.includeExamples ? "Include step-by-step code examples." : ""}

Reference Code:
${codeContent}

Create a tutorial that includes:
- Introduction to the topic
- Prerequisites
- Step-by-step instructions
- Code examples with explanations
- Common pitfalls and solutions
- Next steps and further reading

Format in Markdown.`;

  try {
    const result = await client.models.generateContent({
      model: DOCUMENTATION_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxLength || 2048,
      },
    });

    const content = result.text || result.response?.text?.() || "";
    
    return {
      content,
      format: "markdown",
      tokenCount: result.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    console.error("Tutorial generation error:", error);
    throw error;
  }
}

/**
 * Generate guide documentation
 */
export async function generateGuide(
  topic: string,
  context: string,
  options: DocumentationOptions = {}
): Promise<GeneratedDocumentation> {
  const client = getGeminiClient();

  const prompt = `Generate a comprehensive guide for: ${topic}
${options.title ? `Title: ${options.title}` : ""}
${options.audienceLevel ? `Target Audience: ${options.audienceLevel}` : ""}
${options.includeExamples ? "Include practical examples." : ""}

Context:
${context}

Create a guide that includes:
- Overview and introduction
- Key concepts and terminology
- Best practices
- Common patterns and approaches
- Examples and use cases
- Tips and recommendations
- Related topics

Format in Markdown.`;

  try {
    const result = await client.models.generateContent({
      model: DOCUMENTATION_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxLength || 2048,
      },
    });

    const content = result.text || result.response?.text?.() || "";
    
    return {
      content,
      format: "markdown",
      tokenCount: result.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    console.error("Guide generation error:", error);
    throw error;
  }
}

/**
 * Generate overview documentation
 */
export async function generateOverview(
  codebaseName: string,
  structure: string,
  options: DocumentationOptions = {}
): Promise<GeneratedDocumentation> {
  const client = getGeminiClient();

  const prompt = `Generate a comprehensive overview for: ${codebaseName}
${options.title ? `Title: ${options.title}` : ""}
${options.audienceLevel ? `Target Audience: ${options.audienceLevel}` : ""}

Codebase Structure:
${structure}

Create an overview that includes:
- High-level architecture description
- Main components and their purposes
- Key features and capabilities
- Technology stack
- Getting started guide
- Directory structure explanation
- Important files and their roles

Format in Markdown.`;

  try {
    const result = await client.models.generateContent({
      model: DOCUMENTATION_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxLength || 2048,
      },
    });

    const content = result.text || result.response?.text?.() || "";
    
    return {
      content,
      format: "markdown",
      tokenCount: result.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    console.error("Overview generation error:", error);
    throw error;
  }
}
