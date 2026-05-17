import * as fs from "fs";
import * as path from "path";

export interface LocalResourceLink {
  label: string;
  href: string;
}

export interface ProjectBrainSummary {
  slug: string;
  name: string;
  status: string;
  oneLiner: string;
  summary: string;
  lastUpdated: string | null;
  brainPath: string;
  readmePath: string | null;
  briefCommand: string;
  localResources: LocalResourceLink[];
}

interface IndexedProjectRow {
  slug: string;
  name: string;
  status: string;
  oneLiner: string;
  order: number;
}

const PROJECTS_DIR = path.join(process.cwd(), "projects");
const INDEX_PATH = path.join(PROJECTS_DIR, "INDEX.md");
const WHAT_IS_HEADING = "## ⚡ What Is This Project?";

function extractIndexedProjects(): IndexedProjectRow[] {
  if (!fs.existsSync(INDEX_PATH)) {
    return [];
  }

  const content = fs.readFileSync(INDEX_PATH, "utf-8");
  const rows = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("| **") && line.includes("`projects/"));

  return rows
    .map((line, order) => {
      const match = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*`projects\/([^/]+)\/`\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
      if (!match) {
        return null;
      }

      const [, name, slug, status, oneLiner] = match;
      return {
        slug,
        name,
        status,
        oneLiner,
        order,
      } satisfies IndexedProjectRow;
    })
    .filter((row): row is IndexedProjectRow => Boolean(row));
}

function extractSection(content: string, heading: string): string {
  const start = content.indexOf(heading);
  if (start === -1) {
    return "";
  }

  const afterHeading = content.slice(start + heading.length);
  const nextHeadingMatch = afterHeading.match(/\n##\s+/);
  if (!nextHeadingMatch || nextHeadingMatch.index === undefined) {
    return afterHeading.trim();
  }

  return afterHeading.slice(0, nextHeadingMatch.index).trim();
}

function extractFirstParagraph(section: string): string {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const paragraph: string[] = [];
  for (const line of lines) {
    if (line.startsWith("**")) {
      break;
    }
    paragraph.push(line);
  }

  return paragraph.join(" ").trim();
}

function extractLabelValue(content: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`\\*\\*${escaped}:\\*\\*\\s*\\*?"?([^\\n*]+?)\\*?$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function extractLastUpdated(content: string): string | null {
  const match = content.match(/^>\s*Last updated:\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function extractLocalResourceLinks(content: string): LocalResourceLink[] {
  return [...content.matchAll(/\[([^\]]+)\]\((file:\/\/[^)]+)\)/g)].map((match) => ({
    label: match[1].trim(),
    href: match[2].trim(),
  }));
}

function titleizeSlug(slug: string): string {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function listProjectBrains(): ProjectBrainSummary[] {
  const indexedProjects = extractIndexedProjects();
  const indexedBySlug = new Map(indexedProjects.map((project) => [project.slug, project]));

  if (!fs.existsSync(PROJECTS_DIR)) {
    return [];
  }

  const summaries = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "_template")
    .map((entry) => {
      const slug = entry.name;
      const brainPath = path.join(PROJECTS_DIR, slug, "BRAIN.md");
      if (!fs.existsSync(brainPath)) {
        return null;
      }

      const content = fs.readFileSync(brainPath, "utf-8");
      const indexed = indexedBySlug.get(slug);
      const readmePath = path.join(PROJECTS_DIR, slug, "README.md");
      const whatIsSection = extractSection(content, WHAT_IS_HEADING);
      const oneLiner = extractLabelValue(content, "One-liner");

      return {
        slug,
        name: indexed?.name ?? titleizeSlug(slug),
        status: indexed?.status ?? "⚪ Local",
        oneLiner: indexed?.oneLiner ?? oneLiner,
        summary: extractFirstParagraph(whatIsSection),
        lastUpdated: extractLastUpdated(content),
        brainPath,
        readmePath: fs.existsSync(readmePath) ? readmePath : null,
        briefCommand: `bash scripts/tools/brief-project.sh ${slug}`,
        localResources: extractLocalResourceLinks(content),
      } satisfies ProjectBrainSummary;
    })
    .filter((summary): summary is ProjectBrainSummary => Boolean(summary));

  summaries.sort((left, right) => {
    const leftOrder = indexedBySlug.get(left.slug)?.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = indexedBySlug.get(right.slug)?.order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name);
  });

  return summaries;
}

export function buildProjectPromptSummary(limit = 6): string {
  const projects = listProjectBrains().slice(0, limit);
  if (projects.length === 0) {
    return "";
  }

  const lines = projects.map((project) => {
    const updated = project.lastUpdated ? ` — updated ${project.lastUpdated}` : "";
    const resources = project.localResources.length > 0 ? ` — local resources: ${project.localResources.length}` : "";
    const summary = project.oneLiner || project.summary || "Project brain available.";
    return `- **${project.name}** (${project.slug}) ${project.status}: ${summary}${updated}${resources}.`;
  });

  return [
    "# 🧠 Active Project Brain Index",
    "Use `projects/INDEX.md` and each project's `BRAIN.md` as the source of truth when the user mentions a project.",
    ...lines,
  ].join("\n");
}
