#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="/tmp/meowstik-cloudflared.log"
PID_FILE="/tmp/meowstik-cloudflared.pid"
PORT="${PORT:-5000}"

cd "$ROOT_DIR"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${EXISTING_PID:-}" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    kill "$EXISTING_PID"
    sleep 2
  fi
  rm -f "$PID_FILE"
fi

rm -f "$LOG_FILE"
nohup cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${PORT}" >"$LOG_FILE" 2>&1 &
TUNNEL_PID=$!
echo "$TUNNEL_PID" > "$PID_FILE"

TUNNEL_URL=""
for _ in $(seq 1 30); do
  if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "cloudflared exited unexpectedly"
    cat "$LOG_FILE" || true
    exit 1
  fi

  if [[ -f "$LOG_FILE" ]]; then
    TUNNEL_URL="$(grep -oE 'https://[[:alnum:]-]+\.trycloudflare\.com' "$LOG_FILE" | head -n 1 || true)"
    if [[ -n "$TUNNEL_URL" ]]; then
      break
    fi
  fi

  sleep 1
done

if [[ -z "$TUNNEL_URL" ]]; then
  echo "Failed to determine tunnel URL"
  cat "$LOG_FILE" || true
  exit 1
fi

set -a
. ./.env
set +a

node - <<'NODE' "$TUNNEL_URL"
const base = process.argv[2];
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !phoneNumber) {
  throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must be set");
}

const client = twilio(accountSid, authToken);

(async () => {
  const [number] = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
  if (!number) {
    throw new Error(`No Twilio incoming phone number found for ${phoneNumber}`);
  }

  const updated = await client.incomingPhoneNumbers(number.sid).update({
    voiceUrl: `${base}/api/twilio/voice`,
    voiceMethod: "POST",
    voiceFallbackUrl: `${base}/api/twilio/voice`,
    voiceFallbackMethod: "POST",
    statusCallback: `${base}/api/twilio/status`,
    statusCallbackMethod: "POST",
    smsUrl: `${base}/api/twilio/sms`,
    smsMethod: "POST",
  });

  console.log(JSON.stringify({
    tunnelUrl: base,
    phoneSid: updated.sid,
    voiceUrl: updated.voiceUrl,
    statusCallback: updated.statusCallback,
    smsUrl: updated.smsUrl,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
