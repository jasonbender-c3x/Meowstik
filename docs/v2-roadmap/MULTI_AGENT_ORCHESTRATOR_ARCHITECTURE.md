# Multi-Agent Orchestrator Architecture

**Version**: 3.0 (Vision Document)  
**Status**: 🚧 In Development  
**Last Updated**: January 2026

---

## Executive Summary

This document outlines the architectural vision for Meowstik's evolution from a single-threaded AI assistant to a **fully asynchronous multi-agent orchestrator**. The new architecture enables parallel task execution, specialized sub-agents, and a multi-model brain that optimizes for different cognitive functions.

### Key Objectives

1. **Eliminate Blocking**: Enable the system to handle multiple tasks concurrently without blocking user interaction
2. **Specialization**: Create domain-specific agents with isolated contexts and capabilities
3. **Multi-Model Brain**: Use different AI models optimized for specific cognitive tasks
4. **Fluid UX**: Maintain continuous user engagement even during long-running operations

---

## 1. The Orchestrator Core

The **Orchestrator Core** is the central coordinator that manages all specialized sub-agents. It functions as the "operating system" of the AI assistant.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR CORE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Task       │  │   Agent      │  │   State      │     │
│  │   Planner    │  │   Selector   │  │   Manager    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │            │
│         └──────────────────┼──────────────────┘            │
│                            │                               │
│                     ┌──────▼──────┐                        │
│                     │   Dispatch   │                        │
│                     │   Queue      │                        │
│                     └──────┬──────┘                        │
│                            │                               │
│         ┌──────────────────┼──────────────────┐           │
│         │                  │                  │           │
│    ┌────▼────┐       ┌────▼────┐       ┌────▼────┐       │
│    │ Agent 1 │       │ Agent 2 │       │ Agent N │       │
│    │ (Async) │       │ (Async) │       │ (Async) │       │
│    └─────────┘       └─────────┘       └─────────┘       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Core Responsibilities

1. **Task Decomposition**: Break complex user requests into atomic subtasks
2. **Agent Selection**: Route tasks to the most appropriate specialized agent
3. **Execution Management**: Track progress, handle failures, coordinate dependencies
4. **Result Synthesis**: Combine outputs from multiple agents into coherent responses
5. **Context Management**: Maintain shared context while ensuring agent isolation

### Implementation Components

- **Orchestrator Service** (`server/services/orchestrator.ts`)
- **Agent Registry** (`server/services/agent-registry.ts`)
- **Job Queue** (`server/services/job-queue.ts`)
- **Job Dispatcher** (`server/services/job-dispatcher.ts`)
- **State Manager** (`server/services/state-manager.ts`)

---

## 2. Multi-Model Brain

The **Multi-Model Brain** uses different Gemini models optimized for specific cognitive functions, maximizing both quality and cost-efficiency.

### Model Allocation Strategy

```
┌────────────────────────────────────────────────────────────┐
│                   MULTI-MODEL BRAIN                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         REASONING CORE (Gemini 3.0)                 │   │
│  │  • Complex planning and strategy                    │   │
│  │  • Multi-step reasoning                             │   │
│  │  • Task decomposition                               │   │
│  │  • Error analysis and recovery                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │      PERCEPTION LAYER (Flash 2.0)                   │   │
│  │  • Real-time vision processing                      │   │
│  │  • Audio transcription and analysis                 │   │
│  │  • Document understanding                           │   │
│  │  • Fast content classification                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │       LIVE INTERFACE (Gemini 2.5)                   │   │
│  │  • Real-time conversation                           │   │
│  │  • Small talk and rapport building                  │   │
│  │  • Status updates during long tasks                 │   │
│  │  • User query clarification                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Model Selection Criteria

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| **Planning & Strategy** | Gemini 3.0 Pro | Strongest reasoning, handles complex multi-step problems |
| **Image/Audio Processing** | Flash 2.0 | Optimized for multimodal perception, fast and efficient |
| **User Interaction** | Gemini 2.5 Flash | Low latency, conversational, maintains engagement |
| **Code Generation** | Gemini 3.0 Pro | Best code quality, understands complex architectures |
| **Quick Queries** | Flash 2.0 | Fast responses, cost-effective for simple tasks |
| **Document Analysis** | Flash 2.0 | Efficient processing of large text volumes |

### Configuration Schema

```typescript
interface MultiModelConfig {
  reasoningCore: {
    model: "gemini-3.0-pro";
    capabilities: [
      "planning",
      "reasoning",
      "code_generation",
      "complex_analysis"
    ];
    costTier: "high";
    latency: "high";
  };
  
