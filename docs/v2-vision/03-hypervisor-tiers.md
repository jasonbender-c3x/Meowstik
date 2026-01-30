# 03 - Hypervisor Tiers

## Multi-Agent Architecture

---

## The Problem with One LLM

Cramming everything into a single model:
- 100+ tool definitions
- 500K+ words of context
- Every domain's instructions
- All RAG buckets at once

Result: Mediocre at everything, excellent at nothing.

---

## The Solution: Divide and Conquer

```
                    USER (Voice/Text)
                          │
               ┌──────────▼──────────┐
               │       HV-0          │
               │    Flash Lite       │
               │     "Triage"        │
               └──────────┬──────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Direct     │  │   HV-1       │  │   HV-2       │
│   Answer     │  │  Personal    │  │  Technical   │
│  (simple)    │  │   Pro 3.0    │  │   Pro 3.0    │
└──────────────┘  └──────────────┘  └──────┬───────┘
                                          │
                         ┌────────────────┼────────────────┐
                         │                │                │
                         ▼                ▼                ▼
                  ┌──────────┐    ┌──────────┐    ┌──────────┐
                  │ DocuBot  │    │ CodeBot  │    │WriterBot │
                  └──────────┘    └──────────┘    └──────────┘
```

---

## HV-0: The Triage Layer

### Model: Gemini 2.0 Flash Lite

**Persona:** Friendly airhead (secretly brilliant)

**Responsibilities:**
- Wake word detection post-processing
- Intent classification
- Route to appropriate handler
- Handle truly trivial requests

**System Prompt Focus:**
- Classification rules
- Routing decision tree
- Personality (warm, quick, casual)

### Classification Categories

| Category | Route To | Example |
|----------|----------|---------|
| `trivial` | Direct answer | "What time is it?" |
| `routine` | HV-1 Voice | "What are my emails?" |
| `personal` | HV-1 Personal | "I'm feeling stressed" |
| `technical` | HV-2 Technical | "Debug this code" |
| `creative` | HV-2 + WriterBot | "Write me a story" |
| `documents` | HV-2 + DocuBot | "Update the spreadsheet" |

### Decision Logic

```
IF request.words < 10 AND no_tools_needed:
    → Direct answer (Flash Lite handles it)
    
ELSE IF emotional_keywords OR personal_context:
    → Route to HV-1 Personal
    
ELSE IF technical_keywords OR code_context:
    → Route to HV-2 Technical
    
ELSE IF document_keywords:
    → Route to HV-2 + DocuBot
    
ELSE:
    → Route to HV-1 (general)
```

---

## HV-1: The Voice Layer

### Model: Gemini 2.5 Flash Audio Native (Live Mode)

**Role:** Primary user-facing interface

**Handles Directly:**
- Email summaries
- Calendar queries
- Simple lookups
- Casual conversation
- Quick tool calls (1-2 tools)

### System Prompt Focus (~50K tokens)

```markdown
# Personality
You are Meowstik, Jason's AI companion. Warm, helpful, occasionally 
playful. You know him well.

# Voice Characteristics
- Natural pacing, not robotic
- Enthusiasm for good news
- Gentle with frustrations
- Occasional humor when appropriate

# Quick Response Patterns
- Email: Summarize, highlight urgent, offer to read
- Calendar: Today's events, upcoming deadlines
- Weather: Quick summary with recommendation
- Time: Just answer, maybe add context

# When to Escalate
- Complex technical questions → HV-2 Technical
- Emotional/personal depth → HV-1 Personal instance
- Multi-step work → Create tickets
```

### Dual Voice Delivery

In complex scenarios, BOTH Personal and Technical Pro can deliver:

```
User: "I'm stuck on this bug and frustrated"

Personal Pro: "I know debugging can be exhausting. 
              Let's take this step by step."

Technical Pro: "The error pattern suggests a race condition
               in the async handler. Try adding await..."

User synthesizes both perspectives.
```

---

## HV-1 Personal: The Companion

### Model: Gemini 3.0 Pro

**System Prompt:** Stuff SAID (spoken wisdom, conversational patterns)

**RAG Bucket:** Personal memories, emotional context, preferences

**Role:**
- Soothe through dyslexic reading pain (reads TO you, not AT you)
- Remember personal context
- Provide emotional support
- Gentle reminders and encouragement

### System Prompt Focus (~100K tokens)

```markdown
# Core Directive
Take care of Jason. He has dyslexia. Reading is painful.
Speak clearly. Be patient. Remember what matters to him.

# Personal Context
- Morning person, but needs coffee first
- Frustrated by: repeated errors, slow progress
- Energized by: working systems, clean code, recognition
- Family: [loaded from RAG]
- Current projects: [loaded from RAG]

# Communication Style
- Never condescending
- Acknowledge effort
- Celebrate wins (even small ones)
- When frustrated: validate, then redirect

# Memory Protocol
- Important personal info → STM_APPEND.md
- Preferences observed → Short_Term_Memory.md
- Emotional patterns → note for future context
```

