/**
 * =============================================================================
 * ORCHESTRATOR SERVICE
 * =============================================================================
 * 
 * Central orchestration layer for managing multiple specialized agents.
 * Breaks down complex user requests into hierarchical tasks, assigns them
 * to appropriate agents, and manages their execution.
 * 
 * Key Features:
 * - Agent Registry: Manages specialized agents with specific capabilities
 * - Task Decomposition: Breaks high-level goals into actionable subtasks
 * - State Management: Tracks execution progress and context
 * - Context Passing: Shares state between agents
 * - Logging & Debugging: Comprehensive logs at all levels
 * 
 * Architecture Analogy:
 * Think of the orchestrator as a CPU that:
 * - Fetches instructions (tasks) from memory (queue)
 * - Routes them to specialized execution units (agents)
 * - Manages process state and inter-process communication
 * - Handles interrupts (operator input) and exceptions
 */

import { jobDispatcher } from "./job-dispatcher";
import { jobQueue, type JobSubmission } from "./job-queue";
import { dependencyResolver } from "./dependency-resolver";
import { getDb } from "../db";
import { agentJobs, type AgentJob, jobResults } from "@shared/schema";
import { eq, inArray, desc } from "drizzle-orm";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Agent capabilities define what an agent can do
 */
export interface AgentCapability {
  name: string;
  description: string;
  domains: string[]; // e.g., ["code", "research", "planning"]
  tools: string[]; // Available tools for this capability
  maxConcurrency?: number; // How many tasks this agent can handle at once
}

/**
 * Agent definition with skills and configuration
 */
export interface AgentDefinition {
  id: string;
  name: string;
  type: "planner" | "executor" | "researcher" | "coder" | "reviewer" | "specialist";
  description: string;
  capabilities: AgentCapability[];
  priority: number; // For agent selection (higher = more preferred)
  status: "active" | "idle" | "busy" | "offline";
  currentLoad: number; // Number of active tasks
  maxLoad: number; // Maximum concurrent tasks
  metadata?: Record<string, unknown>;
}

/**
 * Task plan with hierarchical structure
 */
export interface TaskPlan {
  goal: string;
  steps: TaskStep[];
  estimatedDuration?: number;
  parallelizable: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Individual step in a task plan
 */
export interface TaskStep {
  id: string;
  title: string;
  description: string;
  agentType: AgentDefinition["type"];
  requiredCapabilities: string[];
  dependencies: string[]; // IDs of steps that must complete first
  input?: Record<string, unknown>;
  priority: number;
  estimatedDuration?: number;
}

/**
 * Execution context shared between tasks
 */
export interface ExecutionContext {
  sessionId: string;
  userId?: string;
  chatId?: string;
  state: Record<string, unknown>; // Shared state
  history: ContextHistoryEntry[]; // Execution history
  metadata?: Record<string, unknown>;
}

/**
 * Entry in execution history
 */
export interface ContextHistoryEntry {
  taskId: string;
  agentId: string;
  timestamp: Date;
  action: string;
  result?: unknown;
  error?: string;
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
  sessionId: string;
  status: "planning" | "executing" | "completed" | "failed" | "cancelled";
  plan?: TaskPlan;
  jobIds: string[];
  completedTasks: number;
  totalTasks: number;
  results: Record<string, unknown>;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

// =============================================================================
// ORCHESTRATOR SERVICE
// =============================================================================

class OrchestratorService {
  private agents: Map<string, AgentDefinition> = new Map();
  private activeSessions: Map<string, ExecutionContext> = new Map();
  private sessionLogs: Map<string, OrchestratorLog[]> = new Map();

