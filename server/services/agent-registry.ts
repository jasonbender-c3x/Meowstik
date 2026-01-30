/**
 * =============================================================================
 * AGENT REGISTRY SERVICE
 * =============================================================================
 * 
 * Centralized registry for managing specialized agents in the system.
 * Provides agent discovery, capability matching, and load balancing.
 * 
 * This complements the orchestrator by providing a persistent registry
 * that can be used across the system.
 */

import { getDb } from "../db";
import { agentIdentities, type AgentIdentity, type InsertAgentIdentity } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

export interface AgentCapabilityDefinition {
  name: string;
  description: string;
  category: "planning" | "research" | "coding" | "review" | "communication" | "integration" | "analysis";
  tags: string[];
  requiredTools?: string[];
  conflictsWith?: string[]; // Capabilities that conflict with this one
}

export interface AgentRegistration {
  name: string;
  email: string;
  agentType: "compiler" | "guest" | "specialized";
  displayName: string;
  description: string;
  capabilities: string[]; // Capability names
  permissionLevel: "full" | "limited" | "readonly";
  metadata?: {
    maxConcurrency?: number;
    priority?: number;
    supportedDomains?: string[];
    [key: string]: unknown;
  };
}

export interface AgentSearchCriteria {
  capabilities?: string[];
  category?: AgentCapabilityDefinition["category"];
  agentType?: AgentIdentity["agentType"];
  permissionLevel?: AgentIdentity["permissionLevel"];
  tags?: string[];
}

// =============================================================================
// CAPABILITY CATALOG
// =============================================================================

/**
 * Predefined capabilities that agents can have
 */
export const AGENT_CAPABILITIES: Record<string, AgentCapabilityDefinition> = {
  // Planning capabilities
  task_decomposition: {
    name: "task_decomposition",
    description: "Break down complex goals into actionable subtasks",
    category: "planning",
    tags: ["planning", "strategy", "decomposition"],
  },
  dependency_analysis: {
    name: "dependency_analysis",
    description: "Identify and analyze task dependencies",
    category: "planning",
    tags: ["planning", "dependencies", "scheduling"],
  },
  workflow_design: {
    name: "workflow_design",
    description: "Design and optimize workflows",
    category: "planning",
    tags: ["planning", "workflow", "optimization"],
  },

  // Research capabilities
  web_research: {
    name: "web_research",
    description: "Search and gather information from the web",
    category: "research",
    tags: ["research", "web", "information"],
    requiredTools: ["google_search", "web_scrape", "tavily_research"],
  },
  document_analysis: {
    name: "document_analysis",
    description: "Analyze and extract insights from documents",
    category: "research",
    tags: ["research", "documents", "analysis"],
    requiredTools: ["file_get", "docs_read"],
  },
  data_synthesis: {
    name: "data_synthesis",
    description: "Synthesize information from multiple sources",
    category: "research",
    tags: ["research", "synthesis", "aggregation"],
  },

  // Coding capabilities
  code_generation: {
    name: "code_generation",
    description: "Generate code from specifications",
    category: "coding",
    tags: ["coding", "generation", "development"],
    requiredTools: ["file_put", "terminal_execute"],
  },
  code_review: {
    name: "code_review",
    description: "Review and provide feedback on code",
    category: "review",
    tags: ["coding", "review", "quality"],
    requiredTools: ["file_get", "github_code_search"],
  },
  code_refactoring: {
    name: "code_refactoring",
    description: "Refactor and improve existing code",
    category: "coding",
    tags: ["coding", "refactoring", "improvement"],
    requiredTools: ["file_get", "file_put"],
  },
  testing: {
    name: "testing",
    description: "Write and execute tests",
    category: "coding",
    tags: ["coding", "testing", "quality"],
    requiredTools: ["file_put", "terminal_execute"],
  },

  // Communication capabilities
  email_management: {
    name: "email_management",
    description: "Send, read, and manage emails",
    category: "communication",
    tags: ["communication", "email", "gmail"],
    requiredTools: ["gmail_send", "gmail_read", "gmail_search"],
  },
  document_creation: {
    name: "document_creation",
    description: "Create and edit documents",
    category: "communication",
    tags: ["communication", "documents", "writing"],
    requiredTools: ["docs_create", "docs_append"],
  },
  presentation: {
    name: "presentation",
    description: "Present information clearly",
    category: "communication",
    tags: ["communication", "presentation", "formatting"],
  },

  // Integration capabilities
  api_integration: {
    name: "api_integration",
    description: "Integrate with external APIs",
    category: "integration",
    tags: ["integration", "api", "external"],
    requiredTools: ["api_call"],
  },
  database_operations: {
    name: "database_operations",
    description: "Perform database operations",
    category: "integration",
    tags: ["integration", "database", "data"],
  },
  file_operations: {
    name: "file_operations",
    description: "Read, write, and manage files",
    category: "integration",
    tags: ["integration", "files", "storage"],
    requiredTools: ["file_get", "file_put"],
  },

  // Analysis capabilities
  data_analysis: {
    name: "data_analysis",
    description: "Analyze data and generate insights",
    category: "analysis",
    tags: ["analysis", "data", "insights"],
  },
  pattern_recognition: {
    name: "pattern_recognition",
    description: "Identify patterns and trends",
    category: "analysis",
    tags: ["analysis", "patterns", "trends"],
  },
  error_diagnosis: {
    name: "error_diagnosis",
    description: "Diagnose errors and issues",
    category: "analysis",
    tags: ["analysis", "debugging", "diagnosis"],
  },
};

