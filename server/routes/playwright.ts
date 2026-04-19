
import { Router } from "express";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const router = Router();

function getChromiumExecutablePath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  try {
    const chromiumPath = execSync("which chromium", { encoding: "utf-8" }).trim();
    if (chromiumPath && fs.existsSync(chromiumPath)) {
      return chromiumPath;
    }
  } catch {}
  return undefined;
}

const SCREENSHOTS_DIR = path.join(process.cwd(), ".local", "playwright-screenshots");
const PLAYWRIGHT_PROFILES_DIR = path.join(process.cwd(), ".local", "playwright-profiles");
const DEFAULT_PROFILE_ID = "default";

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

function ensureProfilesDir() {
  if (!fs.existsSync(PLAYWRIGHT_PROFILES_DIR)) {
    fs.mkdirSync(PLAYWRIGHT_PROFILES_DIR, { recursive: true });
  }
}

function sanitizeProfileId(profileId?: string): string {
  const normalized = (profileId || DEFAULT_PROFILE_ID).trim() || DEFAULT_PROFILE_ID;
  return normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getProfileDir(profileId?: string): string {
  ensureProfilesDir();
  return path.join(PLAYWRIGHT_PROFILES_DIR, sanitizeProfileId(profileId));
}

interface TestSession {
  browser: Browser | null;
  context: BrowserContext;
  page: Page;
  createdAt: Date;
  profileId: string;
  headless: boolean;
}

const sessions = new Map<string, TestSession>();
const MAX_SESSIONS = 3;
const SESSION_TIMEOUT = 5 * 60 * 1000;

async function cleanupOldSessions() {
  const now = Date.now();
  const entries = Array.from(sessions.entries());
  for (const [id, session] of entries) {
    if (now - session.createdAt.getTime() > SESSION_TIMEOUT) {
      try {
        await session.context.close();
      } catch (e) {}
      sessions.delete(id);
    }
  }
}

async function getValidSession(sessionId: string): Promise<TestSession | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  if (Date.now() - session.createdAt.getTime() > SESSION_TIMEOUT) {
    try {
      await session.context.close();
    } catch (e) {}
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

async function closeSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    await session.context.close();
  } catch (e) {}

  sessions.delete(sessionId);
}

async function getOrCreateSession(
  sessionId: string,
  headless: boolean = true,
  profileId: string = DEFAULT_PROFILE_ID,
): Promise<TestSession> {
  await cleanupOldSessions();
  
  if (sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  for (const [existingSessionId, existingSession] of sessions.entries()) {
    if (existingSession.profileId === profileId) {
      if (existingSession.headless === headless) {
        sessions.set(sessionId, existingSession);
        if (existingSessionId !== sessionId) {
          sessions.delete(existingSessionId);
        }
        return existingSession;
      }

      await closeSession(existingSessionId);
      break;
    }
  }
  
  if (sessions.size >= MAX_SESSIONS) {
    const oldestId = sessions.keys().next().value;
    if (oldestId) {
      await closeSession(oldestId);
    }
  }

  const normalizedProfileId = sanitizeProfileId(profileId);
  const context = await chromium.launchPersistentContext(getProfileDir(normalizedProfileId), {
    headless,
    executablePath: getChromiumExecutablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    viewport: { width: 1280, height: 720 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  });
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  
  const session: TestSession = {
    browser: context.browser(),
    context,
    page,
    createdAt: new Date(),
    profileId: normalizedProfileId,
    headless,
  };
  
  sessions.set(sessionId, session);
  return session;
}

const navigateSchema = z.object({
  sessionId: z.string().default(() => `session_${Date.now()}`),
  url: z.string().url("Valid URL required"),
  profileId: z.string().optional().default(DEFAULT_PROFILE_ID),
  headless: z.boolean().default(true),
  timeout: z.number().min(1000).max(60000).default(30000)
});

router.post("/navigate", async (req, res) => {
  try {
    const parsed = navigateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, url, profileId, headless, timeout } = parsed.data;
    const session = await getOrCreateSession(sessionId, headless, profileId);
    
    await session.page.goto(url, { timeout, waitUntil: "domcontentloaded" });
    const title = await session.page.title();
    const currentUrl = session.page.url();
    
    res.json({
      success: true,
      sessionId,
      result: { title, url: currentUrl, profileId: session.profileId },
      message: `Navigated to ${currentUrl}`
    });
  } catch (error) {
    console.error("[Playwright] Navigate error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Navigation failed" });
  }
});

