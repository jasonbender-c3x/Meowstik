/**
 * =============================================================================
 * CHROMECAST SERVICE
 * =============================================================================
 * Wraps the `catt` CLI for casting media to Chromecast/Google Nest devices.
 * catt is installed at /home/runner/.local/bin/catt
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CATT_PATH = "/home/runner/.local/bin/catt";
const EXEC_OPTIONS = {
  env: { ...process.env, PATH: (process.env.PATH || "") + ":/home/runner/.local/bin" },
};

const DEFAULT_DEVICE = "Living Room TV";

interface DeviceInfo {
  ip: string;
  name: string;
  model: string;
}

let deviceCache: DeviceInfo[] = [];
let deviceCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function parseScanOutput(output: string): DeviceInfo[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      // Format: "192.168.0.14 - Living Room TV - Google Inc. Chromecast HD"
      const parts = line.split(" - ");
      if (parts.length >= 3) {
        return { ip: parts[0].trim(), name: parts[1].trim(), model: parts.slice(2).join(" - ").trim() };
      }
      if (parts.length === 2) {
        return { ip: parts[0].trim(), name: parts[1].trim(), model: "Unknown" };
      }
      return null;
    })
    .filter((d): d is DeviceInfo => d !== null);
}

export async function scanDevices(): Promise<DeviceInfo[]> {
  const { stdout } = await execAsync(`${CATT_PATH} scan`, EXEC_OPTIONS);
  const devices = parseScanOutput(stdout);
  deviceCache = devices;
  deviceCacheTime = Date.now();
  return devices;
}

export async function listDevices(): Promise<DeviceInfo[]> {
  if (deviceCache.length > 0 && Date.now() - deviceCacheTime < CACHE_TTL_MS) {
    return deviceCache;
  }
  return scanDevices();
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function castMedia(deviceName: string = DEFAULT_DEVICE, url: string): Promise<string> {
  const ytId = extractYouTubeId(url);
  if (ytId) {
    // Use pychromecast's native YouTube controller — bypasses yt-dlp/403 issues
    const fs = await import("fs/promises");
    const os = await import("os");
    const path = await import("path");
    const tmpFile = path.join(os.tmpdir(), `cast_yt_${Date.now()}.py`);
    const script = [
      "import pychromecast, time, sys",
      "from pychromecast.controllers.youtube import YouTubeController",
      `casts, browser = pychromecast.get_listed_chromecasts(friendly_names=["${deviceName}"])`,
      "if not casts:",
      '    print("ERROR: device not found", file=sys.stderr); browser.stop_discovery(); sys.exit(1)',
      "cast = casts[0]; cast.wait()",
      "yt = YouTubeController(); cast.register_handler(yt)",
      `yt.play_video("${ytId}")`,
      "time.sleep(2); browser.stop_discovery()",
      `print("Playing YouTube video ${ytId} on ${deviceName}")`,
    ].join("\n");
    await fs.writeFile(tmpFile, script);
    try {
      const { stdout, stderr } = await execAsync(`python3 "${tmpFile}"`, EXEC_OPTIONS);
      if (stderr && stderr.includes("ERROR")) throw new Error(stderr);
      return stdout.trim() || `Casting YouTube to ${deviceName}`;
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  }

  // Non-YouTube URL: use catt directly
  const { stdout, stderr } = await execAsync(
    `${CATT_PATH} -d "${deviceName}" cast "${url}"`,
    EXEC_OPTIONS
  );
  return (stdout + stderr).trim() || `Casting to ${deviceName}`;
}

export async function castTTS(deviceName: string = DEFAULT_DEVICE, audioUrl: string): Promise<string> {
  const { stdout, stderr } = await execAsync(
    `${CATT_PATH} -d "${deviceName}" cast "${audioUrl}"`,
    EXEC_OPTIONS
  );
  return (stdout + stderr).trim() || `Playing audio on ${deviceName}`;
}

export async function stopCast(deviceName: string = DEFAULT_DEVICE): Promise<string> {
  const { stdout, stderr } = await execAsync(
    `${CATT_PATH} -d "${deviceName}" stop`,
    EXEC_OPTIONS
  );
  return (stdout + stderr).trim() || `Stopped ${deviceName}`;
}

export async function setVolume(deviceName: string = DEFAULT_DEVICE, level: number): Promise<string> {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  const { stdout, stderr } = await execAsync(
    `${CATT_PATH} -d "${deviceName}" volume ${clamped}`,
    EXEC_OPTIONS
  );
  return (stdout + stderr).trim() || `Volume set to ${clamped} on ${deviceName}`;
}

export async function getStatus(deviceName: string = DEFAULT_DEVICE): Promise<string> {
  const { stdout, stderr } = await execAsync(
    `${CATT_PATH} -d "${deviceName}" status`,
    EXEC_OPTIONS
  );
  return (stdout + stderr).trim() || `Status: unknown`;
}

export async function pauseCast(deviceName: string = DEFAULT_DEVICE): Promise<string> {
  const { stdout, stderr } = await execAsync(
    `${CATT_PATH} -d "${deviceName}" pause`,
    EXEC_OPTIONS
  );
  return (stdout + stderr).trim() || `Paused ${deviceName}`;
}

export async function resumeCast(deviceName: string = DEFAULT_DEVICE): Promise<string> {
  const { stdout, stderr } = await execAsync(
    `${CATT_PATH} -d "${deviceName}" play`,
    EXEC_OPTIONS
  );
  return (stdout + stderr).trim() || `Resumed ${deviceName}`;
}
