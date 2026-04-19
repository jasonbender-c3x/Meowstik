/**
 * =============================================================================
 * JOB QUEUE SERVICE (PGLite / No-PG Version)
 * =============================================================================
 * 
 * In-memory/Polling job queue replacing pg-boss to avoid Postgres dependency.
 * Uses the existing SQLite/PGlite database for persistence.
 */

import { getDb } from "../db";
import { 
  agentJobs, 
  jobResults,
  type AgentJob, 
  type InsertAgentJob,
  type JobResult,
  type InsertJobResult 
} from "@shared/schema";
import { eq, and, inArray, or, sql, asc, lte } from "drizzle-orm";
import cronParser from "cron-parser";

export type JobType = "prompt" | "tool" | "composite" | "workflow";
export type JobStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
export type ExecutionMode = "sequential" | "parallel" | "batch";

export interface JobPayload {
  prompt?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  systemPrompt?: string;
  context?: Record<string, unknown>;
  childJobs?: InsertAgentJob[];
}

export interface JobSubmission {
  name: string;
  type: JobType;
  payload: JobPayload;
  priority?: number;
  parentJobId?: string;
  dependencies?: string[];
  executionMode?: ExecutionMode;
  maxRetries?: number;
  timeout?: number;
  scheduledFor?: Date;
  cronExpression?: string;
  userId?: string;
}

export interface JobQueueConfig {
  concurrency: number;
  pollInterval: number;
  retryLimit: number;
  retryDelay: number;
  expireInHours: number;
}

const DEFAULT_CONFIG: JobQueueConfig = {
  concurrency: 3,
  pollInterval: 2000,
  retryLimit: 3,
  retryDelay: 30000,
  expireInHours: 24,
};

// Event types for job lifecycle
export type JobEvent = {
  type: "started" | "completed" | "failed" | "cancelled" | "retry" | "waiting_input" | "resumed";
  jobId: string;
  job?: AgentJob;
  result?: JobResult;
  error?: string;
};

type JobEventCallback = (event: JobEvent) => void;

class JobQueueService {
  private config: JobQueueConfig;
  private isInitialized = false;
  private processingCallbacks: Map<string, (job: AgentJob) => Promise<{ output: unknown; error?: string }>> = new Map();
  private eventCallbacks: JobEventCallback[] = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(config: Partial<JobQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Subscribe to job lifecycle events
   */
  onJobEvent(callback: JobEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
    };
  }

  private emitEvent(event: JobEvent): void {
    this.eventCallbacks.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.error("[JobQueue] Event callback error:", error);
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.isInitialized = true;
    console.log("[JobQueue] Initialized with PGlite/Polling (No pg-boss)");

    // Start a lightweight promotion loop; execution is owned by JobDispatcher.
    this.pollInterval = setInterval(() => this.poll(), this.config.pollInterval);
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isInitialized = false;
    console.log("[JobQueue] Stopped");
  }

  private async poll() {
    if (this.isProcessing || !this.isInitialized) return;
    this.isProcessing = true;

    try {
      await this.promoteReadyJobs();
    } catch (err) {
      console.error("[JobQueue] Polling error:", err);
    } finally {
      this.isProcessing = false;
    }
  }

  async promoteReadyJobs(): Promise<number> {
    try {
      const pendingJobs = await getDb().select()
        .from(agentJobs)
        .where(eq(agentJobs.status, "pending"))
        .orderBy(asc(agentJobs.priority), asc(agentJobs.createdAt));

      const now = new Date();
      let promotedCount = 0;

      for (const job of pendingJobs) {
        if (job.scheduledFor && job.scheduledFor > now) {
          continue;
        }

        const depsReady = await this.areDependenciesMet(job.dependencies ?? []);
        if (!depsReady) {
          continue;
        }

        await this.enqueueJob(job);
        promotedCount++;
      }

      if (promotedCount > 0) {
        console.log(`[JobQueue] Promoted ${promotedCount} pending job(s) to queued`);
      }

      return promotedCount;
    } catch (error) {
      console.error("[JobQueue] Error promoting ready jobs:", error);
      return 0;
    }
  }

  async submitJob(submission: JobSubmission): Promise<AgentJob> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const jobData: InsertAgentJob = {
      name: submission.name,
      type: submission.type,
      priority: submission.priority ?? 5,
      parentJobId: submission.parentJobId,
      dependencies: submission.dependencies ?? [],
      executionMode: submission.executionMode ?? "sequential",
      payload: submission.payload as any,
      status: "pending",
      maxRetries: submission.maxRetries ?? this.config.retryLimit,
      timeout: submission.timeout ?? 300000,
      scheduledFor: submission.scheduledFor,
      cronExpression: submission.cronExpression,
      userId: submission.userId,
    };

    const [job] = await getDb().insert(agentJobs).values(jobData).returning();