const clickSchema = z.object({
  sessionId: z.string(),
  selector: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  button: z.enum(["left", "right", "middle"]).default("left"),
  modifiers: z.array(z.enum(["Alt", "Control", "Meta", "Shift"])).optional(),
  clickCount: z.number().default(1),
  timeout: z.number().min(1000).max(30000).default(10000)
}).refine(data => data.selector || (data.x !== undefined && data.y !== undefined), {
  message: "Either selector or x,y coordinates are required"
});

router.post("/click", async (req, res) => {
  try {
    const parsed = clickSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, selector, x, y, button, modifiers, clickCount, timeout } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    if (selector) {
      await session.page.click(selector, { button, modifiers, clickCount, timeout });
      res.json({
        success: true,
        sessionId,
        message: `Clicked element: ${selector}`
      });
    } else if (x !== undefined && y !== undefined) {
      await session.page.mouse.click(x, y, { button, modifiers, clickCount });
      res.json({
        success: true,
        sessionId,
        message: `Clicked at ${x},${y}`
      });
    }
  } catch (error) {
    console.error("[Playwright] Click error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Click failed" });
  }
});

const typeSchema = z.object({
  sessionId: z.string(),
  selector: z.string().optional(),
  text: z.string().optional(),
  key: z.string().optional(),
  modifiers: z.array(z.enum(["Alt", "Control", "Meta", "Shift"])).optional(),
  timeout: z.number().min(1000).max(30000).default(10000)
});

router.post("/type", async (req, res) => {
  try {
    const parsed = typeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, selector, text, key, modifiers, timeout } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    if (selector && text) {
      await session.page.fill(selector, text, { timeout });
      res.json({ success: true, sessionId, message: `Typed "${text}" into ${selector}` });
    } else if (key) {
      // Handle keyboard shortcuts (e.g., Alt+Tab)
      const keyCombo = modifiers ? [...modifiers, key].join('+') : key;
      await session.page.keyboard.press(keyCombo);
      res.json({ success: true, sessionId, message: `Pressed ${keyCombo}` });
    } else if (text) {
      // Just type text into current focus
      await session.page.keyboard.type(text);
      res.json({ success: true, sessionId, message: `Typed "${text}"` });
    } else {
       return res.status(400).json({ success: false, error: "Either text, key, or selector+text required" });
    }
  } catch (error) {
    console.error("[Playwright] Type error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Type failed" });
  }
});

const keyEventSchema = z.object({
  sessionId: z.string(),
  key: z.string(),
});

