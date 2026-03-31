# TTS — Text-to-Speech

Meowstik uses **Google Cloud Text-to-Speech with Chirp3-HD** — Google's highest-quality neural voice generation as of 2025.

---

## Why Chirp3-HD

- **No SSML required** — voices understand natural language style cues in the text itself
- **No `effectsProfileId`** — Chirp3 HD voices don't use audio profile processing
- **Plain text input** — style is conveyed by `[style: tag]` markers or natural emotion words
- **High quality** — neural voices with natural prosody, pauses, and inflection
- **Free tier** — Google Cloud TTS: 1M characters/month free

---

## Default Voice

```
Kore — en-US-Chirp3-HD-Kore (Female · American · Natural)
```

To change the default, update `DEFAULT_TTS_VOICE` in `server/integrations/expressive-tts.ts`.

---

## Available Voices

All voices use the `en-US-Chirp3-HD-{Name}` endpoint.

| Name | Gender | Character | Use for |
|------|--------|-----------|---------|
| **Kore** *(default)* | Female | Natural, balanced | General responses |
| **Puck** | Male | Upbeat, American | Enthusiastic replies |
| **Charon** | Male | Informative, measured | Explanations, reports |
| **Fenrir** | Male | Excitable, energetic | Hype, alerts |
| **Aoede** | Female | Breezy, light | Casual conversation |
| **Leda** | Female | Youthful, bright | Friendly interaction |
| **Orus** | Male | Firm, authoritative | Serious topics |
| **Zephyr** | Female | Bright, clear | Notifications |
| **Schedar** | Female | Even, steady | Reading long content |
| **Sulafat** | Female | Warm, welcoming | Greetings, empathy |

---

## Expressive Voice Styles

The AI embeds style markers in its text responses. The TTS synthesis interprets these as natural speech style cues.

### Syntax

Two equivalent syntaxes:

```
[style: cheerful] I found the answer!
cheerfully: I found the answer!
```

```
[style: sad] Unfortunately, the file was deleted.
sadly: Unfortunately, the file was deleted.
```

### Available Styles

| Style tag | Pronunciation effect |
|-----------|---------------------|
| `[style: neutral]` | Clear, default delivery |
| `[style: cheerful]` | Upbeat, warm, happy |
| `[style: sad]` | Gentle, slower, subdued |
| `[style: tense]` | Clipped, urgent |
| `[style: surprised]` | Elevated pitch, brighter |
| `[style: angry]` | Stronger, more assertive |
| `[style: empathy]` | Soft, reassuring |

### Examples from the AI

```
[style: cheerful] I just deployed the fix — all tests passing! 🎉
[style: empathy] I'm sorry that happened. Let me help you recover the file.
[style: surprised] Wait — that endpoint returns a 200 even on auth failure?
[style: tense] Warning: this action will permanently delete 847 files.
```

---

## The `say` Tool

The AI can trigger voice output explicitly using the `say` tool:

```json
{
  "type": "say",
  "parameters": {
    "utterance": "cheerfully: Your deployment succeeded!",
    "voice": "Puck"
  }
}
```

- `utterance` — text to speak (can include style markers)
- `voice` — optional override (default: user's preferred voice or Kore)
- **Non-blocking** — speech generation happens concurrently with other operations
- **Non-terminating** — must call `end_turn` to finish the turn

---

## Voice Lab

The Voice Lab UI is available at `/voice-lab`.

**What it does:**
- Preview all 10 Chirp3-HD voices with a test phrase
- Listen in real time
- Set your preferred default voice
- Preference is saved to `user_branding.defaultVoice`

---

## Authentication for TTS

The TTS integration (`server/integrations/expressive-tts.ts`) supports two auth methods:

### Method 1: Service Account (Recommended)

Set `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON string) or `GOOGLE_APPLICATION_CREDENTIALS` (file path):

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
```

### Method 2: OAuth 2.0 Fallback

If no service account is configured, the system falls back to the user's Google OAuth tokens (requires `cloud-platform` scope). This works but may hit quota limits more easily.

---

## Soundboard

The AI can also trigger sound effects using the `soundboard` tool:

```json
{
  "type": "soundboard",
  "parameters": {
    "sound": "rimshot",
    "volume": 0.8
  }
}
```

Available sounds: `womp_womp`, `rimshot`, `fart`, `fart_long`, `airhorn`, `crickets`, `price_is_wrong`, `laugh_track`, `jingle`, `news_intro`, `alarm_clock`, `gentle_wake`, `pill_reminder`, `urgent_alarm`, `ding`, `success`, `error_buzz`, `level_up`, `incoming`, `traffic_alert`, `weather_beep`

---

## ElevenLabs Fallback

An optional ElevenLabs TTS integration exists at `server/integrations/elevenlabs-tts.ts`. It's not the primary TTS system but can be enabled by setting `TTS_PROVIDER=elevenlabs` and `ELEVENLABS_API_KEY`.
