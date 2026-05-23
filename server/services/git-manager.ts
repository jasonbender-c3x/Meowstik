import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const GIT_REPOSITORIES_PATH = path.resolve(__dirname, "../../data/git-repositories.json");
export const DEFAULT_GIT_CLONE_PARENT = path.resolve(process.cwd(), "projects");

const WORKSPACE_REPOSITORY_ID = "workspace";
const GIT_READ_TIMEOUT_MS = 10_000;
const GIT_NETWORK_TIMEOUT_MS = 120_000;
const GIT_DIFF_TIMEOUT_MS = 15_000;
const GIT_OUTPUT_MAX_BUFFER = 1024 * 1024;
const GIT_DIFF_MAX_BUFFER = 4 * 1024 * 1024;
const GIT_DIFF_PREVIEW_LIMIT = 350_000;

export interface ManagedGitRepositoryDefinition {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitRemoteSnapshot {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

export interface GitBranchSnapshot {
  name: string;
  current: boolean;
  shortHash?: string;
  lastCommitAt?: string;
  upstream?: string | null;
  tracking?: string | null;
}

export interface GitChangedFileSnapshot {
  path: string;
  originalPath?: string;
  kind: "tracked" | "renamed" | "unmerged" | "untracked";
  statusCode: string;
  indexStatus: string;
  workTreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface GitCommitSnapshot {
  hash: string;
  shortHash: string;
  authorName: string;
  authoredAt: string;
  subject: string;
}

export interface GitStatusSnapshot {
  branchName: string | null;
  detachedHead: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  changedFiles: GitChangedFileSnapshot[];
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
}

export interface GitRevisionSnapshot {
  hash: string | null;
  shortHash: string | null;
  branchName: string | null;
  detachedHead: boolean;
}

export interface GitRepositorySummary {
  id: string;
  name: string;
  path: string;
  source: "workspace" | "tracked";
  availability: "ready" | "missing" | "error";
  isWorkspace: boolean;
  branchName: string | null;
  detachedHead: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  changedFilesCount: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  remoteCount: number;
  lastCommitAt?: string;
  lastCommitSubject?: string;
  error?: string;
}

export interface GitRepositoryDetail extends GitRepositorySummary {
  remotes: GitRemoteSnapshot[];
  branches: GitBranchSnapshot[];
  changedFiles: GitChangedFileSnapshot[];
  commits: GitCommitSnapshot[];
  workingTreeDiff: string;
  stagedDiff: string;
  workingTreeDiffTruncated: boolean;
  stagedDiffTruncated: boolean;
}

export interface GitOverview {
  cwd: string;
  defaultCloneParent: string;
  repositories: GitRepositorySummary[];
  selectedRepoId: string | null;
  selectedRepo: GitRepositoryDetail | null;
}

interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface GitRepositoryReference extends ManagedGitRepositoryDefinition {
  source: "workspace" | "tracked";
}

interface GitCommandOptions {
  timeoutMs?: number;
  maxBuffer?: number;
  allowFailure?: boolean;
}

function normalizeDefinition(input: ManagedGitRepositoryDefinition): ManagedGitRepositoryDefinition {
  const normalizedPath = normalizeGitTargetPath(input.path);
  return {
    id: input.id || createTrackedGitRepositoryId(normalizedPath),
    name: input.name?.trim() || path.basename(normalizedPath) || normalizedPath,
    path: normalizedPath,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || input.createdAt || new Date().toISOString(),
  };
}

function dedupeDefinitions(definitions: ManagedGitRepositoryDefinition[]): ManagedGitRepositoryDefinition[] {
  const seenPaths = new Set<string>();
  return definitions.filter((definition) => {
    if (seenPaths.has(definition.path)) {
      return false;
    }
    seenPaths.add(definition.path);
    return true;
  });
}

export function normalizeGitTargetPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Repository path is required");
  }

  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(process.cwd(), trimmed);
}

export function createTrackedGitRepositoryId(repoPath: string): string {
  const digest = createHash("sha1").update(path.normalize(repoPath)).digest("hex").slice(0, 12);
  return `repo-${digest}`;
}

export function isLikelyGitCloneUrl(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^https?:\/\/\S+$/i.test(trimmed) ||
    /^ssh:\/\/\S+$/i.test(trimmed) ||
    /^git@\S+:\S+$/i.test(trimmed) ||
    /^file:\/\/\S+$/i.test(trimmed)
  );
}

