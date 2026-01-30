#!/usr/bin/env node

/**
 * =============================================================================
 * PLAYWRIGHT MCP SERVER
 * =============================================================================
 * 
 * A Model Context Protocol (MCP) server that exposes Playwright browser
 * automation capabilities to AI assistants like Claude.
 * 
 * This allows AI to:
 * - Navigate web pages
 * - Click buttons and fill forms
 * - Take screenshots
 * - Extract text and data
 * - Execute JavaScript
 * - Manage multiple tabs
 * 
 * =============================================================================
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium, Browser, Page, BrowserContext } from "playwright";

// =============================================================================
// SERVER STATE
// =============================================================================

let browser: Browser | null = null;
let defaultContext: BrowserContext | null = null;
let defaultPage: Page | null = null;
const contexts = new Map<string, BrowserContext>();
const pages = new Map<string, Page>();

// =============================================================================
// BROWSER INITIALIZATION
// =============================================================================

/**
 * Ensure browser and default page are initialized
 */
async function ensureBrowser(): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.error("[Playwright MCP] Browser launched");
  }
  
  if (!defaultContext) {
    defaultContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
  }
  
  if (!defaultPage) {
    defaultPage = await defaultContext.newPage();
    console.error("[Playwright MCP] Default page created");
  }
  
  return defaultPage;
}

/**
 * Get a specific page by ID, or default page if no ID provided
 */
function getPage(pageId?: string): Page | null {
  if (pageId) {
    return pages.get(pageId) || null;
  }
  return defaultPage;
}

// =============================================================================
// MCP SERVER SETUP
// =============================================================================

const server = new Server(
  {
    name: "playwright-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const tools: Tool[] = [
  {
    name: "browser_navigate",
    description: "Navigate to a URL in the browser",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to navigate to (must include http:// or https://)",
        },
        pageId: {
          type: "string",
          description: "Optional page ID to navigate (uses default if not provided)",
        },
        waitUntil: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle"],
          description: "When to consider navigation complete (default: load)",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_screenshot",
    description: "Take a screenshot of the current page or a specific element",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
        selector: {
          type: "string",
          description: "CSS selector to screenshot specific element (full page if not provided)",
        },
        fullPage: {
          type: "boolean",
          description: "Capture full scrollable page (default: false)",
        },
      },
    },
  },
  {
    name: "browser_click",
    description: "Click an element on the page",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element to click",
        },
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
        button: {
          type: "string",
          enum: ["left", "right", "middle"],
          description: "Mouse button to click (default: left)",
        },
        clickCount: {
          type: "number",
          description: "Number of clicks (default: 1, use 2 for double-click)",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_fill",
    description: "Fill out a form field with text",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the input element",
        },
        value: {
          type: "string",
          description: "Text to fill into the field",
        },
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "browser_select",
    description: "Select an option from a dropdown",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the select element",
        },
        value: {
          type: "string",
          description: "Value to select",
        },
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "browser_extract_text",
    description: "Extract text content from the page or specific elements",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector (extracts from body if not provided)",
        },
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
        all: {
          type: "boolean",
          description: "Extract all matching elements (default: false)",
        },
      },
    },
  },
  {
    name: "browser_evaluate",
    description: "Execute JavaScript code in the browser context",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "JavaScript code to execute",
        },
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
      },
      required: ["script"],
    },
  },
  {
    name: "browser_wait_for_selector",
    description: "Wait for an element to appear on the page",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to wait for",
        },
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
        timeout: {
          type: "number",
          description: "Maximum wait time in milliseconds (default: 30000)",
        },
        state: {
          type: "string",
          enum: ["attached", "detached", "visible", "hidden"],
          description: "Wait for element state (default: visible)",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_get_html",
    description: "Get the HTML content of the page or a specific element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector (gets full page HTML if not provided)",
        },
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
      },
    },
  },
  {
    name: "browser_new_page",
    description: "Create a new page/tab",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Optional URL to navigate to immediately",
        },
      },
    },
  },
  {
    name: "browser_close_page",
    description: "Close a specific page/tab",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "Page ID to close (cannot close default page)",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "browser_list_pages",
    description: "List all open pages/tabs with their IDs and URLs",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "browser_get_cookies",
    description: "Get cookies for the current page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
      },
    },
  },
  {
    name: "browser_set_cookie",
    description: "Set a cookie for the current page",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Cookie name",
        },
        value: {
          type: "string",
          description: "Cookie value",
        },
        domain: {
          type: "string",
          description: "Cookie domain",
        },
        path: {
          type: "string",
          description: "Cookie path (default: /)",
        },
        pageId: {
          type: "string",
          description: "Optional page ID (uses default if not provided)",
        },
      },
      required: ["name", "value"],
    },
  },
];

