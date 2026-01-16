# Live Mode: Real-time Voice-to-Voice Conversation

## Overview

Live Mode enables natural, real-time voice conversations with Meowstik using Google's Gemini Live API. Unlike traditional turn-based chat, Live Mode creates a seamless, fluid dialogue experience that feels like talking to a real person.

## 🎯 Key Features

### 1. Continuous Listening Mode
- **Always On**: No need to press a button each time you want to speak
- **Natural Flow**: Just speak whenever you want—the AI listens continuously
- **Smart Detection**: Voice Activity Detection (VAD) automatically identifies when you're speaking

### 2. Voice Activity Detection (VAD)
- **Volume-Based Detection**: Uses RMS (Root Mean Square) audio analysis
- **Configurable Sensitivity**: Adjust threshold (0.005-0.05) to match your environment
- **Smart Timing**: Configurable speech duration (300ms) and silence duration (800ms)
- **Visual Feedback**: See real-time indicators when you're detected as speaking

### 3. Cognitive Endpointing
- **Dual-Channel Processing**:
  - **Audio Stream**: High-quality 16kHz PCM audio for natural voice interaction
  - **Text Stream**: Instant speech-to-text transcription for faster AI comprehension
- **Faster Responses**: AI starts thinking as soon as it understands your intent
- **Interim Transcripts**: See what you're saying in real-time as you speak
- **Web Speech API**: Browser-native speech recognition for zero-latency transcription

### 4. Natural Interruption (Barge-in)
- **Smart Detection**: Automatically detects when you start speaking during AI response
- **Instant Stop**: AI immediately stops talking when interrupted
- **Clear Audio**: Stops all queued audio playback instantly
- **Visual Feedback**: "Interrupt" button appears during AI speech in continuous mode

### 5. Low-Latency Audio Processing
- **AudioWorklet**: Modern web audio API for minimal latency
- **16kHz Input / 24kHz Output**: Optimized sample rates for voice
- **Streaming PCM**: Direct PCM transmission without codec overhead
- **Real-time Playback**: Audio plays as it's generated (~100ms latency)

## 🎮 User Interface

### Connection States

| State | Badge Color | Description |
|-------|-------------|-------------|
| Disconnected | Gray | Not connected to Live API |
| Connecting | Yellow | Establishing WebSocket connection |
| Connected | Green (pulsing) | Active voice conversation session |
| Error | Red | Connection failure or error state |

### Visual Indicators

#### In Continuous Mode:
- 👂 **"Waiting for you to speak..."** - Microphone active, waiting for voice
- 🎤 **"Listening to you..."** - Voice detected, actively capturing speech
- 💬 **Interim Transcript (dashed border)** - Real-time transcription of your speech
- 🔵 **Speaking Animation** - Three bouncing dots indicate AI is responding

#### In Manual Mode:
- 🎙️ **Mic Button (outline)** - Click to start listening
- 🎙️ **Mic Button (filled, pulsing ring)** - Currently listening
- 🔴 **Disconnect Button** - End the conversation

### Settings Panel

Access via gear icon (⚙️) in the top-right corner. Available only when disconnected:

#### 1. AI Voice Selection
Choose from 8 high-quality voices:
- **Kore** - Clear Female
- **Puck** - Warm Male
- **Charon** - Deep Male
- **Fenrir** - Strong Male
- **Aoede** - Melodic Female
- **Leda** - Soft Female
- **Orus** - Authoritative Male
- **Zephyr** - Gentle Neutral

#### 2. Continuous Listening Toggle
- **ON** (default): Hands-free operation with automatic voice detection
- **OFF**: Traditional push-to-talk with manual mic button

#### 3. Voice Detection Sensitivity Slider
- **Range**: 0.005 (very sensitive) to 0.05 (less sensitive)
- **Default**: 0.015
- **Lower values**: Pick up quieter speech, but may trigger on background noise
- **Higher values**: Require louder speech, better for noisy environments

#### 4. Speech-to-Text (Cognitive Endpointing) Toggle
- **ON** (default): Enables interim transcripts and faster AI responses
- **OFF**: Audio-only processing (slightly slower but works in all browsers)
- **Browser Compatibility**: Shows warning if Web Speech API is unavailable

## 🔧 Technical Architecture

### Frontend (client/src/pages/live.tsx)

