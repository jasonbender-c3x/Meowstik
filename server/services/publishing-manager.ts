import { execFile } from "node:child_process";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import {
  environmentManager,
  getStaleRuntimeServiceIds,
  isServerRestartNeeded,
  type EnvironmentVariableScope,
  type ManagedEnvironmentVariable,
} from "./environment-manager";
import {
  buildChildEnv,
  normalizeRuntimeCwd,
  runtimeManager,
  type RuntimeListener,
  type RuntimeServiceSnapshot,
} from "./runtime-manager";
import {
  gitManager,
  type GitOverview,
  type GitRepositorySummary,
  type GitRevisionSnapshot,
  type GitStatusSnapshot,
} from "./git-manager";
import { templateSiteManager, type StarterSiteSummary } from "./template-site-manager";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PUBLISHING_STATE_PATH = path.resolve(__dirname, "../../data/publishing-state.json");

const BUILD_TIMEOUT_MS = 120_000;
const BUILD_MAX_BUFFER = 4 * 1024 * 1024;
const MAX_BUILD_OUTPUT_CHARS = 16_000;
const MAX_DEPLOYMENTS_PER_PROJECT = 50;
const ENV_REQUIREMENT_FILE_NAMES = [
  ".env.example",
  ".env.sample",
  ".env.local.example",
  ".env.local.sample",
  ".env.template",
] as const;
const LAUNCH_SCRIPT_ORDER = ["preview", "start", "dev"] as const;

type PackageManager = "pnpm" | "yarn" | "npm";
type LaunchScriptName = (typeof LAUNCH_SCRIPT_ORDER)[number];
type ChecklistStatus = "ready" | "warning" | "action_required";
type PublishingHealth = "ready" | "attention" | "blocked";
type BuildStatus = "idle" | "succeeded" | "failed";
export type DeploymentActivationMode = "reactivate" | "rollback";
export type DeploymentHistoryStatus = RuntimeServiceSnapshot["status"] | "inactive";
type DeploymentActivationKind = "launch" | "reactivate" | "rollback";

export interface PublishingDeploymentRecord {
  id: string;
  revisionHash: string | null;
  revisionShortHash: string | null;
  branchName: string | null;
  detachedHead: boolean;
  startedAt: string;
  createdAt: string;
  launchScript: LaunchScriptName | null;
  serviceName: string | null;
  port: number | null;
  healthCheckPath: string | null;
  logPaths: string[];
  serviceId: string | null;
  previewUrl: string | null;
  recordedStatus: RuntimeServiceSnapshot["status"];
  buildStatus: BuildStatus;
  activationKind: DeploymentActivationKind;
  sourceDeploymentId: string | null;
}

interface PublishingProjectState {
  repoId: string;
  serviceId: string | null;
  preferredLaunchScript: LaunchScriptName | null;
  lastBuildStatus: BuildStatus;
  lastBuildCommand: string | null;
  lastBuildOutput: string | null;
  lastBuildExitCode: number | null;
  lastBuiltAt: string | null;
  lastLaunchedAt: string | null;
  activeDeploymentId: string | null;
  deployments: PublishingDeploymentRecord[];
  updatedAt: string | null;
}

interface PublishingStateFile {
  projects: PublishingProjectState[];
  updatedAt: string | null;
}

export interface PublishingScriptInfo {
  name: string;
  command: string;
}

export interface PublishingEnvRequirement {
  key: string;
  configured: boolean;
  source: "managed" | "environment" | "missing";
  examplePath: string;
}

export interface PublishingChecklistItem {
  id: "git" | "project" | "environment" | "runtime" | "logs";
  label: string;
  status: ChecklistStatus;
  description: string;
  href: string;
}

export interface PublishingStatusSummary {
  state: PublishingHealth;
  headline: string;
  nextAction: string;
}

export interface PublishingRepositoryOption {
  id: string;
  name: string;
  path: string;
  availability: GitRepositorySummary["availability"];
  branchName: string | null;
  changedFilesCount: number;
  ahead: number;
  behind: number;
  upstream: string | null;
}

export interface PublishingProjectOverview {
  repo: PublishingRepositoryOption;
  packageJsonPath: string | null;
  packageManager: PackageManager | null;
  hasPackageJson: boolean;
  buildScript: PublishingScriptInfo | null;
  launchScripts: PublishingScriptInfo[];
  defaultLaunchScript: LaunchScriptName | null;
  activeLaunchScript: LaunchScriptName | null;
  linkedServiceId: string | null;
  linkedService: RuntimeServiceSnapshot | null;
  relatedServices: Array<{
    id: string;
    name: string;
    status: RuntimeServiceSnapshot["status"];
    command: string;
  }>;
  listeners: RuntimeListener[];
  previewUrl: string | null;
  environment: {
    managedRuntimeVariableCount: number;
    managedServerVariableCount: number;
    serverRestartNeeded: boolean;
    runtimeRestartNeeded: boolean;
    requiredKeys: PublishingEnvRequirement[];
    missingRequiredKeys: string[];
    examplePath: string | null;
  };
  build: {
    available: boolean;
    status: BuildStatus;
    command: string | null;
    output: string | null;
    exitCode: number | null;
    lastBuiltAt: string | null;
  };
  checklist: PublishingChecklistItem[];
  status: PublishingStatusSummary;
}

export interface PublishingOverview {
  cwd: string;
  selectedRepoId: string | null;
  repositories: PublishingRepositoryOption[];
  selectedProject: PublishingProjectOverview | null;
  starterSite: StarterSiteSummary;
}

