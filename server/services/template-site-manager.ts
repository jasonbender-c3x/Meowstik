import { execFile } from "node:child_process";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { DEFAULT_GIT_CLONE_PARENT, gitManager, type GitRepositorySummary } from "./git-manager";
import { normalizeRuntimeCwd } from "./runtime-manager";

const execFileAsync = promisify(execFile);

export const STARTER_SITE_DIRECTORY_NAME = "meowstik-template-site";
export const STARTER_SITE_PACKAGE_NAME = "meowstik-template-site";
export const STARTER_SITE_MARKER_FILE = ".meowstik-starter-site.json";
export const STARTER_SITE_RECOMMENDED_PORT = 4173;
export const STARTER_SITE_RECOMMENDED_HEALTH_PATH = "/";
export const STARTER_SITE_EDITABLE_FILES = [
  "index.html",
  "src/main.js",
  "src/site-content.js",
  "src/styles.css",
] as const;

const STARTER_SITE_TOP_LEVEL_RECOVERABLE = new Set([
  ".git",
  ".gitignore",
  STARTER_SITE_MARKER_FILE,
  "README.md",
  "index.html",
  "package.json",
  "scripts",
  "server.mjs",
  "src",
  "dist",
]);

export interface StarterSiteSummary {
  path: string;
  repoId: string | null;
  exists: boolean;
  tracked: boolean;
  gitInitialized: boolean;
  recommendedPort: number;
  recommendedHealthCheckPath: string;
  editableFiles: string[];
  status: "available" | "ready" | "attention";
  headline: string;
  detail: string;
}

interface StarterSiteInspection {
  path: string;
  exists: boolean;
  entries: string[];
  packageName: string | null;
  hasMarker: boolean;
  recognized: boolean;
  recoverable: boolean;
  gitInitialized: boolean;
}

function starterPath(): string {
  return path.resolve(DEFAULT_GIT_CLONE_PARENT, STARTER_SITE_DIRECTORY_NAME);
}

