# Orchestration Layer Documentation

## Overview

The Meowstik orchestration layer is a sophisticated multi-agent coordination system that enables complex task execution through specialized agents. It transforms user goals into hierarchical task plans, intelligently routes work to appropriate agents, and manages execution state throughout the process.

## Architecture

### Core Concepts

The orchestration system is built around several key concepts inspired by CPU architecture:

1. **Orchestrator (CPU)**: Central coordinator that fetches tasks from the queue and routes them to agents
2. **Agent Registry (Instruction Set)**: Catalog of available agents and their capabilities
3. **State Manager (Memory)**: Shared state and context for inter-agent communication
4. **Job Queue (Instruction Queue)**: Pending tasks awaiting execution
5. **Orchestration Logger (Debug Interface)**: Comprehensive logging for monitoring and debugging

### System Analogy

Think of the orchestrator as a CPU:
- **Fetch**: Retrieves tasks from the queue (memory)
- **Decode**: Analyzes task requirements and selects appropriate agent
- **Execute**: Dispatches task to selected agent
- **Write Back**: Stores results in shared state
- **Exception Handling**: Manages errors and operator input requests

## Components

### 1. Orchestrator Service (`orchestrator.ts`)

The main orchestration engine that:
- Manages agent lifecycle and registration
- Creates task plans from high-level goals
- Routes tasks to appropriate agents based on capabilities
- Tracks execution state and progress
- Handles context passing between agents

**Key Methods:**
- `orchestrate(goal, options)` - Start orchestrated execution
- `registerAgent(agent)` - Register a specialized agent
- `selectAgent(capabilities, type)` - Find best agent for a task
- `getOrchestrationStatus(sessionId)` - Monitor execution progress

### 2. Agent Registry (`agent-registry.ts`)

Centralized registry for managing specialized agents:
- Stores agent definitions and capabilities
- Provides agent discovery and matching
- Tracks agent load and availability
- Validates capability compatibility

**Predefined Capabilities:**
- **Planning**: `task_decomposition`, `dependency_analysis`, `workflow_design`
- **Research**: `web_research`, `document_analysis`, `data_synthesis`
- **Coding**: `code_generation`, `code_review`, `code_refactoring`, `testing`
- **Communication**: `email_management`, `document_creation`, `presentation`
- **Integration**: `api_integration`, `database_operations`, `file_operations`
- **Analysis**: `data_analysis`, `pattern_recognition`, `error_diagnosis`

### 3. State Manager (`state-manager.ts`)

Session-based state management system:
- Creates isolated execution contexts
- Provides thread-safe state updates with locking
- Supports transactional state changes
- Automatic cleanup of expired state

**State Types:**
- `shared` - Accessible to all agents in the session
- `private` - Agent-specific state
- `temporary` - Auto-expires after TTL

### 4. Orchestration Logger (`orchestration-logger.ts`)

Multi-level logging infrastructure:
- Task-level logs for individual executions
- Agent-level logs for agent activity
- Orchestrator-level logs for system events
- Powerful querying and filtering

**Log Levels:**
- `debug` - Detailed execution information
- `info` - General informational messages
- `warn` - Warning conditions
- `error` - Error conditions
- `critical` - Critical failures requiring immediate attention

### 5. API Routes (`routes/orchestrator.ts`)

RESTful API for orchestration control:
- Start orchestrated tasks
- Monitor session status
- Access logs and debugging info
- Manage agent registry
- Update execution context

## Usage Examples

### Basic Orchestration

```typescript
import { orchestrator } from "./services/orchestrator";

// Initialize with default agents
await orchestrator.initialize();

// Start orchestrated task
const result = await orchestrator.orchestrate(
  "Research and write a blog post about quantum computing",
  {
    userId: "user-123",
    chatId: "chat-456",
    initialContext: {
      targetAudience: "technical",
      wordCount: 1000,
    },
  }
);

// Monitor progress
const status = await orchestrator.getOrchestrationStatus(result.sessionId);
console.log(`Progress: ${status.completedTasks}/${status.totalTasks}`);

// Get logs
const logs = orchestrator.getSessionLogs(result.sessionId);
```

### Custom Agent Registration

```typescript
import { orchestrator } from "./services/orchestrator";

// Register a specialized agent
orchestrator.registerAgent({
  id: "security-scanner-001",
  name: "Security Scanner",
  type: "specialist",
  description: "Scans code for security vulnerabilities",
  capabilities: [
    {
      name: "security_analysis",
      description: "Analyze code for security issues",
      domains: ["security", "code"],
      tools: ["file_get", "github_code_search"],
    },
  ],
  priority: 10,
  status: "active",
  currentLoad: 0,
  maxLoad: 2,
  metadata: {
    supportedLanguages: ["javascript", "python", "go"],
  },
});
```

### State Management

```typescript
import { stateManager } from "./services/state-manager";

// Create session
const session = stateManager.createSession("session-123", {
  userId: "user-123",
  initialState: {
    targetLanguage: "python",
    testFramework: "pytest",
  },
});

// Set state
stateManager.setState("session-123", {
  key: "generated_code",
  value: "def hello(): print('Hello')",
  type: "shared",
});

// Get state
const code = stateManager.getState("session-123", "generated_code");

// Transactional updates
const txId = stateManager.beginTransaction("session-123");
stateManager.addToTransaction(txId, {
  key: "test_results",
  value: { passed: 10, failed: 0 },
});
stateManager.commitTransaction(txId);
```

