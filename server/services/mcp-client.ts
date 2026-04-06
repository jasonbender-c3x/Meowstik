
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Point to source directly and use tsx to avoid build step
const SERVER_SRC_PATH = path.resolve(__dirname, "../../servers/puppeteer-mcp/src/index.ts");
const SERVER_DIR = path.dirname(SERVER_SRC_PATH);

export class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void }>();
  private buffer = "";

  constructor() {
    // Lazy start
  }

  private startServer() {
    if (!fs.existsSync(SERVER_SRC_PATH)) {
      console.error("MCP Server source not found at", SERVER_SRC_PATH);
      return;
    }

    console.log("Starting MCP Server from", SERVER_SRC_PATH);
    
    // Use npx tsx to run the server directly from source
    this.process = spawn("npx", ["tsx", SERVER_SRC_PATH], {
      stdio: ["pipe", "pipe", "inherit"],
      cwd: SERVER_DIR,
      env: { ...process.env }
    });

    this.process.stdout?.on("data", (data) => {
      this.handleData(data);
    });

    this.process.on("error", (err) => {
      console.error("MCP Server process error:", err);
    });
    
    this.process.on("exit", (code) => {
      console.log("MCP Server exited with code", code);
      this.process = null;
      // Re-start logic could go here
    });
  }

  private handleData(chunk: Buffer) {
    this.buffer += chunk.toString();
    
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line);
        // Handle response
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const { resolve, reject } = this.pendingRequests.get(msg.id)!;
          
          if (msg.error) {
            reject(new Error(msg.error.message || "Unknown error"));
          } else if (msg.result) {
            resolve(msg.result);
          } else {
             // JSON-RPC 2.0 success response might just have result (even if null)
             // Check if result property exists
             if ('result' in msg) {
                 resolve(msg.result);
             } else {
                 // Maybe it's a notification or partial?
             }
          }
          this.pendingRequests.delete(msg.id);
        }
      } catch (e) {
        // Ignore non-JSON lines (e.g. debug logs from server)
      }
    }
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.process) {
      this.startServer();
      // Give it a moment to start? Usually stdio is ready immediately.
      // But maybe we should wait for a ready signal? 
      // For now, assume it's ready.
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const id = this.requestId++;
    // MCP CallToolRequest
    // method: tools/call
    // params: { name: string, arguments: object }
    const request = {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name,
        arguments: args || {}
      }
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      if (this.process?.stdin) {
        const payload = JSON.stringify(request) + "\n";
        this.process.stdin.write(payload);
      } else {
        this.pendingRequests.delete(id);
        reject(new Error("MCP Server process not running"));
      }
    });
  }

  async listTools(): Promise<any> {
      // Implement if needed
      return [];
  }
}

export const mcpClient = new MCPClient();