export function buildStarterSiteFiles(): Record<string, string> {
  const marker = {
    name: STARTER_SITE_PACKAGE_NAME,
    version: 1,
    createdBy: "Meowstik",
  };

  return {
    [STARTER_SITE_MARKER_FILE]: `${JSON.stringify(marker, null, 2)}\n`,
    ".gitignore": "dist/\n",
    "package.json": `${JSON.stringify(
      {
        name: STARTER_SITE_PACKAGE_NAME,
        version: "0.1.0",
        private: true,
        type: "module",
        scripts: {
          build: "node scripts/build.mjs",
          start: "node server.mjs",
        },
      },
      null,
      2,
    )}\n`,
    "README.md": `# Meowstik Starter Site

This is the built-in starter website Meowstik can preview and publish locally.

## Edit here

- \`index.html\` for the document shell
- \`src/site-content.js\` for the page content model
- \`src/main.js\` for structure and rendering
- \`src/styles.css\` for styling

## Commands

- \`npm run build\` creates a static \`dist/\` build
- \`npm run start\` serves \`dist/\` when it exists, otherwise it serves the source files directly

## Suggested Meowstik Publishing settings

- Port: \`${STARTER_SITE_RECOMMENDED_PORT}\`
- Health check path: \`${STARTER_SITE_RECOMMENDED_HEALTH_PATH}\`
`,
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Meowstik Starter Site</title>
    <meta
      name="description"
      content="A built-in local starter website that Meowstik and the user can iteratively edit, preview, and publish."
    />
    <link rel="stylesheet" href="./src/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
`,
    "server.mjs": `import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const PORT = Number.parseInt(process.env.PORT || "${STARTER_SITE_RECOMMENDED_PORT}", 10);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function directoryExists(target) {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function resolveContentType(targetPath) {
  return MIME_TYPES[path.extname(targetPath)] || "text/plain; charset=utf-8";
}

async function serveFile(baseDir, requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const targetPath = path.resolve(baseDir, "." + normalizedPath);

  if (!targetPath.startsWith(baseDir)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(targetPath);
    const finalPath = stat.isDirectory() ? path.join(targetPath, "index.html") : targetPath;
    response.writeHead(200, { "Content-Type": resolveContentType(finalPath) });
    createReadStream(finalPath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const baseDir = (await directoryExists(DIST)) ? DIST : ROOT;

http
  .createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    await serveFile(baseDir, url.pathname, response);
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(\`Starter site serving \${baseDir === DIST ? "dist" : "source"} on http://127.0.0.1:\${PORT}\`);
  });
`,
    "scripts/build.mjs": `import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(path.join(DIST, "src"), { recursive: true });
await fs.copyFile(path.join(ROOT, "index.html"), path.join(DIST, "index.html"));
await fs.cp(path.join(ROOT, "src"), path.join(DIST, "src"), { recursive: true });
console.log("Built starter site into dist/");
`,
    "src/site-content.js": `export const siteContent = {
  eyebrow: "Built inside Meowstik",
  title: "Your local starter website is ready to shape.",
  subtitle:
    "Use this as the concrete site Meowstik and the user can edit, preview, version, and publish together.",
  cta: {
    label: "Preview from Publishing",
    href: "#publishing",
  },
  highlights: [
    {
      title: "Edit content fast",
      body: "Change the text model in src/site-content.js when you want new messaging, sections, or calls to action.",
    },
    {
      title: "Change the layout",
      body: "Adjust the DOM rendering in src/main.js to restructure the page without replacing the whole scaffold.",
    },
    {
      title: "Restyle everything",
      body: "Update src/styles.css to shift the visual system, spacing, color palette, or responsive behavior.",
    },
  ],
  workflow: [
    "Open this repo from the Publishing page.",
    "Launch it locally and use the preview URL to inspect changes.",
    "Use the Git page when you want to review or commit the edits.",
  ],
};
`,
    "src/main.js": `import { siteContent } from "./site-content.js";

const app = document.querySelector("#app");

app.innerHTML = \`
  <main class="site-shell">
    <section class="hero">
      <p class="eyebrow">\${siteContent.eyebrow}</p>
      <h1>\${siteContent.title}</h1>
      <p class="subtitle">\${siteContent.subtitle}</p>
      <a class="cta" href="\${siteContent.cta.href}">\${siteContent.cta.label}</a>
    </section>

    <section class="panel-grid" aria-label="Highlights">
      \${siteContent.highlights
        .map(
          (item) => \`
            <article class="panel">
              <h2>\${item.title}</h2>
              <p>\${item.body}</p>
            </article>
          \`,
        )
        .join("")}
    </section>

    <section class="workflow" aria-label="Workflow">
      <div class="workflow-card">
        <h2>Starter workflow</h2>
        <ol>
          \${siteContent.workflow.map((step) => \`<li>\${step}</li>\`).join("")}
        </ol>
      </div>
    </section>
  </main>
\`;
`,
    "src/styles.css": `:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #07111f;
  color: #f8fafc;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(56, 189, 248, 0.22), transparent 30%),
    linear-gradient(180deg, #07111f 0%, #0f172a 65%, #111827 100%);
}

a {
  color: inherit;
}

.site-shell {
  width: min(1080px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 4rem 0 5rem;
}

.hero {
  padding: 2rem 0 3rem;
}

.eyebrow {
  margin: 0 0 1rem;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
}

h1 {
  margin: 0;
  max-width: 14ch;
  font-size: clamp(2.8rem, 6vw, 5.6rem);
  line-height: 0.95;
}

.subtitle {
  max-width: 58ch;
  margin: 1.5rem 0 0;
  font-size: 1.05rem;
  line-height: 1.7;
  color: #cbd5e1;
}

.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1.75rem;
  padding: 0.9rem 1.35rem;
  border-radius: 999px;
  background: #38bdf8;
  color: #07111f;
  font-weight: 700;
  text-decoration: none;
}

.panel-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.panel,
.workflow-card {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1.25rem;
  background: rgba(15, 23, 42, 0.76);
  backdrop-filter: blur(18px);
  padding: 1.25rem;
  box-shadow: 0 20px 45px rgba(2, 6, 23, 0.35);
}

.panel h2,
.workflow-card h2 {
  margin-top: 0;
  margin-bottom: 0.75rem;
  font-size: 1.15rem;
}

.panel p,
.workflow-card li {
  color: #cbd5e1;
  line-height: 1.7;
}

.workflow {
  margin-top: 1rem;
}

.workflow-card ol {
  margin: 0;
  padding-left: 1.25rem;
}

@media (max-width: 720px) {
  .site-shell {
    width: min(100% - 1.5rem, 1080px);
    padding-top: 3rem;
  }
}
`,
  };
}

export function canRecoverStarterSiteDirectory(entries: string[], recognized: boolean): boolean {
  if (recognized || entries.length === 0) {
    return true;
  }

  return entries.every((entry) => STARTER_SITE_TOP_LEVEL_RECOVERABLE.has(entry));
}

export function looksLikeStarterSite(packageName: string | null, hasMarker: boolean): boolean {
  return hasMarker || packageName === STARTER_SITE_PACKAGE_NAME;
}

async function pathExists(targetPath: string): Promise<boolean> {
  return fsp
    .stat(targetPath)
    .then(() => true)
    .catch(() => false);
}

async function readPackageName(packageJsonPath: string): Promise<string | null> {
  try {
    const manifest = JSON.parse(await fsp.readFile(packageJsonPath, "utf8")) as { name?: unknown };
    return typeof manifest.name === "string" ? manifest.name : null;
  } catch {
    return null;
  }
}

async function inspectStarterSite(): Promise<StarterSiteInspection> {
  const targetPath = starterPath();
  const exists = await pathExists(targetPath);
  if (!exists) {
    return {
      path: targetPath,
      exists: false,
      entries: [],
      packageName: null,
      hasMarker: false,
      recognized: false,
      recoverable: true,
      gitInitialized: false,
    };
  }

  const entries = await fsp.readdir(targetPath).catch(() => []);
  const hasMarker = entries.includes(STARTER_SITE_MARKER_FILE);
  const packageName = await readPackageName(path.join(targetPath, "package.json"));
  const recognized = looksLikeStarterSite(packageName, hasMarker);

  let gitInitialized = false;
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: targetPath });
    gitInitialized = normalizeRuntimeCwd(stdout.trim()) === normalizeRuntimeCwd(targetPath);
  } catch {
    gitInitialized = false;
  }

  return {
    path: targetPath,
    exists: true,
    entries,
    packageName,
    hasMarker,
    recognized,
    recoverable: canRecoverStarterSiteDirectory(entries, recognized),
    gitInitialized,
  };
}

async function ensureParentDirectory(): Promise<void> {
  await fsp.mkdir(DEFAULT_GIT_CLONE_PARENT, { recursive: true });
}

async function writeScaffoldFiles(targetPath: string): Promise<void> {
  const files = buildStarterSiteFiles();

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(targetPath, relativePath);
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsp.writeFile(absolutePath, content, "utf8");
  }
}

async function runGit(targetPath: string, args: string[], allowFailure = false): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: targetPath,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_ASKPASS: "true",
        LANG: "C",
        LC_ALL: "C",
      },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const execError = error as Error & { stdout?: string; stderr?: string; code?: number | string };
    if (allowFailure) {
      return {
        stdout: execError.stdout ?? "",
        stderr: execError.stderr ?? execError.message,
        exitCode: typeof execError.code === "number" ? execError.code : 1,
      };
    }
    throw new Error(execError.stderr?.trim() || execError.stdout?.trim() || execError.message);
  }
}