// =============================================================================
// TOOL REQUEST HANDLERS
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "browser_navigate": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        await page.goto(args.url, { 
          waitUntil: (args.waitUntil as any) || "load",
          timeout: 30000 
        });
        
        const title = await page.title();
        const url = page.url();
        
        return {
          content: [{
            type: "text",
            text: `Navigated to ${url}\nTitle: ${title}`,
          }],
        };
      }

      case "browser_screenshot": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        let screenshot: Buffer;
        if (args.selector) {
          const element = await page.$(args.selector);
          if (!element) throw new Error(`Element not found: ${args.selector}`);
          screenshot = await element.screenshot();
        } else {
          screenshot = await page.screenshot({ 
            fullPage: args.fullPage || false 
          });
        }
        
        return {
          content: [{
            type: "image",
            data: screenshot.toString("base64"),
            mimeType: "image/png",
          }],
        };
      }

      case "browser_click": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        await page.click(args.selector, {
          button: (args.button as any) || "left",
          clickCount: args.clickCount || 1,
        });
        
        return {
          content: [{
            type: "text",
            text: `Clicked element: ${args.selector}`,
          }],
        };
      }

      case "browser_fill": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        await page.fill(args.selector, args.value);
        
        return {
          content: [{
            type: "text",
            text: `Filled ${args.selector} with: ${args.value}`,
          }],
        };
      }

      case "browser_select": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        await page.selectOption(args.selector, args.value);
        
        return {
          content: [{
            type: "text",
            text: `Selected ${args.value} in ${args.selector}`,
          }],
        };
      }

      case "browser_extract_text": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        const selector = args.selector || "body";
        let text: string;
        
        if (args.all) {
          const elements = await page.$$(selector);
          const texts = await Promise.all(
            elements.map(el => el.textContent())
          );
          text = texts.filter(Boolean).join("\n\n");
        } else {
          text = await page.textContent(selector) || "";
        }
        
        return {
          content: [{
            type: "text",
            text: text,
          }],
        };
      }

      case "browser_evaluate": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        const result = await page.evaluate(args.script);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2),
          }],
        };
      }

      case "browser_wait_for_selector": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        await page.waitForSelector(args.selector, {
          timeout: args.timeout || 30000,
          state: (args.state as any) || "visible",
        });
        
        return {
          content: [{
            type: "text",
            text: `Element appeared: ${args.selector}`,
          }],
        };
      }

      case "browser_get_html": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        let html: string;
        if (args.selector) {
          html = await page.innerHTML(args.selector);
        } else {
          html = await page.content();
        }
        
        return {
          content: [{
            type: "text",
            text: html,
          }],
        };
      }

      case "browser_new_page": {
        await ensureBrowser(); // Ensure browser is initialized
        if (!defaultContext) throw new Error("Browser context not initialized");
        
        const newPage = await defaultContext.newPage();
        const pageId = `page_${Date.now()}`;
        pages.set(pageId, newPage);
        
        if (args.url) {
          await newPage.goto(args.url);
        }
        
        return {
          content: [{
            type: "text",
            text: `Created new page: ${pageId}${args.url ? `\nNavigated to: ${args.url}` : ''}`,
          }],
        };
      }

      case "browser_close_page": {
        const page = pages.get(args.pageId);
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        await page.close();
        pages.delete(args.pageId);
        
        return {
          content: [{
            type: "text",
            text: `Closed page: ${args.pageId}`,
          }],
        };
      }

      case "browser_list_pages": {
        const pageList: string[] = [];
        
        if (defaultPage) {
          pageList.push(`default: ${defaultPage.url()}`);
        }
        
        for (const [id, page] of pages) {
          pageList.push(`${id}: ${page.url()}`);
        }
        
        return {
          content: [{
            type: "text",
            text: pageList.length > 0 
              ? "Open pages:\n" + pageList.join("\n")
              : "No pages open",
          }],
        };
      }

      case "browser_get_cookies": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        const context = page.context();
        const cookies = await context.cookies();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(cookies, null, 2),
          }],
        };
      }

      case "browser_set_cookie": {
        const page = args.pageId ? getPage(args.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${args.pageId}`);
        
        const context = page.context();
        await context.addCookies([{
          name: args.name,
          value: args.value,
          domain: args.domain,
          path: args.path || "/",
          url: page.url(),
        }]);
        
        return {
          content: [{
            type: "text",
            text: `Set cookie: ${args.name}=${args.value}`,
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stack || ''}`,
      }],
      isError: true,
    };
  }
});

// =============================================================================
// SERVER START & CLEANUP
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("Playwright MCP server running on stdio");
  console.error("Available tools: " + tools.length);

  // Cleanup on exit
  const cleanup = async () => {
    console.error("Cleaning up...");
    
    // Close all pages
    for (const [id, page] of pages) {
      try {
        await page.close();
      } catch (e) {
        console.error(`Error closing page ${id}:`, e);
      }
    }
    
    // Close browser
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error("Error closing browser:", e);
      }
    }
    
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((error) => {
  console.error("Fatal server error:", error);
  process.exit(1);
});