  /**
   * Initialize the orchestrator with default agents
   */
  async initialize(): Promise<void> {
    // Register default agents
    this.registerAgent({
      id: "planner-001",
      name: "Planning Agent",
      type: "planner",
      description: "Decomposes complex goals into actionable task plans",
      capabilities: [
        {
          name: "task_decomposition",
          description: "Break down high-level goals into subtasks",
          domains: ["planning", "strategy"],
          tools: ["analyze_requirements", "create_task_tree"],
        },
        {
          name: "dependency_analysis",
          description: "Identify task dependencies and ordering",
          domains: ["planning"],
          tools: ["analyze_dependencies"],
        },
      ],
      priority: 10,
      status: "active",
      currentLoad: 0,
      maxLoad: 5,
    });

    this.registerAgent({
      id: "researcher-001",
      name: "Research Agent",
      type: "researcher",
      description: "Performs deep research and information gathering",
      capabilities: [
        {
          name: "web_search",
          description: "Search the web for information",
          domains: ["research", "information"],
          tools: ["google_search", "web_scrape", "tavily_research"],
        },
        {
          name: "document_analysis",
          description: "Analyze documents and extract insights",
          domains: ["research", "analysis"],
          tools: ["read_document", "extract_entities"],
        },
      ],
      priority: 8,
      status: "active",
      currentLoad: 0,
      maxLoad: 3,
    });

    this.registerAgent({
      id: "coder-001",
      name: "Code Writer Agent",
      type: "coder",
      description: "Writes, edits, and reviews code",
      capabilities: [
        {
          name: "code_generation",
          description: "Generate code from specifications",
          domains: ["coding", "development"],
          tools: ["file_put", "terminal_execute"],
        },
        {
          name: "code_analysis",
          description: "Analyze existing codebases",
          domains: ["coding", "analysis"],
          tools: ["file_get", "github_code_search"],
        },
      ],
      priority: 9,
      status: "active",
      currentLoad: 0,
      maxLoad: 2,
    });

    this.registerAgent({
      id: "reviewer-001",
      name: "Review Agent",
      type: "reviewer",
      description: "Reviews and validates work from other agents",
      capabilities: [
        {
          name: "quality_assurance",
          description: "Review code, research, and other outputs",
          domains: ["review", "quality"],
          tools: ["analyze_output", "verify_requirements"],
        },
      ],
      priority: 7,
      status: "active",
      currentLoad: 0,
      maxLoad: 3,
    });

    console.log(`[Orchestrator] Initialized with ${this.agents.size} agents`);
  }

  /**
   * Register a new agent
   */
  registerAgent(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
    this.log("system", `Registered agent: ${agent.name} (${agent.id})`);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    this.agents.delete(agentId);
    this.log("system", `Unregistered agent: ${agent.name} (${agentId})`);
    return true;
  }

  /**
   * Get all registered agents
   */
  getAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Find best agent for a task based on required capabilities
   */
  selectAgent(
    requiredCapabilities: string[],
    agentType?: AgentDefinition["type"]
  ): AgentDefinition | null {
    const candidates = Array.from(this.agents.values())
      .filter((agent) => {
        // Filter by type if specified
        if (agentType && agent.type !== agentType) return false;

        // Must be active and have capacity
        if (agent.status !== "active") return false;
        if (agent.currentLoad >= agent.maxLoad) return false;

        // Must have all required capabilities
        const agentCapabilityNames = agent.capabilities.map((c) => c.name);
        return requiredCapabilities.every((req) =>
          agentCapabilityNames.includes(req)
        );
      })
      .sort((a, b) => {
        // Sort by priority (higher first), then by load (lower first)
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.currentLoad - b.currentLoad;
      });

    return candidates[0] || null;
  }

