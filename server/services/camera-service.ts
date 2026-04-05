/**
 * camera-service.ts
 * Controls the HI3510-based PTZ IP camera at 192.168.0.5
 * Credentials: admin / (empty password)
 */

const CAM_IP = "192.168.0.5";
const CAM_USER = "admin";
const CAM_PASS = "";
const AUTH = "Basic " + Buffer.from(`${CAM_USER}:${CAM_PASS}`).toString("base64");

const BASE = `http://${CAM_IP}`;
const PTZ_URL = `${BASE}/cgi-bin/hi3510/ptzctrl.cgi`;
const SNAP_URL = `${BASE}/snapshot.jpg`;

async function camFetch(url: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: AUTH } });
}

export function getSnapshotUrl(): string {
  return SNAP_URL;
}

export async function takeSnapshot(): Promise<Buffer> {
  const res = await camFetch(`${SNAP_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`Snapshot failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function ptzMove(
  direction: string,
  speed: number = 5,
  durationMs: number = 500
): Promise<string> {
  const validDirections = ["up", "down", "left", "right", "leftup", "rightup", "leftdown", "rightdown", "zoomin", "zoomout"];
  if (!validDirections.includes(direction)) {
    throw new Error(`Invalid direction: ${direction}. Valid: ${validDirections.join(", ")}`);
  }

  const startUrl = `${PTZ_URL}?-step=0&-act=${direction}&-speed=${speed}`;
  const stopUrl = `${PTZ_URL}?-step=0&-act=stop`;

  await camFetch(startUrl);
  await new Promise(resolve => setTimeout(resolve, durationMs));
  await camFetch(stopUrl);

  return `Camera moved ${direction} at speed ${speed} for ${durationMs}ms`;
}

export async function ptzStop(): Promise<string> {
  await camFetch(`${PTZ_URL}?-step=0&-act=stop`);
  return "Camera stopped";
}

export function getCameraInfo(): object {
  return {
    ip: CAM_IP,
    chip: "HI3510",
    snapshot: SNAP_URL,
    ptz: true,
    resolution: "640x360",
    auth: "admin / (no password)",
    viewer: "/home/runner/Desktop/camera-live.html",
  };
}
