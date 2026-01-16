/**
 * =============================================================================
 * MODEL ROUTER SERVICE
 * =============================================================================
 * 
 * Multi-Model Brain implementation that routes requests to different Gemini
 * models based on task requirements, optimizing for quality, latency, and cost.
 * 
 * This implements the "Multi-Model Brain" concept from the architectural vision:
 * - Reasoning Core (Gemini 3.0): Complex planning and reasoning
 * - Perception Layer (Flash 2.0): Real-time vision and audio processing
 * - Live Interface (Gemini 2.5): Fluid conversational interaction
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Available model types in the multi-model brain
 */
export type ModelType = "reasoning" | "perception" | "live" | "auto";

/**
 * Task categories that determine model selection
 */
export type TaskCategory =
  | "planning"
  | "reasoning"
  | "code_generation"
  | "complex_analysis"
  | "vision"
  | "audio"
  | "document_analysis"
  | "classification"
  | "conversation"
  | "status_update"
  | "clarification"
  | "small_talk"
  | "quick_query";

/**
 * Model configuration for each brain component
 */
export interface ModelConfig {
  modelId: string;
  displayName: string;
  capabilities: TaskCategory[];
  costTier: "low" | "medium" | "high";
  latencyTier: "very-low" | "low" | "medium" | "high";
  maxTokens: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

/**
 * Model selection criteria
 */
export interface ModelSelectionCriteria {
  taskCategory: TaskCategory;
  priority?: "quality" | "speed" | "cost" | "balanced";
  maxLatency?: number; // milliseconds
  maxCost?: number; // relative cost units
  requiresMultimodal?: boolean;
  contextLength?: number;
}

/**
 * Model selection result
 */
export interface ModelSelection {
  modelType: ModelType;
  config: ModelConfig;
  rationale: string;
  estimatedCost: number;
  estimatedLatency: number;
}

// =============================================================================
// MODEL CONFIGURATIONS
// =============================================================================

/**
 * Multi-Model Brain Configuration
 * 
 * Note: Model IDs are placeholders and should be updated when new models are available
 */
const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  reasoning: {
    modelId: "gemini-2.0-flash-exp", // Placeholder: Use gemini-3.0-pro when available
    displayName: "Reasoning Core (Gemini 3.0 Pro)",
    capabilities: [
      "planning",
      "reasoning",
      "code_generation",
      "complex_analysis",
    ],
    costTier: "high",
    latencyTier: "high",
    maxTokens: 8192,
    temperature: 0.7,
  },

  perception: {
    modelId: "gemini-2.0-flash-exp",
    displayName: "Perception Layer (Flash 2.0)",
    capabilities: [
      "vision",
      "audio",
      "document_analysis",
      "classification",
      "quick_query",
    ],
    costTier: "low",
    latencyTier: "low",
    maxTokens: 8192,
    temperature: 0.4,
  },

  live: {
    modelId: "gemini-2.5-flash-002", // Using 2.5 Flash for now
    displayName: "Live Interface (Gemini 2.5 Flash)",
    capabilities: [
      "conversation",
      "status_update",
      "clarification",
      "small_talk",
      "quick_query",
    ],
    costTier: "medium",
    latencyTier: "very-low",
    maxTokens: 8192,
    temperature: 0.9, // More creative for conversation
  },

  // Auto-selection placeholder
  auto: {
    modelId: "gemini-2.5-flash-002",
    displayName: "Auto-Selected Model",
    capabilities: [],
    costTier: "medium",
    latencyTier: "medium",
    maxTokens: 8192,
  },
};

/**
 * Cost estimates (relative units per 1K tokens)
 */
const COST_ESTIMATES: Record<ModelType, { input: number; output: number }> = {
  reasoning: { input: 10, output: 30 }, // High cost for reasoning
  perception: { input: 1, output: 3 }, // Low cost for perception
  live: { input: 3, output: 9 }, // Medium cost for live
  auto: { input: 3, output: 9 },
};

/**
 * Latency estimates (milliseconds for typical request)
 */
const LATENCY_ESTIMATES: Record<ModelType, number> = {
  reasoning: 3000, // 3 seconds for complex reasoning
  perception: 500, // 500ms for quick perception
  live: 300, // 300ms for conversational response
  auto: 1000,
};

