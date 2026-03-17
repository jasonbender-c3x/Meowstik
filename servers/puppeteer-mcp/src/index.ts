#!/usr/bin/env node

/**
 * Puppeteer MCP Server
 * 
 * Provides browser automation capabilities via the Model Context Protocol.
 * Capabilities:
 * - navigate: Load a URL
 * - click: Click an element
 * - type: Type text into an input
 * - screenshot: Capture a screenshot
 * - evaluate: Execute JavaScript in the page context
 * - content: Get page content (HTML or text)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer, { Browser, Page } from "puppeteer";
import { z } from "zod";

// Schema definitions
const NavigateArgsSchema = z.object({
  url: z.string().url(),
  timeout: z.number().optional().default(30000),
});

const ClickArgsSchema = z.object({
  selector: z.string(),
  timeout: z.number().optional().default(5000),
});

const TypeArgsSchema = z.object({
  selector: z.string(),
  text: z.string(),
  delay: z.number().optional().default(0),
});

const ScreenshotArgsSchema = z.object({
  fullPage: z.boolean().optional().default(false),
});

const EvaluateArgsSchema = z.object({
  script: z.string(),
});

const ContentArgsSchema = z.object({
  format: z.enum(["html", "text"]).optional().default("html"),
});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "puppeteer_navigate",
    description: "Navigate to a URL in the browser",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to navigate to" },
        timeout: { type: "number", description: "Navigation timeout in ms (default: 30000)" },
      },
      required: ["url"],
    },
  },
  {
    name: "puppeteer_click",
    description: "Click an element on the current page",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to click" },
        timeout: { type: "number", description: "Wait timeout in ms (default: 5000)" },
      },
      required: ["selector"],
    },
  },
  {
    name: "puppeteer_type",
    description: "Type text into an input field",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the input field" },
        text: { type: "string", description: "Text to type" },
        delay: { type: "number", description: "Delay between keystrokes in ms (default: 0)" },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "puppeteer_screenshot",
    description: "Take a screenshot of the current page",
    inputSchema: {
      type: "object",
      properties: {
        fullPage: { type: "boolean", description: "Capture full scrollable page (default: false)" },
      },
    },
  },
  {
    name: "puppeteer_evaluate",
    description: "Execute JavaScript in the page context",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "JavaScript code to execute" },
      },
      required: ["script"],
    },
  },
  {
    name: "puppeteer_content",
    description: "Get the content of the current page",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["html", "text"], description: "Output format (default: html)" },
      },
    },
  },
];

// Server implementation
class PuppeteerServer {
  private server: Server;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "puppeteer-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.ensureBrowser();

      if (!this.page) {
        throw new Error("Browser page not initialized");
      }

      switch (request.params.name) {
        case "puppeteer_navigate": {
          const args = NavigateArgsSchema.parse(request.params.arguments);
          await this.page.goto(args.url, { timeout: args.timeout });
          return {
            content: [{ type: "text", text: `Navigated to ${args.url}` }],
          };
        }

        case "puppeteer_click": {
          const args = ClickArgsSchema.parse(request.params.arguments);
          await this.page.waitForSelector(args.selector, { timeout: args.timeout });
          await this.page.click(args.selector);
          return {
            content: [{ type: "text", text: `Clicked element ${args.selector}` }],
          };
        }

        case "puppeteer_type": {
          const args = TypeArgsSchema.parse(request.params.arguments);
          await this.page.waitForSelector(args.selector);
          await this.page.type(args.selector, args.text, { delay: args.delay });
          return {
            content: [{ type: "text", text: `Typed text into ${args.selector}` }],
          };
        }

        case "puppeteer_screenshot": {
          const args = ScreenshotArgsSchema.parse(request.params.arguments);
          const screenshot = await this.page.screenshot({
            fullPage: args.fullPage,
            encoding: "base64",
          });
          return {
            content: [
              {
                type: "image",
                data: screenshot,
                mimeType: "image/png",
              },
            ],
          };
        }

        case "puppeteer_evaluate": {
          const args = EvaluateArgsSchema.parse(request.params.arguments);
          const result = await this.page.evaluate((script) => {
            // Use eval to execute the script string
            // eslint-disable-next-line no-eval
            return eval(script);
          }, args.script);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "puppeteer_content": {
          const args = ContentArgsSchema.parse(request.params.arguments);
          let content = "";
          if (args.format === "text") {
            content = await this.page.evaluate(() => document.body.innerText);
          } else {
            content = await this.page.content();
          }
          return {
            content: [{ type: "text", text: content }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  private async ensureBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true, // Use headless mode for server environment
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // Required for some environments
      });
      this.page = await this.browser.newPage();
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Puppeteer MCP Server running on stdio");
  }
}

// Start the server
const server = new PuppeteerServer();
server.start().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