function parseGitTrackString(value: string | null | undefined): { ahead: number; behind: number } {
  if (!value) {
    return { ahead: 0, behind: 0 };
  }

  const aheadMatch = value.match(/ahead (\d+)/);
  const behindMatch = value.match(/behind (\d+)/);
  return {
    ahead: aheadMatch ? Number.parseInt(aheadMatch[1], 10) : 0,
    behind: behindMatch ? Number.parseInt(behindMatch[1], 10) : 0,
  };
}

function normalizeStatusMarker(value: string): string {
  return value === "." ? "" : value;
}

function trimDiffPreview(diff: string): { content: string; truncated: boolean } {
  if (diff.length <= GIT_DIFF_PREVIEW_LIMIT) {
    return { content: diff, truncated: false };
  }

  return {
    content: `${diff.slice(0, GIT_DIFF_PREVIEW_LIMIT)}\n\n[truncated by Meowstik git diff preview limit]\n`,
    truncated: true,
  };
}

function parseStatusHeader(line: string, status: GitStatusSnapshot): void {
  if (line.startsWith("# branch.head ")) {
    const head = line.slice("# branch.head ".length).trim();
    status.detachedHead = head === "(detached)";
    status.branchName = head && head !== "(detached)" ? head : null;
    return;
  }

  if (line.startsWith("# branch.upstream ")) {
    status.upstream = line.slice("# branch.upstream ".length).trim() || null;
    return;
  }

  if (line.startsWith("# branch.ab ")) {
    const branchAb = line.slice("# branch.ab ".length).trim();
    const aheadMatch = branchAb.match(/\+(\d+)/);
    const behindMatch = branchAb.match(/-(\d+)/);
    status.ahead = aheadMatch ? Number.parseInt(aheadMatch[1], 10) : 0;
    status.behind = behindMatch ? Number.parseInt(behindMatch[1], 10) : 0;
  }
}

function parseTrackedStatusLine(line: string): GitChangedFileSnapshot | null {
  if (!(line.startsWith("1 ") || line.startsWith("2 ") || line.startsWith("u "))) {
    return null;
  }

  const [prefix, statusCode, _submodule, _mH, _mI, _mW, _hH, _hI, ...rest] = line.split(" ");
  const payload = rest.join(" ");
  let filePath = payload;
  let originalPath: string | undefined;

  if (prefix === "2") {
    const tabIndex = payload.indexOf("\t");
    const renamedPaths = tabIndex === -1 ? [payload] : [payload.slice(0, tabIndex), payload.slice(tabIndex + 1)];
    filePath = renamedPaths[0].split(" ").slice(1).join(" ");
    originalPath = renamedPaths[1];
  }

  if (!filePath) {
    return null;
  }

  const indexStatus = normalizeStatusMarker(statusCode[0] || ".");
  const workTreeStatus = normalizeStatusMarker(statusCode[1] || ".");

  return {
    path: filePath,
    originalPath,
    kind: prefix === "2" ? "renamed" : prefix === "u" ? "unmerged" : "tracked",
    statusCode,
    indexStatus,
    workTreeStatus,
    staged: Boolean(indexStatus) || prefix === "u",
    unstaged: Boolean(workTreeStatus) || prefix === "u",
    untracked: false,
  };
}