export interface DeploymentHistoryEntry extends PublishingDeploymentRecord {
  isActive: boolean;
  currentStatus: DeploymentHistoryStatus;
  actionMode: DeploymentActivationMode;
  activationBlockedReason: string | null;
}

export interface DeploymentsProjectOverview {
  publishing: PublishingProjectOverview;
  currentRevision: GitRevisionSnapshot;
  hasTrackedChanges: boolean;
  activeDeploymentId: string | null;
  deployments: DeploymentHistoryEntry[];
}

export interface DeploymentsOverview {
  cwd: string;
  selectedRepoId: string | null;
  repositories: PublishingRepositoryOption[];
  selectedProject: DeploymentsProjectOverview | null;
  starterSite: StarterSiteSummary;
}

export interface LaunchProjectInput {
  launchScript?: string | null;
  serviceName?: string | null;
  port?: number | null;
  healthCheckPath?: string | null;
  logPaths?: string[];
  runBuildFirst?: boolean;
  forceRestart?: boolean;
  deploymentActivationKind?: DeploymentActivationKind;
  sourceDeploymentId?: string | null;
}

const EMPTY_STATE: PublishingStateFile = {
  projects: [],
  updatedAt: null,
};

function truncateText(value: string | null | undefined, limit = MAX_BUILD_OUTPUT_CHARS): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}\n\n[truncated by Meowstik publishing output limit]\n`;
}

function createEmptyProjectState(repoId: string): PublishingProjectState {
  return {
    repoId,
    serviceId: null,
    preferredLaunchScript: null,
    lastBuildStatus: "idle",
    lastBuildCommand: null,
    lastBuildOutput: null,
    lastBuildExitCode: null,
    lastBuiltAt: null,
    lastLaunchedAt: null,
    activeDeploymentId: null,
    deployments: [],
    updatedAt: null,
  };
}

function normalizeDeploymentRecord(input: Partial<PublishingDeploymentRecord>): PublishingDeploymentRecord | null {
  if (typeof input.id !== "string" || !input.id) {
    return null;
  }

  return {
    id: input.id,
    revisionHash: typeof input.revisionHash === "string" ? input.revisionHash : null,
    revisionShortHash: typeof input.revisionShortHash === "string" ? input.revisionShortHash : null,
    branchName: typeof input.branchName === "string" ? input.branchName : null,
    detachedHead: input.detachedHead === true,
    startedAt: typeof input.startedAt === "string" ? input.startedAt : new Date().toISOString(),
    createdAt: typeof input.createdAt === "string" ? input.createdAt : typeof input.startedAt === "string" ? input.startedAt : new Date().toISOString(),
    launchScript:
      input.launchScript === "preview" || input.launchScript === "start" || input.launchScript === "dev"
        ? input.launchScript
        : null,
    serviceName: typeof input.serviceName === "string" ? input.serviceName : null,
    port: typeof input.port === "number" ? input.port : null,
    healthCheckPath: typeof input.healthCheckPath === "string" ? input.healthCheckPath : null,
    logPaths: Array.isArray(input.logPaths) ? input.logPaths.filter((value): value is string => typeof value === "string") : [],
    serviceId: typeof input.serviceId === "string" ? input.serviceId : null,
    previewUrl: typeof input.previewUrl === "string" ? input.previewUrl : null,
    recordedStatus:
      input.recordedStatus === "starting" ||
      input.recordedStatus === "running" ||
      input.recordedStatus === "failed" ||
      input.recordedStatus === "stopped"
        ? input.recordedStatus
        : "stopped",
    buildStatus: input.buildStatus === "succeeded" || input.buildStatus === "failed" ? input.buildStatus : "idle",
    activationKind:
      input.activationKind === "reactivate" || input.activationKind === "rollback" || input.activationKind === "launch"
        ? input.activationKind
        : "launch",
    sourceDeploymentId: typeof input.sourceDeploymentId === "string" ? input.sourceDeploymentId : null,
  };
}

export function resolveDeploymentActivationMode(
  currentRevisionHash: string | null,
  deploymentRevisionHash: string | null,
): DeploymentActivationMode {
  return currentRevisionHash && deploymentRevisionHash && currentRevisionHash === deploymentRevisionHash
    ? "reactivate"
    : "rollback";
}

export function deriveDeploymentHistoryStatus(
  isActive: boolean,
  linkedServiceStatus: RuntimeServiceSnapshot["status"] | null,
): DeploymentHistoryStatus {
  if (!isActive) {
    return "inactive";
  }
  return linkedServiceStatus ?? "stopped";
}

export function getDeploymentActivationBlockedReason(input: {
  isActive: boolean;
  mode: DeploymentActivationMode;
  deploymentRevisionHash: string | null;
  stagedCount: number;
  unstagedCount: number;
}): string | null {
  if (input.isActive) {
    return "This deployment is already active.";
  }

  if (input.mode === "rollback" && !input.deploymentRevisionHash) {
    return "This deployment did not capture a git revision.";
  }

  if (input.stagedCount + input.unstagedCount > 0) {
    return input.mode === "rollback"
      ? "Rollback requires a clean working tree."
      : "Re-activating a deployment requires a clean working tree.";
  }

  return null;
}

function normalizePublishingState(input: unknown): PublishingStateFile {
  if (!input || typeof input !== "object") {
    return { ...EMPTY_STATE };
  }

  const state = input as Partial<PublishingStateFile>;
  const projects = Array.isArray(state.projects)
    ? state.projects
        .filter((value): value is Partial<PublishingProjectState> => !!value && typeof value === "object")
        .map((value) => ({
          repoId: typeof value.repoId === "string" ? value.repoId : "",
          serviceId: typeof value.serviceId === "string" ? value.serviceId : null,
          preferredLaunchScript:
            value.preferredLaunchScript === "preview" ||
            value.preferredLaunchScript === "start" ||
            value.preferredLaunchScript === "dev"
              ? value.preferredLaunchScript
              : null,
          lastBuildStatus:
            value.lastBuildStatus === "succeeded" || value.lastBuildStatus === "failed" ? value.lastBuildStatus : "idle",
          lastBuildCommand: typeof value.lastBuildCommand === "string" ? value.lastBuildCommand : null,
          lastBuildOutput: typeof value.lastBuildOutput === "string" ? value.lastBuildOutput : null,
          lastBuildExitCode: typeof value.lastBuildExitCode === "number" ? value.lastBuildExitCode : null,
          lastBuiltAt: typeof value.lastBuiltAt === "string" ? value.lastBuiltAt : null,
          lastLaunchedAt: typeof value.lastLaunchedAt === "string" ? value.lastLaunchedAt : null,
          activeDeploymentId: typeof value.activeDeploymentId === "string" ? value.activeDeploymentId : null,
          deployments: Array.isArray(value.deployments)
            ? value.deployments
                .map((deployment) =>
                  deployment && typeof deployment === "object"
                    ? normalizeDeploymentRecord(deployment as Partial<PublishingDeploymentRecord>)
                    : null
                )
                .filter((deployment): deployment is PublishingDeploymentRecord => !!deployment)
                .slice(-MAX_DEPLOYMENTS_PER_PROJECT)
            : [],
          updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
        }))
        .filter((value) => value.repoId)
    : [];

  return {
    projects,
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : null,
  };
}

export function detectPackageManagerFromFiles(fileNames: string[]): PackageManager {
  const set = new Set(fileNames);
  if (set.has("pnpm-lock.yaml")) {
    return "pnpm";
  }
  if (set.has("yarn.lock")) {
    return "yarn";
  }
  if (set.has("package-lock.json")) {
    return "npm";
  }
  return "npm";
}

export function parseEnvironmentExampleKeys(content: string): string[] {
  const keys = new Set<string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice("export ".length) : line;
    const match = normalized.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
    if (match) {
      keys.add(match[1]);
    }
  }

  return [...keys];
}

function getManifestScripts(manifest: unknown): Record<string, string> {
  if (!manifest || typeof manifest !== "object") {
    return {};
  }

  const rawScripts = (manifest as { scripts?: unknown }).scripts;
  if (!rawScripts || typeof rawScripts !== "object") {
    return {};
  }

  return Object.entries(rawScripts).reduce<Record<string, string>>((accumulator, [key, value]) => {
    if (typeof value === "string" && value.trim()) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
}

export function chooseDefaultLaunchScript(
  launchScripts: PublishingScriptInfo[],
  preferredLaunchScript?: string | null
): LaunchScriptName | null {
  const preferred = preferredLaunchScript?.trim();
  if (
    preferred &&
    (preferred === "preview" || preferred === "start" || preferred === "dev") &&
    launchScripts.some((script) => script.name === preferred)
  ) {
    return preferred;
  }

  for (const name of LAUNCH_SCRIPT_ORDER) {
    if (launchScripts.some((script) => script.name === name)) {
      return name;
    }
  }

  return null;
}

function getBuildScript(scripts: Record<string, string>): PublishingScriptInfo | null {
  return scripts.build ? { name: "build", command: scripts.build } : null;
}

function getLaunchScripts(scripts: Record<string, string>): PublishingScriptInfo[] {
  return LAUNCH_SCRIPT_ORDER.filter((name) => scripts[name]).map((name) => ({
    name,
    command: scripts[name],
  }));
}

function buildPackageScriptCommand(packageManager: PackageManager, scriptName: string): { command: string; args: string[]; display: string } {
  if (packageManager === "yarn") {
    return {
      command: "yarn",
      args: [scriptName],
      display: `yarn ${scriptName}`,
    };
  }

  return {
    command: packageManager,
    args: ["run", scriptName],
    display: `${packageManager} run ${scriptName}`,
  };
}

function buildEnvironmentRequirementSnapshots(
  keys: string[],
  examplePath: string,
  managedVariables: ManagedEnvironmentVariable[]
): PublishingEnvRequirement[] {
  const managedSet = new Set(managedVariables.map((variable) => variable.key));

  return keys.map((key) => ({
    key,
    configured: managedSet.has(key) || typeof process.env[key] === "string",
    source: managedSet.has(key) ? "managed" : typeof process.env[key] === "string" ? "environment" : "missing",
    examplePath,
  }));
}

function buildPreviewUrl(service: RuntimeServiceSnapshot | null): string | null {
  if (!service || service.status !== "running" || !service.port) {
    return null;
  }

  return `http://127.0.0.1:${service.port}/`;
}

