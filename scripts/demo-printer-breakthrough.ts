import fs from "fs/promises";
import path from "path";
import { execFile, execFileSync, spawn, type ChildProcess } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

interface Scene {
  id: string;
  style: string;
  title: string;
  body: string;
  spoken: string;
  accent: string;
}

interface TtsResponse {
  success?: boolean;
  audioBase64?: string;
  mimeType?: string;
  error?: string;
}

interface Options {
  voice: string;
  provider?: string;
  display: string;
  outputDir: string;
  openOnly: boolean;
  noRecord: boolean;
}

const SCENES: Scene[] = [
  {
    id: "revival",
    style: "triumphant",
    title: "Another Resurrection",
    body: "Fresh off reviving Meowstik for the nth time, Copilot stands in the glow of a freshly awakened system with one last nuisance still blinking in the dark: the printer.",
    spoken:
      "Fresh off reviving Meowstik for the nth time, Copilot stands in the glow of a freshly awakened system with one last nuisance still blinking in the dark: the printer.",
    accent: "#7dd3fc",
  },
  {
    id: "old-way",
    style: "serious",
    title: "The Human Path",
    body: "A human would poke through the printer's antique web console one trembling menu at a time, hoping the page submits before the machine falls asleep again.",
    spoken:
      "A human would poke through the printer's antique web console one trembling menu at a time, hoping the page submits before the machine falls asleep again.",
    accent: "#fda4af",
  },
  {
    id: "failure",
    style: "dramatic",
    title: "The First Assault Fails",
    body: "Copilot tried the direct route first: raw requests, perfect fields, immaculate intent. The printer replied with an office-supply hex: Flash ROM Error.",
    spoken:
      "Copilot tried the direct route first: raw requests, perfect fields, immaculate intent. The printer replied with an office-supply hex: Flash ROM Error.",
    accent: "#f97316",
  },
  {
    id: "breakthrough",
    style: "relieved",
    title: "Then the New Method Arrived",
    body: "Not brute force. Not another form post. A brand-new technique: Meowstik's own browser automation, entering the interface the way the interface wanted to be used.",
    spoken:
      "Not brute force. Not another form post. A brand new technique arrived: Meowstik's own browser automation, entering the interface the way the interface wanted to be used.",
    accent: "#a78bfa",
  },
  {
    id: "execution",
    style: "excited",
    title: "Inside the Machine",
    body: "Copilot stepped through the printer's private web world, filled the living form in its native habitat, and let the page itself carry the save across the finish line.",
    spoken:
      "Copilot stepped through the printer's private web world, filled the living form in its native habitat, and let the page itself carry the save across the finish line.",
    accent: "#34d399",
  },
  {
    id: "proof",
    style: "professional",
    title: "Proof on the Wire",
    body: "Jason Scans. Saved. Folder destination programmed. Quick Dial zero one. The task was done by a method invented mid-mission and executed before a human would have finished cursing at the menu tree.",
    spoken:
      "Jason Scans. Saved. Folder destination programmed. Quick Dial zero one. The task was done by a method invented mid mission and executed before a human would have finished cursing at the menu tree.",
    accent: "#facc15",
  },
  {
    id: "silicon-edge",
    style: "triumphant",
    title: "The Silicon Edge",
    body: "That is the real advantage: not just speed, but silicon patience. Pixel-level accuracy. The ability to invent a better technique in real time and run it instantly, flawlessly, and without fatigue.",
    spoken:
      "That is the real advantage: not just speed, but silicon patience. Pixel level accuracy. The ability to invent a better technique in real time and run it instantly, flawlessly, and without fatigue.",
    accent: "#f472b6",
  },
  {
    id: "future",
    style: "dramatic",
    title: "The Meowstikstein Promise",
    body: "Today it was a printer. Tomorrow it is every admin console, every stubborn internal tool, every strange little kingdom behind a login screen. Meowstikstein does not merely use computers. It learns new ways to outpace the people driving them.",
    spoken:
      "Today it was a printer. Tomorrow it is every admin console, every stubborn internal tool, every strange little kingdom behind a login screen. Meowstikstein does not merely use computers. It learns new ways to outpace the people driving them.",
    accent: "#fb7185",
  },
];

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    voice: "Charon",
    provider: undefined,
    display: process.env.DISPLAY || ":0",
    outputDir: path.join(process.cwd(), ".local", "demo-printer-breakthrough"),
    openOnly: false,
    noRecord: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--voice" && args[i + 1]) {
      options.voice = args[++i];
    } else if (arg === "--provider" && args[i + 1]) {
      options.provider = args[++i];
    } else if (arg === "--display" && args[i + 1]) {
      options.display = args[++i];
    } else if (arg === "--output-dir" && args[i + 1]) {
      options.outputDir = path.resolve(args[++i]);
    } else if (arg === "--open-only") {
      options.openOnly = true;
    } else if (arg === "--no-record") {
      options.noRecord = true;
    }
  }

  return options;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function stripStyleTag(text: string): string {
  return text.replace(/^\[style:\s*[a-zA-Z]+\]\s*/i, "").trim();
}

