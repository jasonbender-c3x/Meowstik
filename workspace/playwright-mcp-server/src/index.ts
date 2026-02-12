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

  if (!args) {
    throw new Error(`Arguments are required for tool: ${name}`);
  }

  // Cast to any to handle the many dynamic property accesses in the switch
  const toolArgs = args as any;

  try {
    switch (name) {
      case "browser_navigate": {
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        await page.goto(toolArgs.url, { 
          waitUntil: (toolArgs.waitUntil as any) || "load",
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
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        let screenshot: Buffer;
        if (toolArgs.selector) {
          const element = await page.$(toolArgs.selector);
          if (!element) throw new Error(`Element not found: ${toolArgs.selector}`);
          screenshot = await element.screenshot();
        } else {
          screenshot = await page.screenshot({ 
            fullPage: toolArgs.fullPage || false 
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
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        await page.click(toolArgs.selector, {
          button: (toolArgs.button as any) || "left",
          clickCount: toolArgs.clickCount || 1,
        });
        
        return {
          content: [{
            type: "text",
            text: `Clicked element: ${toolArgs.selector}`,
          }],
        };
      }

      case "browser_fill": {
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        await page.fill(toolArgs.selector, toolArgs.value);
        
        return {
          content: [{
            type: "text",
            text: `Filled ${toolArgs.selector} with: ${toolArgs.value}`,
          }],
        };
      }

      case "browser_select": {
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        await page.selectOption(toolArgs.selector, toolArgs.value);
        
        return {
          content: [{
            type: "text",
            text: `Selected ${toolArgs.value} in ${toolArgs.selector}`,
          }],
        };
      }

      case "browser_extract_text": {
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        const selector = toolArgs.selector || "body";
        let text: string;
        
        if (toolArgs.all) {
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
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        const result = await page.evaluate(toolArgs.script);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2),
          }],
        };
      }

      case "browser_wait_for_selector": {
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        await page.waitForSelector(toolArgs.selector, {
          timeout: toolArgs.timeout || 30000,
          state: (toolArgs.state as any) || "visible",
        });
        
        return {
          content: [{
            type: "text",
            text: `Element appeared: ${toolArgs.selector}`,
          }],
        };
      }

      case "browser_get_html": {
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        let html: string;
        if (toolArgs.selector) {
          html = await page.innerHTML(toolArgs.selector);
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
        
        if (toolArgs.url) {
          await newPage.goto(toolArgs.url);
        }
        
        return {
          content: [{
            type: "text",
            text: `Created new page: ${pageId}${toolArgs.url ? `\nNavigated to: ${toolArgs.url}` : ''}`,
          }],
        };
      }

      case "browser_close_page": {
        const page = pages.get(toolArgs.pageId);
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        await page.close();
        pages.delete(toolArgs.pageId);
        
        return {
          content: [{
            type: "text",
            text: `Closed page: ${toolArgs.pageId}`,
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
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
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
        const page = toolArgs.pageId ? getPage(toolArgs.pageId) : await ensureBrowser();
        if (!page) throw new Error(`Page not found: ${toolArgs.pageId}`);
        
        const context = page.context();
        await context.addCookies([{
          name: toolArgs.name,
          value: toolArgs.value,
          domain: toolArgs.domain,
          path: toolArgs.path || "/",
          url: page.url(),
        }]);
        
        return {
          content: [{
            type: "text",
            text: `Set cookie: ${toolArgs.name}=${toolArgs.value}`,
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
