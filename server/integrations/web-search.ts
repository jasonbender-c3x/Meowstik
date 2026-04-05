
/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     WEB SEARCH INTEGRATION MODULE                          ║
 * ║                   Meowstik - Google Custom Search                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides web search capabilities using Google Custom Search API.
 * It enables the application to search the web and return relevant results.
 * 
 * AVAILABLE OPERATIONS:
 * - search: Perform a web search and return results with snippets
 * 
 * @module web-search
 * @requires GOOGLE_API_KEY - Environment variable for API authentication
 * @requires GOOGLE_CSE_ID - Custom Search Engine ID
 * @see https://developers.google.com/custom-search/v1/overview
 */

import Exa from "exa-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface WebSearchResult {
  success: boolean;
  content: string;
  citations: string[];
  model: string;
  error?: string;
}

export interface SearchItem {
  title: string;
  link: string;
  snippet: string;
}

export interface WebSearchOptions {
  query: string;
  maxResults?: number;
  maxTokens?: number;
  searchRecency?: "day" | "week" | "month" | "year";
  domains?: string[];
  provider?: "google" | "exa";
}

const GOOGLE_SEARCH_API_URL = "https://www.googleapis.com/customsearch/v1";

/**
 * Perform a web search using Google Custom Search API or Exa
 * 
 * @param options - Search options including query and filters
 * @returns Search result with content and citations
 */
export async function webSearch(options: WebSearchOptions): Promise<WebSearchResult> {
  const provider = options.provider || "gemini"; // Default to Gemini now due to Custom Search API issues
  
  if (provider === "exa") {
    return await exaSearch(options);
  }

  if (provider === "google") {
      // Fallback to legacy Google Custom Search if explicitly requested
      return await googleCustomSearch(options);
  }

  // Default to Gemini Search Grounding
  return await geminiSearch(options);
}

async function geminiSearch(options: WebSearchOptions): Promise<WebSearchResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        // Fallback to Google Custom Search if Gemini Key is missing but Google Key is present?
        // Or return error.
        if (process.env.GOOGLE_SEARCH_API_KEY) {
            return await googleCustomSearch(options);
        }
        return {
            success: false,
            content: "",
            citations: [],
            model: "gemini-search",
            error: "GEMINI_API_KEY is not configured."
        };
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            tools: [{ googleSearch: {} } as any] 
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: options.query }] }]
        });
        
        const response = await result.response;
        const text = response.text();
        const metadata = response.candidates?.[0]?.groundingMetadata;
        
        const citations: string[] = [];
        if (metadata?.groundingChunks) {
            metadata.groundingChunks.forEach((chunk: any) => {
                if (chunk.web?.uri) {
                    citations.push(chunk.web.uri);
                }
            });
        }
        
        // Format content with citations if possible, or just return the text
        let content = text;
        if (citations.length > 0) {
            content += "\n\n**Sources:**\n" + citations.map(url => `- ${url}`).join("\n");
        }

        return {
            success: true,
            content: content,
            citations: citations,
            model: "gemini-2.5-flash-grounding"
        };

    } catch (error: any) {
         // Fallback to Google Custom Search on error?
         if (process.env.GOOGLE_SEARCH_API_KEY) {
            console.warn("Gemini Search failed, falling back to Google Custom Search:", error.message);
            return await googleCustomSearch(options);
         }
         
        return {
            success: false,
            content: "",
            citations: [],
            model: "gemini-search",
            error: `Gemini search failed: ${error.message}`
        };
    }
}