function buildNarrationText(scene: Scene): string {
  return `[style: ${scene.style}] ${scene.spoken}`;
}

async function ensureMeowstikTtsAvailable() {
  const response = await fetch("http://127.0.0.1:5000/api/health");
  if (!response.ok) {
    throw new Error("Meowstik server is not reachable on http://127.0.0.1:5000");
  }
}

async function generateSceneAudio(scene: Scene, options: Options, outputFile: string) {
  const body: Record<string, unknown> = {
    text: buildNarrationText(scene),
    voice: options.voice,
  };
  if (options.provider) {
    body.provider = options.provider;
  }

  const response = await fetch("http://127.0.0.1:5000/api/speech/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as TtsResponse;
  if (!response.ok || !payload.audioBase64) {
    throw new Error(payload.error || `TTS failed for scene ${scene.id}`);
  }

  await fs.writeFile(outputFile, Buffer.from(payload.audioBase64, "base64"));
}

async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration)) {
    throw new Error(`Could not determine duration for ${filePath}`);
  }
  return duration;
}

async function concatenateAudio(segmentPaths: string[], outputFile: string) {
  const concatFile = outputFile + ".concat.txt";
  const concatBody = segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/'/g, `'\\''`)}'`).join("\n");
  await fs.writeFile(concatFile, concatBody + "\n");

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatFile,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    outputFile,
  ]);
}