```
┌─────────────────────────────────────────────────────────────┐
│                     Live Mode Frontend                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐      ┌──────────────────┐             │
│  │  Microphone     │──────│  AudioWorklet    │             │
│  │  (getUserMedia) │      │  (audio-processor│             │
│  └─────────────────┘      │   .js)           │             │
│         │                  └──────────────────┘             │
│         │                           │                        │
│         │                           ▼                        │
│         │                  ┌──────────────────┐             │
│         │                  │  PCM → Base64    │             │
│         │                  │  Encoding        │             │
│         │                  └──────────────────┘             │
│         │                           │                        │
│         ▼                           ▼                        │
│  ┌─────────────────┐      ┌──────────────────┐             │
│  │  VAD (Volume    │      │  WebSocket       │             │
│  │  Detection)     │──────│  (Audio Stream)  │             │
│  └─────────────────┘      └──────────────────┘             │
│         │                           │                        │
│         ▼                           │                        │
│  ┌─────────────────┐               │                        │
│  │  Speech         │──────────┐    │                        │
│  │  Recognition    │          │    │                        │
│  │  (Web Speech)   │          │    │                        │
│  └─────────────────┘          │    │                        │
│         │                     │    │                        │
│         ▼                     ▼    ▼                        │
│  ┌────────────────────────────────────────┐                │
│  │  WebSocket (Text Stream)               │                │
│  └────────────────────────────────────────┘                │
│                     │                                        │
│                     ▼                                        │
│         ┌──────────────────────┐                            │
│         │ Gemini Live API      │                            │
│         │ (Server WebSocket)   │                            │
│         └──────────────────────┘                            │
│                     │                                        │
│                     ▼                                        │
│         ┌──────────────────────┐                            │
│         │ Audio Response       │                            │
│         │ (Base64 PCM)         │                            │
│         └──────────────────────┘                            │
│                     │                                        │
│                     ▼                                        │
│         ┌──────────────────────┐                            │
│         │ AudioContext         │                            │
│         │ (24kHz Playback)     │                            │
│         └──────────────────────┘                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Backend (server/)

#### WebSocket Handler (server/websocket-live.ts)
- Handles WebSocket upgrade for `/api/live/stream/:sessionId`
- Routes messages between client and Gemini Live API
- Supports message types:
  - `audio`: PCM audio chunks from client
  - `text`: Text messages from client (cognitive endpointing)
  - `interrupt`: Barge-in requests
  - `persona`: System instruction updates

#### Gemini Live Integration (server/integrations/gemini-live.ts)
- Creates and manages Live API sessions
- Configures voice, modality, and system instructions
- Streams audio and text bidirectionally
- Handles interrupts and function calls

#### API Routes (server/routes/live.ts)
- `POST /api/live/session`: Create new Live session
- `DELETE /api/live/session/:id`: Close Live session
- `GET /api/live/voices`: List available voices

### Custom Hooks

#### useVoiceActivityDetection (client/src/hooks/use-voice-activity-detection.ts)
```typescript
interface VADConfig {
  threshold: number;        // Minimum volume (0-1)
  silenceDuration: number;  // ms of silence to end speech
  speechDuration: number;   // ms of speech to start
  sampleRate: number;       // Audio sample rate
}

const vad = useVoiceActivityDetection(
  onSpeechStart: () => void,
  onSpeechEnd: () => void,
  onVolumeChange: (volume: number) => void,
  config: VADConfig
);

// Returns:
// - isSpeaking: boolean
// - volume: number (0-1)
// - start/stop: () => Promise<void>
// - updateConfig: (config) => void
```

#### useSpeechRecognition (client/src/hooks/use-speech-recognition.ts)
```typescript
const speechRecognition = useSpeechRecognition(
  onResult: (result: { isFinal, transcript, confidence }) => void,
  onEnd: () => void,
  config: {
    language: 'en-US',
    interimResults: true,
    continuous: true
  }
);

