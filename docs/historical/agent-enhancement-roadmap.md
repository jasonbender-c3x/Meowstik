# Agent Enhancement Roadmap

Features that would make Meowstik more capable, based on patterns from advanced agents.

## 1. Structured Reasoning (High Priority)

**What:** Chain-of-thought before action, explicit planning steps.

**Implement:**
- Add `<thinking>` block processing in prompt composer
- Require the LLM to output a plan before tool calls
- Parse and log reasoning for debugging

**Example prompt addition:**
```
Before acting, output your reasoning in <thinking> tags:
<thinking>User wants X. I should: 1) search for Y, 2) create Z...</thinking>
```

## 2. Self-Correction Loop (High Priority)

**What:** Detect failures, retry with different approach.

**Implement:**
- Track tool success/failure in execution.md
- On failure, inject "Previous attempt failed: [error]. Try alternative approach."
- Limit retries (3 max) to prevent loops

## 3. Context Window Management (Medium Priority)

**What:** Smart truncation when approaching token limits.

**Implement:**
- Count tokens before sending to Gemini
- Prioritize: system prompt > recent history > RAG > older history
- Summarize old messages instead of dropping

## 4. Parallel Tool Execution (Medium Priority)

**What:** Execute independent tools simultaneously.

**Implement:**
- Parse toolCalls array for dependencies
- Execute non-dependent tools via Promise.all()
- Return combined results

## 5. Proactive Memory Updates (Medium Priority)

**What:** Auto-detect when to save to long-term memory.

**Implement:**
- Pattern detection: user preferences, corrections, repeated info
- Auto-append to STM_APPEND.md when patterns detected
- Periodic memory consolidation (dedupe, summarize)

## 6. Multi-Turn Planning (Lower Priority)

**What:** Break complex tasks into subtasks across turns.

**Implement:**
- `plan_create` tool that writes to logs/current_plan.md
- Each turn checks plan and marks steps complete
- Auto-resume on next turn

## 7. Confidence Scoring (Lower Priority)

**What:** Express uncertainty, trigger search when low confidence.

**Implement:**
- Add to prompt: "Rate your confidence 1-10 before answering"
- If <7, auto-trigger web_search
- Log confidence for analysis

## 8. Tool Result Caching (Optimization)

**What:** Cache expensive tool results (API calls, searches).

**Implement:**
- Hash tool name + params → cache key
- Store in memory with TTL (5 min for searches, 1 hr for static docs)
- Check cache before executing

## Quick Wins (Implement First)

1. **Add thinking block** to prompt - forces better reasoning
2. **Retry on failure** - catch tool errors, re-prompt with error context
3. **Confidence threshold** - auto-search when uncertain

## Architecture Diagram

```
User Input
    ↓
Prompt Composer (add system prompt, RAG, memory)
    ↓
[NEW] Thinking Block Parser
    ↓
Gemini API → Tool Calls
    ↓
[NEW] Parallel Executor
    ↓
[NEW] Failure Detector → Retry Loop
    ↓
Results → send_chat
    ↓
[NEW] Memory Updater (auto-save learnings)
    ↓
end_turn
```
