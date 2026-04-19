
/**
 * =============================================================================
 * ORCHESTRATION API ROUTES
 * =============================================================================
 * 
 * API endpoints for the workflow orchestration system:
 * - Executor control (start/stop/pause)
 * - Schedule management (CRUD + cron)
 * - Trigger management (CRUD + webhooks)
 * - Workflow management
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { workflowExecutor } from "../services/workflow-executor";
import { cronScheduler } from "../services/cron-scheduler";
import { triggerService } from "../services/trigger-service";
import {
  insertScheduleSchema,
  insertTriggerSchema,
  insertWorkflowSchema,
  TriggerTypes,
  type InsertTrigger,
  type Trigger,
} from "@shared/schema";

const router = Router();

function formatExecutorStatus(status: Awaited<ReturnType<typeof workflowExecutor.getStatus>>) {
  const queueStats = status.stats.queueStats;

  return {
    isRunning: status.isRunning,
    isPaused: status.isPaused,
    activeTaskCount: queueStats.running,
    pendingTaskCount: queueStats.pending + queueStats.queued,
    stats: {
      pending: queueStats.pending + queueStats.queued,
      running: queueStats.running,
      completed: queueStats.completed,
      failed: queueStats.failed,
    },
  };
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTriggerType(triggerType: string): string {
  return triggerType === "keyword" ? TriggerTypes.PROMPT_KEYWORD : triggerType;
}

function buildTriggerInput(body: any): InsertTrigger {
  const config = body?.config && typeof body.config === "object" ? body.config : {};
  const triggerType = normalizeTriggerType(body.triggerType);

  let pattern = body.pattern ?? null;
  let senderFilter = body.senderFilter ?? null;
  let subjectFilter = body.subjectFilter ?? null;
  let webhookSecret = body.webhookSecret ?? null;

  if (triggerType === TriggerTypes.PROMPT_KEYWORD) {
    const keywords = Array.isArray(config.keywords)
      ? config.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
      : [];

    if (keywords.length > 0) {
      pattern = keywords.map(escapeRegexLiteral).join("|");
    }
  }

  if (triggerType === TriggerTypes.EMAIL) {
    senderFilter = typeof config.senderEmail === "string" && config.senderEmail.trim()
      ? escapeRegexLiteral(config.senderEmail.trim())
      : senderFilter;
    subjectFilter = typeof config.subject === "string" && config.subject.trim()
      ? escapeRegexLiteral(config.subject.trim())
      : subjectFilter;
  }

  if (triggerType === TriggerTypes.SMS) {
    senderFilter = typeof config.senderPhone === "string" && config.senderPhone.trim()
      ? escapeRegexLiteral(config.senderPhone.trim())
      : senderFilter;
  }

  if (triggerType === TriggerTypes.WEBHOOK) {
    webhookSecret = typeof config.secret === "string" && config.secret.trim()
      ? config.secret.trim()
      : webhookSecret;
  }

  return insertTriggerSchema.parse({
    ...body,
    triggerType,
    pattern,
    senderFilter,
    subjectFilter,
    webhookSecret,
  });
}

function formatTrigger(trigger: Trigger) {
  const triggerType = trigger.triggerType === TriggerTypes.PROMPT_KEYWORD
    ? "keyword"
    : trigger.triggerType;

  const config: Record<string, unknown> = {};

  if (trigger.triggerType === TriggerTypes.PROMPT_KEYWORD && trigger.pattern) {
    config.keywords = trigger.pattern.split("|");
  }

  if (trigger.triggerType === TriggerTypes.EMAIL && trigger.senderFilter) {
    config.senderEmail = trigger.senderFilter;
  }

  if (trigger.triggerType === TriggerTypes.SMS && trigger.senderFilter) {
    config.senderPhone = trigger.senderFilter;
  }

  if (trigger.triggerType === TriggerTypes.WEBHOOK && trigger.webhookSecret) {
    config.secret = trigger.webhookSecret;
  }

  return {
    id: trigger.id,
    name: trigger.name,
    description: trigger.description,
    triggerType,
    config,
    workflowId: trigger.workflowId,
    taskTemplate: trigger.taskTemplate,
    enabled: trigger.enabled,
    lastFiredAt: trigger.lastTriggeredAt,
    fireCount: trigger.triggerCount,
    createdAt: trigger.createdAt,
  };
}

// ============================================================================
// EXECUTOR CONTROL
// ============================================================================

router.get("/executor/status", async (req: Request, res: Response) => {
  try {
    const status = await workflowExecutor.getStatus();
    res.json(formatExecutorStatus(status));
  } catch (error) {
    res.status(500).json({ error: "Failed to get executor status" });
  }
});

router.post("/executor/start", async (req: Request, res: Response) => {
  try {
    await workflowExecutor.start();
    await cronScheduler.start();
    await triggerService.start();
    const status = await workflowExecutor.getStatus();
    res.json({ message: "Executor started", status: formatExecutorStatus(status) });
  } catch (error) {
    res.status(500).json({ error: "Failed to start executor" });
  }
});

router.post("/executor/stop", async (req: Request, res: Response) => {
  try {
    await workflowExecutor.stop();
    await cronScheduler.stop();
    await triggerService.stop();
    const status = await workflowExecutor.getStatus();
    res.json({ message: "Executor stopped", status: formatExecutorStatus(status) });
  } catch (error) {
    res.status(500).json({ error: "Failed to stop executor" });
  }
});

router.post("/executor/pause", async (req: Request, res: Response) => {
  try {
    await workflowExecutor.pause();
    const status = await workflowExecutor.getStatus();
    res.json({ message: "Executor paused", status: formatExecutorStatus(status) });
  } catch (error) {
    res.status(500).json({ error: "Failed to pause executor" });
  }
});

router.post("/executor/resume", async (req: Request, res: Response) => {
  try {
    await workflowExecutor.resume();
    const status = await workflowExecutor.getStatus();
    res.json({ message: "Executor resumed", status: formatExecutorStatus(status) });
  } catch (error) {
    res.status(500).json({ error: "Failed to resume executor" });
  }
});

// ============================================================================
// TASK CONTROL
// ============================================================================

router.post("/tasks/:id/input", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { input } = req.body;
    
    if (!input) {
      return res.status(400).json({ error: "Input is required" });
    }
    
    await workflowExecutor.provideOperatorInput(id, input);
    res.json({ message: "Input provided" });
  } catch (error) {
    res.status(500).json({ error: "Failed to provide input" });
  }
});

router.post("/tasks/:id/interrupt", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await workflowExecutor.interruptTask(id);
    res.json({ message: "Task interrupted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to interrupt task" });
  }
});

router.post("/tasks/:id/prioritize", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await workflowExecutor.prioritizeTask(id);
    res.json({ message: "Task prioritized" });
  } catch (error) {
    res.status(500).json({ error: "Failed to prioritize task" });
  }
});

router.get("/tasks/waiting", async (req: Request, res: Response) => {
  try {
    const tasks = await storage.getTasksWaitingForInput();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to get waiting tasks" });
  }
});

// ============================================================================
// SCHEDULES
// ============================================================================

router.get("/schedules", async (req: Request, res: Response) => {
  try {
    const enabled = req.query.enabled === "true" ? true : 
                    req.query.enabled === "false" ? false : undefined;
    const schedules = await storage.getSchedules({ enabled });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: "Failed to get schedules" });
  }
});

router.get("/schedules/:id", async (req: Request, res: Response) => {
  try {
    const schedule = await storage.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to get schedule" });
  }
});

router.post("/schedules", async (req: Request, res: Response) => {
  try {
    const scheduleInput = insertScheduleSchema.parse(req.body);
    const validation = cronScheduler.isValidCronExpression(scheduleInput.cronExpression);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const nextRunAt = cronScheduler.getNextRunTime(scheduleInput.cronExpression);
    const schedule = await storage.createSchedule({
      ...scheduleInput,
      nextRunAt
    });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

router.put("/schedules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = insertScheduleSchema.partial().parse(req.body);
    
    if (updates.cronExpression) {
      const validation = cronScheduler.isValidCronExpression(updates.cronExpression);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      updates.nextRunAt = cronScheduler.getNextRunTime(updates.cronExpression);
    }
    
    const schedule = await storage.updateSchedule(id, updates);
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

router.delete("/schedules/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteSchedule(req.params.id);
    res.json({ message: "Schedule deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

router.post("/schedules/:id/run", async (req: Request, res: Response) => {
  try {
    const schedule = await storage.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    
    // Manually trigger the schedule by creating its task
    const template = schedule.taskTemplate as {
      title: string;
      description?: string;
      taskType: string;
      priority?: number;
    };
    
    const task = await workflowExecutor.submitTask({
      title: template.title,
      description: template.description || null,
      taskType: template.taskType || "action",
      priority: template.priority || 5,
      input: { manualRun: true, scheduleName: schedule.name }
    });
    
    res.json({ message: "Schedule run initiated", taskId: task.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to run schedule" });
  }
});

router.get("/schedules/cron/describe", async (req: Request, res: Response) => {
  try {
    const expression = req.query.expression as string;
    if (!expression) {
      return res.status(400).json({ error: "Expression is required" });
    }
    
    const validation = cronScheduler.isValidCronExpression(expression);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const description = cronScheduler.describeCronExpression(expression);
    const nextRun = cronScheduler.getNextRunTime(expression);
    
    res.json({ expression, description, nextRun });
  } catch (error) {
    res.status(500).json({ error: "Failed to describe cron expression" });
  }
});

// ============================================================================
// TRIGGERS
// ============================================================================

router.get("/triggers", async (req: Request, res: Response) => {
  try {
    const enabled = req.query.enabled === "true" ? true : 
                    req.query.enabled === "false" ? false : undefined;
    const triggerType = req.query.type ? normalizeTriggerType(String(req.query.type)) : undefined;
    const triggers = await storage.getTriggers({ enabled, triggerType });
    res.json(triggers.map(formatTrigger));
  } catch (error) {
    res.status(500).json({ error: "Failed to get triggers" });
  }
});

router.get("/triggers/:id", async (req: Request, res: Response) => {
  try {
    const trigger = await storage.getTriggerById(req.params.id);
    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    res.json(formatTrigger(trigger));
  } catch (error) {
    res.status(500).json({ error: "Failed to get trigger" });
  }
});

router.post("/triggers", async (req: Request, res: Response) => {
  try {
    const trigger = await storage.createTrigger(buildTriggerInput(req.body));
    res.status(201).json(formatTrigger(trigger));
  } catch (error) {
    res.status(500).json({ error: "Failed to create trigger" });
  }
});

router.put("/triggers/:id", async (req: Request, res: Response) => {
  try {
    const trigger = await storage.updateTrigger(req.params.id, buildTriggerInput({ ...req.body }));
    res.json(trigger ? formatTrigger(trigger) : null);
  } catch (error) {
    res.status(500).json({ error: "Failed to update trigger" });
  }
});

router.delete("/triggers/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteTrigger(req.params.id);
    res.json({ message: "Trigger deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete trigger" });
  }
});

router.post("/triggers/:id/fire", async (req: Request, res: Response) => {
  try {
    const result = await triggerService.manualTrigger(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ message: "Trigger fired", taskId: result.taskId });
  } catch (error) {
    res.status(500).json({ error: "Failed to fire trigger" });
  }
});

// Webhook endpoint for external triggers
router.post("/webhook/:triggerId", async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;
    const secret = req.headers["x-webhook-secret"] as string | undefined;
    
    const result = await triggerService.handleWebhook(triggerId, req.body, secret);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ message: "Webhook processed", taskId: result.taskId });
  } catch (error) {
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

// ============================================================================
// WORKFLOWS
// ============================================================================

router.get("/workflows", async (req: Request, res: Response) => {
  try {
    const enabled = req.query.enabled === "true" ? true : 
                    req.query.enabled === "false" ? false : undefined;
    const workflows = await storage.getWorkflows({ enabled });
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: "Failed to get workflows" });
  }
});

router.get("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const workflow = await storage.getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to get workflow" });
  }
});

router.post("/workflows", async (req: Request, res: Response) => {
  try {
    const workflow = await storage.createWorkflow(insertWorkflowSchema.parse(req.body));
    res.status(201).json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

router.put("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const workflow = await storage.updateWorkflow(req.params.id, insertWorkflowSchema.partial().parse(req.body));
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

router.delete("/workflows/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteWorkflow(req.params.id);
    res.json({ message: "Workflow deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

// Instantiate workflow - create tasks from workflow steps
router.post("/workflows/:id/run", async (req: Request, res: Response) => {
  try {
    const workflow = await storage.getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    
    const steps = workflow.steps as Array<{
      title: string;
      description?: string;
      taskType: string;
      priority?: number;
    }>;
    
    const tasks = await storage.createQueuedTasks(
      steps.map((step, idx) => ({
        title: step.title,
        description: step.description || null,
        taskType: step.taskType || "action",
        priority: step.priority ?? (steps.length - idx),
        input: req.body.input || null,
        workflowId: workflow.id
      }))
    );
    
    res.json({ message: "Workflow started", taskCount: tasks.length, tasks });
  } catch (error) {
    res.status(500).json({ error: "Failed to run workflow" });
  }
});

export default router;


