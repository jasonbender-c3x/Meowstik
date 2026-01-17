/**
 * =============================================================================
 * SCHEDULER CALLBACK PROCESSOR
 * =============================================================================
 * 
 * Processes scheduled LLM callbacks when they trigger.
 * This processor handles jobs of type "prompt" that were created by the
 * LLM scheduler service. When triggered, it creates a new message in the
 * specified chat with the scheduled prompt.
 */

import { type AgentJob } from "@shared/schema";
import { llmScheduler } from "./llm-scheduler";

/**
 * Process a scheduled callback job
 * This function is called by the job queue when a scheduled time arrives
 */
export async function processScheduledCallback(job: AgentJob): Promise<{ output: unknown; error?: string }> {
  try {
    const payload = job.payload as any;
    const context = payload?.context || {};
    
    // Check if this is a scheduled callback job
    if (!context.isScheduledCallback) {
      return {
        error: "Job is not a scheduled callback",
      };
    }
    
    const { chatId } = context;
    const prompt = payload?.prompt;
    
    if (!chatId || !prompt) {
      return {
        error: "Missing chatId or prompt in job payload",
      };
    }
    
    // Execute the callback - this creates a message in the chat
    await llmScheduler.executeCallback(job.id, chatId, prompt);
    
    return {
      output: {
        success: true,
        chatId,
        message: "Scheduled callback executed successfully",
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SchedulerCallbackProcessor] Error processing job ${job.id}:`, errorMessage);
    
    return {
      error: errorMessage,
    };
  }
}

/**
 * Initialize the scheduler callback processor
 * Registers the processor with the job queue
 */
export async function initializeSchedulerCallbackProcessor(): Promise<void> {
  const { jobQueue } = await import("./job-queue");
  
  // Register the processor for prompt-type jobs
  // The scheduler creates jobs with type "prompt" and marks them with isScheduledCallback
  await jobQueue.registerProcessor("prompt", async (job: AgentJob) => {
    const payload = job.payload as any;
    const context = payload?.context || {};
    
    // Only process scheduled callbacks with this processor
    if (context.isScheduledCallback) {
      return await processScheduledCallback(job);
    }
    
    // For non-scheduled prompt jobs, return an error
    // (These should be handled by a different processor)
    return {
      error: "This processor only handles scheduled callbacks",
    };
  });
  
  console.log("[SchedulerCallbackProcessor] Initialized");
}
