/**
 * =============================================================================
 * ASYNC EXECUTION MANAGER
 * =============================================================================
 * 
 * Manages asynchronous, non-blocking task execution across multiple agents.
 * Enables the system to handle long-running operations while maintaining
 * user interaction and allowing parallel task execution.
 * 
 * Key Features:
 * - Non-blocking task dispatch
 * - Progress streaming via SSE
 * - Task cancellation and interruption
 * - Background completion tracking
 * - Live status updates
 */

import { EventEmitter } from "events";
import { jobQueue, type JobSubmission } from "./job-queue";
import { jobDispatcher } from "./job-dispatcher";
import { stateManager } from "./state-manager";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Execution status
 */
export type ExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

/**
 * Progress update event
 */
export interface ProgressUpdate {
  executionId: string;
  taskId?: string;
  agentId?: string;
  status: ExecutionStatus;
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  userId: string;
  chatId?: string;
  async?: boolean; // Default: true
  streamProgress?: boolean; // Default: true
  backgroundCompletion?: boolean; // Complete even if user disconnects
  priority?: number; // Higher = more important
  timeout?: number; // Milliseconds
  onProgress?: (update: ProgressUpdate) => void;
  onComplete?: (result: unknown) => void;
  onError?: (error: Error) => void;
}

/**
 * Task execution context
 */
export interface TaskExecution {
  executionId: string;
  taskId: string;
  userId: string;
  chatId?: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  progress: number;
  result?: unknown;
  error?: Error;
  metadata: Record<string, unknown>;
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
  planId: string;
  tasks: TaskExecution[];
  dependencies: Map<string, string[]>; // taskId -> dependencies
  parallelizable: boolean;
  estimatedDuration?: number;
}

// =============================================================================
// ASYNC EXECUTION MANAGER
// =============================================================================

