# Multi-Agent Orchestrator - Usage Guide

This guide demonstrates how to use the multi-agent orchestrator system to build advanced AI applications with Meowstik.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Model Selection](#model-selection)
3. [Specialized Agents](#specialized-agents)
4. [Async Execution](#async-execution)
5. [Progress Streaming](#progress-streaming)
6. [Example Workflows](#example-workflows)

---

## Quick Start

### Basic Task Execution

```typescript
import { asyncExecutionManager } from "./services/async-execution-manager";

// Execute a task asynchronously
const executionId = await asyncExecutionManager.executeTask(
  "analyze-code",
  {
    repository: "my-repo",
    file: "src/index.ts",
  },
  {
    userId: "user-123",
    async: true,
    streamProgress: true,
    onProgress: (update) => {
      console.log(`Progress: ${update.progress}% - ${update.message}`);
    },
    onComplete: (result) => {
      console.log("Task completed:", result);
    },
  }
);

console.log("Task queued with ID:", executionId);
```

### Using the API

```bash
# Execute a task
curl -X POST http://localhost:5000/api/orchestrator/v3/execute \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "analyze-code",
    "taskData": {
      "repository": "my-repo",
      "file": "src/index.ts"
    },
    "userId": "user-123",
    "async": true,
    "streamProgress": true
  }'

# Response:
# {
#   "executionId": "exec-1234567890-abc123",
#   "status": "queued",
#   "message": "Task queued for execution"
# }
```

---

## Model Selection

The Multi-Model Brain automatically selects the best AI model for your task.

### Automatic Model Selection

```typescript
import { getModelRouter, inferTaskCategory } from "./services/model-router";

// Infer task category from prompt
const category = inferTaskCategory("Write a function to sort an array");
// Result: "code_generation"

// Select optimal model
const modelRouter = getModelRouter();
const selection = modelRouter.selectModel({
  taskCategory: category,
  priority: "balanced", // "quality" | "speed" | "cost" | "balanced"
});

console.log(selection);
// {
//   modelType: "reasoning",
//   config: { modelId: "gemini-3.0-pro", ... },
//   rationale: "Selected Reasoning Core for code_generation",
//   estimatedCost: 10,
//   estimatedLatency: 3000
// }
```

### Via API

```bash
# Infer task category
curl -X POST http://localhost:5000/api/orchestrator/v3/models/infer \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Analyze this image for objects"}'

# Response: {"category": "vision"}

# Select model
curl -X POST http://localhost:5000/api/orchestrator/v3/models/select \
  -H "Content-Type: application/json" \
  -d '{
    "taskCategory": "vision",
    "priority": "speed",
    "requiresMultimodal": true
  }'
```

### Model Selection Priorities

| Priority | Use Case | Selection Criteria |
|----------|----------|-------------------|
| **quality** | Critical tasks, complex reasoning | Prefers Reasoning Core (Gemini 3.0) |
| **speed** | Real-time interactions | Prefers Perception Layer (Flash 2.0) or Live Interface |
| **cost** | High-volume operations | Prefers lower-cost models |
| **balanced** | General use (default) | Optimizes across all factors |

---

## Specialized Agents

Each agent has domain expertise and restricted access for security.

### Available Agents

#### 1. CodingAgent

**Domain**: Software development  
**Tools**: File system, Git, GitHub, terminal (sandboxed)  
**Restrictions**: No personal data access

```typescript
import { CODING_AGENT } from "./services/specialized-agents";

console.log(CODING_AGENT);
// {
//   id: "coding-agent-001",
//   name: "Coding Agent",
//   domain: ["coding"],
//   capabilities: ["code_generation", "code_review", "testing", ...],
//   modelType: "reasoning"
// }
```

**Example Use Cases**:
- Generate or refactor code
- Review pull requests
- Write unit tests
- Debug issues
- Manage Git operations

#### 2. PersonalLifeAgent

**Domain**: Personal organization  
**Tools**: Gmail, Calendar, Tasks, Contacts, Drive  
**Restrictions**: No code repository access

```typescript
import { PERSONAL_LIFE_AGENT } from "./services/specialized-agents";

// Use for email, calendar, and task management
```

**Example Use Cases**:
- Send and organize emails
- Schedule meetings
- Manage task lists
- Search contacts
- Organize personal documents

#### 3. ResearchAgent

**Domain**: Information gathering  
**Tools**: Web search, document reading, RAG system  
**Restrictions**: Read-only access

```typescript
import { RESEARCH_AGENT } from "./services/specialized-agents";

// Use for web research and document analysis
```

**Example Use Cases**:
- Web research
- Document summarization
- Fact verification
- Literature review
- Data synthesis

#### 4. CreativeAgent

**Domain**: Content creation  
**Tools**: Image generation, music composition, TTS  
**Restrictions**: No code or personal data access

```typescript
import { CREATIVE_AGENT } from "./services/specialized-agents";

// Use for creative content generation
```

**Example Use Cases**:
- Generate images
- Compose music
- Creative writing
- Voice synthesis
- Media editing

### Agent Access Validation

```typescript
import {
  hasToolAccess,
  validateDataAccess,
  getToolAccessLevel,
} from "./services/specialized-agents";

// Check tool access
const canUseTool = hasToolAccess(CODING_AGENT, "github_file_write");
console.log(canUseTool); // true

// Check data access
const canAccessData = validateDataAccess(CODING_AGENT, "workspace/src");
console.log(canAccessData); // true

// Get access level
const accessLevel = getToolAccessLevel(CODING_AGENT, "terminal_execute");
console.log(accessLevel); // "restricted" (sandboxed only)
```

### Via API

```bash
# List all agents
curl http://localhost:5000/api/orchestrator/v3/agents

# Get agent by domain
curl http://localhost:5000/api/orchestrator/v3/agents/by-domain/coding

# Validate access
curl -X POST http://localhost:5000/api/orchestrator/v3/agents/coding-agent-001/validate-access \
  -H "Content-Type: application/json" \
  -d '{
    "type": "tool",
    "target": "github_file_write"
  }'

# Response: {"hasAccess": true, "reason": "Agent has access to tool: github_file_write"}
```

---

## Async Execution

Execute tasks without blocking and track progress in real-time.

### Non-Blocking Execution

```typescript
import { asyncExecutionManager } from "./services/async-execution-manager";

// Start long-running task
const executionId = await asyncExecutionManager.executeTask(
  "build-project",
  {
    command: "npm run build",
    cwd: "/workspace/my-project",
  },
  {
    userId: "user-123",
    async: true, // Non-blocking
    timeout: 300000, // 5 minutes
    onProgress: (update) => {
      console.log(update.message);
    },
  }
);

// Continue other work while task runs
console.log("Task is running in background");

// Check status later
const execution = asyncExecutionManager.getExecution(executionId);
console.log(execution.status, execution.progress);
```

### Cancelling Executions

```typescript
// Cancel a running task
await asyncExecutionManager.cancelExecution(
  executionId,
  "User requested cancellation"
);
```

### Via API

```bash
# Execute async task
curl -X POST http://localhost:5000/api/orchestrator/v3/execute \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "long-task",
    "taskData": {"action": "process"},
    "userId": "user-123",
    "async": true,
    "timeout": 300000
  }'

# Get execution status
curl http://localhost:5000/api/orchestrator/v3/executions/exec-123

# Cancel execution
curl -X DELETE http://localhost:5000/api/orchestrator/v3/executions/exec-123 \
  -H "Content-Type: application/json" \
  -d '{"reason": "User cancelled"}'
```

---

## Progress Streaming

Stream real-time progress updates to the user via Server-Sent Events (SSE).

### Server-Side (Node.js)

```typescript
import { asyncExecutionManager } from "./services/async-execution-manager";

// Express route
app.get("/api/progress/:executionId", (req, res) => {
  const { executionId } = req.params;

  // Setup SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Progress listener
  const listener = (update) => {
    res.write(`data: ${JSON.stringify(update)}\n\n`);
    
    if (update.status === "completed") {
      res.end();
    }
  };

  asyncExecutionManager.addProgressListener(executionId, listener);

  req.on("close", () => {
    asyncExecutionManager.removeProgressListener(executionId, listener);
  });
});
```

### Client-Side (Browser)

```typescript
// Connect to SSE stream
const eventSource = new EventSource(
  `/api/orchestrator/v3/executions/${executionId}/progress`
);

eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data);
  
  console.log(`Progress: ${update.progress}%`);
  console.log(`Status: ${update.status}`);
  console.log(`Message: ${update.message}`);
  
  // Update UI
  updateProgressBar(update.progress);
  updateStatusText(update.message);
  
  if (update.status === "completed") {
    eventSource.close();
    showCompletionMessage();
  }
};

eventSource.onerror = (error) => {
  console.error("SSE error:", error);
  eventSource.close();
};
```

---

## Example Workflows

### Example 1: Code Review with CodingAgent

```typescript
import { asyncExecutionManager } from "./services/async-execution-manager";
import { CODING_AGENT } from "./services/specialized-agents";

async function reviewPullRequest(prNumber: number) {
  const executionId = await asyncExecutionManager.executeTask(
    "review-pr",
    {
      agent: CODING_AGENT.id,
      prNumber,
      checks: ["code_quality", "security", "tests"],
    },
    {
      userId: "developer-123",
      async: true,
      streamProgress: true,
      priority: 8,
      onProgress: (update) => {
        console.log(`Review progress: ${update.message}`);
      },
      onComplete: (result) => {
        console.log("Review complete:", result);
      },
    }
  );

  return executionId;
}

// Usage
const execId = await reviewPullRequest(42);
console.log(`Code review started: ${execId}`);
```

### Example 2: Multi-Agent Research and Writing

```typescript
import { asyncExecutionManager } from "./services/async-execution-manager";
import { RESEARCH_AGENT, CREATIVE_AGENT } from "./services/specialized-agents";

async function researchAndWrite(topic: string) {
  // Step 1: Research the topic
  const researchExecId = await asyncExecutionManager.executeTask(
    "research-topic",
    {
      agent: RESEARCH_AGENT.id,
      topic,
      sources: ["web", "documents"],
    },
    {
      userId: "writer-123",
      async: true,
    }
  );

  // Wait for research to complete
  const researchExecution = await waitForCompletion(researchExecId);
  const researchData = researchExecution.result;

  // Step 2: Write content based on research
  const writingExecId = await asyncExecutionManager.executeTask(
    "write-article",
    {
      agent: CREATIVE_AGENT.id,
      topic,
      research: researchData,
      style: "professional",
    },
    {
      userId: "writer-123",
      async: true,
      onComplete: (article) => {
        console.log("Article written:", article);
      },
    }
  );

  return { researchExecId, writingExecId };
}

async function waitForCompletion(executionId: string): Promise<any> {
  return new Promise((resolve) => {
    const checkStatus = () => {
      const execution = asyncExecutionManager.getExecution(executionId);
      if (execution?.status === "completed") {
        resolve(execution);
      } else {
        setTimeout(checkStatus, 1000);
      }
    };
    checkStatus();
  });
}
```

### Example 3: Personal Assistant Tasks

```typescript
import { asyncExecutionManager } from "./services/async-execution-manager";
import { PERSONAL_LIFE_AGENT } from "./services/specialized-agents";

async function dailyBriefing(userId: string) {
  const tasks = [
    {
      id: "check-email",
      data: { agent: PERSONAL_LIFE_AGENT.id, action: "summarize_unread" },
    },
    {
      id: "check-calendar",
      data: { agent: PERSONAL_LIFE_AGENT.id, action: "list_today_events" },
    },
    {
      id: "check-tasks",
      data: { agent: PERSONAL_LIFE_AGENT.id, action: "list_due_soon" },
    },
  ];

  // Execute all tasks in parallel
  const executions = await Promise.all(
    tasks.map((task) =>
      asyncExecutionManager.executeTask(task.id, task.data, {
        userId,
        async: true,
      })
    )
  );

  console.log("Daily briefing tasks started:", executions);
  return executions;
}
```

---

## Best Practices

### 1. Choose the Right Agent

Match the agent to the task domain:
- **Code tasks** → CodingAgent
- **Personal organization** → PersonalLifeAgent
- **Research** → ResearchAgent
- **Creative content** → CreativeAgent

### 2. Use Async for Long Tasks

Tasks that take > 5 seconds should be executed asynchronously:

```typescript
// ✅ Good: Async for long task
await asyncExecutionManager.executeTask(taskId, data, {
  userId,
  async: true,
  streamProgress: true,
});

// ❌ Bad: Sync for long task (blocks user)
await asyncExecutionManager.executeTask(taskId, data, {
  userId,
  async: false,
});
```

### 3. Stream Progress for User Engagement

Always stream progress for tasks > 10 seconds:

```typescript
await asyncExecutionManager.executeTask(taskId, data, {
  userId,
  streamProgress: true,
  onProgress: (update) => {
    // Keep user informed
    sendNotification(update.message);
  },
});
```

### 4. Set Appropriate Timeouts

Prevent runaway tasks with timeouts:

```typescript
await asyncExecutionManager.executeTask(taskId, data, {
  userId,
  timeout: 300000, // 5 minutes
});
```

### 5. Handle Errors Gracefully

Always provide error handlers:

```typescript
await asyncExecutionManager.executeTask(taskId, data, {
  userId,
  onError: (error) => {
    console.error("Task failed:", error);
    notifyUser(`Task failed: ${error.message}`);
  },
});
```

---

## API Reference

Complete API documentation: See [MULTI_AGENT_ORCHESTRATOR_ARCHITECTURE.md](./MULTI_AGENT_ORCHESTRATOR_ARCHITECTURE.md)

### Key Endpoints

- `GET /api/orchestrator/v3/models` - List available models
- `POST /api/orchestrator/v3/models/select` - Select optimal model
- `GET /api/orchestrator/v3/agents` - List specialized agents
- `POST /api/orchestrator/v3/execute` - Execute task
- `GET /api/orchestrator/v3/executions/:id` - Get execution status
- `GET /api/orchestrator/v3/executions/:id/progress` - Stream progress (SSE)
- `DELETE /api/orchestrator/v3/executions/:id` - Cancel execution

---

## Troubleshooting

### Task Not Starting

Check agent availability:

```bash
curl http://localhost:5000/api/orchestrator/v3/agents
```

Ensure the selected agent has capacity (`currentLoad < maxLoad`).

### Progress Not Streaming

Verify SSE connection:

```javascript
eventSource.onerror = (error) => {
  console.error("SSE connection failed:", error);
};
```

Check that `streamProgress: true` is set in execution options.

### Task Timeout

Increase timeout for long-running tasks:

```typescript
{
  timeout: 600000, // 10 minutes
}
```

---

## Next Steps

- Read the [Architecture Document](./MULTI_AGENT_ORCHESTRATOR_ARCHITECTURE.md)
- Explore the [Model Router Service](../../server/services/model-router.ts)
- Review [Specialized Agent Definitions](../../server/services/specialized-agents.ts)

---

*Last Updated: January 2026*