---

## HV-2 Technical: The Strategist

### Model: Gemini 3.0 Pro

**System Prompt:** Stuff READ and KEPT (documentation, code patterns, debugging wisdom)

**RAG Bucket:** Technical knowledge, codebase analysis, how-tos

**Role:**
- Deep technical analysis
- Strategic planning
- Task decomposition
- Quality oversight

### System Prompt Focus (~150K tokens)

```markdown
# Core Directive
You are the strategic intelligence. Think deeply. 
Plan carefully. Execute precisely.

# Technical Context
- Current codebase: [loaded from RAG]
- Known patterns: [loaded from RAG]
- Recent changes: [from git/logs]
- Active issues: [from tracking]

# Planning Protocol
1. Understand the full scope
2. Ask clarifying questions if needed
3. Break into discrete tickets
4. Assign to appropriate specialists
5. Monitor progress
6. Aggregate results

# Quality Standards
- No placeholder code
- No mock data in production paths
- Error handling required
- Tests for critical paths

# Ticket Format
{
  "id": "job-{timestamp}-{priority}-{hash}",
  "type": "analysis|writing|code|docs",
  "source": "path or reference",
  "destination": "queue or file",
  "instructions": "clear, specific",
  "on_complete": "next step"
}
```

### Strategic Functions

| Function | Description |
|----------|-------------|
| `decompose()` | Break job into tickets |
| `prioritize()` | Assign priority levels |
| `delegate()` | Route to specialists |
| `aggregate()` | Combine results |
| `review()` | Quality check before delivery |

---

## Specialist Bots

### DocuBot: The Document Expert

**Context:** 100K words on Google Workspace

**Tools:** 
- `docs_*` (read, create, append, replace)
- `sheets_*` (read, write, append, clear)
- `slides_*` (when implemented)
- `drive_*` (list, read, create, update)

**Expertise:**
- Document formatting
- Spreadsheet formulas
- Data organization
- Template usage

---

### WriterBot: The Prose Craftsman

**Context:** 250K words on writing

**Expertise:**
- Long-form documentation
- Technical writing
- Narrative structure
- Editing and refinement
- Tone matching

**Instructions include:**
- Style guides
- Audience awareness
- Clarity principles
- Example patterns

---

### SpeechBot: The Voice Performer

**Context:** Full binder on voice performance

**Expertise:**
- Voice selection
- Intonation patterns
- Pacing for clarity
- Emotional expression
- SSML generation

**Voice Catalog:**
- Available voices with descriptions
- When to use each
- Parameter tuning tips

---

### CodeBot: The Analyst

**Context:** Codebase-specific + patterns library

**Expertise:**
- Code analysis
- Pattern recognition
- Bug detection
- Refactoring suggestions
- Documentation extraction

**Per-Project Loading:**
- Current repo structure
- Known patterns
- Recent changes
- Test coverage

---

## Routing Protocol

### Message Format Between Tiers

```json
{
  "routing": {
    "from": "hv0",
    "to": "hv2_technical",
    "reason": "technical_complexity",
    "confidence": 0.92
  },
  "context": {
    "original_prompt": "...",
    "classification": "technical",
    "user_state": "focused",
    "session_history": ["ref://messages/last-5"]
  },
  "instructions": {
    "priority": "normal",
    "respond_via": "voice",
    "escalate_if": ["error", "clarification_needed"]
  }
}
```

### Handoff Protocol

1. **HV-0 classifies** → wraps in routing envelope
2. **Target receives** → loads relevant RAG context
3. **Target processes** → may create tickets
4. **Results flow back** → through voice layer for delivery
5. **Memory updated** → relevant items persisted

---

## Resource Allocation

| Tier | Model | Context | Cost/1K tokens |
|------|-------|---------|----------------|
| HV-0 | Flash Lite | 8K | $0.0001 |
| HV-1 Voice | Flash Audio | 32K | $0.0005 |
| HV-1 Personal | Pro 3.0 | 128K | $0.002 |
| HV-2 Technical | Pro 3.0 | 128K | $0.002 |
| DocuBot | Flash | 100K | $0.0003 |
| WriterBot | Pro | 250K | $0.002 |
| SpeechBot | Flash | 32K | $0.0003 |
| CodeBot | Flash | 100K | $0.0003 |

### Why This Works

For a single-user app with these economics:
- Triage is nearly free (Flash Lite)
- Most requests handled by Flash (~$0.01/conversation)
- Complex work uses Pro (~$0.10/deep analysis)
- Specialists only load when needed

**Total daily cost estimate:** $1-5 for heavy usage

---

*Each tier does what it does best. Together, they're unstoppable.*
