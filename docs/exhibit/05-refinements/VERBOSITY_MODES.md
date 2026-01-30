# Verbosity Modes: Text and Speech Alignment

## Overview

Meowstik's verbosity system controls **both text and speech output** simultaneously, ensuring a consistent multi-modal experience. When you adjust the verbosity slider, both your chat responses and audio output change together.

## The Four Modes

### 🔇 Mute (Alerts Only)
**When to use**: Focus mode, meetings, or when you need minimal distraction

**Behavior**:
- **Text**: Only critical alerts or explicit responses to direct questions
- **Speech**: Completely silent
- **Response Length**: 1 sentence maximum
- **Example**: "Task completed." or "Error: file not found."

### 🔉 Low (Concise)
**When to use**: Quick answers, when you're in a hurry, or scanning information

**Behavior**:
- **Text**: Brief, focused responses with only essential information
- **Speech**: Concise spoken summaries via `say` tool
- **Response Length**: 1-3 sentences
- **Example**: 
  - User: "What's the weather?"
  - Response: "It's 72°F and sunny in your area."

### 🔊 Normal (Verbose) - **DEFAULT**
**When to use**: Learning, detailed explanations, comprehensive understanding

**Behavior**:
- **Text**: Comprehensive, detailed responses with context and examples
- **Speech**: Complete spoken version of text responses
- **Response Length**: Multiple paragraphs with thorough explanations
- **Example**:
  - User: "What's the weather?"
  - Response: "Let me check the current weather conditions for you. Right now in your area, it's 72°F with sunny skies and no clouds. The humidity is at a comfortable 45%, and there's a light breeze from the west at 5 mph. It's a perfect day for outdoor activities! The forecast shows these pleasant conditions continuing through the afternoon with temperatures peaking around 75°F."

### 🎙️ Experimental (Dual-Voice Discussion)
**When to use**: Exploring complex topics, brainstorming, or when you want multiple perspectives

**Behavior**:
- **Text**: Structured as a dialogue between two AI personas
- **Speech**: Two-voice discussion format that continues until you interrupt
- **Response Length**: Extended back-and-forth conversation
- **Example**:
  - User: "Explain quantum computing"
  - Response: 
    - **Persona A**: "That's an interesting question about quantum computing! At its core, it's about using quantum mechanics principles for computation."
    - **Persona B**: "I agree, and I'd add that the key difference from classical computing is the use of qubits instead of bits. These qubits can exist in superposition..."
    - **Persona A**: "Exactly! And another key point is quantum entanglement, which allows qubits to be correlated in ways that classical bits can't be..."
    - *(continues until user interrupts)*

## Technical Implementation

### Frontend (Client-Side)
- **Component**: [`client/src/components/ui/verbosity-slider.tsx`](../client/src/components/ui/verbosity-slider.tsx)
- **Context**: [`client/src/contexts/tts-context.tsx`](../client/src/contexts/tts-context.tsx)
- **Persistence**: Stored in `localStorage` with key `meowstik-verbosity-mode`

### Backend (Server-Side)
- **Route Handler**: [`server/routes.ts`](../server/routes.ts) (lines 606-695)
- **Prompt Injection**: Mode-specific instructions added to system prompt
- **Dynamic**: Changes take effect immediately on next message

## Dynamic Mid-Session Adjustment

Verbosity can be changed at any time during a conversation:

1. **User changes slider** → New mode saved to `localStorage`
2. **Next message sent** → `verbosityMode` included in request body
3. **Server receives mode** → Injects mode-specific prompt instructions
4. **AI responds** → Uses new verbosity level for both text and speech

**Example Flow**:
```
User (Normal mode): "Tell me about Python"
AI: [Comprehensive multi-paragraph response with full speech]

*User switches to Low mode*

User (Low mode): "And what about JavaScript?"
AI: [Brief 2-sentence response with concise speech]
```

## Best Practices

### For Users

1. **Start with Normal**: It's the default for a reason - balanced and comprehensive
2. **Use Low when busy**: Quick answers without interrupting your flow
3. **Use Mute for focus**: When you need to concentrate but want the AI available
4. **Try Experimental for exploration**: Great for brainstorming and learning complex topics

### For Developers

1. **Always pass `verbosityMode`**: Include in every message request to `/api/chats/:id/messages`
2. **Align text and speech**: When verbosity changes, both modalities should match
3. **Respect the mode in tools**: The `say` tool should adjust its output based on mode
4. **Test all four modes**: Ensure each mode has distinct, observable behavior

## API Usage

### Request Format
```typescript
POST /api/chats/:id/messages
{
  "content": "User message",
  "verbosityMode": "low" | "normal" | "experimental" | "mute",
  // ... other fields
}
```

### Mode-Specific Prompts
The server injects mode-specific instructions into the system prompt:

```typescript
// Low Mode
"Keep both text and speech responses concise. 
 Maximum 1-3 sentences."

// Normal Mode  
"Provide comprehensive, detailed responses in both text and speech.
 Use the `say` tool to speak your complete responses."

// Experimental Mode
"Generate a two-voice discussion format.
 Continue the discussion until the user interrupts."

// Mute Mode
"Minimize all output. Only respond to critical alerts.
 No voice output whatsoever."
```

## Troubleshooting

### Text and speech don't match
- **Check**: Ensure `verbosityMode` is being sent with each message
- **Verify**: Inspect network request in DevTools → Payload should include `verbosityMode`

### Mode changes don't take effect
- **Clear cache**: `localStorage.clear()` and refresh
- **Check server logs**: Verify mode is received and prompt is modified

### Experimental mode doesn't create dialogue
- **Model limitation**: Some models may not follow dual-voice instructions perfectly
- **Prompt tuning**: May need to adjust system prompt for better results

## Future Enhancements

- [ ] Webcam capture integration for visual context
- [ ] Real-time barge-in detection for Experimental mode
- [ ] Per-conversation verbosity override
- [ ] Voice personality selection (different voices for different modes)
- [ ] Smart mode switching based on context

---

**Last Updated**: 2026-01-16  
**Maintainer**: Meowstik Development Team
