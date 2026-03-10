# Expressiveness in Speech Synthesis - Meowstik Implementation

## Overview

Meowstik implements **text-based expressiveness** for speech synthesis, where emotional tone and speaking style are controlled through **prefix directives** prepended to the text being synthesized. This approach works across multiple TTS providers (Google Cloud TTS and ElevenLabs).

## Architecture

### Text-Based Style System

Instead of using SSML tags or API-specific emotion parameters, Meowstik uses **natural language style prefixes** that are interpreted by modern neural TTS models:

```typescript
// Base text
"Hello! Welcome to our podcast."

// With style prefix
"Say cheerfully: Hello! Welcome to our podcast."
```

### How It Works

1. **Client-Side Composition** (`client/src/pages/expressive-speech.tsx`)
   - User selects a style preset from dropdown
   - Style is prepended to text if not "natural"
   - Combined text sent to API

2. **Server-Side Processing** (`server/routes/speech.ts`)
   - Receives styled text as single string
   - Passes through to TTS provider unchanged
   - Neural models interpret style directive naturally

3. **TTS Provider** (Google Cloud TTS or ElevenLabs)
   - Neural networks trained on diverse speech data
   - Understand natural language instructions
   - Apply appropriate prosody, intonation, and emotion

## Style Presets

### Available Styles

Located in `client/src/pages/expressive-speech.tsx`:

```typescript
const STYLE_PRESETS = [
  { value: "natural", label: "Natural" },
  { value: "Say cheerfully", label: "Cheerful" },
  { value: "Say seriously", label: "Serious" },
  { value: "Say excitedly", label: "Excited" },
  { value: "Say calmly", label: "Calm" },
  { value: "Say dramatically", label: "Dramatic" },
  { value: "Whisper", label: "Whisper" },
  { value: "Say like a news anchor", label: "News Anchor" },
  { value: "Say warmly", label: "Warm" },
  { value: "Say professionally", label: "Professional" },
];
```

### Style Application Examples

#### Single Voice Mode

```typescript
// User input:
text: "This is amazing news!"
voice: "Kore"
style: "Say excitedly"

// Sent to API:
{
  text: "Say excitedly: This is amazing news!",
  speakers: [{
    name: "Speaker",
    voice: "Kore",
    style: "Say excitedly"
  }]
}
```

#### Multi-Speaker Mode

```typescript
// Conversation:
Host (Kore, cheerful): "Welcome to our show!"
Guest (Puck, serious): "Thank you for having me."

// Sent to API:
{
  text: "Host: Welcome to our show!\nGuest: Thank you for having me.",
  speakers: [
    { name: "Host", voice: "Kore", style: "Say cheerfully" },
    { name: "Guest", voice: "Puck", style: "Say seriously" }
  ]
}
```

## Implementation Details

### Client-Side Implementation

**File**: `client/src/pages/expressive-speech.tsx`

```typescript
const generateAudio = useCallback(async () => {
  let requestBody;
  
  if (mode === "single") {
    // Apply style prefix if not "natural"
    const effectiveStyle = singleStyle !== "natural" ? singleStyle : "";
    const styledText = effectiveStyle ? `${effectiveStyle}: ${singleText}` : singleText;
    
    requestBody = {
      text: styledText,
      speakers: [{ 
        name: "Speaker", 
        voice: singleVoice, 
        style: effectiveStyle 
      }]
    };
  } else {
    // Multi-speaker: Build conversation with speaker labels
    const conversationText = conversation
      .map(line => {
        const speaker = speakers.find(s => s.id === line.speakerId);
        return `${speaker?.name || "Speaker"}: ${line.text}`;
      })
      .join("\n");
      
    requestBody = {
      text: conversationText,
      speakers: speakers.map(s => ({
        name: s.name,
        voice: s.voice,
        style: s.style !== "natural" ? s.style : ""
      }))
    };
  }

  // Send to API
  const response = await fetch("/api/speech/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
}, [mode, singleText, singleVoice, singleStyle, speakers, conversation]);
```

### Server-Side Implementation

**File**: `server/routes/speech.ts`

```typescript
router.post("/tts", asyncHandler(async (req, res) => {
  const { text, speakers, model, provider } = req.body;
  
  // Determine TTS provider
  const ttsProvider = provider || process.env.TTS_PROVIDER || "google";
  
  let result;
  if (ttsProvider === "elevenlabs" || ttsProvider === "11labs") {
    // ElevenLabs interprets style prefixes naturally
    const { generateMultiSpeakerAudio } = await import("../integrations/elevenlabs-tts");
    result = await generateMultiSpeakerAudio({ speakers });
  } else {
    // Google Cloud TTS interprets style prefixes naturally
    const { generateMultiSpeakerAudio } = await import("../integrations/expressive-tts");
    result = await generateMultiSpeakerAudio({
      text,
      speakers,
      model: model || "flash"
    });
  }
  
  res.json(result);
}));
```

