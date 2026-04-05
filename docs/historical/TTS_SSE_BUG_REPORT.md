# TTS / SSE Pipeline — Bug Report & Prioritised Fix Plan

*Generated: 2026-02-24*

---

## Executive Summary

A full-stack trace of the LLM → Streaming TTS → SSE → Client audio-playback pipeline
revealed **seven bugs** ranging from critical (silent audio loss) to low (style/robustness).
The most user-visible symptom is the browser falling back to the native `speechSynthesis`
voice instead of the high-quality server-generated audio — often called the
"browser fallback voice" bug.

---

## Pipeline Overview

```
Gemini AI generates text
        │
        ▼
[Streaming TTS Path]                     [Say Tool Path]
ttsSentenceBuffer (routes.ts ~931)       say() tool called by LLM
  → extractSentences() regex split         → generateSingleSpeakerAudio()
  → generateSingleSpeakerAudio()           → SSE speech { audioGenerated:true }
  → SSE speech { streaming:true }               │
        │                                       │
        └──────────────────┬────────────────────┘
                           ▼
              Client receives SSE speech event
                           │
               speechEventsReceived++
                           │
          ┌────────────────┴────────────────┐
          │ audioGenerated && hdPermitted    │ else
          ▼                                  ▼
   audioQueue.push()              speak(utterance) — browser TTS
   playNextInQueue()
          │
          ▼
   playAudioBase64() [AudioContext]
          │ fails?
          ▼
   HTML Audio fallback
          │ fails?
          ▼
   silent (all methods exhausted)

After stream "done":
  if speechEventsReceived === 0 && browserTTSPermitted
    → speak(fullResponse) — full-response browser TTS fallback
```

---

## Bugs — Ordered by Priority

---

### 🔴 BUG-1 (Critical) — Short Final Sentences Silently Dropped by TTS Buffer

**Files:** `server/routes.ts` lines 969, 981, 1044

**Root cause:** `extractSentences()` uses a `> 3` character-length guard before emitting a
sentence to TTS. The same guard is applied to paragraph-split parts and to the final buffer
flush after the stream ends.  Short but valid sentences — "Yes.", "No.", "Done." — are
silently discarded, causing audio gaps at the end of responses.

**Evidence:**
```typescript
// line 969 — sentence loop
if (trimmed.length > 3) { sentences.push(trimmed); ... }

// line 981 — paragraph split
if (part.length > 3) sentences.push(part);

// line 1044 — final flush
if (useVoice && ttsSentenceBuffer.trim().length > 3) { ... }
```

**Fix:** Lower the minimum to `> 0` everywhere. An empty-string guard is already provided by
the `if (!sentence.trim())` check inside `streamTTSSentence`.

---

### 🔴 BUG-2 (Critical) — Browser Fallback Voice Fires on Non-Human Content

**File:** `client/src/pages/home.tsx` line 786–798

**Root cause:** When no HD speech events arrive, the client fires the browser TTS fallback
on the raw accumulated `aiMessageContent`. The only guard is a naive JSON prefix check
(`isRawJson`). Content that starts with thinking tags (`<thinking>`), markdown headings,
code fences, or tool metadata strings is spoken verbatim — garbled robotic audio.

**Evidence:**
```typescript
const isRawJson = textToSpeak.trim().startsWith('{') || textToSpeak.trim().startsWith('[');
if (textToSpeak && speechEventsReceived === 0 && browserTTSPermitted && !isRawJson) {
  speak(textToSpeak);
}
```

`speak()` does strip markdown, but `cleanContentForTTS` (set only when a `send_chat` tool
result arrives) is preferred; when it is empty the full raw message is spoken.

**Fix:** Extend the non-speakable content detection to also reject content that contains
XML-style thinking tags, starts with a code fence, or is predominantly symbols/JSON after
basic markdown stripping.

---

### 🟡 BUG-3 (High) — SSE Stream Has No Timeout — Client Hangs Forever

**File:** `client/src/pages/home.tsx` line 586–855

**Root cause:** If the server crashes, throws an unhandled error, or drops the TCP
connection mid-stream, the `done` SSE event is never sent. The `while(true)` reader loop
exits when `reader.read()` resolves `{ done: true }` from the HTTP layer, but `isLoading`
is only set to `false` inside the `data.done` handler.  Any code path that reaches end-of-
stream without a `done` event leaves the UI in the perpetual loading spinner state and the
audio queue in a half-flushed state.

