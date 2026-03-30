---
title: Screen Recording
description: Low-CPU screen recording helper and how it integrates with Meowstik's startup scripts.
---

# Screen recording

`meow.sh` and `meow-test.sh` now delegate their recording responsibilities to `scripts/screen-record.sh`, which reuses the low-CPU ffmpeg pipeline we validated at 1920×1200 and 960×600 with both system audio and microphone inputs.

## Key behaviors
- Video is captured with `libx264` at 1 fps (`SCREEN_RECORD_FRAME_RATE`, default `1`) to keep CPU usage under ~13 %.
- Output files land under `/mnt/scrnrec` by default (falling back to `/home/runner/logs` when the drive is absent). Use `MEOW_RECORD_DIR` to override.
- Audio sources are autodetected via `pactl`: monitors (`SCREEN_RECORD_SYSTEM_AUDIO_SOURCE`) and inputs (`SCREEN_RECORD_MIC_AUDIO_SOURCE`) are merged with `amix`, resampled to 16 kHz mono, and encoded with AAC.
- `screen-record.sh` writes per-run logs to `/home/runner/logs/screen-record_<timestamp>.log`.

## Configuration helpers
- `SCREEN_RECORD_VIDEO_SIZE` (default `1920x1200`)
- `SCREEN_RECORD_PRESET` / `SCREEN_RECORD_CRF` / `SCREEN_RECORD_AUDIO_BITRATE` control encoder quality
- `SCREEN_RECORD_SYSTEM_AUDIO_SOURCE` and `SCREEN_RECORD_MIC_AUDIO_SOURCE` override the PulseAudio device names when autodetection fails
- If you need a second output size (e.g., `960x600`), run the helper manually or wrap it with a script that sets `SCREEN_RECORD_VIDEO_SIZE`.

Example:
```bash
SCREEN_RECORD_FRAME_RATE=1 \
SCREEN_RECORD_VIDEO_SIZE=960x600 \
MEOW_RECORD_DIR=/mnt/scrnrec \
bash meow.sh
```

## Troubleshooting
- If ffmpeg refuses to start, inspect `/home/runner/logs/screen-record_<timestamp>.log`.
- Ensure `xdpyinfo` shows the display you expect (`:0` by default); otherwise, set `DISPLAY` before launching a recorder script.
- To inspect available PulseAudio sources run `pactl list short sources` and pass the name into the `SCREEN_RECORD_*_AUDIO_SOURCE` overrides.
