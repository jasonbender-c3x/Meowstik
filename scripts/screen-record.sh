#!/usr/bin/env bash
#
# Helper functions and defaults for Meowstik's low-CPU screen recording workflow.
# Sources this script defines:
#   start_screen_recording <display> <output_dir> <log_dir>

detect_pulse_source() {
  local pattern="$1"
  if ! command -v pactl >/dev/null 2>&1; then
    return 1
  fi

  pactl list short sources 2>/dev/null | awk -v pat="$pattern" '$2 ~ pat {print $2; exit}'
}

start_screen_recording() {
  local display="${1:-:0.0}"
  local record_dir="${2:-/mnt/scrnrec}"
  local log_dir="${3:-/home/runner/logs}"
  local detected_size
  detected_size=$(xdpyinfo -display "${1:-:0}" 2>/dev/null | awk '/dimensions/{print $2}' | head -1)
  local video_size="${SCREEN_RECORD_VIDEO_SIZE:-${detected_size:-1920x1080}}"
  local frame_rate="${SCREEN_RECORD_FRAME_RATE:-1}"
  local preset="${SCREEN_RECORD_PRESET:-ultrafast}"
  local crf="${SCREEN_RECORD_CRF:-30}"
  local audio_bitrate="${SCREEN_RECORD_AUDIO_BITRATE:-64k}"

  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "⚠️  ffmpeg not found; skipping screen recording."
    return 1
  fi

  if ! xdpyinfo -display "$display" >/dev/null 2>&1; then
    echo "🎥 Display $display unavailable; skipping screen recording."
    return 0
  fi

  mkdir -p "$record_dir" "$log_dir"

  local system_audio_source=""
  local mic_audio_source=""

  if command -v pactl >/dev/null 2>&1; then
    system_audio_source="$(detect_pulse_source 'monitor' || true)"
    mic_audio_source="$(detect_pulse_source 'input' || true)"
  fi

  system_audio_source="${SCREEN_RECORD_SYSTEM_AUDIO_SOURCE:-$system_audio_source}"
  mic_audio_source="${SCREEN_RECORD_MIC_AUDIO_SOURCE:-$mic_audio_source}"

  local audio_sources=()
  if [ -n "$system_audio_source" ]; then
    audio_sources+=("$system_audio_source")
  fi
  if [ -n "$mic_audio_source" ] && [ "$mic_audio_source" != "$system_audio_source" ]; then
    audio_sources+=("$mic_audio_source")
  fi

  local timestamp
  timestamp="$(date +%Y%m%d_%H%M%S)"
  local destination="${record_dir}/meowstik_recording_${timestamp}.mp4"
  local ffmpeg_log="${log_dir}/screen-record_${timestamp}.log"

  local ffmpeg_args=(
    -hide_banner
    -loglevel info
    -f x11grab
    -video_size "$video_size"
    -framerate "$frame_rate"
    -i "$display"
  )

  local audio_count=0
  for src in "${audio_sources[@]}"; do
    ffmpeg_args+=(-f pulse -ac 1 -ar 16000 -i "$src")
    audio_count=$((audio_count + 1))
  done

  local map_args=(-map 0:v)
  if [ "$audio_count" -eq 2 ]; then
    ffmpeg_args+=(-filter_complex "[1:a][2:a]amix=inputs=2:dropout_transition=0[aout]")
    map_args+=(-map "[aout]")
  elif [ "$audio_count" -eq 1 ]; then
    map_args+=(-map 1:a)
  fi

  ffmpeg_args+=("${map_args[@]}")
  ffmpeg_args+=(
    -c:v libx264
    -preset "$preset"
    -crf "$crf"
    -tune zerolatency
    -pix_fmt yuv420p
    -movflags +faststart
  )

  if [ "$audio_count" -gt 0 ]; then
    ffmpeg_args+=(
      -c:a aac
      -b:a "$audio_bitrate"
      -ar 16000
      -ac 1
    )
  else
    ffmpeg_args+=(-an)
  fi

  ffmpeg_args+=(-y "$destination")

  echo "🎥 Starting low-CPU screen capture ($video_size @ ${frame_rate}fps) → $destination"
  if [ "${#audio_sources[@]}" -gt 0 ]; then
    echo "🎧 Audio inputs: ${audio_sources[*]}"
  else
    echo "🔇 No audio inputs detected."
  fi
  echo "🔍 ffmpeg log: $ffmpeg_log"

  nohup ffmpeg "${ffmpeg_args[@]}" > "$ffmpeg_log" 2>&1 &
  local ffmpeg_pid=$!
  sleep 2
  if ps -p "$ffmpeg_pid" >/dev/null 2>&1; then
    echo "🎥 Recording PID $ffmpeg_pid"
  else
    echo "⚠️  ffmpeg failed to stay alive; see $ffmpeg_log"
  fi
}
