/**
 * =============================================================================
 * SPECIALIZED AGENT DEFINITIONS
 * =============================================================================
 * 
 * Defines specialized sub-agents with domain-specific capabilities and
 * context isolation. Each agent type has:
 * - Specific tool access permissions
 * - Isolated execution context
 * - Domain expertise
 * - Resource limits
 * 
 * This implements the "Sub-Agent Specialization" concept from the
 * architectural vision.
 */

import type { AgentDefinition, AgentCapability } from "./orchestrator";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Agent domain categories
 */
export type AgentDomain =
  | "coding"
  | "personal_life"
  | "research"
  | "creative"
  | "communication"
  | "analysis";

/**
 * Tool access level
 */
export type ToolAccessLevel = "full" | "read-only" | "restricted" | "denied";

/**
 * Context isolation configuration
 */
export interface ContextIsolation {
  // Whether this agent has separate memory from others
  separateMemory: boolean;

  // Data access level
  dataAccess: "full" | "restricted" | "read-only" | "none";

  // Allowed data scopes
  allowedScopes: string[];

  // Prohibited data patterns
  prohibitedPatterns: string[];

  // Resource limits
  resourceLimits: {
    maxMemory: string; // e.g., "2GB"
    maxCPU: string; // e.g., "2cores"
    executionTimeout: string; // e.g., "5m"
    maxConcurrentTasks: number;
  };
}

/**
 * Tool access configuration
 */
export interface ToolAccess {
  // Explicitly allowed tools
  allowed: string[];

  // Explicitly denied tools
  denied: string[];

  // Tool-specific access levels
  toolLevels?: Record<string, ToolAccessLevel>;
}

/**
 * Extended agent definition with domain specialization
 */
export interface SpecializedAgent extends AgentDefinition {
  domain: AgentDomain[];
  toolAccess: ToolAccess;
  contextIsolation: ContextIsolation;
  modelType: "reasoning" | "perception" | "live";
}

// =============================================================================
// AGENT DEFINITIONS
// =============================================================================

/**
 * CodingAgent - Expert in software development and repository interaction
 * 
 * Domain: Code generation, refactoring, testing, debugging
 * Access: File system (workspace), Git, GitHub, code execution (sandboxed)
 * Restrictions: No personal data, no external service credentials
 */
export const CODING_AGENT: SpecializedAgent = {
  id: "coding-agent-001",
  name: "Coding Agent",
  type: "coder",
  domain: ["coding"],
  description:
    "Expert in software development, code analysis, and repository interaction. Handles all programming tasks with no access to personal data.",
  capabilities: [
    {
      name: "code_generation",
      description: "Generate, refactor, and optimize code",
      domains: ["coding"],
      tools: ["file_put", "file_get", "github_file_write"],
    },
    {
      name: "code_review",
      description: "Review code for quality, security, and best practices",
      domains: ["coding"],
      tools: ["file_get", "github_file_read"],
    },
    {
      name: "testing",
      description: "Create and run tests",
      domains: ["coding"],
      tools: ["file_put", "terminal_execute"],
    },
    {
      name: "debugging",
      description: "Debug and fix code issues",
      domains: ["coding"],
      tools: ["file_get", "terminal_execute", "log_read"],
    },
    {
      name: "repository_management",
      description: "Git operations and GitHub interaction",
      domains: ["coding"],
      tools: [
        "github_repos",
        "github_file_read",
        "github_file_write",
        "github_commit",
        "github_pr",
      ],
    },
  ],
  toolAccess: {
    allowed: [
      "file_get",
      "file_put",
      "file_list",
      "terminal_execute",
      "github_repos",
      "github_file_read",
      "github_file_write",
      "github_commit",
      "github_pr",
      "github_issues",
      "web_search",
      "log_append",
      "log_read",
    ],
    denied: [
      "gmail_list",
      "gmail_read",
      "gmail_send",
      "calendar_list",
      "calendar_create",
      "drive_list",
      "contacts_list",
      "tasks_list",
      "sheets_read",
      "sheets_write",
      "docs_read",
      "docs_write",
    ],
    toolLevels: {
      file_get: "full",
      file_put: "full",
      terminal_execute: "restricted", // Sandboxed only
      web_search: "read-only",
    },
  },
  contextIsolation: {
    separateMemory: true,
    dataAccess: "restricted",
    allowedScopes: ["workspace", "repositories"],
    prohibitedPatterns: [
      ".*@.*\\..+", // Email patterns
      "calendar",
      "personal",
      "private",
    ],
    resourceLimits: {
      maxMemory: "2GB",
      maxCPU: "2cores",
      executionTimeout: "5m",
      maxConcurrentTasks: 3,
    },
  },
  modelType: "reasoning",
  priority: 10,
  status: "active",
  currentLoad: 0,
  maxLoad: 3,
  metadata: {
    supportedLanguages: [
      "javascript",
      "typescript",
      "python",
      "go",
      "rust",
      "java",
      "csharp",
    ],
    specializations: ["web", "backend", "frontend", "devops"],
  },
};