    const isDue = !job.scheduledFor || job.scheduledFor <= new Date();
    const depsReady = await this.areDependenciesMet(job.dependencies ?? []);
    if (isDue && depsReady) {
      await this.enqueueJob(job);
    }

    console.log(`[JobQueue] Submitted job ${job.id}: ${job.name} (type: ${job.type})`);
    return job;
  }

  async submitBatch(submissions: JobSubmission[]): Promise<AgentJob[]> {
    const jobs: AgentJob[] = [];
    for (const submission of submissions) {
      const job = await this.submitJob(submission);
      jobs.push(job);
    }
    return jobs;
  }

  private async enqueueJob(job: AgentJob): Promise<void> {
    await getDb().update(agentJobs)
      .set({ status: "queued" })
      .where(eq(agentJobs.id, job.id));

    // Trigger immediate poll check if we're not already busy
    setImmediate(() => this.poll());
  }

  async registerProcessor(
    type: JobType,
    callback: (job: AgentJob) => Promise<{ output: unknown; error?: string }>
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    this.processingCallbacks.set(type, callback);
    console.log(`[JobQueue] Registered processor for ${type}`);
  }

  publishEvent(event: JobEvent): void {
    this.emitEvent(event);
  }

  private async processJob(jobId: string): Promise<void> {
    const startTime = Date.now();

    const [job] = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));

    if (!job) {
      console.error(`[JobQueue] Job ${jobId} not found`);
      return;
    }

    // Double check status to avoid race conditions
    if (job.status !== "queued") return;

    await getDb().update(agentJobs)
      .set({ 
        status: "running", 
        startedAt: new Date() 
      })
      .where(eq(agentJobs.id, jobId));

    console.log(`[JobQueue] Processing job ${jobId}: ${job.name}`);
    
    // Emit started event
    this.emitEvent({ type: "started", jobId, job });

    try {
      const callback = this.processingCallbacks.get(job.type);
      if (!callback) {
        throw new Error(`No processor registered for job type: ${job.type}`);
      }

      const result = await callback(job);
      const durationMs = Date.now() - startTime;

      const resultData: InsertJobResult = {
        jobId: job.id,
        success: !result.error,
        output: result.output as any,
        error: result.error,
        durationMs,
      };

      await getDb().insert(jobResults).values(resultData);

      await getDb().update(agentJobs)
        .set({ 
          status: result.error ? "failed" : "completed",
          completedAt: new Date(),
        })
        .where(eq(agentJobs.id, jobId));

      console.log(`[JobQueue] Job ${jobId} ${result.error ? "failed" : "completed"} in ${durationMs}ms`);

      // Handle Cron Jobs: Schedule next run if successful
      if (!result.error && job.cronExpression) {
        try {
          const interval = cronParser.parseExpression(job.cronExpression);
          const nextRun = interval.next().toDate();
          
          await this.submitJob({
            name: job.name,
            type: job.type as JobType,
            payload: job.payload as JobPayload,
            priority: job.priority ?? 5,
            executionMode: job.executionMode as ExecutionMode,
            maxRetries: job.maxRetries ?? 3,
            timeout: job.timeout,
            cronExpression: job.cronExpression,
            scheduledFor: nextRun,
            userId: job.userId ?? undefined
          });
          
          console.log(`[JobQueue] Scheduled next run for cron job ${job.name} at ${nextRun}`);
        } catch (cronError) {
          console.error(`[JobQueue] Failed to schedule next cron run for ${job.name}:`, cronError);
        }
      }

      // Emit completion or failure event
      if (result.error) {
        this.emitEvent({ type: "failed", jobId, job, error: result.error });
      } else {
        const savedResult = await this.getJobResult(jobId);
        this.emitEvent({ type: "completed", jobId, job, result: savedResult ?? undefined });
      }

      await this.checkDependentJobs(jobId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[JobQueue] Job ${jobId} error:`, errorMessage);

      const currentRetryCount = (job.retryCount ?? 0) + 1;
      if (currentRetryCount < (job.maxRetries ?? 3)) {
        await getDb().update(agentJobs)
          .set({ 
            status: "pending", // Set back to pending so dependencies logic can pick it up or we can re-enqueue
            retryCount: currentRetryCount,
          })
          .where(eq(agentJobs.id, jobId));
        
        // Re-enqueue after delay? For simplicity in polling, we just set to queued
        // But for exponential backoff we might want a 'scheduledFor' field logic.
        // For now, simple re-queue:
        setTimeout(async () => {
             await getDb().update(agentJobs)
              .set({ status: "queued" })
              .where(eq(agentJobs.id, jobId));
        }, this.config.retryDelay * currentRetryCount); // simple delay

        this.emitEvent({ type: "retry", jobId, job, error: errorMessage });
      } else {
        await getDb().insert(jobResults).values({
          jobId: job.id,
          success: false,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });

        await getDb().update(agentJobs)
          .set({ 
            status: "failed",
            completedAt: new Date(),
          })
          .where(eq(agentJobs.id, jobId));
        
        // Emit failure event
        this.emitEvent({ type: "failed", jobId, job, error: errorMessage });
      }
    }
  }

  private async areDependenciesMet(dependencies: string[]): Promise<boolean> {
    if (!dependencies || dependencies.length === 0) return true;

    // Check if all dependency IDs have status 'completed'
    // This is a simplification.
    
    // Get all dependency jobs
    const deps = await getDb().select()
      .from(agentJobs)
      .where(inArray(agentJobs.id, dependencies));
      
    if (deps.length !== dependencies.length) {
        // Some dependencies don't exist?
        return false;
    }

    return deps.every(d => d.status === "completed");
  }

  private async checkDependentJobs(completedJobId: string): Promise<void> {
    // Find pending jobs that depend on this one
    // We don't have a direct index on dependencies (it's a JSON/Array column usually), 
    // so we might need to scan pending jobs or use specific DB features.
    // Assuming 'dependencies' is a JSONB array or similar text array.
    
    // For PGlite/SQLite, we fetch all pending jobs and check in memory if list is small, 
    // or rely on the fact that when we submit, we check dependencies.
    // But here we need to "wake up" jobs that were waiting.
    
    const pendingJobs = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.status, "pending"));

    for (const job of pendingJobs) {
      const deps = job.dependencies ?? [];
      if (deps.includes(completedJobId)) {
        if (await this.areDependenciesMet(deps)) {
          await this.enqueueJob(job);
        }
      }
    }
  }

  async getJob(jobId: string): Promise<AgentJob | null> {
    const [job] = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));
    return job ?? null;
  }

  async getJobResult(jobId: string): Promise<JobResult | null> {
    const [result] = await getDb().select()
      .from(jobResults)
      .where(eq(jobResults.jobId, jobId));
    return result ?? null;
  }

  async getJobsByStatus(status: JobStatus): Promise<AgentJob[]> {
    return getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.status, status))
      .orderBy(asc(agentJobs.priority), asc(agentJobs.createdAt));
  }

  async getJobsByParent(parentJobId: string): Promise<AgentJob[]> {
    return getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.parentJobId, parentJobId))
      .orderBy(asc(agentJobs.createdAt));
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const [job] = await getDb().update(agentJobs)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(and(
        eq(agentJobs.id, jobId),
        or(eq(agentJobs.status, "pending"), eq(agentJobs.status, "queued"))
      ))
      .returning();

    if (job) {
      this.emitEvent({ type: "cancelled", jobId, job });
    }

    return !!job;
  }

  async resumeJob(jobId: string, operatorInput?: string): Promise<boolean> {
    const [job] = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));

    if (!job) return false;

    const currentPayload = (job.payload as Record<string, unknown>) || {};
    const currentContext = (currentPayload.context as Record<string, unknown>) || {};
    const newPayload = operatorInput !== undefined
      ? { 
          ...currentPayload, 
          context: {
            ...currentContext,
            operatorInput,
          }
        }
      : currentPayload;

    await getDb().update(agentJobs)
      .set({ 
        payload: newPayload as any,
        status: "pending",
      })
      .where(eq(agentJobs.id, jobId));

    const [updatedJob] = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));

    if (updatedJob) {
      await this.enqueueJob(updatedJob);
      this.emitEvent({ type: "resumed", jobId, job: updatedJob });
    }

    return true;
  }

  async markWaitingForInput(jobId: string): Promise<boolean> {
    const [job] = await getDb().update(agentJobs)
      .set({ status: "pending" }) 
      .where(eq(agentJobs.id, jobId))
      .returning();

    if (job) {
      this.emitEvent({ type: "waiting_input", jobId, job });
    }

    return !!job;
  }

  async getQueueStats(): Promise<{
    pending: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const stats = await getDb().select({
      status: agentJobs.status,
      count: sql<number>`count(*)::int`,
    })
    .from(agentJobs)
    .groupBy(agentJobs.status);

    const result = {
      pending: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const stat of stats) {
      if (stat.status in result) {
        result[stat.status as keyof typeof result] = stat.count;
      }
    }

    return result;
  }

  async purgeCompletedJobs(olderThanHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const deleted = await getDb().delete(agentJobs)
      .where(and(
        or(eq(agentJobs.status, "completed"), eq(agentJobs.status, "failed"), eq(agentJobs.status, "cancelled")),
        sql`${agentJobs.completedAt} < ${cutoff}`
      ))
      .returning();

    return deleted.length;
  }
}

export const jobQueue = new JobQueueService();
export default jobQueue;