// =============================================================================
// MODEL ROUTER SERVICE
// =============================================================================

export class ModelRouter {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Select the best model for a given task
   */
  selectModel(criteria: ModelSelectionCriteria): ModelSelection {
    const { taskCategory, priority = "balanced" } = criteria;

    // Find all models that support this task category
    const candidates: Array<{ type: ModelType; config: ModelConfig }> = [];

    for (const [type, config] of Object.entries(MODEL_CONFIGS)) {
      if (
        type !== "auto" &&
        config.capabilities.includes(taskCategory)
      ) {
        candidates.push({ type: type as ModelType, config });
      }
    }

    if (candidates.length === 0) {
      // No specific model, use auto (defaults to live interface)
      return {
        modelType: "auto",
        config: MODEL_CONFIGS.auto,
        rationale: "No specific model matches criteria, using default",
        estimatedCost: COST_ESTIMATES.auto.input,
        estimatedLatency: LATENCY_ESTIMATES.auto,
      };
    }

    // If only one candidate, use it
    if (candidates.length === 1) {
      const { type, config } = candidates[0];
      return {
        modelType: type,
        config,
        rationale: `Only model supporting ${taskCategory}`,
        estimatedCost: COST_ESTIMATES[type].input,
        estimatedLatency: LATENCY_ESTIMATES[type],
      };
    }

    // Multiple candidates - select based on priority
    const selected = this.selectByPriority(candidates, priority, criteria);

    return {
      modelType: selected.type,
      config: selected.config,
      rationale: this.generateRationale(selected, priority, taskCategory),
      estimatedCost: COST_ESTIMATES[selected.type].input,
      estimatedLatency: LATENCY_ESTIMATES[selected.type],
    };
  }

  /**
   * Select model based on priority strategy
   */
  private selectByPriority(
    candidates: Array<{ type: ModelType; config: ModelConfig }>,
    priority: "quality" | "speed" | "cost" | "balanced",
    criteria: ModelSelectionCriteria
  ): { type: ModelType; config: ModelConfig } {
    switch (priority) {
      case "quality":
        // Prefer reasoning core for quality
        return (
          candidates.find((c) => c.type === "reasoning") || candidates[0]
        );

      case "speed":
        // Prefer perception or live for speed
        return (
          candidates.find((c) => c.config.latencyTier === "very-low") ||
          candidates.find((c) => c.config.latencyTier === "low") ||
          candidates[0]
        );

      case "cost":
        // Prefer perception for cost efficiency
        return (
          candidates.find((c) => c.config.costTier === "low") || candidates[0]
        );

      case "balanced":
      default:
        // Apply constraints and score
        return this.selectBalanced(candidates, criteria);
    }
  }

  /**
   * Select model with balanced scoring
   */
  private selectBalanced(
    candidates: Array<{ type: ModelType; config: ModelConfig }>,
    criteria: ModelSelectionCriteria
  ): { type: ModelType; config: ModelConfig } {
    // Score each candidate
    const scored = candidates.map((candidate) => {
      let score = 0;

      // Cost score (lower is better)
      const costScore =
        candidate.config.costTier === "low"
          ? 3
          : candidate.config.costTier === "medium"
          ? 2
          : 1;
      score += costScore;

      // Latency score (lower is better)
      const latencyScore =
        candidate.config.latencyTier === "very-low"
          ? 3
          : candidate.config.latencyTier === "low"
          ? 2
          : 1;
      score += latencyScore;

      // Apply constraints
      if (criteria.maxLatency) {
        const estimatedLatency = LATENCY_ESTIMATES[candidate.type];
        if (estimatedLatency > criteria.maxLatency) {
          score -= 5; // Heavy penalty for exceeding latency
        }
      }

      if (criteria.requiresMultimodal) {
        const hasVision = candidate.config.capabilities.includes("vision");
        if (!hasVision) {
          score -= 3; // Penalty for missing multimodal
        }
      }

      return { ...candidate, score };
    });

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    return scored[0];
  }