export class AsyncExecutionManager extends EventEmitter {
  private executions: Map<string, TaskExecution> = new Map();
  private plans: Map<string, ExecutionPlan> = new Map();
  private progressListeners: Map<string, Set<(update: ProgressUpdate) => void>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startCleanupTimer();
  }

  /**
   * Execute a single task asynchronously
   */
  async executeTask(
    taskId: string,
    taskData: unknown,
    options: ExecutionOptions
  ): Promise<string> {
    const executionId = this.generateExecutionId();

    const execution: TaskExecution = {
      executionId,
      taskId,
      userId: options.userId,
      chatId: options.chatId,
      status: "queued",
      startTime: new Date(),
      progress: 0,
      metadata: {
        async: options.async ?? true,
        streamProgress: options.streamProgress ?? true,
        priority: options.priority ?? 5,
      },
    };

    this.executions.set(executionId, execution);

    // Register progress listener if provided
    if (options.onProgress) {
      this.addProgressListener(executionId, options.onProgress);
    }

    // Dispatch task
    if (options.async !== false) {
      // Async execution - return immediately
      this.dispatchAsync(execution, taskData, options);
    } else {
      // Sync execution - wait for completion
      await this.dispatchSync(execution, taskData, options);
    }

    return executionId;
  }

  /**
   * Execute a plan with multiple tasks
   */
  async executePlan(
    plan: ExecutionPlan,
    options: ExecutionOptions
  ): Promise<string[]> {
    this.plans.set(plan.planId, plan);

    const executionIds: string[] = [];

    // Determine execution order based on dependencies
    const executionOrder = this.resolveDependencies(plan);

    for (const batch of executionOrder) {
      // Execute batch in parallel
      const batchPromises = batch.map((task) =>
        this.executeTask(task.taskId, task, options)
      );

      const batchIds = await Promise.all(batchPromises);
      executionIds.push(...batchIds);

      // Wait for batch completion if there are dependencies
      if (plan.dependencies.size > 0) {
        await this.waitForBatch(batchIds);
      }
    }

    return executionIds;
  }

  /**
   * Dispatch task asynchronously
   */
  private async dispatchAsync(
    execution: TaskExecution,
    taskData: unknown,
    options: ExecutionOptions
  ): Promise<void> {
    try {
      // Update status
      this.updateExecution(execution.executionId, {
        status: "running",
        progress: 10,
      });

      // Submit to job queue
      const jobSubmission: JobSubmission = {
        id: execution.taskId,
        name: `Async task ${execution.taskId}`,
        parameters: taskData,
        dependencies: [],
        priority: (options.priority ?? 5) as 1 | 2 | 3 | 4 | 5,
        metadata: {
          executionId: execution.executionId,
          userId: options.userId,
        },
        createdAt: new Date(),
      };

      await jobQueue.submit(jobSubmission);

      // Poll for completion
      this.pollExecution(execution.executionId, options);
    } catch (error) {
      this.handleExecutionError(execution.executionId, error as Error, options);
    }
  }

  /**
   * Dispatch task synchronously
   */
  private async dispatchSync(
    execution: TaskExecution,
    taskData: unknown,
    options: ExecutionOptions
  ): Promise<void> {
    try {
      this.updateExecution(execution.executionId, {
        status: "running",
        progress: 10,
      });

      // Execute directly via dispatcher
      // Note: This is a simplified version - in production you'd use the actual dispatcher
      const result = await jobDispatcher.executeJob(execution.taskId, taskData);

      this.updateExecution(execution.executionId, {
        status: "completed",
        progress: 100,
        result,
        endTime: new Date(),
      });

      if (options.onComplete) {
        options.onComplete(result);
      }
    } catch (error) {
      this.handleExecutionError(execution.executionId, error as Error, options);
    }
  }

  /**
   * Poll execution status
   */
  private pollExecution(
    executionId: string,
    options: ExecutionOptions
  ): void {
    const pollInterval = setInterval(async () => {
      const execution = this.executions.get(executionId);
      if (!execution) {
        clearInterval(pollInterval);
        return;
      }

      // Check job status
      const jobStatus = await jobQueue.getJob(execution.taskId);
      if (!jobStatus) {
        return;
      }

      // Update progress based on job status
      if (jobStatus.status === "completed") {
        this.updateExecution(executionId, {
          status: "completed",
          progress: 100,
          result: jobStatus.result,
          endTime: new Date(),
        });

        if (options.onComplete) {
          options.onComplete(jobStatus.result);
        }

        clearInterval(pollInterval);
      } else if (jobStatus.status === "failed") {
        this.handleExecutionError(
          executionId,
          new Error(jobStatus.error || "Job failed"),
          options
        );
        clearInterval(pollInterval);
      } else if (jobStatus.status === "running") {
        // Estimate progress (simplified)
        const elapsed = Date.now() - execution.startTime.getTime();
        const estimated = options.timeout || 60000; // Default 1 minute
        const progress = Math.min(90, (elapsed / estimated) * 100);

        this.updateExecution(executionId, {
          progress: Math.round(progress),
        });
      }
    }, 1000); // Poll every second

    // Set timeout
    if (options.timeout) {
      setTimeout(() => {
        const execution = this.executions.get(executionId);
        if (execution && execution.status === "running") {
          this.cancelExecution(executionId, "Execution timeout");
          clearInterval(pollInterval);
        }
      }, options.timeout);
    }
  }

  /**
   * Update execution status
   */
  private updateExecution(
    executionId: string,
    updates: Partial<TaskExecution>
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    Object.assign(execution, updates);

    // Emit progress update
    const update: ProgressUpdate = {
      executionId,
      taskId: execution.taskId,
      status: execution.status,
      progress: execution.progress,
      message: this.getStatusMessage(execution),
      timestamp: new Date(),
      metadata: execution.metadata,
    };

    this.emitProgress(executionId, update);
  }

  /**
   * Handle execution error
   */
  private handleExecutionError(
    executionId: string,
    error: Error,
    options: ExecutionOptions
  ): void {
    this.updateExecution(executionId, {
      status: "failed",
      error,
      endTime: new Date(),
    });

    if (options.onError) {
      options.onError(error);
    }

    this.emit("execution:error", { executionId, error });
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string, reason?: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    // Cancel job if still in queue
    await jobQueue.cancel(execution.taskId);

    this.updateExecution(executionId, {
      status: "cancelled",
      endTime: new Date(),
      metadata: {
        ...execution.metadata,
        cancellationReason: reason,
      },
    });
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): TaskExecution | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get all executions for user
   */
  getUserExecutions(userId: string): TaskExecution[] {
    return Array.from(this.executions.values()).filter(
      (exec) => exec.userId === userId
    );
  }

  /**
   * Add progress listener
   */
  addProgressListener(
    executionId: string,
    listener: (update: ProgressUpdate) => void
  ): void {
    if (!this.progressListeners.has(executionId)) {
      this.progressListeners.set(executionId, new Set());
    }
    this.progressListeners.get(executionId)!.add(listener);
  }

  /**
   * Remove progress listener
   */
  removeProgressListener(
    executionId: string,
    listener: (update: ProgressUpdate) => void
  ): void {
    this.progressListeners.get(executionId)?.delete(listener);
  }

  /**
   * Emit progress update
   */
  private emitProgress(executionId: string, update: ProgressUpdate): void {
    // Notify registered listeners
    const listeners = this.progressListeners.get(executionId);
    if (listeners) {
      listeners.forEach((listener) => listener(update));
    }

    // Emit global event
    this.emit("progress", update);
  }

  /**
   * Resolve task dependencies into execution order
   */
  private resolveDependencies(plan: ExecutionPlan): TaskExecution[][] {
    const batches: TaskExecution[][] = [];
    const completed = new Set<string>();

    while (completed.size < plan.tasks.length) {
      const batch: TaskExecution[] = [];

      for (const task of plan.tasks) {
        if (completed.has(task.taskId)) continue;

        const deps = plan.dependencies.get(task.taskId) || [];
        const allDepsCompleted = deps.every((dep) => completed.has(dep));

        if (allDepsCompleted) {
          batch.push(task);
        }
      }

      if (batch.length === 0) {
        throw new Error("Circular dependency detected in execution plan");
      }

      batches.push(batch);
      batch.forEach((task) => completed.add(task.taskId));
    }

    return batches;
  }

  /**
   * Wait for batch completion
   */
  private async waitForBatch(executionIds: string[]): Promise<void> {
    await Promise.all(
      executionIds.map((id) => this.waitForCompletion(id))
    );
  }

  /**
   * Wait for single execution completion
   */
  private async waitForCompletion(executionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        const execution = this.executions.get(executionId);
        if (!execution) {
          reject(new Error(`Execution ${executionId} not found`));
          return;
        }

        if (
          execution.status === "completed" ||
          execution.status === "failed" ||
          execution.status === "cancelled"
        ) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };

      checkCompletion();
    });
  }

  /**
   * Get status message
   */
  private getStatusMessage(execution: TaskExecution): string {
    switch (execution.status) {
      case "queued":
        return "Task queued for execution";
      case "running":
        return `Task in progress (${execution.progress}%)`;
      case "completed":
        return "Task completed successfully";
      case "failed":
        return `Task failed: ${execution.error?.message || "Unknown error"}`;
      case "cancelled":
        return "Task cancelled";
      case "interrupted":
        return "Task interrupted by user";
      default:
        return "Unknown status";
    }
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start cleanup timer for old executions
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const [id, execution] of this.executions.entries()) {
        const age = now - execution.startTime.getTime();
        if (age > maxAge && execution.endTime) {
          this.executions.delete(id);
          this.progressListeners.delete(id);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Stop cleanup timer
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const asyncExecutionManager = new AsyncExecutionManager();

// =============================================================================
// EXPORTS
// =============================================================================

export default asyncExecutionManager;