router.post("/keyDown", async (req, res) => {
  try {
    const parsed = keyEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message });
    
    const { sessionId, key } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) return res.status(400).json({ error: "Session not found" });
    
    await session.page.keyboard.down(key);
    res.json({ success: true, sessionId, message: `Key down: ${key}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/keyUp", async (req, res) => {
  try {
    const parsed = keyEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message });
    
    const { sessionId, key } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) return res.status(400).json({ error: "Session not found" });
    
    await session.page.keyboard.up(key);
    res.json({ success: true, sessionId, message: `Key up: ${key}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const screenshotSchema = z.object({
  sessionId: z.string(),
  fullPage: z.boolean().default(false)
});

router.post("/screenshot", async (req, res) => {
  try {
    const parsed = screenshotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, fullPage } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    ensureScreenshotsDir();
    const filename = `screenshot_${Date.now()}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    
    await session.page.screenshot({ path: filepath, fullPage });
    
    const base64 = fs.readFileSync(filepath).toString("base64");
    
    res.json({
      success: true,
      sessionId,
      result: {
        filename,
        path: filepath,
        base64: `data:image/png;base64,${base64}`
      },
      message: "Screenshot captured"
    });
  } catch (error) {
    console.error("[Playwright] Screenshot error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Screenshot failed" });
  }
});

const evalSchema = z.object({
  sessionId: z.string(),
  script: z.string().min(1, "Script required")
});

router.post("/evaluate", async (req, res) => {
  try {
    const parsed = evalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, script } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    const result = await session.page.evaluate(script);
    
    res.json({
      success: true,
      sessionId,
      result,
      message: "Script executed"
    });
  } catch (error) {
    console.error("[Playwright] Evaluate error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Evaluate failed" });
  }
});

const waitSchema = z.object({
  sessionId: z.string(),
  selector: z.string().min(1, "Selector required"),
  state: z.enum(["visible", "hidden", "attached", "detached"]).default("visible"),
  timeout: z.number().min(1000).max(60000).default(30000)
});

router.post("/wait", async (req, res) => {
  try {
    const parsed = waitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, selector, state, timeout } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    await session.page.waitForSelector(selector, { state, timeout });
    
    res.json({
      success: true,
      sessionId,
      message: `Element ${selector} is ${state}`
    });
  } catch (error) {
    console.error("[Playwright] Wait error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Wait failed" });
  }
});

const getTextSchema = z.object({
  sessionId: z.string(),
  selector: z.string().min(1, "Selector required"),
  timeout: z.number().min(1000).max(30000).default(10000)
});

router.post("/getText", async (req, res) => {
  try {
    const parsed = getTextSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, selector, timeout } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    const element = await session.page.waitForSelector(selector, { timeout });
    const text = await element?.textContent();
    
    res.json({
      success: true,
      sessionId,
      result: { text: text || "" },
      message: `Got text from ${selector}`
    });
  } catch (error) {
    console.error("[Playwright] GetText error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "GetText failed" });
  }
});

const touchSchema = z.object({
  sessionId: z.string(),
  x: z.number(),
  y: z.number(),
});

router.post("/touch", async (req, res) => {
  try {
    const parsed = touchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, x, y } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    // Playwright supports touch via tap or by emulating touchscreens
    // For simplicity, we'll assume the page has touch emulation enabled or use mouse tap as fallback
    try {
      await session.page.touchscreen.tap(x, y);
      res.json({ success: true, sessionId, message: `Tapped at ${x},${y}` });
    } catch (e) {
      // Fallback to mouse click if touchscreen not enabled
      await session.page.mouse.click(x, y);
      res.json({ success: true, sessionId, message: `Clicked (fallback) at ${x},${y}` });
    }
  } catch (error) {
    console.error("[Playwright] Touch error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Touch failed" });
  }
});

router.get("/framebuffer/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const buffer = await session.page.screenshot({ type: "jpeg", quality: 50 });
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": buffer.length
    });
    res.end(buffer);
  } catch (error) {
    console.error("[Playwright] Framebuffer error:", error);
    res.status(500).json({ error: "Failed to capture framebuffer" });
  }
});

router.post("/close", async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = sessions.get(sessionId);
    
    if (session) {
      await closeSession(sessionId);
    }
    
    res.json({ success: true, message: "Session closed" });
  } catch (error) {
    console.error("[Playwright] Close error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Close failed" });
  }
});

router.get("/sessions", (_req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    createdAt: session.createdAt,
    url: session.page.url(),
    profileId: session.profileId,
  }));
  
  res.json({ sessions: sessionList, maxSessions: MAX_SESSIONS });
});

router.delete("/sessions", async (_req, res) => {
  try {
    const entries = Array.from(sessions.entries());
    for (const [id, session] of entries) {
      await session.context.close();
      sessions.delete(id);
    }
    res.json({ success: true, message: "All sessions closed" });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : "Failed to close sessions" });
  }
});

export default router;


