# Evolution Engine

The Evolution Engine closes the self-improvement loop: it collects user feedback, extracts patterns (aided by the Summarization Engine), generates concrete improvement suggestions using Gemini, and opens a GitHub PR for human review.

**Location:** `server/services/evolution-engine.ts`

---

## How It Works

```mermaid
graph TD
    FB[User Feedback\n100 recent entries] --> SE[Summarization Engine\nsummarizeFeedbackBatch]
    SE --> FP[Structural Pattern Analysis\nlow scores · disliked aspects · comments]
    FP --> AI[Gemini: generateImprovementSuggestions\ngemini-3-flash-preview]
    AI --> Report[EvolutionReport\npatterns + suggestions]
    Report --> Branch[GitHub: create branch]
    Branch --> File[Commit evolution report\ndocs/evolution/{id}.md]
    File --> PR[Open Pull Request]
    PR --> Copilot["@copilot comment\nfor automated review"]
    PR --> Human[Human Review]
    Human -->|Approve| Merge[Merged Improvements]
```

---

## The Feedback Loop

### 1. Collect Feedback

Users rate AI responses via the feedback UI. Each `feedback` record captures:
- `rating` — `positive` or `negative`
- `categories` — scored dimensions: accuracy, helpfulness, clarity, completeness (1-5)
- `likedAspects` / `dislikedAspects` — structured tags
- `freeformText` — open-ended user comment
- `promptSnapshot` / `responseSnapshot` — full context for replay analysis

### 2. Summarize (Summarization Engine)

Before structural analysis, `summarizeFeedbackBatch()` uses Gemini 2.0 Flash to extract:
- High-level behavioral patterns
- Common issues users experience
- Areas to improve

This catches semantic patterns that pure metric analysis would miss.

### 3. Structural Pattern Analysis

In parallel with AI summarization:
- **Category scores ≤ 2** → identified as "low score" patterns
- **Disliked aspects with ≥ 2 occurrences** → recurring complaint patterns
- **Freeform text from negative ratings** → "direct user complaints" pattern

Each pattern has a severity: `low`, `medium`, or `high` based on frequency.

### 4. Generate Improvement Suggestions

Patterns are sent to Gemini with a prompt asking for 2-5 concrete suggestions:

```json
[
  {
    "title": "Reduce response verbosity for simple questions",
    "description": "...",
    "category": "behavior",
    "targetFile": "prompts/core-directives.md",
    "proposedChanges": "Add instruction: 'For yes/no questions, answer in ≤2 sentences'",
    "rationale": "5 users rated helpfulness ≤2 citing long-winded responses",
    "priority": 4
  }
]
```

### 5. Create GitHub PR

```typescript
const pr = await createEvolutionPR(report, { owner, repo }, userId);
// Creates branch: evolution/evo-{timestamp}
// Commits: docs/evolution/evo-{id}.md (the full analysis report)
// Opens PR with pattern summary + suggestions
// Tags @copilot for automated implementation review
```

---

## Key Functions

```typescript
// Run the full analysis pipeline
analyzeFeedbackPatterns(): Promise<FeedbackPattern[]>

// Generate suggestions from patterns
generateImprovementSuggestions(patterns): Promise<ImprovementSuggestion[]>

// Build a full evolution report
generateEvolutionReport(): Promise<EvolutionReport>

// Create a GitHub PR from a report
createEvolutionPR(report, targetRepo, userId?): Promise<PRResult>
```

---

## Types

```typescript
interface FeedbackPattern {
  category: string;       // "category_score" | "disliked_aspect" | "user_comments" | "ai_summarized"
  issue: string;          // Human-readable description
  frequency: number;      // How often it appears
  examples: Array<{
    prompt: string;
    response: string;
    feedback: string;
  }>;
  severity: "low" | "medium" | "high";
}

interface ImprovementSuggestion {
  title: string;
  description: string;
  category: "prompt_improvement" | "formatting" | "knowledge" | "behavior";
  targetFile?: string;      // e.g., "prompts/core-directives.md"
  proposedChanges?: string; // Specific text to change
  rationale: string;
  priority: number;         // 1-5 (5 = highest)
}

interface EvolutionReport {
  id: string;             // "evo-{timestamp}"
  analyzedAt: string;
  feedbackCount: number;
  patterns: FeedbackPattern[];
  suggestions: ImprovementSuggestion[];
  summary: string;
}

interface PRResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}
```

---

## Agent Identity

PRs are attributed to **Agentia Compiler** — the Evolution Engine's agent identity, stored in the `agent_identities` table.

If a user has custom branding configured (`user_branding.githubSignature`), that signature is used instead, so PRs appear as coming from the user's configured identity.

---

## API Endpoints

The Evolution Engine is triggered via API routes. Check `server/routes.ts` for current endpoints — look for imports of `evolution-engine.ts`.

---

## Human-in-the-Loop Design

The Evolution Engine **never auto-merges** or directly modifies source code. All changes go through a GitHub PR that requires human (or Copilot) review. This is intentional:

1. **Safety** — AI-suggested prompt changes could have unintended consequences
2. **Auditability** — every change has a traceable PR with full reasoning
3. **Control** — humans (and Copilot) decide what gets merged

The `@copilot` comment on each PR requests automated implementation assistance, but a human must approve the final merge.

---

## Message Scanner

The Evolution Engine also includes a **message scanner** that scans recent chat messages for implicit feedback (complaints, praise, suggestions buried in conversation). This extracts feedback even when users don't explicitly use the rating UI.

```typescript
scanMessagesForFeedback(messages, repo): Promise<MessageScanResult>
```

Results are committed to a separate PR branch and tagged `@copilot` for review.