function mapRepositoryOption(repository: GitRepositorySummary): PublishingRepositoryOption {
  return {
    id: repository.id,
    name: repository.name,
    path: repository.path,
    availability: repository.availability,
    branchName: repository.branchName,
    changedFilesCount: repository.changedFilesCount,
    ahead: repository.ahead,
    behind: repository.behind,
    upstream: repository.upstream,
  };
}

export function buildPublishingChecklist(input: {
  repoAvailability: GitRepositorySummary["availability"];
  hasPackageJson: boolean;
  hasLaunchScript: boolean;
  missingEnvKeys: string[];
  serviceStatus: RuntimeServiceSnapshot["status"] | "none";
  runtimeRestartNeeded: boolean;
  gitHasUpstream: boolean;
  gitIsDirty: boolean;
  hasLogs: boolean;
}): PublishingChecklistItem[] {
  const gitStatus: ChecklistStatus =
    input.repoAvailability !== "ready"
      ? "action_required"
      : !input.gitHasUpstream || input.gitIsDirty
        ? "warning"
        : "ready";
  const projectStatus: ChecklistStatus =
    input.repoAvailability !== "ready" || !input.hasPackageJson || !input.hasLaunchScript ? "action_required" : "ready";
  const environmentStatus: ChecklistStatus =
    input.missingEnvKeys.length > 0 ? "action_required" : input.runtimeRestartNeeded ? "warning" : "ready";
  const runtimeStatus: ChecklistStatus =
    input.repoAvailability !== "ready" || !input.hasPackageJson || !input.hasLaunchScript
      ? "action_required"
      : input.serviceStatus === "running" || input.serviceStatus === "starting"
        ? "ready"
        : input.serviceStatus === "failed"
          ? "warning"
          : "action_required";
  const logsStatus: ChecklistStatus = input.hasLogs ? "ready" : input.serviceStatus === "running" ? "warning" : "action_required";

  return [
    {
      id: "git",
      label: "Git repository",
      status: gitStatus,
      description:
        input.repoAvailability !== "ready"
          ? "Select a tracked repository that exists on disk."
          : input.gitIsDirty
            ? "Repository is publishable, but the working tree has uncommitted changes."
            : !input.gitHasUpstream
              ? "Repository has no upstream branch configured yet."
              : "Repository is tracked and ready for publishing flows.",
      href: "/git",
    },
    {
      id: "project",
      label: "Project scripts",
      status: projectStatus,
      description:
        !input.hasPackageJson
          ? "A package.json is required to detect build and launch scripts."
          : !input.hasLaunchScript
            ? "Add a preview, start, or dev script to launch this project from Meowstik."
            : "Meowstik detected a runnable project script.",
      href: "/git",
    },
    {
      id: "environment",
      label: "Secrets & environment",
      status: environmentStatus,
      description:
        input.missingEnvKeys.length > 0
          ? `Missing required keys: ${input.missingEnvKeys.join(", ")}`
          : input.runtimeRestartNeeded
            ? "Managed runtime variables changed after the linked service started."
            : "Managed environment variables are ready for this project.",
      href: "/environment",
    },
    {
      id: "runtime",
      label: "Runtime service",
      status: runtimeStatus,
      description:
        input.serviceStatus === "running"
          ? "The linked publishing service is running."
          : input.serviceStatus === "starting"
            ? "The linked publishing service is still starting."
            : input.serviceStatus === "failed"
              ? "The linked publishing service failed and needs attention."
              : "Create or start a linked runtime service from this page.",
      href: "/runtime",
    },
    {
      id: "logs",
      label: "Logs",
      status: logsStatus,
      description: input.hasLogs
        ? "Recent runtime output is available."
        : input.serviceStatus === "running"
          ? "The service is running, but no recent log lines were captured yet."
          : "Logs will appear here after the linked service runs.",
      href: "/logs",
    },
  ];
}