async function ensureLocalGitIdentity(targetPath: string): Promise<void> {
  const currentName = await runGit(targetPath, ["config", "user.name"], true);
  if (!currentName.stdout.trim()) {
    await runGit(targetPath, ["config", "user.name", "Meowstik"]);
  }

  const currentEmail = await runGit(targetPath, ["config", "user.email"], true);
  if (!currentEmail.stdout.trim()) {
    await runGit(targetPath, ["config", "user.email", "meowstik@local.invalid"]);
  }
}

async function ensureGitRepository(targetPath: string): Promise<void> {
  const gitDirExists = await pathExists(path.join(targetPath, ".git"));
  if (!gitDirExists) {
    await runGit(targetPath, ["init"]);
    await runGit(targetPath, ["branch", "-M", "main"], true);
  }

  const topLevel = await runGit(targetPath, ["rev-parse", "--show-toplevel"], true);
  if (topLevel.exitCode === 0 && normalizeRuntimeCwd(topLevel.stdout.trim()) !== normalizeRuntimeCwd(targetPath)) {
    throw new Error("Starter site path is inside another git repository and could not be isolated cleanly.");
  }

  await ensureLocalGitIdentity(targetPath);

  const hasHead = await runGit(targetPath, ["rev-parse", "--verify", "HEAD"], true);
  if (hasHead.exitCode !== 0) {
    await runGit(targetPath, ["add", "."]);
    await runGit(targetPath, ["commit", "-m", "Create Meowstik starter site"]);
  }
}

