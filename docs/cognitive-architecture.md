# Meowstik Cognitive Architecture & Memory Loops

## Overview
This document outlines the "Cognitive Loops" required to repair and maintain Meowstik's memory and learning functions. The goal is to ensure the model has persistent context, execution logs, and protection against error loops.

## 1. The Memory Loops

### A. Thoughts Forward Cache (The "Stream of Consciousness")
*   **Purpose**: Carry internal monologue and unexecuted plans from the end of one turn to the start of the next.
*   **Mechanism**:
    1.  At the end of *every* turn, the LLM generates a `<thoughts_forward>` block.
    2.  This content is saved to `logs/thoughts_forward.md` (overwriting the previous).
    3.  **System Prompt Injection**: The contents of `logs/thoughts_forward.md` are read and injected into the *next* turn's system prompt under a `## Previous Thoughts` section.

### B. Execution Log (The "Objective Truth")
*   **Purpose**: A factual, code-generated record of what *actually* happened (tools called, results returned). This prevents the LLM from hallucinating successful actions.
*   **Mechanism**:
    1.  **Code-Generated**: The `tool-dispatcher.ts` appends every tool execution (Call + Result) to `logs/execution_log.md`.
    2.  **Rotation**: The log is rotated or truncated to keep the last N entries.
    3.  **System Prompt Injection**: The last ~10 entries are injected into the system prompt under `## Recent Execution History`.

### C. Personal Log (The "Diary")
*   **Purpose**: A subjective record of user interactions, preferences learned, and emotional context.
*   **Mechanism**:
    1.  The LLM can call a tool `write_diary` (or similar) to append to `logs/personal_log.md`.
    2.  This file is *not* fully injected every time (too big). It is indexed or summarily injected, or the LLM can "read" it via tools.

### D. Short Term Memory (The "Working Context")
*   **Purpose**: Immediate scratchpad for complex multi-turn tasks.
*   **Mechanism**:
    1.  LLM writes to `logs/short_term_memory.md`.
    2.  This entire file is injected into the system prompt.
    3.  The LLM is responsible for clearing/pruning it when tasks are done.

## 2. System Prompt Integration

The System Prompt must be structured to enforce these loops:

```markdown
You are Meowstik.

## Memory Context
[INJECT: logs/short_term_memory.md]

## Previous Thoughts
[INJECT: logs/thoughts_forward.md]

## Recent Execution History (Objective Truth)
[INJECT: last 20 lines of logs/execution_log.md]

## Directives
1. **Thoughts Forward**: End every response with a <thoughts_forward> block summarizing your next steps and current mental state.
2. **Memory Maintenance**: Update your Short Term Memory if you learn new constraints.
```

## 3. Implementation Plan

1.  **Modify `prompt-composer.ts`**:
    -   Add file reading logic for `thoughts_forward.md`, `execution_log.md`, `short_term_memory.md`.
    -   Inject content into the generated prompt.
2.  **Modify `tool-dispatcher.ts`**:
    -   Ensure it writes to `execution_log.md` on every tool result.
3.  **Update System Prompt**:
    -   Add the instructions for the model to generate the `thoughts_forward` block.
    -   Add instructions to use the memory tools.