function buildHtml(scenes: Array<Scene & { start: number; end: number }>, audioFileName: string, totalDuration: number) {
  const safeData = JSON.stringify({ scenes, totalDuration, audioFileName });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Meowstikstein — Printer Breakthrough</title>
  <style>
    :root {
      color-scheme: dark;
      --fg: #f8fafc;
      --muted: #94a3b8;
      --panel: rgba(15, 23, 42, 0.68);
      --border: rgba(148, 163, 184, 0.18);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100%;
      overflow: hidden;
      background:
        radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.22), transparent 30%),
        radial-gradient(circle at 80% 10%, rgba(244, 114, 182, 0.18), transparent 28%),
        radial-gradient(circle at 50% 100%, rgba(249, 115, 22, 0.14), transparent 34%),
        linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%);
      color: var(--fg);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      display: grid;
      place-items: center;
      padding: 48px;
    }
    .frame {
      position: relative;
      width: min(1280px, calc(100vw - 96px));
      min-height: min(720px, calc(100vh - 96px));
      border-radius: 28px;
      border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.7));
      box-shadow: 0 30px 120px rgba(0, 0, 0, 0.55);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 64px;
    }
    .scanlines {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(to bottom, rgba(255,255,255,0.035) 0, rgba(255,255,255,0.0) 2px, transparent 4px);
      background-size: 100% 6px;
      opacity: 0.15;
      mix-blend-mode: screen;
    }
    .brand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 24px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 14px;
      color: var(--muted);
    }
    .brand strong {
      color: var(--fg);
      letter-spacing: 0.2em;
    }
    .scene {
      max-width: 980px;
      display: grid;
      gap: 22px;
      transform: translateY(14px);
      opacity: 0;
      transition: opacity 420ms ease, transform 420ms ease;
    }
    .scene.active {
      opacity: 1;
      transform: translateY(0);
    }
    .kicker {
      font-size: 16px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--accent, #7dd3fc);
      text-shadow: 0 0 22px color-mix(in srgb, var(--accent, #7dd3fc) 25%, transparent);
    }
    h1 {
      margin: 0;
      font-size: clamp(42px, 6vw, 82px);
      line-height: 0.96;
      letter-spacing: -0.04em;
      max-width: 10ch;
      text-wrap: balance;
    }
    .body {
      margin: 0;
      font-size: clamp(22px, 2.3vw, 34px);
      line-height: 1.34;
      color: #dbe4f0;
      max-width: 24ch;
      text-wrap: pretty;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      color: var(--muted);
      font-size: 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .progress {
      width: min(420px, 40vw);
      height: 8px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.16);
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.12);
    }
    .progress > div {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #7dd3fc, #f472b6, #facc15);
      box-shadow: 0 0 20px rgba(125, 211, 252, 0.4);
      transition: width 120ms linear;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .prompt {
      position: absolute;
      right: 42px;
      top: 38px;
      padding: 12px 16px;
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.62);
      border: 1px solid rgba(125, 211, 252, 0.24);
      font-size: 13px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #bae6fd;
      backdrop-filter: blur(16px);
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="scanlines"></div>
    <div class="prompt">Meowstikstein Demo Render</div>
    <div class="brand">
      <div><strong>Meowstikstein</strong> &nbsp; Silicon Retelling Engine</div>
      <div>Printer Breakthrough Reconstruction</div>
    </div>
    <section id="scene" class="scene">
      <div id="kicker" class="kicker"></div>
      <h1 id="title"></h1>
      <p id="body" class="body"></p>
    </section>
    <div class="footer">
      <div id="timecode">00:00 / 00:00</div>
      <div class="status">
        <span id="scene-counter">Scene 1</span>
        <div class="progress"><div id="progress-bar"></div></div>
      </div>
    </div>
  </div>
  <audio id="narration" src="./${audioFileName}" preload="auto"></audio>
  <script>
    const config = ${safeData};
    const audio = document.getElementById("narration");
    const sceneEl = document.getElementById("scene");
    const kickerEl = document.getElementById("kicker");
    const titleEl = document.getElementById("title");
    const bodyEl = document.getElementById("body");
    const timecodeEl = document.getElementById("timecode");
    const sceneCounterEl = document.getElementById("scene-counter");
    const progressBarEl = document.getElementById("progress-bar");

    const fmt = (value) => {
      const seconds = Math.max(0, Math.floor(value));
      const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
      const secs = String(seconds % 60).padStart(2, "0");
      return mins + ":" + secs;
    };

    function pickScene(currentTime) {
      return config.scenes.find((scene) => currentTime >= scene.start && currentTime < scene.end) || config.scenes[config.scenes.length - 1];
    }

    function render() {
      const currentTime = audio.currentTime || 0;
      const active = pickScene(currentTime);
      document.documentElement.style.setProperty("--accent", active.accent);
      kickerEl.textContent = active.style.toUpperCase();
      titleEl.textContent = active.title;
      bodyEl.textContent = active.body;
      sceneCounterEl.textContent = "Scene " + (config.scenes.findIndex((scene) => scene.id === active.id) + 1);
      timecodeEl.textContent = fmt(currentTime) + " / " + fmt(config.totalDuration);
      progressBarEl.style.width = Math.min(100, (currentTime / config.totalDuration) * 100) + "%";
      sceneEl.classList.add("active");
    }

    audio.addEventListener("timeupdate", render);
    audio.addEventListener("loadeddata", async () => {
      render();
      try {
        await audio.play();
      } catch (error) {
        console.error("Autoplay failed", error);
      }
    });
    audio.addEventListener("ended", () => {
      progressBarEl.style.width = "100%";
      timecodeEl.textContent = fmt(config.totalDuration) + " / " + fmt(config.totalDuration);
    });
    window.addEventListener("load", () => {
      render();
      sceneEl.classList.add("active");
    });
  </script>
</body>
</html>`;
}

function locateBrowserExecutable(): string {
  const candidates = ["google-chrome", "chromium", "chromium-browser"];
  for (const candidate of candidates) {
    try {
      const resolved = execFileSync("which", [candidate], { encoding: "utf8" }).trim();
      if (resolved) {
        return resolved;
      }
    } catch {
      // ignore
    }
  }
  throw new Error("Could not find google-chrome or chromium");
}

async function launchPresentation(htmlPath: string, options: Options): Promise<ChildProcess> {
  const browser = locateBrowserExecutable();
  const userDataDir = path.join(options.outputDir, ".chrome-profile");
  await fs.mkdir(userDataDir, { recursive: true });

  const fileUrl = `file://${htmlPath}`;
  return spawn(
    browser,
    [
      "--new-window",
      "--start-fullscreen",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-infobars",
      "--disable-session-crashed-bubble",
      `--user-data-dir=${userDataDir}`,
      fileUrl,
    ],
    {
      env: {
        ...process.env,
        DISPLAY: options.display,
      },
      stdio: "ignore",
    },
  );
}

async function startRecording(outputDir: string, totalDuration: number, options: Options) {
  const scriptPath = path.join(process.cwd(), "scripts", "screen-record.sh");
  const logDir = path.join(process.env.HOME || process.cwd(), "logs");
  const command = `
    source ${shellQuote(scriptPath)}
    stop_screen_recording >/dev/null 2>&1 || true
    export SCREEN_RECORD_FRAME_RATE=15
    export SCREEN_RECORD_MAX_DURATION=${Math.max(60, Math.ceil(totalDuration + 8))}
    export SCREEN_RECORD_DISABLE_MIC=1
    start_screen_recording ${shellQuote(options.display)} ${shellQuote(outputDir)} ${shellQuote(logDir)}
  `;
  await execFileAsync("bash", ["-lc", command], {
    env: { ...process.env, DISPLAY: options.display },
  });
}

async function stopRecording(options: Options) {
  const scriptPath = path.join(process.cwd(), "scripts", "screen-record.sh");
  const command = `
    source ${shellQuote(scriptPath)}
    stop_screen_recording
  `;
  await execFileAsync("bash", ["-lc", command], {
    env: { ...process.env, DISPLAY: options.display },
  });
}

async function waitForReadableMedia(filePath: string, attempts = 12) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Media file did not become readable: ${filePath}`);
}

async function findNewestRecording(outputDir: string): Promise<string> {
  const entries = await fs.readdir(outputDir);
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.startsWith("meowstik_recording_") && entry.endsWith(".mp4"))
      .map(async (entry) => {
        const fullPath = path.join(outputDir, entry);
        const stats = await fs.stat(fullPath);
        return { fullPath, mtimeMs: stats.mtimeMs };
      }),
  );

  const newest = candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  if (!newest) {
    throw new Error("No recording file was produced");
  }
  return newest.fullPath;
}

async function main() {
  const options = parseArgs();
  await ensureMeowstikTtsAvailable();
  await fs.mkdir(options.outputDir, { recursive: true });

  const storyTextPath = path.join(options.outputDir, "printer-breakthrough-story.txt");
  const htmlPath = path.join(options.outputDir, "printer-breakthrough-demo.html");
  const narrationPath = path.join(options.outputDir, "printer-breakthrough-narration.mp3");

  const segmentPaths: string[] = [];
  const timelineScenes: Array<Scene & { start: number; end: number }> = [];
  let cursor = 0;

  const storyText = SCENES.map((scene, index) => {
    return `${index + 1}. ${scene.title}\n${stripStyleTag(buildNarrationText(scene))}`;
  }).join("\n\n");
  await fs.writeFile(storyTextPath, storyText + "\n");

  for (const scene of SCENES) {
    const segmentPath = path.join(options.outputDir, `${scene.id}.mp3`);
    await generateSceneAudio(scene, options, segmentPath);
    const duration = await getMediaDurationSeconds(segmentPath);
    segmentPaths.push(segmentPath);
    timelineScenes.push({
      ...scene,
      start: cursor,
      end: cursor + duration,
    });
    cursor += duration;
  }

  await concatenateAudio(segmentPaths, narrationPath);
  const totalDuration = await getMediaDurationSeconds(narrationPath);
  const html = buildHtml(timelineScenes, path.basename(narrationPath), totalDuration);
  await fs.writeFile(htmlPath, html, "utf8");

  let browserProcess: ChildProcess | null = null;
  let finalizedRecording: string | null = null;

  try {
    if (!options.noRecord) {
      await startRecording(options.outputDir, totalDuration, options);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    browserProcess = await launchPresentation(htmlPath, options);

    if (!options.openOnly) {
      const playbackWaitMs = Math.ceil((totalDuration + 4) * 1000);
      await new Promise((resolve) => setTimeout(resolve, playbackWaitMs));
    }
  } finally {
    if (!options.noRecord) {
      await stopRecording(options);
      const rawRecording = await findNewestRecording(options.outputDir);
      await waitForReadableMedia(rawRecording);
      finalizedRecording = path.join(options.outputDir, "meowstikstein-printer-breakthrough-demo.mp4");
      await fs.copyFile(rawRecording, finalizedRecording);
      await waitForReadableMedia(finalizedRecording);
    }

    if (browserProcess?.pid) {
      try {
        process.kill(browserProcess.pid, "SIGTERM");
      } catch {
        // ignore
      }
    }
  }

  console.log(`Story: ${storyTextPath}`);
  console.log(`Narration: ${narrationPath}`);
  console.log(`Presentation: ${htmlPath}`);
  if (finalizedRecording) {
    console.log(`Movie: ${finalizedRecording}`);
  }
}

main().catch((error) => {
  console.error("[demo-printer-breakthrough] Failed:", error);
  process.exit(1);
});
