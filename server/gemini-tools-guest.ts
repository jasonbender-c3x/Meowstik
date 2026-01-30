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
import { geminiFunctionDeclarations } from "./gemini-tools";

export const guestToolDeclarations: FunctionDeclaration[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE OUTPUT TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "send_chat",
    description: "Send content to the chat window. NON-TERMINATING - does not end your turn. You can call this multiple times to provide incremental updates. Must explicitly call end_turn to finish.",
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
    name: "end_turn",
    description: "Terminate your turn in the interactive agentic loop and return control to the user. This is the ONLY way to end your turn - call this when you have completed your response.",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "say",
    description: "Generate HD voice audio output. NON-BLOCKING and NON-TERMINATING - speech generation happens concurrently with other operations. Use alongside or before send_chat. Must call end_turn to finish your turn.",
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
  {
    name: "open_url",
    description: "Open a URL in a new browser tab. NON-TERMINATING - does not end your turn. Use this when the user asks to view a webpage, open a link, or navigate to a URL.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL to open (must include https:// or http://)"
        }
      },
      required: ["url"]
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
  // V2: Removed tavily_search and perplexity_search (paid APIs)
  // Use web_search (free) instead

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

// Tools to completely remove (not needed)
const REMOVED_TOOLS = new Set([
  // Remove Tavily/Perplexity search tools (not used)
  "tavily_search", "tavily_qna", "tavily_research",
  "perplexity_search", "perplexity_quick", "perplexity_research", "perplexity_news",
]);

/**
 * Get tool declarations based on authentication status
 * 
 * Strategy: Include all tools as native function declarations.
 * Only filter out unused tools (Tavily, Perplexity).
 * 
 * @param isAuthenticated - Whether the user is authenticated
 * @returns The appropriate tool set (full or guest)
 */
export function getToolDeclarations(isAuthenticated: boolean): FunctionDeclaration[] {
  if (isAuthenticated) {
    // Filter out removed tools only
    const nativeTools = geminiFunctionDeclarations.filter(
      tool => !REMOVED_TOOLS.has(tool.name)
    );
    
    console.log(`[Tools] Using ${nativeTools.length} native tools (${REMOVED_TOOLS.size} removed)`);
    return nativeTools;
  } else {
    // Return limited guest tool set
    return guestToolDeclarations;
  }
}
