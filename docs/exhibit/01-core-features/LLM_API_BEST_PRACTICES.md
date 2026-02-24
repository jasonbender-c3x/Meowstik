# LLM API Call Best Practices

## System Prompt Separation

**CRITICAL**: System prompts must ALWAYS be passed via the `systemInstruction` parameter, NEVER embedded in message history.

### ✅ CORRECT Pattern

```typescript
const result = await genAI.models.generateContent({
  model: "gemini-3-flash-preview",
  config: {
    systemInstruction: "You are a helpful assistant. Provide clear, accurate responses.",
  },
  contents: [
    { role: "user", parts: [{ text: "What is TypeScript?" }] }
  ]
});
```

### ❌ INCORRECT Patterns

**Don't embed system instructions in user messages:**

```typescript
// ❌ BAD - System prompt mixed into message content
const result = await genAI.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: [
    {
      role: "user",
      parts: [{
        text: "You are a helpful assistant. Answer this question: What is TypeScript?"
      }]
    }
  ]
});
```

**Don't use "system" role in contents array:**

```typescript
// ❌ BAD - System role not supported in contents array
const result = await genAI.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: [
    { role: "system", parts: [{ text: "You are a helpful assistant." }] },
    { role: "user", parts: [{ text: "What is TypeScript?" }] }
  ]
});
```

**Don't prefix with "System:":**

```typescript
// ❌ BAD - System instruction prefixed in user message
const result = await genAI.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: [
    { role: "user", parts: [{ text: "System: You are a task executor" }] },
    { role: "user", parts: [{ text: "Execute task XYZ" }] }
  ]
});
```

## Why This Matters

1. **API Clarity**: The Gemini API explicitly provides a `systemInstruction` parameter for this purpose
2. **Token Efficiency**: System instructions in the dedicated parameter may receive different treatment than regular message content
3. **Context Window**: Proper separation prevents system prompts from consuming conversation history space
4. **Multi-turn Consistency**: System instructions passed via parameter persist across turns without being repeated in history
5. **Debugging**: Cleaner separation makes it easier to debug and log interactions

## Message History Structure

Message history in the `contents` array should contain ONLY:
- **user** messages (actual user inputs)
- **model** messages (AI responses)

### ✅ CORRECT Message History

```typescript
const history = [
  { role: "user", parts: [{ text: "Hello, how are you?" }] },
  { role: "model", parts: [{ text: "I'm doing well, thanks!" }] },
  { role: "user", parts: [{ text: "What's the weather?" }] },
];

const result = await genAI.models.generateContentStream({
  model: "gemini-2.5-pro",
  config: {
    systemInstruction: "You are a helpful assistant.",
  },
  contents: [...history, { role: "user", parts: userParts }]
});
```

## Validation Helper

Use the validation utility to check your LLM calls:

```typescript
import { validateLLMCall } from './server/utils/llm-call-validator';

const config = {
  model: "gemini-3-flash-preview",
  contents: myContents,
  config: {
    systemInstruction: mySystemPrompt
  }
};

// Validate before calling
const validation = validateLLMCall(config);
if (!validation.valid) {
  console.error("LLM call validation failed:", validation.errors);
}
```

Or use the safe wrappers:

```typescript
import { safeGenerateContent, safeGenerateContentStream } from './server/utils/llm-call-validator';

// These automatically validate and warn/error on issues
const result = await safeGenerateContent(genAI.models, {
  model: "gemini-3-flash-preview",
  contents: [...],
  config: { systemInstruction: "..." }
});
```

## Common Mistakes to Avoid

### 1. Starting User Messages with Instructions

```typescript
// ❌ BAD
{ text: "You are analyzing a screenshot. Describe what you see..." }

// ✅ GOOD - Extract the instruction
config: {
  systemInstruction: "You are analyzing screenshots."
},
contents: [
  { role: "user", parts: [{ text: "Describe what you see in this image..." }] }
]
```

### 2. Mixing Context with Instructions

```typescript
// ❌ BAD
{ text: "Analyze these logs from ${url}. Please identify errors..." }

// ✅ GOOD - Separate instruction from data
config: {
  systemInstruction: "Analyze browser console logs. Identify errors and suggest fixes."
},
contents: [
  { role: "user", parts: [{ text: `Logs from ${url}:\n${logData}` }] }
]
```

### 3. Re-including System Prompt in Conversation

```typescript
// ❌ BAD - System prompt gets included every turn
const systemPromptAsMessage = { role: "user", parts: [{ text: systemPrompt }] };
contents: [systemPromptAsMessage, ...history, currentMessage]

// ✅ GOOD - System instruction once, history without it
config: {
  systemInstruction: systemPrompt
},
contents: [...history, currentMessage]
```

## Testing

Tests are available in `server/utils/__tests__/llm-call-validator.test.ts`. Run them to ensure your patterns are correct:

```bash
npm test -- llm-call-validator.test.ts
```

## Migration Guide

If you find existing code with embedded system prompts:

1. **Identify** the system instruction portion (usually starting with "You are...", "Act as...", etc.)
2. **Extract** it to a separate variable
3. **Move** it to `config.systemInstruction` parameter
4. **Clean** the user message to contain only actual user content/context
5. **Test** to ensure behavior is unchanged

### Example Migration

**Before:**
```typescript
const result = await genAI.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: [{
    role: "user",
    parts: [{
      text: `You are a code analyzer. Review this code:
      
${codeToReview}

Identify issues and suggest improvements.`
    }]
  }]
});
```

**After:**
```typescript
const systemInstruction = `You are a code analyzer. Identify issues and suggest improvements.`;

const result = await genAI.models.generateContent({
  model: "gemini-3-flash-preview",
  config: {
    systemInstruction,
  },
  contents: [{
    role: "user",
    parts: [{
      text: `Review this code:
      
${codeToReview}`
    }]
  }]
});
```

## References

- Google Gemini API Documentation: https://ai.google.dev/docs
- Issue #[issue-number]: System Prompt Exclusion Fix
- Validator Implementation: `server/utils/llm-call-validator.ts`
