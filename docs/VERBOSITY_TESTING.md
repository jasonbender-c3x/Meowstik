# Verbosity Slider Testing Guide

## Test Environment Setup

Before testing, ensure:
1. Development server is running: `npm run dev`
2. Environment variables are configured (`.env` file)
3. Database is accessible

## Manual Test Cases

### Test Case 1: Verbosity Slider Visual Verification

**Objective**: Verify the verbosity slider displays all 4 modes correctly

**Steps**:
1. Navigate to the home page (`/`)
2. Locate the verbosity slider in the header area
3. Verify the following modes are displayed:
   - 🔇 Mute (VolumeX icon)
   - 🔉 Low (Volume1 icon)
   - 🔊 Normal (Volume2 icon)
   - 🎙️ Experimental (Radio icon)

**Expected Result**: All 4 modes are visible with correct icons and labels

**Status**: ⏳ Pending

---

### Test Case 2: Mode Selection and Persistence

**Objective**: Verify mode selection is saved and persists

**Steps**:
1. Click on each mode button in sequence
2. Verify the active mode highlights correctly
3. Hover over each mode to see tooltip descriptions
4. Refresh the page
5. Verify the last selected mode is still active

**Expected Result**: 
- Active mode shows visual feedback (blue background)
- Tooltips display correct descriptions:
  - Mute: "Silent (alerts only)"
  - Low: "Concise text & speech"
  - Normal: "Verbose text & speech"
  - Experimental: "Dual-voice discussion mode"
- Mode persists after page refresh

**Status**: ⏳ Pending

---

### Test Case 3: Mute Mode Behavior

**Objective**: Verify Mute mode suppresses non-essential output

**Steps**:
1. Select Mute mode
2. Send a general question: "Tell me about the weather"
3. Observe the response

**Expected Result**:
- Response is 1 sentence or less
- No audio playback
- Example: "I don't have access to current weather data."

**Status**: ⏳ Pending

---

### Test Case 4: Low Mode Behavior

**Objective**: Verify Low mode provides concise responses

**Steps**:
1. Select Low mode
2. Send a question: "What is Python?"
3. Observe the response

**Expected Result**:
- Response is 1-3 sentences maximum
- Audio plays if "say" tool is used
- Example: "Python is a high-level programming language. It's known for its simple syntax and versatility."

**Status**: ⏳ Pending

---

### Test Case 5: Normal Mode Behavior (Default)

**Objective**: Verify Normal mode provides verbose responses

**Steps**:
1. Select Normal mode (or use default)
2. Send a question: "What is Python?"
3. Observe the response

**Expected Result**:
- Response is comprehensive with multiple paragraphs
- All content is spoken via audio
- Includes context, examples, and detailed explanations
- Example: "Python is a powerful, high-level programming language that was created by Guido van Rossum in 1991. It's designed with a philosophy that emphasizes code readability and simplicity... [continues with extensive details]"

**Status**: ⏳ Pending

---

### Test Case 6: Experimental Mode Behavior

**Objective**: Verify Experimental mode generates dual-voice discussion

**Steps**:
1. Select Experimental mode
2. Send a question: "Explain quantum computing"
3. Observe the response format

**Expected Result**:
- Response is structured as a dialogue
- Multiple exchanges between two personas
- Example:
  ```
  Persona A: "That's an interesting question..."
  Persona B: "I agree, and I'd add..."
  Persona A: "Exactly! And another point..."
  ```

**Status**: ⏳ Pending

---

### Test Case 7: Mid-Session Mode Change

**Objective**: Verify mode changes take effect immediately

**Steps**:
1. Start in Normal mode
2. Send a message: "Tell me about JavaScript"
3. Wait for verbose response
4. Switch to Low mode
5. Send another message: "And what about TypeScript?"
6. Observe the difference

**Expected Result**:
- First response (Normal): Verbose, comprehensive
- Second response (Low): Concise, brief
- Mode change takes effect immediately without page refresh

**Status**: ⏳ Pending

---

### Test Case 8: Audio Settings Page Integration

**Objective**: Verify audio settings page reflects new modes

**Steps**:
1. Navigate to Audio Settings page (`/audio-settings`)
2. Locate the verbosity slider
3. Verify labels: "Mute", "Low (Concise)", "Normal (Verbose)", "Experimental"
4. Change the slider position
5. Return to home page
6. Verify the home page slider matches the setting

**Expected Result**:
- Audio settings page slider has correct labels
- Changes on audio settings page sync with home page
- Both sliders show the same active mode

**Status**: ⏳ Pending

---

### Test Case 9: Backwards Compatibility