export function derivePublishingStatus(checklist: PublishingChecklistItem[]): PublishingStatusSummary {
  const blocking = checklist.find((item) => item.status === "action_required");
  if (blocking) {
    return {
      state: "blocked",
      headline: `${blocking.label} needs attention`,
      nextAction: blocking.description,
    };
  }

  const warning = checklist.find((item) => item.status === "warning");
  if (warning) {
    return {
      state: "attention",
      headline: `${warning.label} needs follow-up`,
      nextAction: warning.description,
    };
  }

  return {
    state: "ready",
    headline: "Publishing flow is ready",
    nextAction: "Build or launch the selected project from this page.",
  };
}

function isManagedRuntimeScope(scope: EnvironmentVariableScope): boolean {
  return scope === "runtime" || scope === "all";
}

function isManagedServerScope(scope: EnvironmentVariableScope): boolean {
  return scope === "server" || scope === "all";
}

function normalizeLogPaths(input?: string[]): string[] {
  return Array.from(
    new Set(
      (input ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function serviceNeedsUpdate(
  service: RuntimeServiceSnapshot,
  desired: {
    name: string;
    command: string;
    cwd: string;
    port: number | null;
    healthCheckPath: string | null;
    logPaths: string[];
  }
): boolean {
  return (
    service.name !== desired.name ||
    service.command !== desired.command ||
    normalizeRuntimeCwd(service.cwd) !== normalizeRuntimeCwd(desired.cwd) ||
    (service.port ?? null) !== desired.port ||
    (service.healthCheckPath ?? null) !== desired.healthCheckPath ||
    JSON.stringify(service.logPaths ?? []) !== JSON.stringify(desired.logPaths)
  );
}

async function runExecFile(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: options.env,
      timeout: BUILD_TIMEOUT_MS,
      maxBuffer: BUILD_MAX_BUFFER,
    });
    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
    if (execError.code === "ENOENT") {
      throw new Error(`${command} is not installed or not available in PATH`);
    }
    if (typeof execError.code === "number" || typeof execError.stdout === "string" || typeof execError.stderr === "string") {
      return {
        exitCode: typeof execError.code === "number" ? execError.code : 1,
        stdout: execError.stdout ?? "",
        stderr: execError.stderr ?? "",
      };
    }
    throw error;
  }
}

class PublishingManager {
  private state: PublishingStateFile = { ...EMPTY_STATE };
  private initialized = false;
  private persistChain: Promise<void> = Promise.resolve();
  private repoChains = new Map<string, Promise<void>>();

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await fsp.mkdir(path.dirname(PUBLISHING_STATE_PATH), { recursive: true });
    if (!fs.existsSync(PUBLISHING_STATE_PATH)) {
      await fsp.writeFile(PUBLISHING_STATE_PATH, `${JSON.stringify(EMPTY_STATE, null, 2)}\n`, "utf8");
    }

    const raw = await fsp.readFile(PUBLISHING_STATE_PATH, "utf8");
    this.state = normalizePublishingState(JSON.parse(raw));
    this.initialized = true;
  }

  private async persistState(): Promise<void> {
    const payload = `${JSON.stringify(this.state, null, 2)}\n`;

    this.persistChain = this.persistChain.then(async () => {
      const tempPath = `${PUBLISHING_STATE_PATH}.tmp`;
      await fsp.writeFile(tempPath, payload, "utf8");
      await fsp.rename(tempPath, PUBLISHING_STATE_PATH);
    });

    await this.persistChain;
  }

  private async updateProjectState(repoId: string, updater: (current: PublishingProjectState) => PublishingProjectState): Promise<PublishingProjectState> {
    await this.ensureLoaded();

    const existing = this.state.projects.find((project) => project.repoId === repoId) ?? createEmptyProjectState(repoId);

    const next = updater(existing);
    next.updatedAt = new Date().toISOString();
    this.state.projects = this.state.projects.filter((project) => project.repoId !== repoId);
    this.state.projects.push(next);
    this.state.updatedAt = next.updatedAt;
    await this.persistState();
    return next;
  }

  private async getProjectState(repoId: string): Promise<PublishingProjectState> {
    await this.ensureLoaded();
    return this.state.projects.find((project) => project.repoId === repoId) ?? createEmptyProjectState(repoId);
  }

  private async withRepoLock<T>(repoId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.repoChains.get(repoId) ?? Promise.resolve();
    let result: T | undefined;

    const next = previous.catch(() => undefined).then(async () => {
      result = await operation();
    });

    this.repoChains.set(repoId, next.then(() => undefined, () => undefined));
    await next;
    return result as T;
  }

  private async getGitOverview(selectedRepoId?: string | null): Promise<GitOverview> {
    return gitManager.getOverview(selectedRepoId);
  }

  private async getReadyRepository(repoId: string): Promise<GitRepositorySummary> {
    const gitOverview = await this.getGitOverview(repoId);
    const repository = gitOverview.repositories.find((item) => item.id === gitOverview.selectedRepoId);
    if (!repository || repository.availability !== "ready") {
      throw new Error("Select a ready repository first.");
    }
    return repository;
  }

  private async inspectProject(repoPath: string): Promise<{
    packageJsonPath: string | null;
    packageManager: PackageManager | null;
    buildScript: PublishingScriptInfo | null;
    launchScripts: PublishingScriptInfo[];
  }> {
    const packageJsonPath = path.join(repoPath, "package.json");
    const packageJsonExists = await fsp.stat(packageJsonPath).then((stat) => stat.isFile()).catch(() => false);
    if (!packageJsonExists) {
      return {
        packageJsonPath: null,
        packageManager: null,
        buildScript: null,
        launchScripts: [],
      };
    }

    const packageJson = JSON.parse(await fsp.readFile(packageJsonPath, "utf8")) as unknown;
    const scripts = getManifestScripts(packageJson);
    const fileNames = await fsp.readdir(repoPath).catch(() => []);

    return {
      packageJsonPath,
      packageManager: detectPackageManagerFromFiles(fileNames),
      buildScript: getBuildScript(scripts),
      launchScripts: getLaunchScripts(scripts),
    };
  }

  private async inspectEnvironmentRequirements(
    repoPath: string,
    managedVariables: ManagedEnvironmentVariable[]
  ): Promise<{
    examplePath: string | null;
    requiredKeys: PublishingEnvRequirement[];
  }> {
    for (const fileName of ENV_REQUIREMENT_FILE_NAMES) {
      const candidatePath = path.join(repoPath, fileName);
      const content = await fsp.readFile(candidatePath, "utf8").catch(() => null);
      if (!content) {
        continue;
      }

      const keys = parseEnvironmentExampleKeys(content);
      if (keys.length === 0) {
        continue;
      }

      return {
        examplePath: candidatePath,
        requiredKeys: buildEnvironmentRequirementSnapshots(keys, candidatePath, managedVariables),
      };
    }

    return {
      examplePath: null,
      requiredKeys: [],
    };
  }

  private async buildProjectOverview(
    repository: GitRepositorySummary,
    runtimeServices: RuntimeServiceSnapshot[],
    listeners: RuntimeListener[],
    managedVariables: ManagedEnvironmentVariable[],
    environmentState: { lastServerChangeAt: string | null; lastRuntimeChangeAt: string | null },
    selectedRepoId: string
  ): Promise<PublishingProjectOverview> {
    const projectState = await this.getProjectState(selectedRepoId);
    const inspected = await this.inspectProject(repository.path);
    const envRequirements = await this.inspectEnvironmentRequirements(repository.path, managedVariables);
    const staleRuntimeServiceIds = getStaleRuntimeServiceIds(environmentState.lastRuntimeChangeAt, runtimeServices);
    const normalizedRepoPath = normalizeRuntimeCwd(repository.path);
    const relatedServices = runtimeServices.filter((service) => normalizeRuntimeCwd(service.cwd) === normalizedRepoPath);
    const linkedService =
      (projectState.serviceId ? relatedServices.find((service) => service.id === projectState.serviceId) : null) ??
      (relatedServices.length === 1 ? relatedServices[0] : null) ??
      null;
    const linkedServiceId = linkedService?.id ?? projectState.serviceId ?? null;
    const defaultLaunchScript = chooseDefaultLaunchScript(inspected.launchScripts, projectState.preferredLaunchScript);
    const managedRuntimeVariableCount = managedVariables.filter((variable) => isManagedRuntimeScope(variable.scope)).length;
    const managedServerVariableCount = managedVariables.filter((variable) => isManagedServerScope(variable.scope)).length;
    const processStartedAt = new Date(Date.now() - process.uptime() * 1000);
    const runtimeRestartNeeded = linkedService ? staleRuntimeServiceIds.includes(linkedService.id) : false;
    const checklist = buildPublishingChecklist({
      repoAvailability: repository.availability,
      hasPackageJson: !!inspected.packageJsonPath,
      hasLaunchScript: inspected.launchScripts.length > 0,
      missingEnvKeys: envRequirements.requiredKeys.filter((item) => !item.configured).map((item) => item.key),
      serviceStatus: linkedService?.status ?? "none",
      runtimeRestartNeeded,
      gitHasUpstream: !!repository.upstream,
      gitIsDirty: repository.changedFilesCount > 0,
      hasLogs: !!linkedService && (linkedService.recentOutput.length > 0 || (linkedService.logPaths?.length ?? 0) > 0),
    });

    return {
      repo: mapRepositoryOption(repository),
      packageJsonPath: inspected.packageJsonPath,
      packageManager: inspected.packageManager,
      hasPackageJson: !!inspected.packageJsonPath,
      buildScript: inspected.buildScript,
      launchScripts: inspected.launchScripts,
      defaultLaunchScript,
      activeLaunchScript: defaultLaunchScript,
      linkedServiceId,
      linkedService,
      relatedServices: relatedServices.map((service) => ({
        id: service.id,
        name: service.name,
        status: service.status,
        command: service.command,
      })),
      listeners: linkedService ? listeners.filter((listener) => listener.pid === linkedService.pid || listener.port === linkedService.port) : [],
      previewUrl: buildPreviewUrl(linkedService),
      environment: {
        managedRuntimeVariableCount,
        managedServerVariableCount,
        serverRestartNeeded: isServerRestartNeeded(environmentState.lastServerChangeAt, processStartedAt),
        runtimeRestartNeeded,
        requiredKeys: envRequirements.requiredKeys,
        missingRequiredKeys: envRequirements.requiredKeys.filter((item) => !item.configured).map((item) => item.key),
        examplePath: envRequirements.examplePath,
      },
      build: {
        available: !!inspected.buildScript,
        status: projectState.lastBuildStatus,
        command: projectState.lastBuildCommand,
        output: projectState.lastBuildOutput,
        exitCode: projectState.lastBuildExitCode,
        lastBuiltAt: projectState.lastBuiltAt,
      },
      checklist,
      status: derivePublishingStatus(checklist),
    };
  }

  private async appendDeploymentRecord(
    repoId: string,
    input: {
      service: RuntimeServiceSnapshot;
      launchScript: LaunchScriptName;
      activationKind: DeploymentActivationKind;
      sourceDeploymentId?: string | null;
      projectState: PublishingProjectState;
    }
  ): Promise<void> {
    const revision = await gitManager.getRevisionSnapshot(repoId);
    const record: PublishingDeploymentRecord = {
      id: nanoid(),
      revisionHash: revision.hash,
      revisionShortHash: revision.shortHash,
      branchName: revision.branchName,
      detachedHead: revision.detachedHead,
      startedAt: input.service.startedAt ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
      launchScript: input.launchScript,
      serviceName: input.service.name,
      port: input.service.port ?? null,
      healthCheckPath: input.service.healthCheckPath ?? null,
      logPaths: normalizeLogPaths(input.service.logPaths ?? []),
      serviceId: input.service.id,
      previewUrl: buildPreviewUrl(input.service),
      recordedStatus: input.service.status,
      buildStatus: input.projectState.lastBuildStatus,
      activationKind: input.activationKind,
      sourceDeploymentId: input.sourceDeploymentId ?? null,
    };

    await this.updateProjectState(repoId, (current) => {
      const deployments = [...current.deployments, record].slice(-MAX_DEPLOYMENTS_PER_PROJECT);
      return {
        ...current,
        activeDeploymentId: record.id,
        deployments,
      };
    });
  }

  async getOverview(selectedRepoId?: string | null): Promise<PublishingOverview> {
    await this.ensureLoaded();

    const [gitOverview, runtimeServices, listeners, managedVariables, environmentState] = await Promise.all([
      this.getGitOverview(selectedRepoId),
      runtimeManager.listServices(),
      runtimeManager.listListeners(),
      environmentManager.listVariables(),
      environmentManager.getState(),
    ]);

    const repositories = gitOverview.repositories.map(mapRepositoryOption);
    const selectedRepository =
      (gitOverview.selectedRepoId ? gitOverview.repositories.find((repository) => repository.id === gitOverview.selectedRepoId) : null) ?? null;
    const starterSite = await templateSiteManager.getSummary(gitOverview.repositories);

    return {
      cwd: process.cwd(),
      selectedRepoId: selectedRepository?.id ?? null,
      repositories,
      selectedProject: selectedRepository
        ? await this.buildProjectOverview(
            selectedRepository,
            runtimeServices,
            listeners,
            managedVariables,
            {
              lastServerChangeAt: environmentState.lastServerChangeAt,
              lastRuntimeChangeAt: environmentState.lastRuntimeChangeAt,
            },
            selectedRepository.id
          )
        : null,
      starterSite,
    };
  }

  async createStarterSite(): Promise<PublishingOverview> {
    const starterSite = await templateSiteManager.ensureStarterSite();
    return this.getOverview(starterSite.repoId);
  }

  private async buildDeploymentsProjectOverview(
    repoId: string,
    publishing: PublishingProjectOverview,
    projectState: PublishingProjectState,
  ): Promise<DeploymentsProjectOverview> {
    const [currentRevision, repoStatus] = await Promise.all([
      gitManager.getRevisionSnapshot(repoId),
      gitManager.getRepositoryStatus(repoId),
    ]);

    const deployments = [...projectState.deployments]
      .slice()
      .reverse()
      .map((deployment) => {
        const isActive = projectState.activeDeploymentId === deployment.id;
        const actionMode = resolveDeploymentActivationMode(currentRevision.hash, deployment.revisionHash);
        return {
          ...deployment,
          isActive,
          currentStatus: deriveDeploymentHistoryStatus(isActive, isActive ? publishing.linkedService?.status ?? null : null),
          actionMode,
          activationBlockedReason: getDeploymentActivationBlockedReason({
            isActive,
            mode: actionMode,
            deploymentRevisionHash: deployment.revisionHash,
            stagedCount: repoStatus.stagedCount,
            unstagedCount: repoStatus.unstagedCount,
          }),
        };
      });

    return {
      publishing,
      currentRevision,
      hasTrackedChanges: repoStatus.stagedCount + repoStatus.unstagedCount > 0,
      activeDeploymentId: projectState.activeDeploymentId,
      deployments,
    };
  }

  async getDeploymentsOverview(selectedRepoId?: string | null): Promise<DeploymentsOverview> {
    const overview = await this.getOverview(selectedRepoId);
    if (!overview.selectedProject || !overview.selectedRepoId) {
      return {
        cwd: overview.cwd,
        selectedRepoId: overview.selectedRepoId,
        repositories: overview.repositories,
        selectedProject: null,
        starterSite: overview.starterSite,
      };
    }

    const projectState = await this.getProjectState(overview.selectedRepoId);
    return {
      cwd: overview.cwd,
      selectedRepoId: overview.selectedRepoId,
      repositories: overview.repositories,
      selectedProject: await this.buildDeploymentsProjectOverview(
        overview.selectedRepoId,
        overview.selectedProject,
        projectState,
      ),
      starterSite: overview.starterSite,
    };
  }

  private async runBuildUnlocked(repoId: string): Promise<void> {
    const repository = await this.getReadyRepository(repoId);

    const inspected = await this.inspectProject(repository.path);
    if (!inspected.packageManager || !inspected.buildScript) {
      throw new Error("This project does not expose a build script in package.json.");
    }

    const runtimeEnvOverrides = await environmentManager.getRuntimeEnvOverrides();
    const command = buildPackageScriptCommand(inspected.packageManager, inspected.buildScript.name);
    const result = await runExecFile(command.command, command.args, {
      cwd: repository.path,
      env: buildChildEnv(process.env, runtimeEnvOverrides),
    });

    await this.updateProjectState(repoId, (current) => ({
      ...current,
      lastBuildStatus: result.exitCode === 0 ? "succeeded" : "failed",
      lastBuildCommand: command.display,
      lastBuildOutput: truncateText(`${result.stdout}${result.stderr}`.trim() || null),
      lastBuildExitCode: result.exitCode,
      lastBuiltAt: new Date().toISOString(),
    }));

    if (result.exitCode !== 0) {
      throw new Error(truncateText(`${result.stdout}\n${result.stderr}`.trim(), 2000) || "Build failed.");
    }
  }

  async runBuild(repoId: string): Promise<PublishingOverview> {
    return this.withRepoLock(repoId, async () => {
      await this.runBuildUnlocked(repoId);
      return this.getOverview(repoId);
    });
  }

  private async launchProjectUnlocked(repoId: string, input: LaunchProjectInput = {}): Promise<void> {
    const repository = await this.getReadyRepository(repoId);
    const inspected = await this.inspectProject(repository.path);
    if (!inspected.packageManager) {
      throw new Error("A package.json is required before Meowstik can launch this project.");
    }

    const launchScript = chooseDefaultLaunchScript(inspected.launchScripts, input.launchScript);
    if (!launchScript) {
      throw new Error("This project needs a preview, start, or dev script before it can launch from Meowstik.");
    }

    if (input.runBuildFirst && inspected.buildScript) {
      await this.runBuildUnlocked(repoId);
    }

    const runtimeServices = await runtimeManager.listServices();
    const projectState = await this.getProjectState(repoId);
    const linkedService =
      (projectState.serviceId ? runtimeServices.find((service) => service.id === projectState.serviceId) : null) ??
      null;

    const serviceCommand = buildPackageScriptCommand(inspected.packageManager, launchScript).display;
    const desiredConfig = {
      name: input.serviceName?.trim() || `${repository.name} publishing`,
      command: serviceCommand,
      cwd: repository.path,
      port: input.port ?? linkedService?.port ?? null,
      healthCheckPath: input.healthCheckPath?.trim() || linkedService?.healthCheckPath || null,
      logPaths: normalizeLogPaths(input.logPaths ?? linkedService?.logPaths ?? []),
    };

    let service = linkedService;
    if (!service) {
      service = await runtimeManager.createService(desiredConfig);
    } else if (serviceNeedsUpdate(service, desiredConfig)) {
      const isRunning = service.status === "running" || service.status === "starting";
      if (isRunning && !input.forceRestart) {
        throw new Error("Updating the linked publishing service will restart it. Relaunch with forceRestart enabled.");
      }

      service = await runtimeManager.updateService(service.id, desiredConfig);
    }

    if (service.status !== "running" && service.status !== "starting") {
      service = await runtimeManager.startService(service.id);
    }

    const nextState = await this.updateProjectState(repoId, (current) => ({
      ...current,
      serviceId: service?.id ?? null,
      preferredLaunchScript: launchScript,
      lastLaunchedAt: new Date().toISOString(),
    }));

    await this.appendDeploymentRecord(repoId, {
      service,
      launchScript,
      activationKind: input.deploymentActivationKind ?? "launch",
      sourceDeploymentId: input.sourceDeploymentId ?? null,
      projectState: nextState,
    });
  }

  async launchProject(repoId: string, input: LaunchProjectInput = {}): Promise<PublishingOverview> {
    return this.withRepoLock(repoId, async () => {
      await this.launchProjectUnlocked(repoId, input);
      return this.getOverview(repoId);
    });
  }

  async activateDeployment(repoId: string, deploymentId: string): Promise<DeploymentsOverview> {
    return this.withRepoLock(repoId, async () => {
      const projectState = await this.getProjectState(repoId);
      const deployment = projectState.deployments.find((item) => item.id === deploymentId);
      if (!deployment) {
        throw new Error("Deployment not found.");
      }

      const [currentRevision, repoStatus] = await Promise.all([
        gitManager.getRevisionSnapshot(repoId),
        gitManager.getRepositoryStatus(repoId),
      ]);

      const mode = resolveDeploymentActivationMode(currentRevision.hash, deployment.revisionHash);
      const blockedReason = getDeploymentActivationBlockedReason({
        isActive: projectState.activeDeploymentId === deployment.id,
        mode,
        deploymentRevisionHash: deployment.revisionHash,
        stagedCount: repoStatus.stagedCount,
        unstagedCount: repoStatus.unstagedCount,
      });
      if (blockedReason) {
        throw new Error(blockedReason);
      }

      const previousActiveDeployment =
        projectState.activeDeploymentId
          ? projectState.deployments.find((item) => item.id === projectState.activeDeploymentId) ?? null
          : null;

      try {
        if (projectState.serviceId) {
          await runtimeManager.stopService(projectState.serviceId);
        }

        if (mode === "rollback") {
          await gitManager.checkoutDetachedRevision(repoId, deployment.revisionHash!);
        }

        await this.launchProjectUnlocked(repoId, {
          launchScript: deployment.launchScript,
          serviceName: deployment.serviceName,
          port: deployment.port,
          healthCheckPath: deployment.healthCheckPath,
          logPaths: deployment.logPaths,
          runBuildFirst: true,
          forceRestart: true,
          deploymentActivationKind: mode,
          sourceDeploymentId: deployment.id,
        });
      } catch (error) {
        if (mode === "rollback" && currentRevision.hash) {
          try {
            if (currentRevision.branchName && !currentRevision.detachedHead) {
              await gitManager.checkoutRepository(repoId, { branchName: currentRevision.branchName });
            } else {
              await gitManager.checkoutDetachedRevision(repoId, currentRevision.hash);
            }
            if (previousActiveDeployment) {
              await this.launchProjectUnlocked(repoId, {
                launchScript: previousActiveDeployment.launchScript,
                serviceName: previousActiveDeployment.serviceName,
                port: previousActiveDeployment.port,
                healthCheckPath: previousActiveDeployment.healthCheckPath,
                logPaths: previousActiveDeployment.logPaths,
                runBuildFirst: false,
                forceRestart: true,
              });
            }
          } catch (restoreError) {
            console.error("[PublishingManager] Failed to restore previous deployment after rollback error:", restoreError);
          }
        }
        throw error;
      }

      return this.getDeploymentsOverview(repoId);
    });
  }

  async stopProject(repoId: string): Promise<PublishingOverview> {
    return this.withRepoLock(repoId, async () => {
      const projectState = await this.getProjectState(repoId);
      if (!projectState.serviceId) {
        throw new Error("No publishing service is linked to this repository yet.");
      }

      await runtimeManager.stopService(projectState.serviceId);
      return this.getOverview(repoId);
    });
  }

  async restartProject(repoId: string): Promise<PublishingOverview> {
    return this.withRepoLock(repoId, async () => {
      const projectState = await this.getProjectState(repoId);
      if (!projectState.serviceId) {
        throw new Error("No publishing service is linked to this repository yet.");
      }

      await runtimeManager.restartService(projectState.serviceId);
      return this.getOverview(repoId);
    });
  }
}

export const publishingManager = new PublishingManager();