### TTS Provider Integration

**Google Cloud TTS** (`server/integrations/expressive-tts.ts`):

```typescript
export async function generateSingleSpeakerAudio(
  text: string,  // Text with style prefix (e.g., "Say cheerfully: Hello!")
  voice: string = DEFAULT_TTS_VOICE,
  maxRetries: number = 2
): Promise<TTSResponse> {
  // ...authentication...
  
  const response = await tts.text.synthesize({
    requestBody: {
      input: { text },  // Style prefix included in text
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,  // e.g., "en-US-Neural2-C"
        ssmlGender: voiceConfig.ssmlGender
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0,
        effectsProfileId: ["headphone-class-device"]
      }
    }
  });
  
  // Returns MP3 base64
}
```

**ElevenLabs** (`server/integrations/elevenlabs-tts.ts`):

```typescript
export async function generateSingleSpeakerAudio(
  text: string,  // Text with style prefix
  voice: string = DEFAULT_ELEVENLABS_VOICE,
  maxRetries: number = 2
): Promise<TTSResponse> {
  // ...authentication...
  
  const audioStream = await client.textToSpeech.convert(voiceConfig.voiceId, {
    text: text,  // Style prefix interpreted by ElevenLabs neural models
    model_id: "eleven_turbo_v2_5",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,  // ElevenLabs-specific style parameter
      use_speaker_boost: true
    }
  });
  
  // Returns MP3 base64
}
```

## Why This Approach Works

### Neural Model Training

Modern neural TTS models are trained on:

1. **Diverse Speech Datasets**
   - Professional narration (news anchors, audiobooks)
   - Conversational speech (podcasts, interviews)
   - Emotional speech (excited, calm, dramatic)
   - Whispered and intimate speech

2. **Contextual Understanding**
   - Models learn from text + audio pairs
   - Understand natural language instructions
   - Associate phrases like "Say cheerfully:" with appropriate prosody

3. **Implicit Emotion Transfer**
   - "Say cheerfully" → Higher pitch, faster pace, brighter tone
   - "Whisper" → Reduced volume, breathy quality, intimate tone
   - "Say dramatically" → Wider pitch range, deliberate pauses

### Example Transformations

| Style Prefix | Prosody Changes | Example Output |
|--------------|-----------------|----------------|
| **Say cheerfully** | ↑ Pitch, ↑ Speed, Bright tone | "Hello! 😊" (upward inflection) |
| **Say seriously** | ↓ Pitch, Stable, Authoritative | "Listen carefully." (firm, steady) |
| **Whisper** | ↓ Volume, Breathy, Intimate | "*Psst... over here*" (soft, close) |
| **Say dramatically** | Wide pitch range, Pauses | "And then... it happened!" (suspenseful) |
| **Say like a news anchor** | Clear, Measured, Professional | "In today's headlines..." (broadcast quality) |

## Multi-Speaker Conversations

### Conversation Structure

Multi-speaker mode builds a natural conversation format:

```
Host: Welcome to our podcast!
Guest: Thanks for having me!
Host: Let's dive right in.
```

Each speaker line is prefixed with their name, which helps the TTS model understand turn-taking and speaker transitions.

### Speaker Configuration

```typescript
interface Speaker {
  id: string;
  name: string;  // "Host", "Guest", "Narrator"
  voice: string;  // "Kore", "Puck", "Rachel"
  style: string;  // "Say cheerfully", "natural"
}

interface ConversationLine {
  id: string;
  speakerId: string;  // Links to Speaker
  text: string;       // The dialogue
}
```

### Multi-Speaker Example

```typescript
// Configuration
speakers = [
  { id: "1", name: "Host", voice: "Kore", style: "Say cheerfully" },
  { id: "2", name: "Guest", voice: "Puck", style: "Say professionally" }
];

conversation = [
  { id: "1", speakerId: "1", text: "Welcome to Tech Talk!" },
  { id: "2", speakerId: "2", text: "Glad to be here." },
];

// Generated text sent to API:
text = `Host: Welcome to Tech Talk!\nGuest: Glad to be here.`;

// Result: Two distinct voices with different styles
```

## Provider-Specific Features

### Google Cloud TTS (Default)

**Voices**: Neural2 voices
- Kore (Female, clear)
- Puck (Male, warm)
- Charon (Male, deep)
- [8 voices total]

**Strengths**:
- Excellent natural language understanding
- Free tier: 1M characters/month
- Consistent quality