### Logging and Debugging

```typescript
import { orchestrationLogger } from "./services/orchestration-logger";

// Log events
orchestrationLogger.info("orchestrator", "Task plan created", {
  sessionId: "session-123",
  data: { stepCount: 5 },
});

orchestrationLogger.error("agent", "Agent execution failed", error, {
  sessionId: "session-123",
  agentId: "coder-001",
  taskId: "task-456",
});

// Query logs
const errors = orchestrationLogger.getErrors("session-123");
const recentLogs = orchestrationLogger.getRecent(50);

// Get statistics
const stats = orchestrationLogger.getStatistics("session-123");
console.log(`Error rate: ${stats.errorRate * 100}%`);
```

## API Reference

### POST /api/orchestrator/orchestrate

Start a new orchestrated task.

**Request Body:**
```json
{
  "goal": "Research and implement user authentication",
  "userId": "user-123",
  "chatId": "chat-456",
  "initialContext": {
    "framework": "express",
    "database": "postgresql"
  },
  "metadata": {
    "priority": "high"
  }
}
```

**Response:**
```json
{
  "sessionId": "orch-1234567890-abc123",
  "status": "executing",
  "plan": {
    "goal": "Research and implement user authentication",
    "steps": [
      {
        "id": "step-1",
        "title": "Research authentication methods",
        "agentType": "researcher",
        "requiredCapabilities": ["web_research"]
      }
    ],
    "parallelizable": true
  },
  "jobIds": ["job-1", "job-2"],
  "completedTasks": 0,
  "totalTasks": 5,
  "results": {},
  "errors": [],
  "startTime": "2024-01-15T10:00:00Z"
}
```

### GET /api/orchestrator/sessions/:sessionId

Get orchestration status.

**Response:**
```json
{
  "sessionId": "orch-1234567890-abc123",
  "status": "executing",
  "jobIds": ["job-1", "job-2"],
  "completedTasks": 2,
  "totalTasks": 5,
  "results": {
    "job-1": { "researched": ["JWT", "OAuth2"] }
  },
  "errors": [],
  "startTime": "2024-01-15T10:00:00Z"
}
```

### GET /api/orchestrator/sessions/:sessionId/logs

Get session logs.

**Response:**
```json
{
  "sessionId": "orch-1234567890-abc123",
  "logs": [
    {
      "id": "log-1234567890-0",
      "timestamp": "2024-01-15T10:00:00Z",
      "level": "info",
      "source": "orchestrator",
      "message": "Starting orchestration",
      "sessionId": "orch-1234567890-abc123"
    }
  ]
}
```

### GET /api/orchestrator/agents

List all registered agents.

**Response:**
```json
{
  "agents": [
    {
      "id": "planner-001",
      "name": "Planning Agent",
      "type": "planner",
      "status": "active",
      "currentLoad": 1,
      "maxLoad": 5,
      "capabilities": [
        {
          "name": "task_decomposition",
          "description": "Break down complex goals into actionable subtasks",
          "domains": ["planning", "strategy"]
        }
      ]
    }
  ],
  "count": 4
}
```

### POST /api/orchestrator/agents

Register a new agent.

**Request Body:**
```json
{
  "id": "custom-agent-001",
  "name": "Custom Specialist",
  "type": "specialist",
  "description": "Custom specialized agent",
  "capabilities": [
    {
      "name": "custom_capability",
      "description": "Perform custom operations",
      "domains": ["custom"],
      "tools": ["custom_tool"]
    }
  ],
  "priority": 5,
  "status": "active",
  "currentLoad": 0,
  "maxLoad": 3
}
```

### GET /api/orchestrator/stats

Get orchestration statistics.

**Response:**
```json
{
  "totalAgents": 4,
  "activeAgents": 4,
  "busyAgents": 2,
  "totalCapacity": 13,
  "usedCapacity": 3,
  "agentsByType": {
    "planner": 1,
    "researcher": 1,
    "coder": 1,
    "reviewer": 1
  }
}
```

## Design Patterns

### Hierarchical Task Decomposition

Complex goals are broken down into manageable subtasks:

```
Goal: "Build a REST API"
├── Step 1: Design API schema (Planner)
├── Step 2: Research best practices (Researcher)
├── Step 3: Implement endpoints (Coder)
│   ├── Subtask 3.1: Create user endpoints
│   ├── Subtask 3.2: Create auth endpoints
│   └── Subtask 3.3: Add error handling
├── Step 4: Write tests (Coder)
└── Step 5: Review implementation (Reviewer)
```

### Agent Specialization

Agents are specialized by capability rather than by job type:

```typescript
// Instead of monolithic agents:
const agent = new Agent({ type: "all-purpose" });

// Use specialized agents:
const planner = new Agent({
  type: "planner",
  capabilities: ["task_decomposition", "dependency_analysis"],
});

const researcher = new Agent({
  type: "researcher",
  capabilities: ["web_research", "document_analysis"],
});
```