export function parseGitStatusPorcelainV2(output: string): GitStatusSnapshot {
  const status: GitStatusSnapshot = {
    branchName: null,
    detachedHead: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    changedFiles: [],
    stagedCount: 0,
    unstagedCount: 0,
    untrackedCount: 0,
  };

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) {
      continue;
    }

    if (line.startsWith("# ")) {
      parseStatusHeader(line, status);
      continue;
    }

    if (line.startsWith("? ")) {
      const filePath = line.slice(2);
      status.changedFiles.push({
        path: filePath,
        kind: "untracked",
        statusCode: "??",
        indexStatus: "",
        workTreeStatus: "?",
        staged: false,
        unstaged: false,
        untracked: true,
      });
      status.untrackedCount += 1;
      continue;
    }

    const tracked = parseTrackedStatusLine(line);
    if (!tracked) {
      continue;
    }

    status.changedFiles.push(tracked);
    if (tracked.staged) {
      status.stagedCount += 1;
    }
    if (tracked.unstaged) {
      status.unstagedCount += 1;
    }
  }

  return status;
}

export function parseGitRemoteList(output: string): GitRemoteSnapshot[] {
  const remotes = new Map<string, GitRemoteSnapshot>();

  for (const line of output.split("\n").map((value) => value.trim()).filter(Boolean)) {
    const match = line.match(/^([^\s]+)\s+(.+?)\s+\((fetch|push)\)$/);
    if (!match) {
      continue;
    }

    const [, name, url, kind] = match;
    const current = remotes.get(name) ?? { name };
    if (kind === "fetch") {
      current.fetchUrl = url;
    } else {
      current.pushUrl = url;
    }
    remotes.set(name, current);
  }

  return Array.from(remotes.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function parseBranchSnapshots(output: string): GitBranchSnapshot[] {
  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, head, shortHash, lastCommitAt, upstream, tracking] = entry.split("\x1f");
      return {
        name,
        current: head === "*",
        shortHash: shortHash || undefined,
        lastCommitAt: lastCommitAt || undefined,
        upstream: upstream || null,
        tracking: tracking || null,
      };
    })
    .sort((left, right) => {
      if (left.current === right.current) {
        return left.name.localeCompare(right.name);
      }
      return left.current ? -1 : 1;
    });
}

function parseCommitSnapshots(output: string): GitCommitSnapshot[] {
  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, shortHash, authorName, authoredAt, subject] = entry.split("\x1f");
      return {
        hash,
        shortHash,
        authorName,
        authoredAt,
        subject,
      };
    });
}

async function isDirectoryMissing(repoPath: string): Promise<boolean> {
  try {
    await fsp.access(repoPath, fs.constants.F_OK);
    return false;
  } catch {
    return true;
  }
}

class GitManager {
  private definitions: ManagedGitRepositoryDefinition[] = [];
  private initialized = false;
  private persistChain: Promise<void> = Promise.resolve();
  private mutationChains = new Map<string, Promise<void>>();

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await fsp.mkdir(path.dirname(GIT_REPOSITORIES_PATH), { recursive: true });

    if (!fs.existsSync(GIT_REPOSITORIES_PATH)) {
      await fsp.writeFile(GIT_REPOSITORIES_PATH, "[]\n", { encoding: "utf8", mode: 0o600 });
    }

