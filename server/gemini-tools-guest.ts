/**
 * Gemini Function Calling Tool Declarations - GUEST MODE
 * 
 * Limited, safe tool set for unauthenticated guest users.
 * 
 * SECURITY PRINCIPLES:
 * - No access to personal data (Gmail, Drive, Calendar, etc.)
 * - No file system access (prevents data leakage)
 * - No external API integrations that require authentication
 * - Read-only web search and information retrieval
 * - Basic chat output only
 * 
 * This creates a secure sandbox for guest interactions.
 */
import type { FunctionDeclaration } from "@google/genai";

export const guestToolDeclarations: FunctionDeclaration[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE OUTPUT TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "send_chat",
    description: "Send final response to the chat window. TERMINATES the agentic loop. Use after gathering all information.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The markdown-formatted response to display in chat"
        }
      },
      required: ["content"]
    }
  },
  {
    name: "say",
    description: "Generate HD voice audio output. Does NOT terminate the loop - use alongside or before send_chat. Required when voice mode is enabled.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        utterance: {
          type: "string",
          description: "Text to speak aloud"
        },
        voice: {
          type: "string",
          enum: ["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"],
          description: "Voice to use (default: Kore)"
        }
      },
      required: ["utterance"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB SEARCH (Read-only, safe)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "google_search",
    description: "Search the web using Google Custom Search API. Returns search results with titles, snippets, and URLs.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results to return (default: 10)" }
      },
      required: ["query"]
    }
  },
  {
    name: "duckduckgo_search",
    description: "Search the web using DuckDuckGo (privacy-focused, no API key needed)",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results to return (default: 10)" }
      },
      required: ["query"]
    }
  },
  {
    name: "tavily_search",
    description: "Deep web search using Tavily AI - optimized for accurate, up-to-date information retrieval",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results (default: 5)" }
      },
      required: ["query"]
    }
  },
  {
    name: "perplexity_search",
    description: "AI-powered search with Perplexity API - returns synthesized answers with citations",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Question or search query" },
        mode: { 
          type: "string", 
          enum: ["quick", "research"],
          description: "Search mode: 'quick' for fast results, 'research' for deep analysis" 
        }
      },
      required: ["query"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB SCRAPING (Read-only)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "browser_scrape",
    description: "Scrape content from a web page. Returns cleaned text content.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to scrape" }
      },
      required: ["url"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE GENERATION (Safe creative tools)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "image_generate",
    description: "Generate images using AI (Flux or DALL-E 3)",
    parametersJsonSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Image generation prompt" },
        model: { 
          type: "string", 
          enum: ["flux", "dalle3"],
          description: "Model to use (default: flux)" 
        },
        size: {
          type: "string",
          enum: ["1024x1024", "1792x1024", "1024x1792"],
          description: "Image size (default: 1024x1024)"
        }
      },
      required: ["prompt"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAL KNOWLEDGE (No personal data access)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "debug_echo",
    description: "Echo back parameters for testing and debugging",
    parametersJsonSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to echo" }
      },
      required: ["message"]
    }
  },
];

/**
 * Get tool declarations based on authentication status
 * @param isAuthenticated - Whether the user is authenticated
 * @returns The appropriate tool set (full or guest)
 */
export function getToolDeclarations(isAuthenticated: boolean): FunctionDeclaration[] {
  if (isAuthenticated) {
    // Import and return full tool set for authenticated users
    const { geminiFunctionDeclarations } = require("./gemini-tools");
    return geminiFunctionDeclarations;
  } else {
    // Return limited guest tool set
    return guestToolDeclarations;
  }
}