  perceptionLayer: {
    model: "gemini-2.0-flash";
    capabilities: [
      "vision",
      "audio",
      "document_analysis",
      "classification"
    ];
    costTier: "low";
    latency: "low";
  };
  
  liveInterface: {
    model: "gemini-2.5-flash";
    capabilities: [
      "conversation",
      "status_updates",
      "clarification",
      "small_talk"
    ];
    costTier: "medium";
    latency: "very-low";
  };
}
```

---

## 3. Asynchronous Multitasking

The system is **fully asynchronous** at all levels, enabling true parallel execution without blocking.

### Async Execution Model

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  Orchestrator: Create execution plan                    │
└─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  Dispatch to Job Queue (non-blocking)                   │
└─────────────────────────────────────────────────────────┘
     │
     ├──────────────────┬──────────────────┬──────────────┐
     ▼                  ▼                  ▼              ▼
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│ Agent 1 │      │ Agent 2 │      │ Agent 3 │      │  Live   │
│ (Task A)│      │ (Task B)│      │ (Task C)│      │Interface│
│         │      │         │      │         │      │ (User   │
│ Working │      │ Working │      │ Working │      │  Chat)  │
│   ...   │      │   ...   │      │   ...   │      │         │
└─────────┘      └─────────┘      └─────────┘      └─────────┘
     │                  │                  │              │
     └──────────────────┴──────────────────┴──────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ Results Synth   │
                   │ & Delivery      │
                   └─────────────────┘
```

### Key Features

1. **Non-Blocking Dispatch**: Tasks are queued and executed asynchronously
2. **Parallel Execution**: Multiple agents work simultaneously on independent tasks
3. **Streaming Progress**: Real-time updates streamed to user via SSE
4. **Interruption Handling**: User can interrupt, modify, or cancel ongoing tasks
5. **Background Completion**: Long tasks complete even if user navigates away

### User Experience Benefits

- **Immediate Feedback**: User gets acknowledgment instantly, even for long tasks
- **Continuous Engagement**: Live Interface maintains conversation during processing
- **Progress Visibility**: Real-time status updates as tasks complete
- **Interruptibility**: User can provide input or change direction mid-execution

### Implementation Pattern

```typescript
// Async task execution pattern
async function handleUserRequest(request: string, userId: string) {
  // 1. Immediate acknowledgment (Live Interface)
  await liveInterface.acknowledge(userId, request);
  
  // 2. Plan decomposition (Reasoning Core)
  const plan = await reasoningCore.decompose(request);
  
  // 3. Async dispatch (non-blocking)
  const executionId = await orchestrator.execute(plan, {
    userId,
    async: true,
    onProgress: (update) => streamProgressToUser(userId, update),
    onComplete: (result) => deliverResult(userId, result)
  });
  
  // 4. Continue user interaction (Live Interface keeps engaging)
  await liveInterface.maintainEngagement(userId, {
    executionId,
    estimatedTime: plan.estimatedDuration
  });
  
  return { executionId, status: "processing" };
}
```

---

## 4. Sub-Agent Specialization

Specialized agents with **domain-specific capabilities** and **context isolation** ensure security and efficiency.

### Agent Types

#### 4.1 CodingAgent

**Domain**: Software development, repository interaction, code analysis

**Capabilities**:
- Code generation and refactoring
- Repository navigation and file operations
- Testing and debugging
- Code review and analysis
- Build system interaction