// Returns:
// - isListening: boolean
// - transcript: string
// - isFinal: boolean
// - start/stop: () => void
// - isSupported: boolean
// - error: string | null
```

## 🚀 Usage Guide

### Quick Start

1. **Navigate to Live Mode**: Click the "Live Voice" link from the home page
2. **Configure Settings**: (Optional) Adjust voice, sensitivity, and continuous mode
3. **Connect**: Click the phone button (📞) to start a session
4. **Talk Naturally**: If in continuous mode, just start speaking!

### Best Practices

#### Environment Setup
- **Quiet Environment**: Works best with minimal background noise
- **Good Microphone**: Use a quality headset or microphone for best results
- **Adjust Sensitivity**: If VAD triggers too often, increase the threshold slider

#### Conversation Tips
- **Speak Clearly**: Natural pace, clear pronunciation
- **Brief Pauses**: VAD uses silence to detect sentence boundaries
- **Interrupt Anytime**: Don't wait for AI to finish—interrupt naturally!
- **Use Visual Feedback**: Watch for 🎤 indicator to confirm you're being heard

### Troubleshooting

| Issue | Solution |
|-------|----------|
| **VAD not detecting speech** | Lower the sensitivity slider (move left) |
| **VAD triggering on background noise** | Raise the sensitivity slider (move right) |
| **No interim transcripts** | Enable STT in settings, check browser compatibility |
| **Choppy audio playback** | Check network connection, try refreshing the page |
| **Microphone not working** | Grant microphone permissions in browser settings |
| **Speech recognition error** | Only supported in Chrome, Edge, Safari (check browser) |

## 🌐 Browser Compatibility

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Audio Streaming (WebSocket) | ✅ | ✅ | ✅ | ✅ |
| AudioWorklet | ✅ | ✅ | ✅ | ✅ |
| Web Speech API (STT) | ✅ | ✅ | ✅ | ❌ |
| Voice Activity Detection | ✅ | ✅ | ✅ | ✅ |

**Note**: Firefox doesn't support Web Speech API, so cognitive endpointing will be disabled. Audio-only mode will still work perfectly.

## 🔒 Privacy & Security

- **Local Processing**: VAD runs entirely in your browser
- **Encrypted Connection**: WebSocket uses WSS (WebSocket Secure) in production
- **No Recording**: Audio is streamed in real-time, not recorded or stored
- **Session Based**: Each conversation is ephemeral and deleted when you disconnect

## 📊 Performance Metrics

### Expected Latency
- **VAD Detection**: < 100ms
- **Speech Recognition**: < 200ms (interim), < 500ms (final)
- **Audio Transmission**: < 50ms
- **AI Processing**: 200-1000ms (depends on Gemini API)
- **Audio Playback Start**: < 100ms
- **Total End-to-End**: ~500-1500ms from speech end to AI response start

### Bandwidth Usage
- **Audio Upload**: ~32 KB/s (16kHz mono PCM)
- **Audio Download**: ~48 KB/s (24kHz mono PCM)
- **Text Messages**: < 1 KB/s
- **Total**: ~80 KB/s bidirectional during active conversation

## 🔮 Future Enhancements

- [ ] Multi-language support (auto-detect language)
- [ ] Conversation history/replay
- [ ] Voice cloning for personalized AI responses
- [ ] Background noise cancellation
- [ ] Echo cancellation improvements
- [ ] Offline mode with local STT
- [ ] Emotion detection from voice tone
- [ ] Multi-participant conversations

## 📚 API Reference

### WebSocket Message Types

#### Client → Server

```typescript
// Audio chunk
{
  type: "audio",
  data: string,        // Base64-encoded PCM
  mimeType: "audio/pcm"
}

// Text message (cognitive endpointing)
{
  type: "text",
  text: string
}

// Interrupt AI speech
{
  type: "interrupt"
}

// Update AI personality
{
  type: "persona",
  systemInstruction: string
}
```

#### Server → Client

```typescript
// Audio response chunk
{
  type: "audio",
  data: string         // Base64-encoded PCM
}

// Final transcript
{
  type: "transcript",
  text: string
}

// Interim AI thinking (unused currently)
{
  type: "text",
  text: string
}

// Response complete
{
  type: "end"
}

// Error occurred
{
  type: "error",
  error: string
}
```

## 🤝 Contributing

Want to improve Live Mode? Here are some areas that need work:

1. **Better VAD Algorithm**: Current RMS-based VAD could be improved with ML-based detection
2. **Echo Cancellation**: Prevent AI voice from triggering VAD
3. **Multi-language**: Support automatic language detection
4. **Offline STT**: Add fallback for browsers without Web Speech API
5. **Performance Optimization**: Reduce latency further

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

**Last Updated**: 2026-01-15  
**Version**: 1.0.0  
**Maintainer**: Meowstik Development Team
