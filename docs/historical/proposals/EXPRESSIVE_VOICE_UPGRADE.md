# Proposal: Highly Expressive Voice for Meowstik

## Executive Summary
Meowstik currently has the technical capability for expressive speech (via ElevenLabs and Google Neural2), but lacks the **autonomy** to use it. Currently, expressiveness is a manual "effect" applied by the user in a specific tool.

This proposal outlines an architecture to give Meowstik **emotional agency**, allowing her to autonomously modulate her voice tone, speed, and style based on the conversation context.

## 1. The "Stage Direction" Architecture

We need to bridge the gap between the LLM's text generation and the TTS engine's parameters. We will do this using **Stage Directions**.

### Current Flow
`LLM Text ("Hello user")` -> `TTS Engine (Default Neutral Voice)` -> `Audio`

### Proposed Flow
`LLM Text ("(cheerfully) Hello user!")` -> `Parser (Extracts style: cheerful)` -> `TTS Engine (Applies "cheerful" params)` -> `Audio`

### Implementation Details
1.  **Prompt Engineering**: Instruct the LLM to include emotional context tags at the start of sentences or paragraphs.
    *   *Example*: `[style: excited] I found the file you were looking for!`
    *   *Example*: `[style: serious] I detected a potential security vulnerability.`
2.  **Middleware Parser**: Create a `SpeechProcessor` service that:
    *   Intercepts the LLM response before it hits the TTS service.
    *   Strips the `[style: ...]` tags so they don't appear in the text transcript.
    *   Maps the tag to specific TTS parameters.

## 2. TTS Provider Mapping

We will map abstract styles to concrete provider parameters to maximize quality.

### Mapping Table

| Style Tag | Google TTS Implementation (SSML) | ElevenLabs Implementation (Settings) |
| :--- | :--- | :--- |
| `[style: cheerful]` | `<speak><prosody pitch="+2st" rate="1.05">...</prosody></speak>` | `stability: 0.4`, `style: 0.6` (High variability) |
| `[style: serious]` | `<speak><prosody pitch="-1st" rate="0.95">...</prosody></speak>` | `stability: 0.8`, `style: 0.0` (High consistency) |
| `[style: whisper]` | `<speak><emphasis level="reduced">...</emphasis></speak>` | `style: 0.0` (Use "Whisper" model if avail) |
| `[style: dramatic]` | `<speak><prosody rate="0.9">...</prosody></speak>` | `stability: 0.3`, `style: 1.0` (Max exaggeration) |

### ElevenLabs "Turbo" Specifics
ElevenLabs Turbo v2.5 is extremely sensitive to prompt context. We can enhance the "Prefix Trick" currently used:
*   Instead of just prepending "Say cheerfully:", we can use the `previous_text` or `prompt` context window if available, or continue using the prefix hack but stripped from the final audio if possible (hard with current API).
*   **Better Approach**: Dynamic `stability` modulation. Lower stability = more emotion/randomness. Higher style = more exaggeration.

## 3. Personality & Prompting Updates

We must update `prompts/personality.md` and the system prompt to explicitly encourage this behavior.

**New Directive:**
> "You have a voice, not just text. You represent your internal state using `[style: state]` tags.
> - If you solve a hard problem, use `[style: relieved]` or `[style: triumphant]`.
> - If you are confused, use `[style: uncertain]`.
> - If the user is sad, use `[style: empathetic]`.
> Do not be robotic. Be theatrical."

## 4. "Voice Feedback" Loop

To "encourage" her to be expressive, we implement a feedback mechanism:

1.  **User Reaction**: Add simple reaction buttons to voice messages (👍/👎 or "Too excited" / "Too flat").
2.  **Memory Storage**: Store these preferences in `memory/voice_preferences.json`.
3.  **Prompt Injection**: Inject these preferences into the system prompt.
    *   *Example*: "The user prefers a calmer voice. Avoid high-energy styles unless critical."

## 5. Roadmap

1.  **Phase 1 (The Parser)**: Implement `SpeechProcessor` to strip `[style: x]` tags and route them to TTS.
2.  **Phase 2 (The Actor)**: Update System Prompt to start generating these tags.
3.  **Phase 3 (The Tuner)**: Fine-tune the mapping of `[style: x]` to specific ElevenLabs/Google parameters.
4.  **Phase 4 (The Critic)**: Implement user feedback for voice style.

## Immediate Next Steps
- [ ] Modify `server/services/tts.ts` (or equivalent) to accept a `style` parameter.
- [ ] Create the `style_mapper.ts` utility.
- [ ] Update `prompts/core-directives.md` to include the new Voice Capability instructions.
