# Agent Enhancement Implementation Plan

## Phase 1: Foundation (Week 1)

### 1.1 Thinking Block Support
**Files:** `server/services/prompt-composer.ts`, `prompts/core-directives.md`

**Steps:**
1. Add to core-directives.md:
```markdown
## Reasoning Protocol
Before any tool call, output your reasoning:
<thinking>
1. What is the user asking?
2. What information do I need?
3. What tools will I use and in what order?
</thinking>
```

2. Parse `<thinking>` blocks in response handler:
```typescript
// server/routes.ts - in chat handler
const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/);
if (thinkingMatch) {
  await storage.appendToLog('execution', `REASONING: ${thinkingMatch[1]}`);
}
```

**Deliverable:** LLM outputs reasoning before acting, logged for debugging.

---

### 1.2 Retry-on-Failure Loop
**Files:** `server/gemini.ts` or `server/routes.ts`

**Steps:**
1. Wrap tool execution in try/catch
2. On failure, re-prompt with error context:
```typescript
const MAX_RETRIES = 3;
let retries = 0;

while (retries < MAX_RETRIES) {
  try {
    const result = await executeTool(toolCall);
    break;
  } catch (error) {
    retries++;
    // Inject error into next prompt
    conversationHistory.push({
      role: 'user',
      content: `Tool "${toolCall.name}" failed: ${error.message}. Try alternative approach.`
    });
    // Re-call LLM with error context
  }
}
```

**Deliverable:** Agent automatically retries failed tools with error context.

---

### 1.3 Confidence-Based Search Trigger
**Files:** `prompts/core-directives.md`, `server/routes.ts`

**Steps:**
1. Add to prompt:
```markdown
## Confidence Check
Before answering factual questions, rate your confidence 1-10.
If confidence < 7, use web_search FIRST.
Format: [CONFIDENCE: 8/10] then proceed.
```

2. Parse confidence and auto-trigger search:
```typescript
const confidenceMatch = response.match(/\[CONFIDENCE:\s*(\d+)\/10\]/);
if (confidenceMatch && parseInt(confidenceMatch[1]) < 7) {
  // Force web_search before proceeding
}
```

**Deliverable:** Agent searches when uncertain instead of guessing.

---

## Phase 2: Memory & Context (Week 2)

### 2.1 Proactive Memory Updates
**Files:** `server/services/prompt-composer.ts`

**Steps:**
1. Detect patterns that should be saved:
```typescript
const SAVE_PATTERNS = [
  /prefer|always|never|remember|my .* is/i,  // preferences
  /correction:|actually,|no,/i,               // corrections
];

function shouldAutoSave(userMessage: string): boolean {
  return SAVE_PATTERNS.some(p => p.test(userMessage));
}
```

2. Auto-append to STM_APPEND.md when detected:
```typescript
if (shouldAutoSave(userMessage)) {
  const entry = `\n---\n**${new Date().toISOString()}**\n[AUTO-SAVED] ${userMessage}\n`;
  fs.appendFileSync('logs/STM_APPEND.md', entry);
}
```

**Deliverable:** Important info auto-saved without explicit LLM action.

---

### 2.2 Context Window Management
**Files:** `server/services/prompt-composer.ts`

**Steps:**
1. Add token counter (use tiktoken or estimate ~4 chars/token):
```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

2. Prioritize and truncate:
```typescript
const MAX_TOKENS = 100000;
const priorities = [
  { name: 'system', content: systemPrompt, priority: 1 },
  { name: 'rag', content: ragContext, priority: 2 },
  { name: 'recent', content: last5Messages, priority: 3 },
  { name: 'history', content: olderMessages, priority: 4 },
];