    const raw = await fsp.readFile(GIT_REPOSITORIES_PATH, "utf8");
    const parsed = JSON.parse(raw) as ManagedGitRepositoryDefinition[];
    this.definitions = Array.isArray(parsed) ? dedupeDefinitions(parsed.map(normalizeDefinition)) : [];
    this.initialized = true;
  }

  private async persistDefinitions(): Promise<void> {
    const payload = `${JSON.stringify(this.definitions, null, 2)}\n`;
    this.persistChain = this.persistChain.then(async () => {
      await fsp.mkdir(path.dirname(GIT_REPOSITORIES_PATH), { recursive: true });
      const tempPath = `${GIT_REPOSITORIES_PATH}.tmp`;
      await fsp.writeFile(tempPath, payload, { encoding: "utf8", mode: 0o600 });
      await fsp.rename(tempPath, GIT_REPOSITORIES_PATH);
      await fsp.chmod(GIT_REPOSITORIES_PATH, 0o600).catch(() => {});
    });

    await this.persistChain;
  }

  private async execGit(repoPath: string, args: string[], options: GitCommandOptions = {}): Promise<GitExecResult> {
    try {
      const { stdout, stderr } = await execFileAsync("git", args, {
        cwd: repoPath,
        encoding: "utf8",
        windowsHide: true,
        timeout: options.timeoutMs ?? GIT_READ_TIMEOUT_MS,
        maxBuffer: options.maxBuffer ?? GIT_OUTPUT_MAX_BUFFER,
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
      const execError = error as Error & { code?: number | string; stdout?: string; stderr?: string };
      const exitCode = typeof execError.code === "number" ? execError.code : -1;

      if (options.allowFailure) {
        return {
          stdout: execError.stdout ?? "",
          stderr: execError.stderr ?? execError.message,
          exitCode,
        };
      }

      throw new Error(execError.stderr?.trim() || execError.stdout?.trim() || execError.message || `git ${args.join(" ")} failed`);
    }
  }

  private async resolveGitTopLevel(targetPath: string): Promise<string> {
    const normalized = normalizeGitTargetPath(targetPath);
    const { stdout } = await this.execGit(normalized, ["rev-parse", "--show-toplevel"]);
    return path.normalize(stdout.trim());
  }

  private async detectWorkspaceRepository(): Promise<GitRepositoryReference | null> {
    const root = await this.execGit(process.cwd(), ["rev-parse", "--show-toplevel"], { allowFailure: true });
    if (root.exitCode !== 0 || !root.stdout.trim()) {
      return null;
    }

    const repoPath = path.normalize(root.stdout.trim());
    return {
      id: WORKSPACE_REPOSITORY_ID,
      name: path.basename(repoPath) || repoPath,
      path: repoPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "workspace",
    };
  }

  private async listRepositoryReferences(): Promise<GitRepositoryReference[]> {
    await this.ensureLoaded();
    const workspaceRepo = await this.detectWorkspaceRepository();
    const references: GitRepositoryReference[] = [];
    const workspacePath = workspaceRepo?.path;

    if (workspaceRepo) {
      references.push(workspaceRepo);
    }

    for (const definition of this.definitions) {
      if (workspacePath && definition.path === workspacePath) {
        continue;
      }

      references.push({
        ...definition,
        source: "tracked",
      });
    }

    return references;
  }

  private async buildRepositorySummary(reference: GitRepositoryReference): Promise<GitRepositorySummary> {
    if (await isDirectoryMissing(reference.path)) {
      return {
        id: reference.id,
        name: reference.name,
        path: reference.path,
        source: reference.source,
        availability: "missing",
        isWorkspace: reference.source === "workspace",
        branchName: null,
        detachedHead: false,
        upstream: null,
        ahead: 0,
        behind: 0,
        changedFilesCount: 0,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        remoteCount: 0,
        error: "Repository path is missing on disk.",
      };
    }

    try {
      const [statusResult, remotesResult, lastCommitResult] = await Promise.all([
        this.execGit(reference.path, ["status", "--porcelain=v2", "--branch"]),
        this.execGit(reference.path, ["remote", "-v"]),
        this.execGit(
          reference.path,
          ["log", "-1", "--date=iso-strict", "--format=%ad%x1f%s"],
          { allowFailure: true }
        ),
      ]);

      const status = parseGitStatusPorcelainV2(statusResult.stdout);
      const remotes = parseGitRemoteList(remotesResult.stdout);
      const lastCommitLine = lastCommitResult.exitCode === 0 ? lastCommitResult.stdout.trim() : "";
      const [lastCommitAt, lastCommitSubject] = lastCommitLine ? lastCommitLine.split("\x1f") : [];

      return {
        id: reference.id,
        name: reference.name,
        path: reference.path,
        source: reference.source,
        availability: "ready",
        isWorkspace: reference.source === "workspace",
        branchName: status.branchName,
        detachedHead: status.detachedHead,
        upstream: status.upstream,
        ahead: status.ahead,
        behind: status.behind,
        changedFilesCount: status.changedFiles.length,
        stagedCount: status.stagedCount,
        unstagedCount: status.unstagedCount,
        untrackedCount: status.untrackedCount,
        remoteCount: remotes.length,
        lastCommitAt: lastCommitAt || undefined,
        lastCommitSubject: lastCommitSubject || undefined,
      };
    } catch (error) {
      return {
        id: reference.id,
        name: reference.name,
        path: reference.path,
        source: reference.source,
        availability: "error",
        isWorkspace: reference.source === "workspace",
        branchName: null,
        detachedHead: false,
        upstream: null,
        ahead: 0,
        behind: 0,
        changedFilesCount: 0,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        remoteCount: 0,
        error: error instanceof Error ? error.message : "Unable to inspect repository",
      };
    }
  }

  private async buildRepositoryDetail(summary: GitRepositorySummary): Promise<GitRepositoryDetail> {
    if (summary.availability !== "ready") {
      return {
        ...summary,
        remotes: [],
        branches: [],
        changedFiles: [],
        commits: [],
        workingTreeDiff: "",
        stagedDiff: "",
        workingTreeDiffTruncated: false,
        stagedDiffTruncated: false,
      };
    }

    const [statusResult, remotesResult, branchesResult, commitsResult, workingTreeDiffResult, stagedDiffResult] = await Promise.all([
      this.execGit(summary.path, ["status", "--porcelain=v2", "--branch"]),
      this.execGit(summary.path, ["remote", "-v"]),
      this.execGit(
        summary.path,
        [
          "for-each-ref",
          "refs/heads",
          "--format=%(refname:short)%x1f%(HEAD)%x1f%(objectname:short)%x1f%(committerdate:iso-strict)%x1f%(upstream:short)%x1f%(upstream:track)%x1e",
        ]
      ),
      this.execGit(
        summary.path,
        ["log", "-15", "--date=iso-strict", "--format=%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1e"],
        { allowFailure: true, maxBuffer: GIT_OUTPUT_MAX_BUFFER }
      ),
      this.execGit(summary.path, ["diff", "--no-ext-diff"], {
        timeoutMs: GIT_DIFF_TIMEOUT_MS,
        maxBuffer: GIT_DIFF_MAX_BUFFER,
      }),
      this.execGit(summary.path, ["diff", "--cached", "--no-ext-diff"], {
        timeoutMs: GIT_DIFF_TIMEOUT_MS,
        maxBuffer: GIT_DIFF_MAX_BUFFER,
      }),
    ]);

    const status = parseGitStatusPorcelainV2(statusResult.stdout);
    const workingTreeDiff = trimDiffPreview(workingTreeDiffResult.stdout);
    const stagedDiff = trimDiffPreview(stagedDiffResult.stdout);
    const remotes = parseGitRemoteList(remotesResult.stdout);
    const branches = parseBranchSnapshots(branchesResult.stdout).map((branch) => {
      const track = parseGitTrackString(branch.tracking);
      return {
        ...branch,
        tracking:
          branch.tracking && (track.ahead > 0 || track.behind > 0)
            ? branch.tracking
            : branch.tracking || null,
      };
    });

    return {
      ...summary,
      branchName: status.branchName,
      detachedHead: status.detachedHead,
      upstream: status.upstream,
      ahead: status.ahead,
      behind: status.behind,
      changedFilesCount: status.changedFiles.length,
      stagedCount: status.stagedCount,
      unstagedCount: status.unstagedCount,
      untrackedCount: status.untrackedCount,
      remoteCount: remotes.length,
      remotes,
      branches,
      changedFiles: status.changedFiles,
      commits: commitsResult.exitCode === 0 ? parseCommitSnapshots(commitsResult.stdout) : [],
      workingTreeDiff: workingTreeDiff.content,
      stagedDiff: stagedDiff.content,
      workingTreeDiffTruncated: workingTreeDiff.truncated,
      stagedDiffTruncated: stagedDiff.truncated,
    };
  }

  private async getRepositoryReference(id: string): Promise<GitRepositoryReference> {
    const references = await this.listRepositoryReferences();
    const reference = references.find((item) => item.id === id);
    if (!reference) {
      throw new Error("Repository not found");
    }
    return reference;
  }

  private async upsertTrackedRepository(repoPath: string): Promise<ManagedGitRepositoryDefinition> {
    await this.ensureLoaded();

    const normalizedPath = path.normalize(repoPath);
    const now = new Date().toISOString();
    const id = createTrackedGitRepositoryId(normalizedPath);
    const existing = this.definitions.find((definition) => definition.path === normalizedPath || definition.id === id);

    if (existing) {
      existing.path = normalizedPath;
      existing.name = existing.name || path.basename(normalizedPath) || normalizedPath;
      existing.updatedAt = now;
      await this.persistDefinitions();
      return { ...existing };
    }

    const definition: ManagedGitRepositoryDefinition = {
      id,
      name: path.basename(normalizedPath) || normalizedPath,
      path: normalizedPath,
      createdAt: now,
      updatedAt: now,
    };

    this.definitions.push(definition);
    this.definitions = dedupeDefinitions(this.definitions);
    await this.persistDefinitions();
    return { ...definition };
  }

  private async queueMutation<T>(repoId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationChains.get(repoId) ?? Promise.resolve();
    let result: T | undefined;
    const next = previous.catch(() => undefined).then(async () => {
      result = await operation();
    });
    this.mutationChains.set(repoId, next.then(() => undefined, () => undefined));
    await next;
    return result as T;
  }

  private async ensureActionableRepo(id: string): Promise<GitRepositoryReference> {
    const reference = await this.getRepositoryReference(id);
    if (await isDirectoryMissing(reference.path)) {
      throw new Error("Repository path is missing on disk");
    }
    return reference;
  }

  private async getRepoStatus(reference: GitRepositoryReference): Promise<GitStatusSnapshot> {
    const result = await this.execGit(reference.path, ["status", "--porcelain=v2", "--branch"]);
    return parseGitStatusPorcelainV2(result.stdout);
  }

  async getOverview(selectedRepoId?: string | null): Promise<GitOverview> {
    const references = await this.listRepositoryReferences();
    const repositories = await Promise.all(references.map((reference) => this.buildRepositorySummary(reference)));
    const selectedSummary =
      (selectedRepoId ? repositories.find((repository) => repository.id === selectedRepoId) : null) ??
      repositories.find((repository) => repository.availability === "ready") ??
      repositories[0] ??
      null;

    return {
      cwd: process.cwd(),
      defaultCloneParent: DEFAULT_GIT_CLONE_PARENT,
      repositories,
      selectedRepoId: selectedSummary?.id ?? null,
      selectedRepo: selectedSummary ? await this.buildRepositoryDetail(selectedSummary) : null,
    };
  }

  async addExistingRepository(targetPath: string): Promise<ManagedGitRepositoryDefinition | { id: string; name: string; path: string }> {
    const repoPath = await this.resolveGitTopLevel(targetPath);
    const workspaceRepo = await this.detectWorkspaceRepository();
    if (workspaceRepo?.path === repoPath) {
      return { id: WORKSPACE_REPOSITORY_ID, name: workspaceRepo.name, path: repoPath };
    }

    return this.upsertTrackedRepository(repoPath);
  }

  async cloneRepository(url: string, targetPath: string): Promise<ManagedGitRepositoryDefinition | { id: string; name: string; path: string }> {
    const trimmedUrl = url.trim();
    if (!isLikelyGitCloneUrl(trimmedUrl)) {
      throw new Error("Clone URL must be an https://, ssh://, file://, or git@ URL");
    }

    const normalizedTarget = normalizeGitTargetPath(targetPath);
    await fsp.mkdir(path.dirname(normalizedTarget), { recursive: true });

    await this.execGit(process.cwd(), ["clone", trimmedUrl, normalizedTarget], {
      timeoutMs: GIT_NETWORK_TIMEOUT_MS,
      maxBuffer: GIT_DIFF_MAX_BUFFER,
    });

    const repoPath = await this.resolveGitTopLevel(normalizedTarget);
    const workspaceRepo = await this.detectWorkspaceRepository();
    if (workspaceRepo?.path === repoPath) {
      return { id: WORKSPACE_REPOSITORY_ID, name: workspaceRepo.name, path: repoPath };
    }

    return this.upsertTrackedRepository(repoPath);
  }

  async removeTrackedRepository(id: string): Promise<void> {
    await this.ensureLoaded();
    if (id === WORKSPACE_REPOSITORY_ID) {
      throw new Error("The workspace repository cannot be removed from Git management");
    }

    const nextDefinitions = this.definitions.filter((definition) => definition.id !== id);
    if (nextDefinitions.length === this.definitions.length) {
      throw new Error("Repository not found");
    }

    this.definitions = nextDefinitions;
    await this.persistDefinitions();
  }

  async checkoutRepository(id: string, options: { branchName: string; create?: boolean; startPoint?: string | null }): Promise<{ status: string; message: string }> {
    const branchName = options.branchName.trim();
    if (!branchName) {
      throw new Error("Branch name is required");
    }

    const reference = await this.ensureActionableRepo(id);
    return this.queueMutation(id, async () => {
      if (options.create) {
        const args = ["switch", "-c", branchName];
        if (options.startPoint?.trim()) {
          args.push(options.startPoint.trim());
        }
        await this.execGit(reference.path, args, { timeoutMs: GIT_READ_TIMEOUT_MS });
        return { status: "created", message: `Created and checked out ${branchName}.` };
      }

      await this.execGit(reference.path, ["switch", branchName], { timeoutMs: GIT_READ_TIMEOUT_MS });
      return { status: "checked_out", message: `Checked out ${branchName}.` };
    });
  }

  async commitAllChanges(id: string, message: string): Promise<{ status: string; message: string }> {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      throw new Error("Commit message is required");
    }

    const reference = await this.ensureActionableRepo(id);
    return this.queueMutation(id, async () => {
      await this.execGit(reference.path, ["add", "-A"], { timeoutMs: GIT_READ_TIMEOUT_MS });

      const stagedCheck = await this.execGit(reference.path, ["diff", "--cached", "--quiet"], {
        allowFailure: true,
        timeoutMs: GIT_READ_TIMEOUT_MS,
      });

      if (stagedCheck.exitCode === 0) {
        return { status: "nothing_to_commit", message: "No changes are ready to commit." };
      }
      if (stagedCheck.exitCode !== 1) {
        throw new Error(stagedCheck.stderr.trim() || stagedCheck.stdout.trim() || "Unable to inspect staged changes");
      }

      await this.execGit(reference.path, ["commit", "-m", trimmedMessage], {
        timeoutMs: GIT_READ_TIMEOUT_MS,
        maxBuffer: GIT_DIFF_MAX_BUFFER,
      });

      return { status: "committed", message: "Created a new commit from all current changes." };
    });
  }

  async pullRepository(id: string): Promise<{ status: string; message: string }> {
    const reference = await this.ensureActionableRepo(id);
    return this.queueMutation(id, async () => {
      const status = await this.getRepoStatus(reference);
      if (!status.upstream) {
        throw new Error("The current branch has no upstream. Set an upstream branch before pulling.");
      }

      const result = await this.execGit(reference.path, ["pull", "--ff-only"], {
        timeoutMs: GIT_NETWORK_TIMEOUT_MS,
        maxBuffer: GIT_DIFF_MAX_BUFFER,
      });

      const output = `${result.stdout}\n${result.stderr}`;
      if (/Already up to date\./i.test(output)) {
        return { status: "already_up_to_date", message: "The branch is already up to date." };
      }

      return { status: "pulled", message: "Pulled the latest upstream changes with fast-forward only." };
    });
  }

  async pushRepository(id: string): Promise<{ status: string; message: string }> {
    const reference = await this.ensureActionableRepo(id);
    return this.queueMutation(id, async () => {
      const status = await this.getRepoStatus(reference);
      if (status.detachedHead || !status.branchName) {
        throw new Error("Push is unavailable while HEAD is detached.");
      }

      let result: GitExecResult;
      if (status.upstream) {
        result = await this.execGit(reference.path, ["push"], {
          timeoutMs: GIT_NETWORK_TIMEOUT_MS,
          maxBuffer: GIT_DIFF_MAX_BUFFER,
        });
      } else {
        const remotes = parseGitRemoteList((await this.execGit(reference.path, ["remote", "-v"])).stdout);
        const defaultRemote = remotes.find((remote) => remote.name === "origin") ?? (remotes.length === 1 ? remotes[0] : null);
        if (!defaultRemote) {
          throw new Error("The current branch has no upstream and no default remote could be chosen.");
        }

        result = await this.execGit(
          reference.path,
          ["push", "--set-upstream", defaultRemote.name, status.branchName],
          {
            timeoutMs: GIT_NETWORK_TIMEOUT_MS,
            maxBuffer: GIT_DIFF_MAX_BUFFER,
          }
        );
      }

      const output = `${result.stdout}\n${result.stderr}`;
      if (/Everything up-to-date/i.test(output)) {
        return { status: "already_up_to_date", message: "The remote already has the latest commit." };
      }

      return { status: "pushed", message: "Pushed the current branch to its remote." };
    });
  }

  async getRepositoryStatus(id: string): Promise<GitStatusSnapshot> {
    const reference = await this.ensureActionableRepo(id);
    return this.getRepoStatus(reference);
  }

  async getRevisionSnapshot(id: string): Promise<GitRevisionSnapshot> {
    const reference = await this.ensureActionableRepo(id);
    const [status, hashResult] = await Promise.all([
      this.getRepoStatus(reference),
      this.execGit(reference.path, ["rev-parse", "HEAD"], {
        allowFailure: true,
        timeoutMs: GIT_READ_TIMEOUT_MS,
      }),
    ]);

    const hash = hashResult.exitCode === 0 ? hashResult.stdout.trim() || null : null;

    return {
      hash,
      shortHash: hash ? hash.slice(0, 7) : null,
      branchName: status.branchName,
      detachedHead: status.detachedHead,
    };
  }

  async checkoutDetachedRevision(id: string, revision: string): Promise<{ status: string; message: string }> {
    const trimmedRevision = revision.trim();
    if (!trimmedRevision) {
      throw new Error("Revision is required");
    }

    const reference = await this.ensureActionableRepo(id);
    return this.queueMutation(id, async () => {
      await this.execGit(reference.path, ["switch", "--detach", trimmedRevision], {
        timeoutMs: GIT_READ_TIMEOUT_MS,
        maxBuffer: GIT_DIFF_MAX_BUFFER,
      });
      return { status: "checked_out", message: `Checked out ${trimmedRevision} in detached HEAD mode.` };
    });
  }
}

export const gitManager = new GitManager();
