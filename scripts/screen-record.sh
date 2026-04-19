#!/usr/bin/env bash
#
# Helper functions and defaults for Meowstik's low-CPU screen recording workflow.
# Sources this script defines:
#   start_screen_recording <display> <output_dir> <log_dir>
#
# Safety limits (override via env vars):
#   SCREEN_RECORD_MAX_SIZE_MB   — max file size in MB before ffmpeg stops (default: 2048 = 2GB)
#   SCREEN_RECORD_MAX_DURATION  — max recording duration in seconds (default: 7200 = 2h)
#   SCREEN_RECORD_MIN_FREE_MB   — minimum free disk space required to start (default: 3072 = 3GB)
#   SCREEN_RECORD_PID_FILE      — path to PID file (default: /tmp/meowstik-ffmpeg.pid)
#   SCREEN_RECORD_DISABLE_SYSTEM_AUDIO=1 — skip monitor capture
#   SCREEN_RECORD_DISABLE_MIC=1          — skip microphone capture

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
  local max_size_mb="${SCREEN_RECORD_MAX_SIZE_MB:-2048}"
  local max_duration="${SCREEN_RECORD_MAX_DURATION:-7200}"
  local min_free_mb="${SCREEN_RECORD_MIN_FREE_MB:-3072}"
  local pid_file="${SCREEN_RECORD_PID_FILE:-/tmp/meowstik-ffmpeg.pid}"
  local disable_system_audio="${SCREEN_RECORD_DISABLE_SYSTEM_AUDIO:-0}"
  local disable_mic_audio="${SCREEN_RECORD_DISABLE_MIC:-0}"

  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "⚠️  ffmpeg not found; skipping screen recording."
    return 1
  fi

  if ! xdpyinfo -display "$display" >/dev/null 2>&1; then
    echo "🎥 Display $display unavailable; skipping screen recording."
    return 0
  fi

  # Guard: prevent duplicate recording instances
  if [ -f "$pid_file" ]; then
    local existing_pid
    existing_pid=$(cat "$pid_file" 2>/dev/null)
    if [ -n "$existing_pid" ] && ps -p "$existing_pid" >/dev/null 2>&1; then
      echo "🎥 Recording already running (PID $existing_pid); skipping."
      return 0
    fi
    rm -f "$pid_file"
  fi

  mkdir -p "$record_dir" "$log_dir"

  # Guard: check free disk space before starting
  local free_mb
  free_mb=$(df -m "$record_dir" 2>/dev/null | awk 'NR==2{print $4}')
  if [ -n "$free_mb" ] && [ "$free_mb" -lt "$min_free_mb" ]; then
    echo "⚠️  Insufficient disk space on $record_dir (${free_mb}MB free, need ${min_free_mb}MB); skipping recording."
    return 1
  fi

  local system_audio_source=""
  local mic_audio_source=""

  if command -v pactl >/dev/null 2>&1; then
    system_audio_source="$(detect_pulse_source 'monitor' || true)"
    mic_audio_source="$(detect_pulse_source 'input' || true)"
  fi

  if [ "$disable_system_audio" = "1" ]; then
    system_audio_source=""
  fi
  if [ "$disable_mic_audio" = "1" ]; then
    mic_audio_source=""
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

  # Apply safety limits: max duration and max file size
  ffmpeg_args+=(-t "$max_duration")
  ffmpeg_args+=(-fs "$((max_size_mb * 1024 * 1024))")

  ffmpeg_args+=(-y "$destination")

  echo "🎥 Starting low-CPU screen capture ($video_size @ ${frame_rate}fps) → $destination"
  echo "🛡️  Limits: max ${max_duration}s duration, max ${max_size_mb}MB file size, min ${min_free_mb}MB free required"
  if [ "${#audio_sources[@]}" -gt 0 ]; then
    echo "🎧 Audio inputs: ${audio_sources[*]}"
  else
    echo "🔇 No audio inputs detected."
  fi
  echo "🔍 ffmpeg log: $ffmpeg_log"

  nohup ffmpeg "${ffmpeg_args[@]}" > "$ffmpeg_log" 2>&1 &
  local ffmpeg_pid=$!
  echo "$ffmpeg_pid" > "$pid_file"
  sleep 2
  if ps -p "$ffmpeg_pid" >/dev/null 2>&1; then
    echo "🎥 Recording PID $ffmpeg_pid (pid file: $pid_file)"
  else
    rm -f "$pid_file"
    echo "⚠️  ffmpeg failed to stay alive; see $ffmpeg_log"
  fi
}

stop_screen_recording() {
  local pid_file="${SCREEN_RECORD_PID_FILE:-/tmp/meowstik-ffmpeg.pid}"
  if [ ! -f "$pid_file" ]; then
    echo "🎥 No active recording found (no PID file at $pid_file)."
    return 0
  fi
  local pid
  pid=$(cat "$pid_file" 2>/dev/null)
  if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
    kill "$pid" && echo "🛑 Recording stopped (PID $pid)."
  else
    echo "🎥 Recording process not running."
  fi
  rm -f "$pid_file"
}