/**
 * PersonalLifeAgent - Expert in calendar, email, and personal organization
 * 
 * Domain: Email, calendar, contacts, tasks, personal documents
 * Access: Google Workspace APIs (Gmail, Calendar, Drive, Tasks, Contacts)
 * Restrictions: No code repositories, no terminal access, no file system
 */
export const PERSONAL_LIFE_AGENT: SpecializedAgent = {
  id: "personal-life-agent-001",
  name: "Personal Life Agent",
  type: "specialist",
  domain: ["personal_life", "communication"],
  description:
    "Expert in managing email, calendar, tasks, and personal organization. Has full access to Google Workspace but no code or file system access.",
  capabilities: [
    {
      name: "email_management",
      description: "Read, compose, and manage emails",
      domains: ["personal_life", "communication"],
      tools: ["gmail_list", "gmail_read", "gmail_send", "gmail_search"],
    },
    {
      name: "calendar_management",
      description: "Schedule, update, and manage calendar events",
      domains: ["personal_life"],
      tools: [
        "calendar_list",
        "calendar_events",
        "calendar_create",
        "calendar_update",
      ],
    },
    {
      name: "task_management",
      description: "Create and manage task lists",
      domains: ["personal_life"],
      tools: [
        "tasks_list",
        "tasks_create",
        "tasks_update",
        "tasks_complete",
      ],
    },
    {
      name: "contact_management",
      description: "Manage personal contacts",
      domains: ["personal_life"],
      tools: ["contacts_list", "contacts_get"],
    },
    {
      name: "document_organization",
      description: "Organize personal documents in Drive",
      domains: ["personal_life"],
      tools: [
        "drive_list",
        "drive_get",
        "drive_create",
        "drive_move",
        "drive_search",
      ],
    },
  ],
  toolAccess: {
    allowed: [
      "gmail_list",
      "gmail_read",
      "gmail_send",
      "gmail_search",
      "calendar_list",
      "calendar_events",
      "calendar_create",
      "calendar_update",
      "calendar_delete",
      "tasks_list",
      "tasks_create",
      "tasks_update",
      "tasks_complete",
      "tasks_delete",
      "contacts_list",
      "contacts_get",
      "drive_list",
      "drive_get",
      "drive_create",
      "drive_move",
      "drive_search",
      "docs_read",
      "sheets_read",
    ],
    denied: [
      "file_put",
      "file_get",
      "terminal_execute",
      "github_repos",
      "github_file_write",
      "log_append",
    ],
    toolLevels: {
      gmail_list: "full",
      gmail_read: "full",
      gmail_send: "full",
      drive_list: "restricted", // Personal folders only
      docs_read: "read-only",
    },
  },
  contextIsolation: {
    separateMemory: true,
    dataAccess: "full",
    allowedScopes: ["google_workspace", "personal_data"],
    prohibitedPatterns: ["github.com", "repository", "code"],
    resourceLimits: {
      maxMemory: "512MB",
      maxCPU: "1core",
      executionTimeout: "3m",
      maxConcurrentTasks: 5,
    },
  },
  modelType: "live",
  priority: 9,
  status: "active",
  currentLoad: 0,
  maxLoad: 5,
  metadata: {
    privacyLevel: "high",
    dataRetention: "session-only",
  },
};

/**
 * ResearchAgent - Expert in information gathering and analysis
 * 
 * Domain: Web search, document analysis, data synthesis
 * Access: Web search, Drive (read-only), RAG system
 * Restrictions: No write operations, no personal data modification
 */
export const RESEARCH_AGENT: SpecializedAgent = {
  id: "research-agent-001",
  name: "Research Agent",
  type: "researcher",
  domain: ["research", "analysis"],
  description:
    "Expert in gathering and synthesizing information from web and documents. Read-only access to prevent data modification.",
  capabilities: [
    {
      name: "web_research",
      description: "Search and gather information from the web",
      domains: ["research"],
      tools: ["web_search", "web_scrape", "tavily_research"],
    },
    {
      name: "document_analysis",
      description: "Analyze and extract insights from documents",
      domains: ["research", "analysis"],
      tools: ["file_get", "docs_read", "drive_get", "rag_retrieve"],
    },
    {
      name: "data_synthesis",
      description: "Synthesize information from multiple sources",
      domains: ["research"],
      tools: ["rag_retrieve", "web_search"],
    },
    {
      name: "fact_verification",
      description: "Verify facts and check sources",
      domains: ["research"],
      tools: ["web_search", "rag_retrieve"],
    },
  ],
  toolAccess: {
    allowed: [
      "web_search",
      "web_scrape",
      "tavily_research",
      "file_get",
      "docs_read",
      "sheets_read",
      "drive_get",
      "drive_list",
      "drive_search",
      "rag_retrieve",
      "rag_search",
    ],
    denied: [
      "file_put",
      "docs_write",
      "sheets_write",
      "drive_create",
      "terminal_execute",
      "gmail_send",
      "calendar_create",
    ],
    toolLevels: {
      web_search: "full",
      file_get: "read-only",
      docs_read: "read-only",
      drive_get: "read-only",
    },
  },
  contextIsolation: {
    separateMemory: true,
    dataAccess: "read-only",
    allowedScopes: ["web", "documents", "knowledge_base"],
    prohibitedPatterns: [],
    resourceLimits: {
      maxMemory: "1GB",
      maxCPU: "1core",
      executionTimeout: "5m",
      maxConcurrentTasks: 4,
    },
  },
  modelType: "perception",
  priority: 8,
  status: "active",
  currentLoad: 0,
  maxLoad: 4,
  metadata: {
    specializations: ["academic", "technical", "general"],
  },
};