**Objective**: Verify old mode values map to new modes

**Steps**:
1. Open browser DevTools → Application → Local Storage
2. Set `meowstik-verbosity-mode` to old values:
   - "quiet" → should map to "low"
   - "verbose" → should map to "normal"
   - "high" → should map to "normal"
   - "demo-hd" → should map to "normal"
   - "podcast" → should map to "experimental"
3. Refresh the page
4. Verify the correct new mode is active

**Expected Result**: Old mode values correctly map to new modes without errors

**Status**: ⏳ Pending

---

## Integration Tests

### API Request Verification

**Objective**: Verify verbosityMode is sent with each message

**Steps**:
1. Open browser DevTools → Network tab
2. Send a message in each mode
3. Inspect the request payload to `/api/chats/:id/messages`
4. Verify `verbosityMode` field is present in request body

**Expected Result**:
```json
{
  "content": "User message",
  "verbosityMode": "low" | "normal" | "experimental" | "mute",
  ...
}
```

**Status**: ⏳ Pending

---

### Server Prompt Injection Verification

**Objective**: Verify server injects correct prompt instructions

**Steps**:
1. Enable server logging
2. Send a message in each mode
3. Check server console logs for prompt injection
4. Verify mode-specific instructions are added

**Expected Result**:
- Mute mode: "VERBOSITY MODE: MUTE (Alerts Only)"
- Low mode: "VERBOSITY MODE: LOW (Concise Text & Speech)"
- Normal mode: "VERBOSITY MODE: NORMAL (Verbose Text & Speech)"
- Experimental mode: "VERBOSITY MODE: EXPERIMENTAL (Dual-Voice Discussion)"

**Status**: ⏳ Pending

---

## Regression Tests

### Test Case 10: Existing Features Unaffected

**Objective**: Verify other features still work correctly

**Steps**:
1. Test file uploads
2. Test screenshot capture
3. Test voice input (speech recognition)
4. Test chat history
5. Test Google integrations (if configured)

**Expected Result**: All existing features work as before

**Status**: ⏳ Pending

---

## Performance Tests

### Test Case 11: Mode Switching Performance

**Objective**: Verify mode switches are instantaneous

**Steps**:
1. Rapidly click between different modes
2. Observe UI responsiveness
3. Check for any lag or delay

**Expected Result**: Mode switches happen instantly without lag

**Status**: ⏳ Pending

---

## Accessibility Tests

### Test Case 12: Keyboard Navigation

**Objective**: Verify modes can be selected via keyboard

**Steps**:
1. Tab to the verbosity slider
2. Use arrow keys to navigate between modes
3. Press Enter/Space to select a mode

**Expected Result**: Full keyboard accessibility

**Status**: ⏳ Pending

---

### Test Case 13: Screen Reader Compatibility

**Objective**: Verify screen readers can announce modes

**Steps**:
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate to verbosity slider
3. Listen to announcements

**Expected Result**: Each mode is announced with its label and description

**Status**: ⏳ Pending

---

## Documentation Review

### Test Case 14: Documentation Accuracy

**Objective**: Verify documentation matches implementation

**Steps**:
1. Read `docs/VERBOSITY_MODES.md`
2. Compare with actual implementation
3. Verify all code examples are accurate

**Expected Result**: Documentation is accurate and complete

**Status**: ⏳ Pending

---

## Known Limitations

1. **Dual-voice implementation**: The Experimental mode relies on the AI model's ability to generate dialogue format. Some models may not follow this instruction perfectly.

2. **Audio quality**: Speech synthesis quality depends on browser TTS or Google TTS API availability.

3. **Mid-session changes**: Mode changes affect the *next* message, not the current streaming response.

---

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: Visual Verification | ⏳ Pending | |
| TC2: Mode Persistence | ⏳ Pending | |
| TC3: Mute Mode | ⏳ Pending | |
| TC4: Low Mode | ⏳ Pending | |
| TC5: Normal Mode | ⏳ Pending | |
| TC6: Experimental Mode | ⏳ Pending | |
| TC7: Mid-Session Change | ⏳ Pending | |
| TC8: Audio Settings | ⏳ Pending | |
| TC9: Backwards Compat | ⏳ Pending | |
| TC10: Regression | ⏳ Pending | |
| TC11: Performance | ⏳ Pending | |
| TC12: Keyboard Nav | ⏳ Pending | |
| TC13: Screen Reader | ⏳ Pending | |
| TC14: Documentation | ⏳ Pending | |

---

**Test Date**: _To be completed_  
**Tester**: _To be assigned_  
**Environment**: Development / Staging / Production
