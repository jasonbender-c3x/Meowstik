#!/usr/bin/env node

import { Command } from "commander";
import { DesktopAgent } from "./agent.js";

const program = new Command();

program
  .name("meowstik-agent")
  .description("Meowstik Desktop Agent - AI-powered desktop collaboration")
  .version("1.0.0");

program
  .option("-t, --token <token>", "Session token for authentication (optional for localhost)")
  .option("-s, --server <url>", "Server URL (default: ws://localhost:5000)")
  .option("-r, --relay <url>", "Server relay URL (alias for --server)")
  .option("-f, --fps <number>", "Frames per second for screen capture (default: 2)", "2")
  .option("-q, --quality <number>", "JPEG quality 1-100 (default: 60)", "60")
  .option("--no-audio", "Disable audio capture")
  .option("--no-input", "Disable input injection (view only)")
  .action(async (options) => {
    // Support both --server and --relay flags
    const serverUrl = options.relay || options.server || process.env.MEOWSTIK_SERVER_URL || "ws://localhost:5000";
    
    // Check if connecting to localhost (parse URL properly for security)
    let isLocalhost = false;
    try {
      const url = new URL(serverUrl.startsWith('ws://') || serverUrl.startsWith('wss://') ? serverUrl : `ws://${serverUrl}`);
      // Only allow exact localhost addresses - no subdomains or variations
      const localhostAddresses = ['localhost', '127.0.0.1', '::1', '[::1]'];
      isLocalhost = localhostAddresses.includes(url.hostname.toLowerCase());
    } catch (e) {
      // Invalid URL - not localhost
      isLocalhost = false;
    }
    
    // Token is required for non-localhost connections
    if (!options.token && !isLocalhost) {
      console.error("Error: Session token is required for non-localhost connections.");
      console.error("Use --token <token> or connect to localhost for development.");
      process.exit(1);
    }

    console.log("🐱 Meowstik Desktop Agent");
    console.log("=========================");
    console.log(`Server: ${serverUrl}`);
    console.log(`Token: ${options.token ? "***" : "localhost (tokenless)"}`);
    console.log(`FPS: ${options.fps}`);
    console.log(`Quality: ${options.quality}%`);
    console.log(`Audio: ${options.audio ? "enabled" : "disabled"}`);
    console.log(`Input: ${options.input ? "enabled" : "disabled"}`);
    console.log("");

    const agent = new DesktopAgent({
      token: options.token || null,
      serverUrl,
      fps: parseInt(options.fps, 10),
      quality: parseInt(options.quality, 10),
      enableAudio: options.audio,
      enableInput: options.input,
    });

    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      await agent.disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await agent.disconnect();
      process.exit(0);
    });

    try {
      await agent.connect();
    } catch (error) {
      console.error("Failed to connect:", error);
      process.exit(1);
    }
  });

program.parse();
