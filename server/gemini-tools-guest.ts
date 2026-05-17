
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
    description: "Send content to the chat window. NON-TERMINATING - does not end your turn. You can call this multiple times to provide incremental updates. Use this for visible assistant text, and do not repeat the same content again in a final plain-text reply.",
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
    description: "Generate HD voice audio output only. NON-BLOCKING and NON-TERMINATING - speech generation happens concurrently with other operations. Pair this with send_chat if you also want visible text. Do not rely on say to write to chat, and do not repeat the same content again in a final plain-text reply.",
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
    name: "pause",
    description: "Pause the current chat loop and return control to the human. Use this when you need operator input or want to sleep for a while. Optional durationSeconds requests an automatic resume after that many seconds if the chat UI stays open. Maximum durationSeconds is 3600. Optional message is shown in chat before pausing.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        durationSeconds: {
          type: "number",
          description: "Optional pause duration in seconds before auto-resume. Maximum 3600."
        },
        message: {
          type: "string",
          description: "Optional chat message to show before pausing"
        }
      }
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
    name: "exa_search",
    description: "Search the web using Exa (neural search engine)",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results to return (default: 10)" },
        useAutoprompt: { type: "boolean", description: "Whether to use autoprompt (default: true)" },
        type: { type: "string", enum: ["neural", "keyword"], description: "Search type (default: neural)" }
      },
      required: ["query"]
    }
  },
  // V2: Removed duckduckgo_search, tavily_search and perplexity_search
  // Use web_search (free) instead



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
  // Remove Tavily/Perplexity/DuckDuckGo search tools (not used)
  "tavily_search", "tavily_qna", "tavily_research",
  "perplexity_search", "perplexity_quick", "perplexity_research", "perplexity_news",
  "duckduckgo_search", "browserbase_load", "browserbase_screenshot", "browserbase_action"
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