function fitToContext(priorities, maxTokens) {
  let total = 0;
  const included = [];
  for (const item of priorities.sort((a,b) => a.priority - b.priority)) {
    const tokens = estimateTokens(item.content);
    if (total + tokens <= maxTokens) {
      included.push(item);
      total += tokens;
    } else {
      // Summarize or truncate
      included.push({ ...item, content: summarize(item.content, maxTokens - total) });
      break;
    }
  }
  return included;
}
```

**Deliverable:** Long conversations don't break; old context summarized.

---

## Phase 3: Parallel Execution (Week 3)

### 3.1 Parallel Tool Executor
**Files:** `server/gemini.ts`

**Steps:**
1. Analyze tool dependencies:
```typescript
function findIndependentTools(toolCalls: ToolCall[]): ToolCall[][] {
  // Group tools that can run in parallel
  // Tools are dependent if one uses output of another
  const groups: ToolCall[][] = [];
  let current: ToolCall[] = [];
  
  for (const tool of toolCalls) {
    if (hasDependency(tool, current)) {
      groups.push(current);
      current = [tool];
    } else {
      current.push(tool);
    }
  }
  if (current.length) groups.push(current);
  return groups;
}
```

2. Execute in parallel:
```typescript
for (const group of toolGroups) {
  const results = await Promise.all(
    group.map(tool => executeTool(tool))
  );
  // Combine results for next group
}
```

**Deliverable:** Independent tools run simultaneously, faster responses.

---

### 3.2 Tool Result Caching
**Files:** `server/services/tool-cache.ts` (new)

**Steps:**
1. Create cache service:
```typescript
const cache = new Map<string, { result: any, expires: number }>();

function cacheKey(tool: string, params: object): string {
  return `${tool}:${JSON.stringify(params)}`;
}

function getCached(tool: string, params: object): any | null {
  const key = cacheKey(tool, params);
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.result;
  return null;
}

function setCache(tool: string, params: object, result: any, ttlMs: number) {
  cache.set(cacheKey(tool, params), { result, expires: Date.now() + ttlMs });
}
```

2. Wrap tool executor:
```typescript
async function executeToolWithCache(tool: ToolCall) {
  const cached = getCached(tool.name, tool.parameters);
  if (cached) return cached;
  
  const result = await executeTool(tool);
  const ttl = CACHE_TTL[tool.name] || 60000; // 1 min default
  setCache(tool.name, tool.parameters, result, ttl);
  return result;
}
```

**Deliverable:** Repeated searches/API calls return instantly.

---

## Phase 4: Multi-Turn Planning (Week 4)

### 4.1 Plan Persistence
**Files:** `server/gemini-tools.ts`, `server/tool-handlers/`

**Steps:**
1. Add plan tools:
```typescript
{
  name: "plan_create",
  description: "Create multi-step plan. Saved to logs/current_plan.md",
  parameters: { steps: [{ id, description, status }] }
},
{
  name: "plan_update",
  description: "Mark plan step complete or blocked",
  parameters: { stepId, status }
}
```

2. Auto-inject active plan into prompt:
```typescript
// In prompt-composer.ts
const planPath = 'logs/current_plan.md';
if (fs.existsSync(planPath)) {
  const plan = fs.readFileSync(planPath, 'utf8');
  systemPrompt += `\n\n## Active Plan\n${plan}\nContinue from next incomplete step.`;
}
```

**Deliverable:** Complex tasks persist across sessions.

---

## Implementation Order

| Week | Feature | Effort | Impact |
|------|---------|--------|--------|
| 1.1 | Thinking blocks | Low | High |
| 1.2 | Retry loop | Medium | High |
| 1.3 | Confidence search | Low | Medium |
| 2.1 | Auto-save memory | Medium | Medium |
| 2.2 | Context management | High | High |
| 3.1 | Parallel execution | High | Medium |
| 3.2 | Tool caching | Medium | Medium |
| 4.1 | Multi-turn plans | Medium | Medium |

## Testing Checklist

- [ ] Thinking blocks appear in execution.md logs
- [ ] Failed tool triggers retry with error context
- [ ] Low-confidence answers trigger search first
- [ ] User preferences auto-saved to STM
- [ ] Long conversations don't error out
- [ ] Multiple searches execute in parallel
- [ ] Repeated queries return cached results
- [ ] Plans survive session restart

## Metrics to Track

1. **Success rate:** % of tool calls that succeed on first try
2. **Retry effectiveness:** % of failures recovered by retry
3. **Search trigger rate:** How often confidence < 7
4. **Response latency:** Average time to complete request
5. **Memory utilization:** Token usage per request