// =============================================================================
// AGENT REGISTRY SERVICE
// =============================================================================

class AgentRegistryService {
  /**
   * Register a new agent in the system
   */
  async registerAgent(registration: AgentRegistration): Promise<AgentIdentity> {
    // Validate capabilities
    const invalidCapabilities = registration.capabilities.filter(
      (cap) => !AGENT_CAPABILITIES[cap]
    );
    if (invalidCapabilities.length > 0) {
      throw new Error(
        `Invalid capabilities: ${invalidCapabilities.join(", ")}`
      );
    }

    // Create agent identity
    const agentData: InsertAgentIdentity = {
      name: registration.name,
      email: registration.email,
      agentType: registration.agentType,
      permissionLevel: registration.permissionLevel,
      displayName: registration.displayName,
      description: registration.description,
      enabled: true,
      githubSignature: `Automated by ${registration.displayName}`,
    };

    const [agent] = await getDb()
      .insert(agentIdentities)
      .values(agentData)
      .returning();

    console.log(
      `[AgentRegistry] Registered agent: ${agent.displayName} (${agent.id})`
    );

    return agent;
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<boolean> {
    const result = await getDb()
      .delete(agentIdentities)
      .where(eq(agentIdentities.id, agentId));

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<AgentIdentity | null> {
    const [agent] = await getDb()
      .select()
      .from(agentIdentities)
      .where(eq(agentIdentities.id, agentId))
      .limit(1);

    return agent || null;
  }

  /**
   * Get all agents
   */
  async getAllAgents(enabledOnly: boolean = true): Promise<AgentIdentity[]> {
    let query = getDb().select().from(agentIdentities);

    if (enabledOnly) {
      query = query.where(eq(agentIdentities.enabled, true)) as any;
    }

    return await query;
  }

  /**
   * Search for agents matching criteria
   */
  async findAgents(criteria: AgentSearchCriteria): Promise<AgentIdentity[]> {
    let query = getDb().select().from(agentIdentities);

    const conditions: any[] = [eq(agentIdentities.enabled, true)];

    if (criteria.agentType) {
      conditions.push(eq(agentIdentities.agentType, criteria.agentType));
    }

    if (criteria.permissionLevel) {
      conditions.push(
        eq(agentIdentities.permissionLevel, criteria.permissionLevel)
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const agents = await query;

    // Further filter by capabilities if provided
    // Note: In a real implementation, capabilities would be stored
    // in the database. For now, we return all matching agents.
    return agents;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(
    agentId: string,
    enabled: boolean
  ): Promise<AgentIdentity | null> {
    const [updated] = await getDb()
      .update(agentIdentities)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(agentIdentities.id, agentId))
      .returning();

    return updated || null;
  }

  /**
   * Get capability definition
   */
  getCapability(capabilityName: string): AgentCapabilityDefinition | null {
    return AGENT_CAPABILITIES[capabilityName] || null;
  }

  /**
   * Get all capabilities
   */
  getAllCapabilities(): AgentCapabilityDefinition[] {
    return Object.values(AGENT_CAPABILITIES);
  }

  /**
   * Get capabilities by category
   */
  getCapabilitiesByCategory(
    category: AgentCapabilityDefinition["category"]
  ): AgentCapabilityDefinition[] {
    return Object.values(AGENT_CAPABILITIES).filter(
      (cap) => cap.category === category
    );
  }

  /**
   * Check if capabilities are compatible
   */
  areCapabilitiesCompatible(capabilities: string[]): {
    compatible: boolean;
    conflicts: string[];
  } {
    const conflicts: string[] = [];

    for (const capName of capabilities) {
      const cap = AGENT_CAPABILITIES[capName];
      if (!cap || !cap.conflictsWith) continue;

      for (const otherCapName of capabilities) {
        if (
          otherCapName !== capName &&
          cap.conflictsWith.includes(otherCapName)
        ) {
          conflicts.push(`${capName} conflicts with ${otherCapName}`);
        }
      }
    }

    return {
      compatible: conflicts.length === 0,
      conflicts,
    };
  }

  /**
   * Get required tools for capabilities
   */
  getRequiredTools(capabilities: string[]): string[] {
    const tools = new Set<string>();

    for (const capName of capabilities) {
      const cap = AGENT_CAPABILITIES[capName];
      if (cap?.requiredTools) {
        cap.requiredTools.forEach((tool) => tools.add(tool));
      }
    }

    return Array.from(tools);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const agentRegistry = new AgentRegistryService();
export default agentRegistry;