/**
 * CreativeAgent - Expert in content generation and media creation
 * 
 * Domain: Image generation, music composition, creative writing
 * Access: Image/music generation APIs, TTS, Drive storage
 * Restrictions: No code execution, no personal data access
 */
export const CREATIVE_AGENT: SpecializedAgent = {
  id: "creative-agent-001",
  name: "Creative Agent",
  type: "specialist",
  domain: ["creative"],
  description:
    "Expert in generating creative content including images, music, and text. Focused on artistic expression and media creation.",
  capabilities: [
    {
      name: "image_generation",
      description: "Generate and edit images",
      domains: ["creative"],
      tools: ["image_generate", "image_edit"],
    },
    {
      name: "music_composition",
      description: "Compose music and audio",
      domains: ["creative"],
      tools: ["music_generate"],
    },
    {
      name: "creative_writing",
      description: "Write creative content",
      domains: ["creative"],
      tools: ["send_chat"],
    },
    {
      name: "voice_synthesis",
      description: "Generate expressive speech",
      domains: ["creative"],
      tools: ["say", "tts_generate"],
    },
  ],
  toolAccess: {
    allowed: [
      "image_generate",
      "image_edit",
      "music_generate",
      "say",
      "tts_generate",
      "drive_create",
      "drive_upload",
      "send_chat",
    ],
    denied: [
      "file_put",
      "terminal_execute",
      "github_repos",
      "gmail_list",
      "calendar_list",
    ],
    toolLevels: {
      image_generate: "full",
      drive_create: "restricted", // Media folder only
    },
  },
  contextIsolation: {
    separateMemory: true,
    dataAccess: "restricted",
    allowedScopes: ["media_generation", "drive_storage"],
    prohibitedPatterns: ["personal", "code", "repository"],
    resourceLimits: {
      maxMemory: "2GB",
      maxCPU: "2cores",
      executionTimeout: "10m", // Media generation can be slow
      maxConcurrentTasks: 2,
    },
  },
  modelType: "reasoning",
  priority: 7,
  status: "active",
  currentLoad: 0,
  maxLoad: 2,
  metadata: {
    mediaFormats: ["image", "audio", "text"],
  },
};

// =============================================================================
// AGENT REGISTRY
// =============================================================================

/**
 * All specialized agents in the system
 */
export const SPECIALIZED_AGENTS: Record<string, SpecializedAgent> = {
  coding: CODING_AGENT,
  personalLife: PERSONAL_LIFE_AGENT,
  research: RESEARCH_AGENT,
  creative: CREATIVE_AGENT,
};

/**
 * Get agent by domain
 */
export function getAgentByDomain(domain: AgentDomain): SpecializedAgent | null {
  return (
    Object.values(SPECIALIZED_AGENTS).find((agent) =>
      agent.domain.includes(domain)
    ) || null
  );
}

/**
 * Get agents by capability
 */
export function getAgentsByCapability(
  capabilityName: string
): SpecializedAgent[] {
  return Object.values(SPECIALIZED_AGENTS).filter((agent) =>
    agent.capabilities.some((cap) => cap.name === capabilityName)
  );
}

/**
 * Check if agent has tool access
 */
export function hasToolAccess(
  agent: SpecializedAgent,
  toolName: string
): boolean {
  if (agent.toolAccess.denied.includes(toolName)) {
    return false;
  }
  return agent.toolAccess.allowed.includes(toolName);
}

/**
 * Get tool access level for agent
 */
export function getToolAccessLevel(
  agent: SpecializedAgent,
  toolName: string
): ToolAccessLevel {
  if (!hasToolAccess(agent, toolName)) {
    return "denied";
  }
  return agent.toolAccess.toolLevels?.[toolName] || "full";
}

/**
 * Validate agent access to data scope
 */
export function validateDataAccess(
  agent: SpecializedAgent,
  dataScope: string
): boolean {
  // Check if scope is allowed
  const isAllowed = agent.contextIsolation.allowedScopes.some(
    (scope) =>
      dataScope === scope || dataScope.startsWith(scope + "/")
  );

  if (!isAllowed) {
    return false;
  }

  // Check if scope matches prohibited patterns
  const isProhibited = agent.contextIsolation.prohibitedPatterns.some(
    (pattern) => new RegExp(pattern, "i").test(dataScope)
  );

  return !isProhibited;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default SPECIALIZED_AGENTS;
export {
  CODING_AGENT,
  PERSONAL_LIFE_AGENT,
  RESEARCH_AGENT,
  CREATIVE_AGENT,
};
