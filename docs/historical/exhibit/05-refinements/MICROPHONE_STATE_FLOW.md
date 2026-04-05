# Microphone State Management Flow

## Before Fix (Bug Present)

```
Session 1:
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks mic                                           │
│ 2. startListening(hasExistingText=false)                     │
│ 3. hook.transcript = ""                                      │
│ 4. User speaks: "Hello"                                      │
│ 5. hook.transcript = "Hello"                                 │
│ 6. lastTranscriptLengthRef = 5                              │
│ 7. User stops                                                │
│ 8. Input shows: "Hello"                                      │
└─────────────────────────────────────────────────────────────┘

Session 2:
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks mic again                                     │
│ 2. startListening(hasExistingText=false)                     │
│    ⚠️  hook.transcript STILL = "Hello" (not cleared!)       │
│ 3. lastTranscriptLengthRef reset to 0                       │
│ 4. User speaks: "World"                                      │
│ 5. hook.transcript = "HelloWorld" (accumulated!)            │
│ 6. Effect calculates delta:                                  │
│    newText = transcript.slice(0) = "HelloWorld"             │
│ 7. 🐛 BUG: "HelloWorld" inserted into input!                │
└─────────────────────────────────────────────────────────────┘
```

## After Fix (Bug Resolved)

```
Session 1:
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks mic                                           │
│ 2. resetTranscript() → hook.transcript = ""                 │
│ 3. lastTranscriptLengthRef = 0                              │
│ 4. startListening(false) → confirms transcript = ""         │
│ 5. User speaks: "Hello"                                      │
│ 6. hook.transcript = "Hello"                                 │
│ 7. lastTranscriptLengthRef = 5                              │
│ 8. User stops                                                │
│ 9. Input shows: "Hello"                                      │
└─────────────────────────────────────────────────────────────┘

Session 2:
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks mic again                                     │
│ 2. resetTranscript() → hook.transcript = ""                 │
│ 3. lastTranscriptLengthRef = 0                              │
│ 4. startListening(false) → confirms transcript = ""         │
│ 5. User speaks: "World"                                      │
│ 6. hook.transcript = "World"                                 │
│ 7. Effect calculates delta:                                  │
│    newText = transcript.slice(0) = "World"                  │
│ 8. ✅ CORRECT: Only "World" inserted into input!            │
└─────────────────────────────────────────────────────────────┘
```

## Key Changes

1. **Added `resetTranscript()` method** to `useVoice` hook
   - Explicitly clears: `transcript`, `interimTranscript`, `error`
   - Ensures clean state before each session

2. **Call `resetTranscript()` before starting**
   - Called in `handleMicClick` before `startListening`
   - Prevents stale data from previous sessions

3. **Always use non-append mode**
   - Changed from: `startListening(hasExistingText)`
   - Changed to: `startListening(false)`
   - Ensures consistent behavior

## State Synchronization

```
Component State          Hook State              Ref State
─────────────────────   ───────────────────    ──────────────────────
input: string           transcript: string      lastTranscriptLengthRef
cursorPositionRef       interimTranscript       
                        isListening             
                        error                   

                        ↓ resetTranscript()
                        
                        transcript = ""         
                        interimTranscript = ""  → lastTranscriptLengthRef = 0
                        error = null            
```

## Delta Calculation Logic

The component uses a delta-tracking mechanism to insert only new text:

```typescript
// Effect triggers when transcript changes
useEffect(() => {
  if (transcript && transcript.length > lastTranscriptLengthRef.current) {
    // Calculate delta (new text only)
    const newText = transcript.slice(lastTranscriptLengthRef.current);
    
    // Insert at saved cursor position
    setInput(prev => 
      prev.slice(0, cursorPos) + newText + prev.slice(cursorPos)
    );
    
    // Update tracking
    lastTranscriptLengthRef.current = transcript.length;
  }
}, [transcript]);
```

**Why the bug occurred:**
- `lastTranscriptLengthRef` was reset to 0, but `transcript` wasn't
- `transcript.slice(0)` returned the entire accumulated string
- Old text was reinserted as if it were new

**Why the fix works:**
- Both `transcript` and `lastTranscriptLengthRef` start at 0
- `transcript.slice(0)` returns only the newly spoken text
- No old data to reinsert
