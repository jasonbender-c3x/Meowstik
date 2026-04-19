
/**
 * =============================================================================
 * JOB DISPATCHER SERVICE
 * =============================================================================
 * 
 * Routes jobs to workers based on priority, dependencies, and execution mode.
 * Coordinates between JobQueue, WorkerPool, and DependencyResolver.
 */

import { jobQueue, type JobSubmission } from "./job-queue";
import { workerPool } from "./worker-pool";
import { dependencyResolver } from "./dependency-resolver";
import { getDb } from "../db";
import { agentJobs, jobResults, type AgentJob } from "@shared/schema";
import { eq, and, inArray, asc } from "drizzle-orm";

export interface DispatchResult {
  jobId: string;
  status: "dispatched" | "queued" | "blocked" | "failed";
  workerId?: string;
  error?: string;
}

class JobDispatcherService {
  private isRunning = false;
  private dispatchInterval: NodeJS.Timeout | null = null;
  private dispatchIntervalMs = 2000;
  private retryDelayMs = 30000;

  async start(): Promise<void> {
    if (this.isRunning) return;

    await jobQueue.initialize();
    await workerPool.initialize();

    this.isRunning = true;
    this.startDispatchLoop();

    console.log("[JobDispatcher] Started");
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.dispatchInterval) {
      clearInterval(this.dispatchInterval);
      this.dispatchInterval = null;
    }

    await workerPool.shutdown();
    await jobQueue.stop();

