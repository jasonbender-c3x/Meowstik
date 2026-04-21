import fs from "fs";
import path from "path";
import YAML from "yaml";

export interface ExternalSkillEntry {
  id: string;
  source: "claude" | "gemini" | "copilot" | "generic";
  kind: "skill" | "agent" | "instructions";
  path: string;
  name: string;
  description: string;
  whenToUse?: string;
  excerpt: string;
  charCount: number;
}

type Frontmatter = {
  name?: unknown;
  description?: unknown;
  when_to_use?: unknown;
};

const MAX_SCAN_DEPTH = 5;
const MAX_SKILLS = 12;
const MAX_EXCERPT_LENGTH = 1400;
const CACHE_TTL_MS = 30_000;

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".cache",
  "logs",
  "attached_assets",
  "session-state",
  "rewind-snapshots",
]);

const CANDIDATE_FILE_NAMES = new Set([
  "SKILL.md",
  "Skill.md",
  "agent.md",
  "copilot-instructions.md",
]);

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "external-skill";
}

function classifySource(filePath: string): ExternalSkillEntry["source"] {
  const lower = filePath.toLowerCase();
  if (lower.includes("/.claude/") || lower.includes("/claude-code-")) return "claude";
  if (lower.includes("/.gemini/")) return "gemini";
  if (lower.includes("/.copilot/") || lower.includes("/.github/")) return "copilot";
  return "generic";
}

function classifyKind(filePath: string): ExternalSkillEntry["kind"] {
  const base = path.basename(filePath).toLowerCase();
  if (base === "skill.md" || base === "skILL.md".toLowerCase()) return "skill";
  if (base === "agent.md" || base.endsWith(".agent.md")) return "agent";
  return "instructions";
}

function stripFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---\n")) {
    return { frontmatter: {}, body: raw.trim() };
  }

  const end = trimmed.indexOf("\n---\n", 4);
  if (end === -1) {
    return { frontmatter: {}, body: raw.trim() };
  }

  const frontmatterText = trimmed.slice(4, end);
  const body = trimmed.slice(end + 5).trim();

  try {
    const parsed = YAML.parse(frontmatterText);
    return { frontmatter: (parsed && typeof parsed === "object" ? parsed : {}) as Frontmatter, body };
  } catch {
    return { frontmatter: {}, body };
  }
}

function firstHeading(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

function buildExcerpt(markdown: string): string {
  const normalized = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[[^\]]+]\([^)]*\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized.slice(0, MAX_EXCERPT_LENGTH).trim();
}

function isCandidateFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return CANDIDATE_FILE_NAMES.has(base) || base.endsWith(".agent.md");
}

function walkCandidates(root: string, depth = 0, results: string[] = []): string[] {
  if (depth > MAX_SCAN_DEPTH || results.length >= MAX_SKILLS) {
    return results;
  }

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= MAX_SKILLS) break;
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkCandidates(fullPath, depth + 1, results);
      continue;
    }

    if (entry.isFile() && isCandidateFile(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

export class ExternalSkillsService {
  private cachedSkills: ExternalSkillEntry[] = [];
  private cachedAt = 0;

  private getScanRoots(): string[] {
    const home = process.env.HOME || "";
    return [
      path.join(process.cwd(), ".claude"),
      path.join(process.cwd(), ".github"),
      path.join(home, ".claude"),
      path.join(home, ".gemini"),
      path.join(home, ".copilot"),
      path.join(home, "claude-code-source-code-full"),
    ].filter(Boolean);
  }

  private scanNow(): ExternalSkillEntry[] {
    const seenPaths = new Set<string>();
    const candidates: string[] = [];

    for (const root of this.getScanRoots()) {
      if (!fs.existsSync(root)) continue;
      walkCandidates(root, 0, candidates);
      if (candidates.length >= MAX_SKILLS) break;
    }

    const entries: ExternalSkillEntry[] = [];
    for (const candidate of candidates) {
      if (seenPaths.has(candidate)) continue;
      seenPaths.add(candidate);

      let raw = "";
      try {
        raw = fs.readFileSync(candidate, "utf8");
      } catch {
        continue;
      }

      const { frontmatter, body } = stripFrontmatter(raw);
      const excerpt = buildExcerpt(body);
      if (!excerpt) continue;

      const name =
        (typeof frontmatter.name === "string" && frontmatter.name.trim()) ||
        firstHeading(body) ||
        path.basename(path.dirname(candidate)) ||
        path.basename(candidate, path.extname(candidate));

      const description =
        (typeof frontmatter.description === "string" && frontmatter.description.trim()) ||
        excerpt.split("\n")[0] ||
        `Imported ${classifyKind(candidate)} instructions`;

      entries.push({
        id: slugify(candidate),
        source: classifySource(candidate),
        kind: classifyKind(candidate),
        path: candidate,
        name,
        description,
        whenToUse: typeof frontmatter.when_to_use === "string" ? frontmatter.when_to_use.trim() : undefined,
        excerpt,
        charCount: raw.length,
      });
    }

    return entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_SKILLS);
  }

  listSkills(options?: { forceRefresh?: boolean }): ExternalSkillEntry[] {
    const now = Date.now();
    if (!options?.forceRefresh && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cachedSkills;
    }

    this.cachedSkills = this.scanNow();
    this.cachedAt = now;
    return this.cachedSkills;
  }

  buildPromptSummary(): string | null {
    const skills = this.listSkills();
    if (skills.length === 0) return null;

    const lines = skills.map((skill) => {
      const whenToUse = skill.whenToUse ? `\nWhen to use: ${skill.whenToUse}` : "";
      return [
        `### ${skill.name} [${skill.source}/${skill.kind}]`,
        `Path: ${skill.path}`,
        `Description: ${skill.description}${whenToUse}`,
        `Excerpt:\n${skill.excerpt}`,
      ].join("\n");
    });

    return [
      "## EXTERNAL ASSISTANT SKILLS",
      "The following external skill or instruction files were discovered locally. Reuse their guidance when relevant, but prefer Meowstik's own tools and current repo conventions if they conflict.",
      ...lines,
    ].join("\n\n");
  }
}

export const externalSkillsService = new ExternalSkillsService();