async function googleCustomSearch(options: WebSearchOptions): Promise<WebSearchResult> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cseId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!apiKey) {
    return {
      success: false,
      content: "",
      citations: [],
      model: "google-custom-search",
      error: "GOOGLE_SEARCH_API_KEY is not configured. Please add it to your environment secrets."
    };
  }

  if (!cseId) {
    return {
      success: false,
      content: "",
      citations: [],
      model: "google-custom-search",
      error: "GOOGLE_SEARCH_ENGINE_ID is not configured. Please add it to your environment secrets."
    };
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx: cseId,
      q: options.query,
      num: (options.maxResults || 10).toString()
    });

    // Add date restriction based on recency filter
    if (options.searchRecency) {
      const dateRestrict = getDateRestrict(options.searchRecency);
      if (dateRestrict) {
        params.append("dateRestrict", dateRestrict);
      }
    }

    // Add site search if domains specified
    if (options.domains && options.domains.length > 0) {
      const siteSearch = options.domains.join(" OR site:");
      params.set("q", `site:${siteSearch} ${options.query}`);
    }

    const response = await fetch(`${GOOGLE_SEARCH_API_URL}?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        content: "",
        citations: [],
        model: "google-custom-search",
        error: `Google Search API error: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json() as {
      items?: Array<{
        title: string;
        link: string;
        snippet: string;
      }>;
      searchInformation?: {
        totalResults: string;
        formattedTotalResults: string;
      };
    };

    const items = data.items || [];
    
    if (items.length === 0) {
      return {
        success: true,
        content: "No results found for your search query.",
        citations: [],
        model: "google-custom-search"
      };
    }

    // Format results into readable content
    const content = formatResults(items);
    const citations = items.map(item => item.link);

    return {
      success: true,
      content,
      citations,
      model: "google-custom-search"
    };
  } catch (error: any) {
    return {
      success: false,
      content: "",
      citations: [],
      model: "google-custom-search",
      error: `Web search failed: ${error.message}`
    };
  }
}

async function exaSearch(options: WebSearchOptions): Promise<WebSearchResult> {
  const apiKey = process.env.EXA_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      content: "",
      citations: [],
      model: "exa-search",
      error: "EXA_API_KEY is not configured. Please add it to your environment secrets."
    };
  }

  try {
    const exa = new Exa(apiKey);
    
    // Convert recency to startPublishedDate if possible, but Exa JS client usage might differ.
    // Basic search first.
    
    const result = await exa.searchAndContents(
      options.query,
      {
        numResults: options.maxResults || 10,
        useAutoprompt: true,
        // highlights: true // Optional
      }
    );

    if (!result.results || result.results.length === 0) {
      return {
        success: true,
        content: "No results found for your search query on Exa.",
        citations: [],
        model: "exa-search"
      };
    }

    const items = result.results.map(r => ({
      title: r.title || "Untitled",
      link: r.url,
      snippet: r.text // Exa returns full text or summary depending on options. Default is usually some text.
    }));

    // Format results
    let content = `Found ${items.length} results via Exa:\n\n`;
    items.forEach((item, index) => {
      content += `**${index + 1}. ${item.title}**\n`;
      // Truncate snippet if too long
      const snippet = item.snippet.length > 300 ? item.snippet.substring(0, 300) + "..." : item.snippet;
      content += `${snippet}\n`;
      content += `[${item.link}](${item.link})\n\n`;
    });

    return {
      success: true,
      content: content.trim(),
      citations: items.map(i => i.link),
      model: "exa-search"
    };

  } catch (error: any) {
    return {
      success: false,
      content: "",
      citations: [],
      model: "exa-search",
      error: `Exa search failed: ${error.message}`
    };
  }
}

/**
 * Convert recency filter to Google's dateRestrict parameter
 */
function getDateRestrict(recency: "day" | "week" | "month" | "year"): string {
  switch (recency) {
    case "day":
      return "d1";
    case "week":
      return "w1";
    case "month":
      return "m1";
    case "year":
      return "y1";
    default:
      return "";
  }
}

/**
 * Format search results into readable content
 */
function formatResults(items: Array<{ title: string; link: string; snippet: string }>): string {
  let content = `Found ${items.length} results:\n\n`;
  
  items.forEach((item, index) => {
    content += `**${index + 1}. ${item.title}**\n`;
    content += `${item.snippet}\n`;
    content += `[${item.link}](${item.link})\n\n`;
  });

  return content.trim();
}

/**
 * Format search results for display in chat
 * 
 * @param result - The search result to format
 * @returns Formatted string with content and citations
 */
export function formatSearchResult(result: WebSearchResult): string {
  if (!result.success) {
    return `Search Error: ${result.error}`;
  }

  return result.content;
}