function buildSummary(inspection: StarterSiteInspection, repositories: GitRepositorySummary[]): StarterSiteSummary {
  const trackedRepository =
    repositories.find((repository) => normalizeRuntimeCwd(repository.path) === normalizeRuntimeCwd(inspection.path)) ?? null;

  if (!inspection.exists) {
    return {
      path: inspection.path,
      repoId: null,
      exists: false,
      tracked: false,
      gitInitialized: false,
      recommendedPort: STARTER_SITE_RECOMMENDED_PORT,
      recommendedHealthCheckPath: STARTER_SITE_RECOMMENDED_HEALTH_PATH,
      editableFiles: [...STARTER_SITE_EDITABLE_FILES],
      status: "available",
      headline: "Starter website not created yet",
      detail: "Create the built-in starter website so Publishing always has a concrete local project to work with.",
    };
  }

  if (!inspection.recognized && !inspection.recoverable) {
    return {
      path: inspection.path,
      repoId: trackedRepository?.id ?? null,
      exists: true,
      tracked: !!trackedRepository,
      gitInitialized: inspection.gitInitialized,
      recommendedPort: STARTER_SITE_RECOMMENDED_PORT,
      recommendedHealthCheckPath: STARTER_SITE_RECOMMENDED_HEALTH_PATH,
      editableFiles: [...STARTER_SITE_EDITABLE_FILES],
      status: "attention",
      headline: "Starter website path needs attention",
      detail: "The default starter-site path already contains unrelated files. Move or rename that folder before creating the Meowstik starter site.",
    };
  }

  if (trackedRepository && inspection.gitInitialized) {
    return {
      path: inspection.path,
      repoId: trackedRepository.id,
      exists: true,
      tracked: true,
      gitInitialized: true,
      recommendedPort: STARTER_SITE_RECOMMENDED_PORT,
      recommendedHealthCheckPath: STARTER_SITE_RECOMMENDED_HEALTH_PATH,
      editableFiles: [...STARTER_SITE_EDITABLE_FILES],
      status: "ready",
      headline: "Starter website is ready",
      detail: "Open it in Publishing, launch it locally, and iterate through Meowstik using the existing Git, Runtime, and preview flows.",
    };
  }

  return {
    path: inspection.path,
    repoId: trackedRepository?.id ?? null,
    exists: true,
    tracked: !!trackedRepository,
    gitInitialized: inspection.gitInitialized,
    recommendedPort: STARTER_SITE_RECOMMENDED_PORT,
    recommendedHealthCheckPath: STARTER_SITE_RECOMMENDED_HEALTH_PATH,
    editableFiles: [...STARTER_SITE_EDITABLE_FILES],
    status: "available",
    headline: "Starter website can be opened",
    detail: inspection.recognized
      ? "The starter site already exists on disk. Reconnect it to Meowstik Publishing to keep iterating."
      : "The starter-site path is reserved and recoverable. Create or reconnect the scaffold to continue.",
  };
}

class TemplateSiteManager {
  async getSummary(repositories: GitRepositorySummary[]): Promise<StarterSiteSummary> {
    const inspection = await inspectStarterSite();
    return buildSummary(inspection, repositories);
  }

  async ensureStarterSite(): Promise<{ repoId: string; path: string }> {
    await ensureParentDirectory();

    const inspection = await inspectStarterSite();
    if (inspection.exists && !inspection.recognized && !inspection.recoverable) {
      throw new Error("The starter-site path already contains unrelated files. Clear that folder before creating the starter website.");
    }

    await fsp.mkdir(inspection.path, { recursive: true });

    if (!inspection.recognized) {
      await writeScaffoldFiles(inspection.path);
    } else if (!inspection.hasMarker) {
      await fsp.writeFile(
        path.join(inspection.path, STARTER_SITE_MARKER_FILE),
        buildStarterSiteFiles()[STARTER_SITE_MARKER_FILE],
        "utf8",
      );
    }

    await ensureGitRepository(inspection.path);

    const trackedRepository = await gitManager.addExistingRepository(inspection.path);
    if (normalizeRuntimeCwd(trackedRepository.path) !== normalizeRuntimeCwd(inspection.path)) {
      throw new Error("Starter site registration resolved to the wrong repository root.");
    }

    return {
      repoId: trackedRepository.id,
      path: trackedRepository.path,
    };
  }
}

export const templateSiteManager = new TemplateSiteManager();