**Configuration**:
```typescript
audioConfig: {
  audioEncoding: "MP3",
  speakingRate: 1.0,  // Could be adjusted for style
  pitch: 0,           // Could be adjusted for style
  effectsProfileId: ["headphone-class-device"]
}
```

### ElevenLabs

**Voices**: Premium voices
- Rachel (Female, balanced)
- Antoni (Male, well-rounded)
- [10 voices total]

**Strengths**:
- Highly expressive and emotional
- Natural-sounding with emotional range
- Excellent at interpreting style directives

**Configuration**:
```typescript
voice_settings: {
  stability: 0.5,          // Balance between consistency and variation
  similarity_boost: 0.75,  // How closely to match the voice
  style: 0.0,              // ElevenLabs-specific style parameter
  use_speaker_boost: true  // Enhance speaker characteristics
}
```

## Usage in Chat

The same expressiveness system is available in the main chat via the "say" tool:

```typescript
// In RAG dispatcher
case "say":
  result = await this.executeSay(toolCall);
  break;

// executeSay method
private async executeSay(toolCall: ToolCall): Promise<unknown> {
  const params = toolCall.parameters as { utterance: string; voice?: string };
  
  // Text can include style prefix
  // e.g., "Say cheerfully: Hello there!"
  
  const ttsProvider = process.env.TTS_PROVIDER || "google";
  
  if (ttsProvider === "elevenlabs") {
    const { generateSingleSpeakerAudio } = await import("../integrations/elevenlabs-tts");
    ttsResult = await generateSingleSpeakerAudio(params.utterance, voice);
  } else {
    const { generateSingleSpeakerAudio } = await import("../integrations/expressive-tts");
    ttsResult = await generateSingleSpeakerAudio(params.utterance, voice);
  }
  
  return {
    type: "say",
    success: true,
    audioBase64: ttsResult.audioBase64,
    mimeType: ttsResult.mimeType,
    duration: ttsResult.duration,
    provider: ttsProvider
  };
}
```

## Best Practices

### 1. Style Prefix Placement

✅ **Correct**:
```typescript
"Say cheerfully: Hello! How are you today?"
```

❌ **Incorrect**:
```typescript
"Hello! Say cheerfully: How are you today?"  // Style in middle
"Hello! (cheerfully)"  // Wrong format
```

### 2. Combining Styles

✅ **One style per utterance**:
```typescript
"Say cheerfully: Welcome!"
"Say seriously: Now for the important part."
```

❌ **Multiple styles in one**:
```typescript
"Say cheerfully and seriously: Mixed message"  // Confusing
```

### 3. Natural Language

✅ **Natural phrasing**:
```typescript
"Say like a news anchor: Breaking news tonight."
"Whisper: This is a secret."
```

✅ **Simple directives**:
```typescript
"Say cheerfully: Great to see you!"
```

### 4. Multi-Speaker Conversations

✅ **Clear speaker labels**:
```typescript
"Host: Welcome!\nGuest: Thank you!"
```

❌ **Ambiguous structure**:
```typescript
"Welcome! Thank you!"  // Who's speaking?
```

## Limitations

### Current Limitations

1. **No SSML Support**
   - No fine-grained control over pitch, rate, emphasis
   - Cannot use `<prosody>`, `<emphasis>`, `<break>` tags
   - Relies on model interpretation of natural language

2. **Style Interpretation Varies**
   - Different models interpret styles differently
   - Google Cloud TTS vs ElevenLabs may produce different results
   - No guaranteed consistency across providers

3. **Single Style Per Utterance**
   - Cannot mix multiple styles in one sentence
   - Must split into separate utterances for style changes

4. **No Real-Time Style Control**
   - Style is baked into text before synthesis
   - Cannot dynamically adjust mid-generation

### Future Enhancements

**Potential Improvements**:

1. **SSML Support**
   - Add SSML wrapper option for Google Cloud TTS
   - Fine-grained prosody control
   - Precise timing and emphasis

2. **Provider-Specific Features**
   - Leverage ElevenLabs' emotion API
   - Use Google's speaking rate/pitch parameters
   - Provider-specific style enhancements

3. **Dynamic Style Adjustment**
   - Real-time style parameter tuning
   - Interactive style preview
   - Style interpolation between presets

4. **Advanced Multi-Speaker**
   - Speaker overlap (interruptions)
   - Background voices
   - Spatial audio positioning

## Conclusion

Meowstik's expressiveness system uses a **text-based style prefix approach** that works universally across TTS providers. While it lacks fine-grained SSML control, it provides:

✅ **Simple, intuitive interface**  
✅ **Provider-agnostic implementation**  
✅ **Natural language style control**  
✅ **Multi-speaker conversation support**  
✅ **Extensible to new providers**  

This approach balances ease of use with expressive capability, making it accessible to users while leveraging the natural language understanding of modern neural TTS models.