**Tool Access**:
- ✅ File system operations (workspace only)
- ✅ Git operations
- ✅ GitHub API
- ✅ Code execution (sandboxed)
- ✅ Package managers (npm, pip, etc.)
- ❌ Personal data (email, calendar, contacts)
- ❌ External service credentials

**Context Isolation**:
```typescript
interface CodingAgentContext {
  workspaceRoot: string;
  repositoryAccess: string[];
  allowedCommands: string[];
  environmentVariables: Record<string, string>;
  resourceLimits: {
    maxMemory: "2GB";
    maxCPU: "2cores";
    executionTimeout: "5m";
  };
}
```

#### 4.2 PersonalLifeAgent

**Domain**: Calendar, email, personal contacts, life management

**Capabilities**:
- Email composition and management
- Calendar scheduling and reminders
- Contact management
- Task list management
- Personal document organization

**Tool Access**:
- ✅ Gmail API
- ✅ Google Calendar API
- ✅ Google Contacts API
- ✅ Google Tasks API
- ✅ Google Drive (personal folders only)
- ❌ Code repositories
- ❌ Terminal access
- ❌ File system operations

**Context Isolation**:
```typescript
interface PersonalLifeAgentContext {
  userId: string;
  googleWorkspaceScopes: string[];
  allowedDriveRoots: string[];
  emailFilters: {
    allowedDomains: string[];
    prohibitedPatterns: RegExp[];
  };
  privacyLevel: "high";
}
```

#### 4.3 ResearchAgent

**Domain**: Information gathering, web search, document analysis

**Capabilities**:
- Web search and content retrieval
- Document summarization
- Data synthesis from multiple sources
- Fact verification
- Citation management

**Tool Access**:
- ✅ Web search APIs
- ✅ Web scraping (rate-limited)
- ✅ Document reading (Drive, PDF)
- ✅ RAG system access
- ❌ Write operations
- ❌ Personal data access
- ❌ Code execution

#### 4.4 CreativeAgent

**Domain**: Content generation, image creation, music composition

**Capabilities**:
- Image generation and editing
- Music composition
- Creative writing
- Design suggestions
- Media format conversion

**Tool Access**:
- ✅ Imagen 3 API
- ✅ Music generation API
- ✅ TTS for narration
- ✅ Drive for storage
- ❌ Code execution
- ❌ Personal data access

### Agent Registry Schema

```typescript
interface AgentRegistration {
  id: string;
  name: string;
  type: AgentType;
  domain: string[];
  capabilities: string[];
  toolAccess: {
    allowed: string[];
    denied: string[];
  };
  contextIsolation: {
    separateMemory: boolean;
    dataAccess: "restricted" | "read-only" | "full";
    resourceLimits: ResourceLimits;
  };
  model: "gemini-3.0-pro" | "gemini-2.5-flash" | "gemini-2.0-flash";
  priority: number;
  maxConcurrency: number;
}
```

---

## 5. Communication and Coordination

### Inter-Agent Communication

Agents communicate through a **shared state store** with access controls:

```typescript
interface SharedState {
  executionId: string;
  userId: string;
  
  // Read-write for all agents
  sharedContext: {
    currentGoal: string;
    completedTasks: string[];
    pendingTasks: string[];
  };
  
  // Agent-specific private state
  agentStates: {
    [agentId: string]: {
      internalState: unknown;
      lastUpdate: Date;
    };
  };
  
  // Results from completed tasks
  taskResults: {
    [taskId: string]: {
      agentId: string;
      result: unknown;
      timestamp: Date;
    };
  };
}
```

### Orchestrator-Agent Protocol