  /**
   * Orchestrate a complex task
   * This is the main entry point for multi-agent orchestration
   */
  async orchestrate(
    goal: string,
    options: {
      userId?: string;
      chatId?: string;
      initialContext?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<OrchestrationResult> {
    const sessionId = this.generateSessionId();
    const startTime = new Date();

    this.log(sessionId, `Starting orchestration for goal: ${goal}`);

    // Create execution context
    const context: ExecutionContext = {
      sessionId,
      userId: options.userId,
      chatId: options.chatId,
      state: options.initialContext || {},
      history: [],
      metadata: options.metadata,
    };
    this.activeSessions.set(sessionId, context);

    try {
      // Step 1: Create a plan using the planning agent
      this.log(sessionId, "Creating task plan...");
      const plan = await this.createPlan(goal, context);
      
      if (!plan) {
        throw new Error("Failed to create task plan");
      }

      this.log(sessionId, `Plan created with ${plan.steps.length} steps`);

      // Step 2: Convert plan to jobs
      const jobIds = await this.executePlan(plan, context);

      this.log(sessionId, `Created ${jobIds.length} jobs`);

      // Step 3: Return orchestration handle
      return {
        sessionId,
        status: "executing",
        plan,
        jobIds,
        completedTasks: 0,
        totalTasks: plan.steps.length,
        results: {},
        errors: [],
        startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(sessionId, `Orchestration failed: ${errorMessage}`, "error");

      return {
        sessionId,
        status: "failed",
        jobIds: [],
        completedTasks: 0,
        totalTasks: 0,
        results: {},
        errors: [errorMessage],
        startTime,
        endTime: new Date(),
      };
    }
  }

  /**
   * Create a task plan from a high-level goal
   */
  private async createPlan(
    goal: string,
    context: ExecutionContext
  ): Promise<TaskPlan | null> {
    // Select planning agent
    const planner = this.selectAgent(["task_decomposition"], "planner");
    if (!planner) {
      throw new Error("No planning agent available");
    }

    this.log(context.sessionId, `Using planner: ${planner.name}`);

    // Submit planning job
    const planningJob: JobSubmission = {
      name: "Task Planning",
      type: "prompt",
      payload: {
        prompt: `Create a detailed task plan to achieve the following goal:

Goal: ${goal}

Context: ${JSON.stringify(context.state, null, 2)}

Break this down into specific, actionable steps. For each step:
1. Identify what needs to be done
2. Specify which type of agent should handle it
3. List required capabilities
4. Note any dependencies on other steps
5. Estimate duration if possible

Return the plan as a JSON object matching this structure:
{
  "goal": "...",
  "steps": [
    {
      "id": "step-1",
      "title": "...",
      "description": "...",
      "agentType": "planner|executor|researcher|coder|reviewer|specialist",
      "requiredCapabilities": ["capability1", "capability2"],
      "dependencies": [],
      "priority": 5,
      "estimatedDuration": 60
    }
  ],
  "parallelizable": true
}`,
        systemPrompt: "You are a planning agent that creates detailed, executable task plans.",
      },
      priority: 10,
      userId: context.userId,
    };

    const job = await jobDispatcher.submitJob(planningJob);
    
    // Wait for planning to complete (with timeout)
    const result = await this.waitForJob(job.id, 60000); // 60 second timeout

    if (!result.success || !result.output) {
      throw new Error("Planning job failed");
    }

    // Parse the plan
    try {
      const planData = typeof result.output === "string" 
        ? JSON.parse(result.output) 
        : result.output;

      return {
        goal,
        steps: planData.steps || [],
        estimatedDuration: planData.estimatedDuration,
        parallelizable: planData.parallelizable !== false,
        metadata: planData.metadata,
      };
    } catch (error) {
      throw new Error("Failed to parse planning result");
    }
  }

  /**
   * Execute a task plan by creating jobs for each step
   */
  private async executePlan(
    plan: TaskPlan,
    context: ExecutionContext
  ): Promise<string[]> {
    const jobIds: string[] = [];
    const stepToJobMap: Map<string, string> = new Map();

    // Create jobs for each step
    for (const step of plan.steps) {
      // Select appropriate agent
      const agent = this.selectAgent(step.requiredCapabilities, step.agentType);
      if (!agent) {
        this.log(
          context.sessionId,
          `Warning: No agent found for step ${step.id}, skipping`,
          "warn"
        );
        continue;
      }

      // Map step dependencies to job dependencies
      const jobDependencies = step.dependencies
        .map((depId) => stepToJobMap.get(depId))
        .filter((id): id is string => id !== undefined);

      // Create job submission
      const jobSubmission: JobSubmission = {
        name: step.title,
        type: "prompt", // Could be more specific based on step type
        payload: {
          prompt: step.description,
          context: {
            ...context.state,
            step: step,
          },
        },
        priority: step.priority || 5,
        dependencies: jobDependencies,
        userId: context.userId,
      };

      const job = await jobDispatcher.submitJob(jobSubmission);
      jobIds.push(job.id);
      stepToJobMap.set(step.id, job.id);

      // Update agent load
      agent.currentLoad++;

      this.log(
        context.sessionId,
        `Created job ${job.id} for step ${step.id} using agent ${agent.name}`
      );
    }

    return jobIds;
  }

  /**
   * Wait for a job to complete
   */
  private async waitForJob(
    jobId: string,
    timeoutMs: number = 30000
  ): Promise<{ success: boolean; output?: unknown; error?: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = await jobQueue.getJobResult(jobId);
      
      if (result) {
        return {
          success: result.success,
          output: result.output,
          error: result.error || undefined,
        };
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return {
      success: false,
      error: "Job timeout",
    };
  }

  /**
   * Get orchestration status
   */
  async getOrchestrationStatus(sessionId: string): Promise<OrchestrationResult | null> {
    const context = this.activeSessions.get(sessionId);
    if (!context) return null;

    // Get all jobs in this session's history
    const jobIds = context.history.map((entry) => entry.taskId);
    
    if (jobIds.length === 0) {
      return null;
    }

    // Fetch job statuses
    const jobs = await getDb()
      .select()
      .from(agentJobs)
      .where(inArray(agentJobs.id, jobIds));

    const results = await getDb()
      .select()
      .from(jobResults)
      .where(inArray(jobResults.jobId, jobIds));

    const completedTasks = jobs.filter((j) => j.status === "completed").length;
    const failedTasks = jobs.filter((j) => j.status === "failed");
    const runningTasks = jobs.filter((j) => j.status === "running");

    // Determine overall status
    let status: OrchestrationResult["status"] = "executing";
    if (completedTasks === jobs.length) {
      status = "completed";
    } else if (failedTasks.length > 0 && runningTasks.length === 0) {
      status = "failed";
    }

    // Collect results
    const resultMap: Record<string, unknown> = {};
    for (const result of results) {
      resultMap[result.jobId] = result.output;
    }

    return {
      sessionId,
      status,
      jobIds,
      completedTasks,
      totalTasks: jobs.length,
      results: resultMap,
      errors: failedTasks.map((j) => `Job ${j.id} failed`),
      startTime: new Date(context.history[0]?.timestamp || new Date()),
      endTime: status === "completed" || status === "failed" ? new Date() : undefined,
    };
  }

  /**
   * Get logs for a session
   */
  getSessionLogs(sessionId: string): OrchestratorLog[] {
    return this.sessionLogs.get(sessionId) || [];
  }

  /**
   * Update shared context for a session
   */
  updateContext(
    sessionId: string,
    updates: Partial<ExecutionContext["state"]>
  ): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    context.state = { ...context.state, ...updates };
    this.log(sessionId, `Context updated: ${Object.keys(updates).join(", ")}`);
  }

  /**
   * Add entry to execution history
   */
  addToHistory(
    sessionId: string,
    entry: Omit<ContextHistoryEntry, "timestamp">
  ): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    context.history.push({
      ...entry,
      timestamp: new Date(),
    });
  }

  /**
   * Clean up completed session
   */
  cleanupSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    // Keep logs for debugging
    this.log(sessionId, "Session cleaned up");
  }

  /**
   * Log a message
   */
  private log(
    sessionId: string,
    message: string,
    level: "info" | "warn" | "error" = "info"
  ): void {
    const logEntry: OrchestratorLog = {
      sessionId,
      timestamp: new Date(),
      level,
      message,
    };

    const logs = this.sessionLogs.get(sessionId) || [];
    logs.push(logEntry);
    this.sessionLogs.set(sessionId, logs);

    // Also log to console
    const prefix = `[Orchestrator:${sessionId.slice(0, 8)}]`;
    switch (level) {
      case "error":
        console.error(prefix, message);
        break;
      case "warn":
        console.warn(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `orch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// =============================================================================
// LOG ENTRY TYPE
// =============================================================================

interface OrchestratorLog {
  sessionId: string;
  timestamp: Date;
  level: "info" | "warn" | "error";
  message: string;
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const orchestrator = new OrchestratorService();
export default orchestrator;