### Context Propagation

State flows through the execution graph:

```typescript
// Initial context
context = { language: "python", framework: "fastapi" };

// Step 1: Planner adds to context
context.taskPlan = [...steps];

// Step 2: Researcher enriches context
context.bestPractices = [...findings];

// Step 3: Coder uses accumulated context
generateCode(context);
```

## Best Practices

### 1. Agent Design

- **Single Responsibility**: Each agent should have a focused set of capabilities
- **Clear Interfaces**: Define explicit input/output contracts
- **Idempotency**: Agents should produce consistent results for the same inputs
- **Error Handling**: Gracefully handle failures and provide meaningful errors

### 2. Task Decomposition

- **Atomic Steps**: Break tasks into independently executable units
- **Clear Dependencies**: Explicitly declare what each step depends on
- **Parallel Opportunities**: Identify steps that can run concurrently
- **Resource Estimation**: Provide duration estimates for better scheduling

### 3. State Management

- **Minimal State**: Only store what's necessary for coordination
- **Explicit Sharing**: Use `type: "shared"` for inter-agent data
- **Cleanup**: Set TTLs on temporary data
- **Transactions**: Use transactions for multi-step state updates

### 4. Logging

- **Structured Logs**: Include relevant context (sessionId, taskId, agentId)
- **Appropriate Levels**: Use correct severity for each message
- **Actionable Messages**: Logs should help with debugging and monitoring
- **Regular Cleanup**: Clear old logs to manage memory

## Advanced Topics

### Dynamic Agent Registration

Agents can be registered at runtime based on available tools:

```typescript
// Detect available tools
const availableTools = detectInstalledTools();

// Register agents based on available tools
if (availableTools.includes("docker")) {
  orchestrator.registerAgent({
    id: "container-specialist",
    name: "Container Specialist",
    type: "specialist",
    capabilities: [
      {
        name: "container_management",
        domains: ["devops", "containers"],
        tools: ["docker"],
      },
    ],
  });
}
```

### Custom Scheduling Policies

Implement custom agent selection logic:

```typescript
// Priority-based selection
const selectAgent = (capabilities, agentType) => {
  const candidates = getEligibleAgents(capabilities, agentType);
  
  // Custom scoring
  return candidates.sort((a, b) => {
    // Prefer less loaded agents
    if (a.currentLoad !== b.currentLoad) {
      return a.currentLoad - b.currentLoad;
    }
    
    // Then by priority
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    
    // Finally by specialization (fewer capabilities = more specialized)
    return a.capabilities.length - b.capabilities.length;
  })[0];
};
```

### Fault Tolerance

Handle agent failures gracefully:

```typescript
// Retry with different agent
try {
  await executeWithAgent(primaryAgent, task);
} catch (error) {
  console.warn(`Primary agent failed: ${error.message}`);
  
  // Try fallback agent
  const fallbackAgent = selectAgent(
    task.requiredCapabilities,
    task.agentType
  );
  
  if (fallbackAgent && fallbackAgent.id !== primaryAgent.id) {
    await executeWithAgent(fallbackAgent, task);
  } else {
    throw new Error("No fallback agent available");
  }
}
```

## Troubleshooting

### Common Issues

#### 1. No Agent Found for Task

**Problem**: Task cannot find an agent with required capabilities.

**Solution**:
- Verify agent registration: `GET /api/orchestrator/agents`
- Check capability definitions in task plan
- Ensure agents are `active` and have capacity

#### 2. Session State Not Persisting

**Problem**: State changes are lost between task executions.

**Solution**:
- Use `type: "shared"` for inter-agent state
- Avoid `type: "temporary"` for critical data
- Check TTL values aren't too short

#### 3. High Error Rate

**Problem**: Many tasks are failing.

**Solution**:
- Check logs: `GET /api/orchestrator/sessions/:id/logs`
- Review error statistics
- Verify agent health and connectivity
- Check for resource exhaustion

#### 4. Tasks Stuck in Pending

**Problem**: Tasks remain in pending state indefinitely.

**Solution**:
- Check dependency resolution
- Verify no circular dependencies
- Ensure all dependency jobs completed successfully
- Check for deadlocks in state locking

## Future Enhancements

Planned improvements to the orchestration system:

1. **Persistent State**: Store state in database for crash recovery
2. **Agent Metrics**: Track agent performance and success rates
3. **Auto-scaling**: Automatically spawn additional agent workers
4. **Workflow Templates**: Predefined workflows for common patterns
5. **Visual Debugger**: Web UI for visualizing execution graphs
6. **Cost Tracking**: Monitor resource usage and costs per session
7. **A/B Testing**: Compare different orchestration strategies
8. **Machine Learning**: Learn optimal agent selection from history

## Conclusion

The Meowstik orchestration layer provides a powerful foundation for building complex multi-agent systems. By combining specialized agents, intelligent routing, shared state management, and comprehensive logging, it enables sophisticated task automation while remaining flexible and debuggable.

For questions or contributions, please refer to the main project documentation or open an issue on GitHub.