    console.log("[JobDispatcher] Stopped");
  }

  private startDispatchLoop(): void {
    this.dispatchInterval = setInterval(async () => {
      try {
        await this.dispatchReadyJobs();
      } catch (error) {
        console.error("[JobDispatcher] Dispatch loop error:", error);
      }
    }, this.dispatchIntervalMs);
  }

  private async dispatchReadyJobs(): Promise<void> {
    await jobQueue.promoteReadyJobs();

    const resolution = await dependencyResolver.resolve();

    for (const failedDep of resolution.failedDeps) {
      await getDb().update(agentJobs)
        .set({ 
          status: "failed",
          completedAt: new Date(),
        })
        .where(eq(agentJobs.id, failedDep.jobId));
      
      console.warn(`[JobDispatcher] Job ${failedDep.jobId} failed due to failed dependencies: ${failedDep.failedDependencies.join(", ")}`);
    }

    const queuedJobs = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.status, "queued"))
      .orderBy(asc(agentJobs.priority), asc(agentJobs.createdAt));

    const sortedJobs = queuedJobs.sort((a, b) => {
      const priA = a.priority ?? 5;
      const priB = b.priority ?? 5;
      if (priA !== priB) return priA - priB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    for (const job of sortedJobs) {
      const worker = await workerPool.getIdleWorker();
      
      if (!worker) {
        const canScale = await workerPool.scaleUp();
        if (!canScale) {
          break;
        }
        continue;
      }

      try {
        const [claimedJob] = await getDb().update(agentJobs)
          .set({ status: "running", startedAt: new Date() })
          .where(and(eq(agentJobs.id, job.id), eq(agentJobs.status, "queued")))
          .returning();

        if (!claimedJob) {
          continue;
        }

        jobQueue.publishEvent({ type: "started", jobId: job.id, job: claimedJob });

        const startTime = Date.now();
        worker.executeJob(claimedJob).then(async (result) => {
          const { output, error, inputTokens, outputTokens } = result;
          if (error) {
            await this.handleJobFailure(claimedJob, error, startTime, { output, inputTokens, outputTokens });
          } else {
            await this.handleJobSuccess(claimedJob, { output, inputTokens, outputTokens }, startTime);
          }
        }).catch(async (err) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[JobDispatcher] Job ${job.id} execution error:`, err);
          await this.handleJobFailure(claimedJob, errorMessage, startTime);
        });

      } catch (error) {
        console.error(`[JobDispatcher] Failed to dispatch job ${job.id}:`, error);
      }
    }
  }

  async submitJob(submission: JobSubmission): Promise<AgentJob> {
    if (!this.isRunning) {
      await this.start();
    }
    return jobQueue.submitJob(submission);
  }

  async submitWorkflow(
    name: string,
    steps: JobSubmission[],
    mode: "sequential" | "parallel" = "sequential"
  ): Promise<AgentJob> {
    if (!this.isRunning) {
      await this.start();
    }

    const [parentJob] = await getDb().insert(agentJobs).values({
      name,
      type: "composite",
      payload: { childJobs: steps as any } as any,
      executionMode: mode,
      status: "pending",
      priority: Math.min(...steps.map((step) => step.priority ?? 5), 5),
      dependencies: [],
      maxRetries: 0,
      userId: steps[0]?.userId,
    }).returning();

    const childJobIds: string[] = [];
    let previousJobId: string | undefined;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      const childSubmission: JobSubmission = {
        ...step,
        parentJobId: parentJob.id,
        dependencies: mode === "sequential" && previousJobId 
          ? [previousJobId] 
          : [],
      };

        const childJob = await jobQueue.submitJob(childSubmission);
        childJobIds.push(childJob.id);
        previousJobId = childJob.id;
      }

    await getDb().update(agentJobs)
      .set({ dependencies: childJobIds })
      .where(eq(agentJobs.id, parentJob.id));

    await jobQueue.promoteReadyJobs();

    return parentJob;
  }

  async getJobStatus(jobId: string): Promise<{
    job: AgentJob | null;
    result: any;
    children: AgentJob[];
  }> {
    const job = await jobQueue.getJob(jobId);
    const result = await jobQueue.getJobResult(jobId);
    
    let children: AgentJob[] = [];
    if (job) {
      children = await getDb().select()
        .from(agentJobs)
        .where(eq(agentJobs.parentJobId, jobId))
        .orderBy(asc(agentJobs.createdAt));
    }

    return { job, result, children };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return jobQueue.cancelJob(jobId);
  }

  async getDispatcherStats(): Promise<{
    queueStats: Awaited<ReturnType<typeof jobQueue.getQueueStats>>;
    poolStats: Awaited<ReturnType<typeof workerPool.getPoolStats>>;
    isRunning: boolean;
  }> {
    return {
      queueStats: await jobQueue.getQueueStats(),
      poolStats: await workerPool.getPoolStats(),
      isRunning: this.isRunning,
    };
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private async handleJobSuccess(
    job: AgentJob,
    result: { output: unknown; inputTokens?: number; outputTokens?: number },
    startTime: number
  ): Promise<void> {
    const durationMs = Date.now() - startTime;

    await getDb().insert(jobResults).values({
      jobId: job.id,
      success: true,
      output: result.output as any,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs,
    });

    await getDb().update(agentJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(agentJobs.id, job.id));

    console.log(`[JobDispatcher] Job ${job.id} completed`);

    if (job.cronExpression) {
      await this.scheduleNextCronRun(job);
    }

    const savedResult = await jobQueue.getJobResult(job.id);
    jobQueue.publishEvent({ type: "completed", jobId: job.id, job, result: savedResult ?? undefined });
    await jobQueue.promoteReadyJobs();
  }

  private async handleJobFailure(
    job: AgentJob,
    errorMessage: string,
    startTime: number,
    partial?: { output?: unknown; inputTokens?: number; outputTokens?: number }
  ): Promise<void> {
    const nextRetryCount = (job.retryCount ?? 0) + 1;
    const durationMs = Date.now() - startTime;

    if (nextRetryCount < (job.maxRetries ?? 3)) {
      const retryAt = new Date(Date.now() + this.retryDelayMs * nextRetryCount);

      await getDb().update(agentJobs)
        .set({
          status: "pending",
          retryCount: nextRetryCount,
          scheduledFor: retryAt,
          startedAt: null,
          workerId: null,
        })
        .where(eq(agentJobs.id, job.id));

      console.warn(`[JobDispatcher] Job ${job.id} retrying at ${retryAt.toISOString()}: ${errorMessage}`);
      jobQueue.publishEvent({ type: "retry", jobId: job.id, job, error: errorMessage });
      return;
    }

    await getDb().insert(jobResults).values({
      jobId: job.id,
      success: false,
      output: partial?.output as any,
      error: errorMessage,
      inputTokens: partial?.inputTokens,
      outputTokens: partial?.outputTokens,
      durationMs,
    });

    await getDb().update(agentJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
      })
      .where(eq(agentJobs.id, job.id));

    console.error(`[JobDispatcher] Job ${job.id} failed: ${errorMessage}`);
    jobQueue.publishEvent({ type: "failed", jobId: job.id, job, error: errorMessage });
    await jobQueue.promoteReadyJobs();
  }

  private async scheduleNextCronRun(job: AgentJob): Promise<void> {
    if (!job.cronExpression) {
      return;
    }

    const cronParser = await import("cron-parser");
    const interval = cronParser.default.parseExpression(job.cronExpression);
    const nextRun = interval.next().toDate();

    await jobQueue.submitJob({
      name: job.name,
      type: job.type as JobSubmission["type"],
      payload: job.payload as JobSubmission["payload"],
      priority: job.priority ?? 5,
      executionMode: job.executionMode as JobSubmission["executionMode"],
      maxRetries: job.maxRetries ?? 3,
      timeout: job.timeout ?? undefined,
      cronExpression: job.cronExpression,
      scheduledFor: nextRun,
      userId: job.userId ?? undefined,
    });

    console.log(`[JobDispatcher] Scheduled next cron run for ${job.name} at ${nextRun.toISOString()}`);
  }
}

export const jobDispatcher = new JobDispatcherService();
export default jobDispatcher;


