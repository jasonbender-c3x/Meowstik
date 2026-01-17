/**
 * =============================================================================
 * LLM SCHEDULER SERVICE
 * =============================================================================
 * 
 * Allows the LLM to schedule automated callbacks for long-running tasks.
 * The LLM can schedule itself to "wake up" at a later time with a specific
 * prompt to check task status and continue workflows.
 * 
 * Features:
 * - Schedule one-time callbacks with custom prompts
 * - Time-based triggers (seconds or specific datetime)
 * - Automatic chat context creation for callback prompts
 * - Integration with existing job queue system
 */

import { getDb } from "../db";
import { agentJobs, chats, messages, type InsertMessage } from "@shared/schema";
import { jobQueue } from "./job-queue";
import { eq } from "drizzle-orm";

export interface ScheduleCallbackParams {
  /**
   * The prompt to send to the LLM when the callback triggers.
   * Should include logic for checking task status and handling retries.
   */
  prompt: string;
  
  /**
   * Delay in seconds before triggering the callback.
   * Either this or triggerAt must be provided.
   */
  triggerInSeconds?: number;
  
  /**
   * Specific datetime to trigger the callback (ISO 8601 format).
   * Either this or triggerInSeconds must be provided.
   */
  triggerAt?: string;
  
  /**
   * Optional chat ID to associate the callback with.
   * If not provided, will use the current chat context.
   */
  chatId?: string;
  
  /**
   * Optional user ID for the scheduled callback.
   */
  userId?: string;
  
  /**
   * Optional metadata for tracking the purpose of this callback.
   */
  metadata?: {
    taskType?: string;
    taskId?: string;
    retryCount?: number;
    [key: string]: unknown;
  };
}

export interface ScheduledCallback {
  id: string;
  jobId: string;
  chatId: string;
  prompt: string;
  scheduledFor: Date;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
}

class LlmSchedulerService {
  /**
   * Schedule an LLM callback to execute at a future time
   */
  async scheduleCallback(params: ScheduleCallbackParams): Promise<ScheduledCallback> {
    const { prompt, triggerInSeconds, triggerAt, chatId, userId, metadata } = params;
    
    // Validate that either triggerInSeconds or triggerAt is provided
    if (!triggerInSeconds && !triggerAt) {
      throw new Error("Either triggerInSeconds or triggerAt must be provided");
    }
    
    if (triggerInSeconds && triggerAt) {
      throw new Error("Only one of triggerInSeconds or triggerAt can be provided");
    }
    
    // Calculate the scheduled time
    let scheduledFor: Date;
    if (triggerInSeconds) {
      scheduledFor = new Date(Date.now() + triggerInSeconds * 1000);
    } else if (triggerAt) {
      scheduledFor = new Date(triggerAt);
      if (isNaN(scheduledFor.getTime())) {
        throw new Error("Invalid triggerAt datetime format. Use ISO 8601 format.");
      }
      if (scheduledFor <= new Date()) {
        throw new Error("triggerAt must be in the future");
      }
    } else {
      throw new Error("Unreachable: validation should have caught this");
    }
    
    // Ensure we have a chat context
    if (!chatId) {
      throw new Error("chatId is required for scheduling callbacks");
    }
    
    // Create a job in the queue system with the scheduled time
    const job = await jobQueue.submitJob({
      name: `LLM Callback: ${metadata?.taskType || 'Scheduled Check'}`,
      type: "prompt",
      payload: {
        prompt,
        context: {
          isScheduledCallback: true,
          originalMetadata: metadata,
          chatId,
        },
      },
      scheduledFor,
      userId,
      priority: 5, // Normal priority
      maxRetries: 1, // Limited retries for callbacks
      timeout: 300000, // 5 minute timeout
    });
    
    console.log(`[LlmScheduler] Scheduled callback for ${scheduledFor.toISOString()}, job ${job.id}`);
    
    return {
      id: job.id,
      jobId: job.id,
      chatId,
      prompt,
      scheduledFor,
      status: "pending",
      createdAt: new Date(job.createdAt!),
    };
  }
  
  /**
   * Execute a scheduled callback by creating a message with the prompt
   * This is called by the job processor when the scheduled time arrives
   */
  async executeCallback(jobId: string, chatId: string, prompt: string): Promise<void> {
    // Verify the chat exists
    const [chat] = await getDb().select()
      .from(chats)
      .where(eq(chats.id, chatId));
    
    if (!chat) {
      throw new Error(`Chat ${chatId} not found`);
    }
    
    // Create a message with role "user" containing the scheduled prompt
    const messageData: InsertMessage = {
      chatId,
      role: "user",
      content: `[Scheduled Callback]\n\n${prompt}`,
      metadata: {
        isScheduledCallback: true,
        jobId,
      },
    };
    
    await getDb().insert(messages).values(messageData);
    
    console.log(`[LlmScheduler] Executed callback for job ${jobId} in chat ${chatId}`);
    
    // Note: The actual LLM response generation should be triggered by the 
    // normal chat message processing flow, not directly here. This ensures
    // proper SSE streaming and UI updates.
  }
  
  /**
   * Cancel a scheduled callback
   */
  async cancelCallback(callbackId: string): Promise<boolean> {
    return await jobQueue.cancelJob(callbackId);
  }
  
  /**
   * Get the status of a scheduled callback
   */
  async getCallbackStatus(callbackId: string): Promise<ScheduledCallback | null> {
    const job = await jobQueue.getJob(callbackId);
    if (!job) return null;
    
    const payload = job.payload as any;
    const context = payload?.context || {};
    
    return {
      id: job.id,
      jobId: job.id,
      chatId: context.chatId || "",
      prompt: payload?.prompt || "",
      scheduledFor: job.scheduledFor ? new Date(job.scheduledFor) : new Date(),
      status: job.status === "completed" ? "completed" : 
              job.status === "failed" ? "failed" : "pending",
      createdAt: new Date(job.createdAt!),
    };
  }
}

export const llmScheduler = new LlmSchedulerService();
export default llmScheduler;
