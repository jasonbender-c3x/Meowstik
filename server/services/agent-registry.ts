import { db } from "../db"; 
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";

/**
 * Service to manage active agents.
 * FIX: Updated database import to use the modern 'db' export.
 */

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
}

export class AgentRegistry {
  private agents: Map<string, AgentProfile> = new Map();

  constructor() {
    // Initialize default agents
    this.register({
      id: "coder",
      name: "Meowstik Coder",
      role: "assistant",
      capabilities: ["code-generation", "refactoring", "debugging"]
    });
  }

  register(profile: AgentProfile) {
    this.agents.set(profile.id, profile);
  }

  get(id: string): AgentProfile | undefined {
    return this.agents.get(id);
  }

  getAll(): AgentProfile[] {
    return Array.from(this.agents.values());
  }

  // Example database interaction
  async getAgentFromUser(userId: number) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user ? { id: `user-${user.id}`, name: user.username, role: user.role, capabilities: [] } : null;
  }
}

export const agentRegistry = new AgentRegistry();