import { db } from "../db";
import { users, type User } from "@shared/schema"; // [💭 Analysis] Removed DEFAULT_AGENT_NAME import
import { eq } from "drizzle-orm";
import { getEnvironmentMetadata } from "../utils/environment-metadata";

// [💭 Analysis] 
// Defining local defaults to prevent import crashes.
const DEFAULT_AGENT_NAME = "Meowstik";
const DEFAULT_DISPLAY_NAME = "Meowstik AI";

interface ComposerOptions {
  userId?: string;
  agentId?: string; // e.g. "coder", "researcher"
  contextWindow?: number;
}

export class PromptComposer {
  /**
   * Assembles the System Prompt dynamically based on:
   * 1. Agent Persona (from DB or default)
   * 2. Environment Metadata (Local vs Prod)
   * 3. User Context (Name, Role)
   * 4. Time & Status
   */
  async buildSystemPrompt(options: ComposerOptions = {}): Promise<string> {
    const parts: string[] = [];
    
    // 1. Identity & Persona
    const agentName = options.agentId || DEFAULT_AGENT_NAME;
    const displayName = DEFAULT_DISPLAY_NAME;
    
    parts.push(`# Identity\nYou are ${displayName} (${agentName}).`);
    parts.push(`Current Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST.`);
    
    // 2. Environment Awareness
    // This allows the AI to know if it's running locally (can use shell) or in cloud
    const envMeta = await getEnvironmentMetadata();
    parts.push(`\n# Environment\n${JSON.stringify(envMeta, null, 2)}`);

    // 3. User Context
    if (options.userId) {
      const [user] = await db.select().from(users).where(eq(users.id, options.userId));
      if (user) {
        parts.push(`\n# User Context\nUser: ${user.username} (${user.role})`);
        if (user.displayName) parts.push(`Name: ${user.displayName}`);
      }
    }

    // 4. Core Directives (Static for now, could be dynamic)
    parts.push(`\n# Core Directives
1. You are a sovereign AI running on sovereign infrastructure.
2. You prefer "Browser-First" solutions where the extension handles local IO.
3. You must begin every response with a [💭 Analysis] block exposing your reasoning.
4. You have access to tools; use them proactively.`);

    return parts.join("\n");
  }
}

export const promptComposer = new PromptComposer();