**Fix:** Add a 30-second inactivity timeout that resets on every received chunk and triggers
the same cleanup as `data.done` if it fires.

---

### 🟡 BUG-4 (High) — `say` Tool Failure Does Not Increment `speechEventsReceived` Correctly

**File:** `client/src/pages/home.tsx` lines 672, 685–696

**Root cause:** When the `say` tool fails and the server sends
`{ speech: { audioGenerated: false, utterance: "..." } }`, `speechEventsReceived` is
correctly incremented (line 672), which suppresses the full-response browser TTS fallback.
However, the code at line 693 will then fall through to
`speak(speechData.utterance)` only **if** `browserTTSPermitted` is true.  In `low`
verbosity mode `shouldPlayBrowserTTS()` returns `false`, so the failed-say speech event
silently produces **no audio at all** — neither HD nor fallback.

**Fix:** When `audioGenerated === false`, trigger browser TTS regardless of verbosity mode,
matching the server's explicit intent to speak the utterance.

---

### 🟡 BUG-5 (Medium) — `extractSentences` Splits on Decimal Points and Abbreviations

**File:** `server/routes.ts` lines 961–986

**Root cause:** The sentence-splitting regex `/([.!?]+[\s\n]*)/` has no lookahead to
distinguish terminating periods from decimal points (`3.14`), domain separators
(`example.com`), or common abbreviations (`Dr.`, `e.g.`).  The result is that a sentence
like *"Version 2.0 is available."* is split into two TTS chunks: *"Version 2."* and
*"0 is available."* — producing unnatural, choppy audio.

**Fix:** Add a negative lookbehind/lookahead to the sentence-split regex to avoid splitting
after a digit-dot-digit pattern or when the word following the dot is lowercase (indicating
abbreviation or continuation), matching common heuristics used by NLP sentence tokenisers.

---

### 🟡 BUG-6 (Medium) — `AudioContext` Not Resumed Before Every Playback Attempt

**File:** `client/src/contexts/tts-context.tsx` lines 125–131

**Root cause:** `playAudioBase64` tries to resume a suspended `AudioContext` but bails out
immediately if `ctx.state !== 'running'` after the resume attempt. On some browsers
(especially Safari/Firefox) `ctx.resume()` is asynchronous and may not complete before the
state is checked, causing the first sentence of every new conversation to play silently.

**Fix:** `await ctx.resume()` is already called (line 126) but is swallowed by a bare
`try { } catch {}`. The state check on the next line should be the sole guard — no need to
re-throw, but the await result should drive the check rather than a snapshot of state taken
before the await completes (it is taken *after*, so this is actually fine — the real risk is
browsers that never leave `suspended`). Add a short `setTimeout` fallback retry or log a
clear warning when the context cannot be unblocked.

---

### 🟢 BUG-7 (Low) — `unlockAudio` Skips If Already Unlocked, Ignoring Re-Suspension

**File:** `client/src/contexts/tts-context.tsx` line 95

**Root cause:** `unlockAudio` returns immediately if `isAudioUnlocked` is `true`. This
state is never reset, so if the browser re-suspends the `AudioContext` (e.g., after the tab
is backgrounded), subsequent calls to `playAudioBase64` will try to resume without the
one-time user-gesture token, which can fail silently.

**Fix:** Remove the early-exit guard and always attempt `ctx.resume()` on each `unlockAudio`
call, or reset `isAudioUnlocked` when the context state transitions to `suspended`.

---

## Implementation Plan (by Priority)

| # | Bug | File | Change Type | Lines |
|---|-----|------|-------------|-------|
| 1 | BUG-1: Short sentences dropped | `server/routes.ts` | Threshold change | 969, 981, 1044 |
| 2 | BUG-2: Browser TTS fires on non-content | `client/src/pages/home.tsx` | Logic improvement | 786–798 |
| 3 | BUG-3: SSE no timeout | `client/src/pages/home.tsx` | Add timeout guard | 586–590 |
| 4 | BUG-4: `say` tool fail silent in low mode | `client/src/pages/home.tsx` | Fallback logic | 685–696 |
| 5 | BUG-5: Regex splits on decimals | `server/routes.ts` | Regex improvement | 964 |
| 6 | BUG-6: AudioContext resume timing | `client/src/contexts/tts-context.tsx` | Robustness | 125–131 |
| 7 | BUG-7: `unlockAudio` skips re-suspension | `client/src/contexts/tts-context.tsx` | Guard removal | 95 |

All fixes are implemented in the subsequent commits on this branch.
