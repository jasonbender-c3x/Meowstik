# LLM Scheduler - Automated Callback System

## Overview

The LLM Scheduler allows the AI to schedule itself to "wake up" at a later time with a specific prompt. This enables handling of long-running tasks without blocking, implementing retry logic, and creating delayed workflows.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    LLM SCHEDULER FLOW                           │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. LLM calls scheduler_create_callback                         │
│          │                                                       │
│          ▼                                                       │
│  2. Scheduled job created in database                           │
│          │                                                       │
│          ▼                                                       │
│  3. pg-boss schedules delayed execution                         │
│          │                                                       │
│          ▼ (after delay)                                        │
│  4. Job triggers → Creates message in chat                      │
│          │                                                       │
│          ▼                                                       │
│  5. LLM processes prompt with conditional logic                 │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. LLM Scheduler Service (`server/services/llm-scheduler.ts`)
- Handles callback scheduling and execution
- Creates jobs in the job queue system
- Generates messages in chats when callbacks trigger

### 2. Scheduler Callback Processor (`server/services/scheduler-callback-processor.ts`)
- Processes scheduled callback jobs when they execute
- Integrates with the job queue system

### 3. Tool Declarations (`server/gemini-tools.ts`)
- Exposes scheduler tools to the LLM
- Provides parameter schemas and documentation

## Available Tools

### `scheduler_create_callback`
Schedule a delayed callback with a custom prompt.

**Parameters:**
- `prompt` (required): The exact prompt to send when callback triggers
- `triggerInSeconds` (optional): Delay in seconds before triggering
- `triggerAt` (optional): Specific ISO 8601 datetime to trigger
- `metadata` (optional): Tracking metadata (taskType, taskId, retryCount, etc.)

**Note:** Exactly one of `triggerInSeconds` or `triggerAt` must be provided.

### `scheduler_cancel_callback`
Cancel a scheduled callback.

**Parameters:**
- `callbackId` (required): ID of the callback to cancel

### `scheduler_get_status`
Check the status of a scheduled callback.

**Parameters:**
- `callbackId` (required): ID of the callback to check

## Usage Examples

### Example 1: Long-Running Task with Retry Logic

```typescript
// Step 1: Start the long-running task
const taskId = startCodebaseAnalysis();

// Step 2: Schedule callback to check status in 5 minutes
scheduler_create_callback({
  prompt: `Check if codebase analysis task '${taskId}' has completed.
  
  **If completed successfully:**
  - Retrieve the analysis results
  - Summarize key findings
  - Present results to the user
  
  **If still running:**
  - Check retry count in metadata
  - If retries < 3: Schedule another callback in 5 minutes with retryCount+1
  - If retries >= 3: Report timeout error to user
  
  **If failed:**
  - Report the error to the user
  - Ask if they want to retry`,
  
  triggerInSeconds: 300, // 5 minutes
  metadata: {
    taskType: "codebase_analysis",
    taskId: taskId,
    retryCount: 0
  }
});

// Step 3: Respond to user
send_chat({ content: "I've started the codebase analysis. I'll check back in 5 minutes with the results." });
end_turn();
```

### Example 2: Delayed Reminder

```typescript
scheduler_create_callback({
  prompt: "Remind the user that they have a meeting in 15 minutes.",
  triggerAt: "2024-03-15T14:45:00Z",
  metadata: {
    taskType: "reminder",
    taskId: "meeting-reminder-1"
  }
});

send_chat({ content: "I've set a reminder for 15 minutes before your meeting." });
end_turn();
```

### Example 3: Periodic Status Check

```typescript
scheduler_create_callback({
  prompt: `Check the status of deployment task 'deploy-789'.
  
  If deployment succeeded: Notify user of success.
  If deployment failed: Notify user of failure with error details.
  If still deploying: Schedule another check in 2 minutes (up to 5 retries).`,
  
  triggerInSeconds: 120, // 2 minutes
  metadata: {
    taskType: "deployment_check",
    taskId: "deploy-789",
    retryCount: 0
  }
});
```

## Implementation Details

### Database Integration
- Uses existing `agentJobs` table for job storage
- Leverages `pg-boss` for reliable job scheduling
- Jobs are marked with `isScheduledCallback: true` in payload context

### Message Creation
When a scheduled callback triggers:
1. The job processor calls `llmScheduler.executeCallback()`
2. A new message is created in the specified chat with role "user"
3. The message content is prefixed with `[Scheduled Callback]`
4. Normal chat processing flow handles the LLM response

### Error Handling
- Failed callbacks can retry based on job configuration
- Callbacks that fail persistently are marked as failed
- Error details are stored in job results

## Best Practices

### 1. Craft Detailed Prompts
Include all conditional logic directly in the prompt:
- Check task status
- Handle success case
- Handle still-running case (with retry logic)
- Handle failure case
- Set retry limits

### 2. Use Metadata for Context
Store relevant information in metadata:
```typescript
metadata: {
  taskType: "analysis",
  taskId: "abc-123",
  retryCount: 0,
  maxRetries: 3,
  originalRequest: "Analyze codebase for security issues"
}
```

### 3. Set Reasonable Delays
Consider typical completion times:
- Quick tasks (seconds): 10-30 seconds
- Medium tasks (minutes): 2-5 minutes
- Long tasks (hours): 10-30 minutes

### 4. Implement Retry Limits
Always include a maximum retry count to prevent infinite loops:
```typescript
if (retryCount < 3) {
  // Schedule another callback
} else {
  // Report timeout/failure to user
}
```

### 5. Handle Edge Cases
Plan for:
- Task completion before callback
- Task failure
- Network/system errors
- User cancellation

## Testing

### Manual Testing
1. Start the server
2. In a chat, use the scheduler tool:
   ```json
   {
     "type": "scheduler_create_callback",
     "parameters": {
       "prompt": "Say 'Hello from the past!'",
       "triggerInSeconds": 10
     }
   }
   ```
3. Wait 10 seconds
4. Check that a new message appears in the chat

### Integration Testing
See `server/services/llm-scheduler.ts` for test examples.

## Troubleshooting

### Callback Not Triggering
- Check that the job queue is running
- Verify the scheduled time is in the future
- Check job status in `agent_jobs` table

### Messages Not Appearing
- Verify chat ID exists
- Check job results for errors
- Review server logs for callback execution

### Infinite Retry Loops
- Ensure retry logic includes maximum retry count
- Add timeout conditions to your prompts
- Monitor job queue for stuck jobs

## Future Enhancements

Potential improvements:
- Recurring callbacks (cron-style scheduling)
- Callback dependencies (chain callbacks)
- Priority levels for callbacks
- Callback groups for batch operations
- Callback history and analytics

## Related Documentation

- [Job Orchestration](../docs/ragent/job-orchestration.md)
- [Scheduler & Cron Jobs](../docs/ragent/scheduler.md)
- [Tool Protocol Reference](../docs/ragent/tool-protocol.md)