  /**
   * Generate human-readable rationale for model selection
   */
  private generateRationale(
    selected: { type: ModelType; config: ModelConfig },
    priority: string,
    taskCategory: TaskCategory
  ): string {
    const { type, config } = selected;

    const reasons: string[] = [];

    reasons.push(`Selected ${config.displayName} for ${taskCategory}`);

    if (priority === "quality") {
      reasons.push("prioritizing output quality");
    } else if (priority === "speed") {
      reasons.push("prioritizing response speed");
    } else if (priority === "cost") {
      reasons.push("prioritizing cost efficiency");
    } else {
      reasons.push("using balanced optimization");
    }

    reasons.push(
      `(cost: ${config.costTier}, latency: ${config.latencyTier})`
    );

    return reasons.join(" ");
  }

  /**
   * Get a model instance for the selected type
   */
  getModel(
    modelType: ModelType,
    options?: {
      temperature?: number;
      topP?: number;
      topK?: number;
      maxOutputTokens?: number;
    }
  ) {
    const config = MODEL_CONFIGS[modelType];

    return this.genAI.getGenerativeModel({
      model: config.modelId,
      generationConfig: {
        temperature: options?.temperature ?? config.temperature,
        topP: options?.topP ?? config.topP,
        topK: options?.topK ?? config.topK,
        maxOutputTokens: options?.maxOutputTokens ?? config.maxTokens,
      },
    });
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelType: ModelType): ModelConfig {
    return MODEL_CONFIGS[modelType];
  }

  /**
   * Get all model configurations
   */
  getAllModelConfigs(): Record<ModelType, ModelConfig> {
    return { ...MODEL_CONFIGS };
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(
    modelType: ModelType,
    inputTokens: number,
    outputTokens: number
  ): number {
    const costs = COST_ESTIMATES[modelType];
    return (
      (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output
    );
  }

  /**
   * Get estimated latency for a model
   */
  getEstimatedLatency(modelType: ModelType): number {
    return LATENCY_ESTIMATES[modelType];
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let modelRouterInstance: ModelRouter | null = null;

/**
 * Get or create the model router singleton
 */
export function getModelRouter(apiKey?: string): ModelRouter {
  if (!modelRouterInstance) {
    const key = apiKey || process.env.GOOGLE_GENAI_API_KEY;
    if (!key) {
      throw new Error("Google GenAI API key is required");
    }
    modelRouterInstance = new ModelRouter(key);
  }
  return modelRouterInstance;
}

/**
 * Reset the model router instance (for testing)
 */
export function resetModelRouter(): void {
  modelRouterInstance = null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Helper to select and get model in one call
 */
export async function selectAndGetModel(
  criteria: ModelSelectionCriteria,
  apiKey?: string
) {
  const router = getModelRouter(apiKey);
  const selection = router.selectModel(criteria);
  const model = router.getModel(selection.modelType);

  return {
    model,
    selection,
    config: selection.config,
  };
}

/**
 * Task category inference from prompt
 */
export function inferTaskCategory(prompt: string): TaskCategory {
  const lower = prompt.toLowerCase();

  // Code-related
  if (
    lower.includes("code") ||
    lower.includes("function") ||
    lower.includes("implement") ||
    lower.includes("debug") ||
    lower.includes("refactor")
  ) {
    return "code_generation";
  }

  // Planning
  if (
    lower.includes("plan") ||
    lower.includes("strategy") ||
    lower.includes("organize") ||
    lower.includes("breakdown")
  ) {
    return "planning";
  }

  // Vision/image
  if (
    lower.includes("image") ||
    lower.includes("picture") ||
    lower.includes("photo") ||
    lower.includes("screenshot")
  ) {
    return "vision";
  }

  // Audio
  if (
    lower.includes("audio") ||
    lower.includes("sound") ||
    lower.includes("voice") ||
    lower.includes("speech")
  ) {
    return "audio";
  }

  // Document analysis
  if (
    lower.includes("document") ||
    lower.includes("pdf") ||
    lower.includes("analyze") ||
    lower.includes("summarize")
  ) {
    return "document_analysis";
  }

  // Complex reasoning
  if (
    lower.includes("why") ||
    lower.includes("explain") ||
    lower.includes("reasoning") ||
    lower.includes("logic")
  ) {
    return "reasoning";
  }

  // Quick queries (short prompts)
  if (prompt.split(" ").length < 10) {
    return "quick_query";
  }

  // Default to conversation
  return "conversation";
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ModelRouter;
export { MODEL_CONFIGS, COST_ESTIMATES, LATENCY_ESTIMATES };
