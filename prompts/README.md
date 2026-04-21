# Meowstik - System Prompt Architecture

## Overview

This directory contains the modular system prompt configuration for Meowstic, the AI assistant powering Meowstik. The prompt is split into separate files for maintainability, versioning, and easy customization.

## File Structure

```
prompts/
├── README.md              # This file - documentation
├── core-directives.md     # Fundamental behavior rules and constraints
├── personality.md         # Character, tone, and communication style
└── tools.md               # Tool definitions with implementation details
```

## How It Works

The `PromptComposer` service in `server/services/prompt-composer.ts` loads these files at startup and assembles them into a complete system prompt. The static prompt files it actually loads are:

1. **Core Directives** - Establishes fundamental rules and constraints
2. **Personality** - Defines character and communication style
3. **Tools** - Provides detailed tool specifications

Two old prompt files that were present in this directory but **not used by the runtime loader** were removed:

- `database-instructions.md`
- `llm-instructions.o;`

## What `PromptComposer` actually adds

The final system prompt is larger than just the three files above. `PromptComposer` currently assembles it in this order:

1. **Agent Identity** - injected branding (`You are {displayName}, referred to as {agentName}`)
2. **Environment Metadata** - runtime / environment details from `formatEnvironmentMetadata()`
3. **Core Directives** - `prompts/core-directives.md`
4. **Personality** - `prompts/personality.md`
5. **Tools** - `prompts/tools.md`
6. **Short-Term Memory** - `logs/Short_Term_Memory.md` when present
7. **Recent Execution History** - last lines of `logs/execution_log.md` when present
8. **To-Do List** - database-backed pending/in-progress tasks when a user ID is available
9. **Family Context** - injected from `getFamilyContext()` when present
10. **Thoughts Forward** - `logs/cache.md` from the previous turn when enabled
11. **External Skills Summary** - discovered skill/instruction summaries from `externalSkillsService`
12. **Final Instructions** - mandatory end-of-turn instructions appended by `getFinalInstructions()`

## Prompt Assembly

```typescript
// server/services/prompt-composer.ts
const systemPrompt = [
  identity,
  environmentMetadata,
  coreDirectives,
  personality,
  tools,
  shortTermMemory,
  executionLog,
  todoList,
  familyContext,
  cache,
  externalSkillsSummary,
  finalInstructions,
].join('\n\n');
```

## Customization

### Modifying Behavior
Edit `core-directives.md` to change fundamental rules like:
- Response format requirements
- Security constraints
- Error handling policies

### Adjusting Personality
Edit `personality.md` to change:
- Tone and communication style
- Level of formality
- Verbosity preferences

### Adding/Modifying Tools
Edit `tools.md` to:
- Add new tool types
- Modify tool parameters
- Update implementation details