```typescript
interface AgentTask {
  taskId: string;
  type: string;
  input: unknown;
  context: SharedContext;
  
  // Callbacks for communication
  onProgress: (update: ProgressUpdate) => void;
  onNeedInput: (prompt: string) => Promise<string>;
  onError: (error: Error) => void;
  onComplete: (result: unknown) => void;
}

interface AgentResponse {
  taskId: string;
  status: "completed" | "failed" | "needs-input";
  result?: unknown;
  error?: Error;
  nextTasks?: string[]; // Suggested follow-up tasks
}
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal**: Establish the core architecture and patterns

- [ ] Create model router service for multi-model selection
- [ ] Implement async job execution with proper error handling
- [ ] Add streaming progress system (SSE)
- [ ] Create agent base class with context isolation
- [ ] Document architecture and patterns

### Phase 2: Specialized Agents (Week 3-4)

**Goal**: Implement first two specialized agents

- [ ] Implement CodingAgent with repository access
- [ ] Implement PersonalLifeAgent with Google Workspace
- [ ] Add context isolation enforcement
- [ ] Add tool access restrictions
- [ ] Create agent-specific tests

### Phase 3: Orchestration Enhancement (Week 5-6)

**Goal**: Improve orchestrator capabilities

- [ ] Enhance task decomposition with Reasoning Core
- [ ] Add parallel task execution with dependency resolution
- [ ] Implement result synthesis
- [ ] Add execution monitoring and logging
- [ ] Create orchestration dashboard UI

### Phase 4: Live Interface Integration (Week 7-8)

**Goal**: Maintain user engagement during long operations

- [ ] Implement Live Interface agent
- [ ] Add small talk capabilities
- [ ] Create progress narration system
- [ ] Add user interruption handling
- [ ] Implement context switching

### Phase 5: Polish and Optimization (Week 9-10)

**Goal**: Production readiness

- [ ] Performance optimization
- [ ] Error handling and recovery
- [ ] Cost monitoring and optimization
- [ ] Security audit
- [ ] Documentation and examples

---

## 7. Success Metrics

### Performance Metrics

- **Task Throughput**: Number of concurrent tasks handled
- **Response Time**: Time to first user acknowledgment (< 500ms target)
- **Completion Rate**: Percentage of tasks completed successfully (> 95% target)
- **Model Cost**: Average cost per user session (optimize for 50% reduction)

### User Experience Metrics

- **Perceived Responsiveness**: User survey on system responsiveness
- **Task Success Rate**: Percentage of user goals achieved
- **Engagement During Wait**: User interaction rate during long tasks
- **Interruptibility**: Ease of changing direction mid-task

---

## 8. Security and Privacy

### Principles

1. **Agent Isolation**: Agents cannot access data outside their domain
2. **Least Privilege**: Agents only get minimum necessary tool access
3. **Data Segregation**: Personal data separated from code/workspace data
4. **Audit Trail**: All agent actions logged for security review
5. **User Control**: Users can limit agent capabilities per-session

### Access Control Matrix

| Agent Type | File System | Google Workspace | Code Repos | Web Access | Personal Data |
|------------|-------------|------------------|------------|------------|---------------|
| CodingAgent | ✅ Workspace | ❌ | ✅ | ✅ Limited | ❌ |
| PersonalLifeAgent | ❌ | ✅ | ❌ | ✅ Limited | ✅ |
| ResearchAgent | ❌ | ✅ Read-only | ❌ | ✅ Full | ❌ |
| CreativeAgent | ❌ | ✅ Storage only | ❌ | ✅ Limited | ❌ |

---

## 9. Future Enhancements

### Version 3.1: Learning and Adaptation

- Agent performance tracking and optimization
- User preference learning per agent
- Automatic capability expansion based on usage

### Version 3.2: External Agent Integration

- Plugin system for third-party agents
- Agent marketplace
- Cross-platform agent federation

### Version 3.3: Autonomous Operation

- Proactive task suggestions
- Scheduled autonomous actions
- Self-initiated research and preparation

---

## 10. References

- [Orchestration Layer Documentation](../orchestration-layer.md)
- [Cognitive Architecture 2.0](../COGNITIVE_ARCHITECTURE_2.0.md)
- [Visions of the Future](./VISIONS_OF_THE_FUTURE.md)
- [Multi-Model Brain Configuration](../../server/services/model-router.ts)
- [Agent Registry](../../server/services/agent-registry.ts)

---

*This document is a living specification and will be updated as the architecture evolves.*

**Last Updated**: January 2026  
**Contributors**: Jason Bender, Meowstik Team  
**Status**: 🚧 Active Development
