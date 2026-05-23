import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  FileText,
  GitBranch,
  Loader2,
  RefreshCw,
  Rocket,
  Server,
  Shield,
  Square,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type RepositoryAvailability = "ready" | "missing" | "error";
type ChecklistStatus = "ready" | "warning" | "action_required";
type PublishingHealth = "ready" | "attention" | "blocked";
type BuildStatus = "idle" | "succeeded" | "failed";
type ServiceStatus = "stopped" | "starting" | "running" | "failed";
type LaunchScriptName = "preview" | "start" | "dev";

interface PublishingRepositoryOption {
  id: string;
  name: string;
  path: string;
  availability: RepositoryAvailability;
  branchName: string | null;
  changedFilesCount: number;
  ahead: number;
  behind: number;
  upstream: string | null;
}

interface PublishingScriptInfo {
  name: string;
  command: string;
}

interface PublishingEnvRequirement {
  key: string;
  configured: boolean;
  source: "managed" | "environment" | "missing";
  examplePath: string;
}

interface PublishingChecklistItem {
  id: "git" | "project" | "environment" | "runtime" | "logs";
  label: string;
  status: ChecklistStatus;
  description: string;
  href: string;
}

interface PublishingStatusSummary {
  state: PublishingHealth;
  headline: string;
  nextAction: string;
}

interface PublishingProjectOverview {
  repo: PublishingRepositoryOption;
  packageJsonPath: string | null;
  packageManager: "pnpm" | "yarn" | "npm" | null;
  hasPackageJson: boolean;
  buildScript: PublishingScriptInfo | null;
  launchScripts: PublishingScriptInfo[];
  defaultLaunchScript: LaunchScriptName | null;
  activeLaunchScript: LaunchScriptName | null;
  linkedServiceId: string | null;
  linkedService: {
    id: string;
    name: string;
    command: string;
    cwd: string;
    port?: number | null;
    healthCheckPath?: string | null;
    logPaths?: string[];
    status: ServiceStatus;
    pid: number | null;
    portStatus: "open" | "closed" | "unknown";
    healthStatus: "healthy" | "unhealthy" | "unknown";
    healthDetail?: string;
    startedAt?: string;
    stoppedAt?: string;
    recentOutput: Array<{
      timestamp: string;
      stream: "stdout" | "stderr" | "system";
      text: string;
    }>;
  } | null;
  relatedServices: Array<{
    id: string;
    name: string;
    status: ServiceStatus;
    command: string;
  }>;
  listeners: Array<{
    protocol: string;
    localAddress: string;
    host: string;
    port: number | null;
    processName?: string;
    pid?: number;
  }>;
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

interface PublishingOverview {
  cwd: string;
  selectedRepoId: string | null;
  repositories: PublishingRepositoryOption[];
  selectedProject: PublishingProjectOverview | null;
  starterSite: {
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
  };
}

interface LaunchFormState {
  launchScript: string;
  serviceName: string;
  port: string;
  healthCheckPath: string;
  logPaths: string;
  forceRestart: boolean;
}

const emptyForm: LaunchFormState = {
  launchScript: "",
  serviceName: "",
  port: "",
  healthCheckPath: "",
  logPaths: "",
  forceRestart: false,
};

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusVariant(status: ChecklistStatus | PublishingHealth | ServiceStatus | BuildStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ready" || status === "running" || status === "succeeded") {
    return "default";
  }
  if (status === "warning" || status === "attention" || status === "starting" || status === "idle") {
    return "secondary";
  }
  if (status === "action_required" || status === "blocked" || status === "failed") {
    return "destructive";
  }
  return "outline";
}

function availabilityVariant(status: RepositoryAvailability): "default" | "secondary" | "destructive" {
  if (status === "ready") return "default";
  if (status === "missing") return "secondary";
  return "destructive";
}

function starterStatusVariant(status: PublishingOverview["starterSite"]["status"]): "default" | "secondary" | "destructive" {
  if (status === "ready") return "default";
  if (status === "available") return "secondary";
  return "destructive";
}

export default function PublishingPage() {
  const initialRepoId = new URLSearchParams(window.location.search).get("repoId");
  const [overview, setOverview] = useState<PublishingOverview | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(initialRepoId);
  const [form, setForm] = useState<LaunchFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const selectedProject = overview?.selectedProject ?? null;
  const starterSite = overview?.starterSite ?? null;

  const loadOverview = useCallback(
    async (repoIdOverride?: string | null) => {
      if (!overview) {
        setLoading(true);
      }

      try {
        const targetRepoId = repoIdOverride ?? selectedRepoId;
        const params = new URLSearchParams();
        if (targetRepoId) {
          params.set("repoId", targetRepoId);
        }

        const response = await fetch(`/api/publishing/overview${params.toString() ? `?${params.toString()}` : ""}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load publishing overview");
        }

        const nextOverview = data as PublishingOverview;
        setOverview(nextOverview);
        setSelectedRepoId(nextOverview.selectedRepoId);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load publishing overview");
      } finally {
        setLoading(false);
      }
    },
    [overview, selectedRepoId]
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadOverview();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    setForm({
      launchScript: selectedProject.activeLaunchScript ?? selectedProject.defaultLaunchScript ?? "",
      serviceName: selectedProject.linkedService?.name ?? `${selectedProject.repo.name} publishing`,
      port:
        selectedProject.linkedService?.port
          ? String(selectedProject.linkedService.port)
          : starterSite?.repoId === selectedProject.repo.id
            ? String(starterSite.recommendedPort)
            : "",
      healthCheckPath:
        selectedProject.linkedService?.healthCheckPath ??
        (starterSite?.repoId === selectedProject.repo.id ? starterSite.recommendedHealthCheckPath : ""),
      logPaths: (selectedProject.linkedService?.logPaths ?? []).join("\n"),
      forceRestart: false,
    });
  }, [
    selectedProject?.repo.id,
    selectedProject?.linkedServiceId,
    selectedProject?.activeLaunchScript,
    selectedProject?.defaultLaunchScript,
    starterSite?.repoId,
    starterSite?.recommendedPort,
    starterSite?.recommendedHealthCheckPath,
  ]);

  const handleRepoChange = async (repoId: string) => {
    setSelectedRepoId(repoId);
    setSuccessMessage(null);
    await loadOverview(repoId);
  };

  const postAction = async (actionKey: string, url: string, success: string, body?: Record<string, unknown>) => {
    setPendingAction(actionKey);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Publishing action failed");
      }

      setOverview(data as PublishingOverview);
      setSelectedRepoId((data as PublishingOverview).selectedRepoId);
      setSuccessMessage(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Publishing action failed");
    } finally {
      setPendingAction(null);
    }
  };

  const launchPayload = useMemo(
    () => ({
      launchScript: form.launchScript || undefined,
      serviceName: form.serviceName.trim() || null,
      port: form.port.trim() ? Number(form.port) : null,
      healthCheckPath: form.healthCheckPath.trim() || null,
      logPaths: form.logPaths
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      forceRestart: form.forceRestart,
    }),
    [form]
  );

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-publishing">
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Publishing
            </h1>
            <p className="text-sm text-muted-foreground">
              Build and launch a local project from Meowstik while keeping Git, Runtime, Logs, and Environment in one workflow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedRepoId ? (
              <Link href={`/deployments?repoId=${encodeURIComponent(selectedRepoId)}`}>
                <Button variant="outline">Deployments</Button>
              </Link>
            ) : null}
            <Button onClick={() => void loadOverview()} variant="ghost" size="icon">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
              {successMessage}
            </div>
          ) : null}

          {loading && !overview ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading publishing overview…
            </div>
          ) : null}

          {overview ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Project selection</CardTitle>
                  <CardDescription>Choose the repository you want to build and launch from inside Meowstik.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,320px),1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="publishing-repo">Repository</Label>
                    <Select value={selectedRepoId ?? undefined} onValueChange={(value) => void handleRepoChange(value)}>
                      <SelectTrigger id="publishing-repo">
                        <SelectValue placeholder="Select a repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {overview.repositories.map((repo) => (
                          <SelectItem key={repo.id} value={repo.id}>
                            {repo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedProject ? (
                    <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{selectedProject.repo.name}</div>
                        <Badge variant={availabilityVariant(selectedProject.repo.availability)}>{selectedProject.repo.availability}</Badge>
                        {selectedProject.repo.branchName ? <Badge variant="outline">{selectedProject.repo.branchName}</Badge> : null}
                      </div>
                      <div className="font-mono text-xs break-all text-muted-foreground">{selectedProject.repo.path}</div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{selectedProject.repo.changedFilesCount} changed files</span>
                        <span>{selectedProject.repo.ahead} ahead</span>
                        <span>{selectedProject.repo.behind} behind</span>
                        <span>{selectedProject.repo.upstream || "no upstream"}</span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Starter website</CardTitle>
                  <CardDescription>
                    Keep a concrete local website on hand so Meowstik always has something to edit, preview, version, and publish.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={starterStatusVariant(overview.starterSite.status)}>{overview.starterSite.status}</Badge>
                    {overview.starterSite.repoId ? <Badge variant="outline">tracked repo</Badge> : null}
                    {overview.starterSite.gitInitialized ? <Badge variant="outline">git ready</Badge> : null}
                  </div>
                  <div>
                    <div className="text-base font-medium">{overview.starterSite.headline}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{overview.starterSite.detail}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Path</div>
                      <div className="mt-1 font-mono text-xs break-all">{overview.starterSite.path}</div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended port</div>
                        <div className="mt-1 text-sm">{overview.starterSite.recommendedPort}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Health check</div>
                        <div className="mt-1 text-sm">{overview.starterSite.recommendedHealthCheckPath}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary files to edit</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {overview.starterSite.editableFiles.map((file) => (
                          <Badge key={file} variant="outline">
                            {file}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pendingAction !== null}
                      onClick={() =>
                        void postAction(
                          "starter-create",
                          "/api/publishing/starter-site/create",
                          overview.starterSite.repoId ? "Starter website reconnected." : "Starter website created.",
                        )
                      }
                    >
                      {pendingAction === "starter-create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                      <span className="ml-2">{overview.starterSite.repoId ? "Reconnect starter website" : "Create starter website"}</span>
                    </Button>
                    {overview.starterSite.repoId ? (
                      <Button
                        variant="outline"
                        disabled={pendingAction !== null}
                        onClick={() => void handleRepoChange(overview.starterSite.repoId!)}
                      >
                        Open in Publishing
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {selectedProject ? (
                <>
                  <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-primary" />
                          Status
                        </CardTitle>
                        <CardDescription>Current publishing readiness and the next action Meowstik recommends.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(selectedProject.status.state)}>{selectedProject.status.state}</Badge>
                          {selectedProject.linkedService ? (
                            <Badge variant={statusVariant(selectedProject.linkedService.status)}>
                              service {selectedProject.linkedService.status}
                            </Badge>
                          ) : null}
                          {selectedProject.build.available ? (
                            <Badge variant={statusVariant(selectedProject.build.status)}>build {selectedProject.build.status}</Badge>
                          ) : null}
                        </div>
                        <div>
                          <div className="text-base font-medium">{selectedProject.status.headline}</div>
                          <p className="text-sm text-muted-foreground mt-1">{selectedProject.status.nextAction}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href="/git">
                            <Button variant="outline" size="sm">
                              <GitBranch className="h-4 w-4" />
                              <span className="ml-2">Git</span>
                            </Button>
                          </Link>
                          <Link href="/runtime">
                            <Button variant="outline" size="sm">
                              <Server className="h-4 w-4" />
                              <span className="ml-2">Runtime</span>
                            </Button>
                          </Link>
                          <Link href="/environment">
                            <Button variant="outline" size="sm">
                              <Shield className="h-4 w-4" />
                              <span className="ml-2">Environment</span>
                            </Button>
                          </Link>
                          <Link href={selectedProject.linkedServiceId ? `/logs?serviceId=${encodeURIComponent(selectedProject.linkedServiceId)}` : "/logs"}>
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4" />
                              <span className="ml-2">Logs</span>
                            </Button>
                          </Link>
                          {selectedProject.previewUrl ? (
                            <a href={selectedProject.previewUrl} target="_blank" rel="noreferrer">
                              <Button size="sm">
                                <ExternalLink className="h-4 w-4" />
                                <span className="ml-2">Open preview</span>
                              </Button>
                            </a>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Checklist</CardTitle>
                        <CardDescription>Every publishing prerequisite that Meowstik is checking for this repository.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedProject.checklist.map((item) => (
                          <div key={item.id} className="rounded-lg border bg-muted/10 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{item.label}</div>
                              <Badge variant={statusVariant(item.status)}>{item.status.replace("_", " ")}</Badge>
                              <Link href={item.href}>
                                <Button variant="ghost" size="sm" className="h-7 px-2">
                                  Open
                                </Button>
                              </Link>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wrench className="h-5 w-5 text-primary" />
                          Build & launch
                        </CardTitle>
                        <CardDescription>
                          {selectedProject.packageManager
                            ? `Using ${selectedProject.packageManager} in ${selectedProject.packageJsonPath || "this repository"}.`
                            : "A package.json is required before Meowstik can run project scripts."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="launch-script">Launch script</Label>
                            <Select
                              value={form.launchScript || undefined}
                              onValueChange={(value) => setForm((current) => ({ ...current, launchScript: value }))}
                              disabled={selectedProject.launchScripts.length === 0}
                            >
                              <SelectTrigger id="launch-script">
                                <SelectValue placeholder="Select a script" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedProject.launchScripts.map((script) => (
                                  <SelectItem key={script.name} value={script.name}>
                                    {script.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedProject.launchScripts.length > 0 ? (
                              <div className="text-xs text-muted-foreground">
                                {selectedProject.launchScripts.find((script) => script.name === form.launchScript)?.command}
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="service-name">Service name</Label>
                            <Input
                              id="service-name"
                              value={form.serviceName}
                              onChange={(event) => setForm((current) => ({ ...current, serviceName: event.target.value }))}
                              placeholder={`${selectedProject.repo.name} publishing`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="service-port">Port</Label>
                            <Input
                              id="service-port"
                              inputMode="numeric"
                              value={form.port}
                              onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
                              placeholder="Optional"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="service-health">Health check path</Label>
                            <Input
                              id="service-health"
                              value={form.healthCheckPath}
                              onChange={(event) => setForm((current) => ({ ...current, healthCheckPath: event.target.value }))}
                              placeholder="/"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="service-logs">Extra log paths</Label>
                          <Textarea
                            id="service-logs"
                            value={form.logPaths}
                            onChange={(event) => setForm((current) => ({ ...current, logPaths: event.target.value }))}
                            rows={4}
                            placeholder="/absolute/path/to/app.log"
                          />
                          <p className="text-xs text-muted-foreground">One path per line. Leave blank to rely on captured stdout and stderr.</p>
                        </div>

                        <div className="flex items-start gap-3 rounded-lg border bg-muted/10 px-4 py-3">
                          <Checkbox
                            id="force-restart"
                            checked={form.forceRestart}
                            onCheckedChange={(checked) => setForm((current) => ({ ...current, forceRestart: checked === true }))}
                          />
                          <div className="space-y-1">
                            <Label htmlFor="force-restart">Allow Meowstik to restart the linked service when configuration changes</Label>
                            <p className="text-xs text-muted-foreground">
                              Keep this enabled only when you want a running publishing service to be reconfigured in place.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            disabled={!selectedProject.build.available || pendingAction !== null}
                            onClick={() =>
                              void postAction(
                                "build",
                                `/api/publishing/projects/${encodeURIComponent(selectedProject.repo.id)}/build`,
                                "Build finished."
                              )
                            }
                          >
                            {pendingAction === "build" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                            <span className="ml-2">Build</span>
                          </Button>

                          <Button
                            disabled={!form.launchScript || pendingAction !== null}
                            onClick={() =>
                              void postAction(
                                "build-launch",
                                `/api/publishing/projects/${encodeURIComponent(selectedProject.repo.id)}/launch`,
                                selectedProject.build.available ? "Build and launch finished." : "Project launched.",
                                {
                                  ...launchPayload,
                                  runBuildFirst: !!selectedProject.build.available,
                                }
                              )
                            }
                          >
                            {pendingAction === "build-launch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                            <span className="ml-2">{selectedProject.build.available ? "Build & Launch" : "Launch"}</span>
                          </Button>

                          {selectedProject.build.available ? (
                            <Button
                              variant="secondary"
                              disabled={!form.launchScript || pendingAction !== null}
                              onClick={() =>
                                void postAction(
                                  "launch",
                                  `/api/publishing/projects/${encodeURIComponent(selectedProject.repo.id)}/launch`,
                                  "Project launched without rebuilding.",
                                  {
                                    ...launchPayload,
                                    runBuildFirst: false,
                                  }
                                )
                              }
                            >
                              {pendingAction === "launch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                              <span className="ml-2">Launch only</span>
                            </Button>
                          ) : null}

                          <Button
                            variant="outline"
                            disabled={!selectedProject.linkedServiceId || pendingAction !== null}
                            onClick={() =>
                              void postAction(
                                "restart",
                                `/api/publishing/projects/${encodeURIComponent(selectedProject.repo.id)}/restart`,
                                "Publishing service restarted."
                              )
                            }
                          >
                            {pendingAction === "restart" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            <span className="ml-2">Restart</span>
                          </Button>

                          <Button
                            variant="outline"
                            disabled={!selectedProject.linkedServiceId || pendingAction !== null}
                            onClick={() =>
                              void postAction(
                                "stop",
                                `/api/publishing/projects/${encodeURIComponent(selectedProject.repo.id)}/stop`,
                                "Publishing service stopped."
                              )
                            }
                          >
                            {pendingAction === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                            <span className="ml-2">Stop</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Secrets & environment</CardTitle>
                        <CardDescription>Project-level requirements plus the managed variables Meowstik can inject into runtime services.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>{selectedProject.environment.managedRuntimeVariableCount} managed runtime vars</span>
                          <span>{selectedProject.environment.managedServerVariableCount} managed server vars</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={selectedProject.environment.serverRestartNeeded ? "secondary" : "outline"}>
                            server restart {selectedProject.environment.serverRestartNeeded ? "needed" : "not needed"}
                          </Badge>
                          <Badge variant={selectedProject.environment.runtimeRestartNeeded ? "secondary" : "outline"}>
                            runtime restart {selectedProject.environment.runtimeRestartNeeded ? "needed" : "not needed"}
                          </Badge>
                        </div>
                        {selectedProject.environment.examplePath ? (
                          <div className="rounded-lg border bg-muted/10 p-3 text-sm">
                            <div className="font-medium">Detected example env file</div>
                            <div className="mt-1 font-mono text-xs break-all text-muted-foreground">{selectedProject.environment.examplePath}</div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                            No .env example file was detected at the repository root.
                          </div>
                        )}
                        {selectedProject.environment.requiredKeys.length > 0 ? (
                          <div className="space-y-2">
                            {selectedProject.environment.requiredKeys.map((item) => (
                              <div key={item.key} className="flex flex-wrap items-center gap-2 rounded-lg border bg-background/80 px-3 py-2 text-sm">
                                <div className="font-medium">{item.key}</div>
                                <Badge variant={item.configured ? "default" : "destructive"}>
                                  {item.configured ? item.source : "missing"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle>Linked runtime service</CardTitle>
                        <CardDescription>Live runtime details for the publishing service tied to this repository.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {selectedProject.linkedService ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{selectedProject.linkedService.name}</div>
                              <Badge variant={statusVariant(selectedProject.linkedService.status)}>
                                {selectedProject.linkedService.status}
                              </Badge>
                              {selectedProject.linkedService.port ? (
                                <Badge variant="outline">port {selectedProject.linkedService.port}</Badge>
                              ) : null}
                            </div>
                            <div className="font-mono text-xs break-all text-muted-foreground">{selectedProject.linkedService.command}</div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span>PID {selectedProject.linkedService.pid ?? "—"}</span>
                              <span>health {selectedProject.linkedService.healthStatus}</span>
                              <span>port {selectedProject.linkedService.portStatus}</span>
                              <span>started {formatTimestamp(selectedProject.linkedService.startedAt)}</span>
                            </div>
                            {selectedProject.linkedService.healthDetail ? (
                              <div className="rounded-lg border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                                {selectedProject.linkedService.healthDetail}
                              </div>
                            ) : null}
                            {selectedProject.listeners.length > 0 ? (
                              <div className="space-y-2">
                                <div className="text-sm font-medium">Observed listeners</div>
                                {selectedProject.listeners.map((listener) => (
                                  <div key={`${listener.localAddress}-${listener.pid ?? "none"}`} className="rounded-lg border bg-background/80 px-3 py-2 text-sm">
                                    <div>{listener.localAddress}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {listener.processName || "process"} • pid {listener.pid ?? "unknown"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {selectedProject.relatedServices.length > 1 ? (
                              <div className="space-y-2">
                                <div className="text-sm font-medium">Other services in this repository</div>
                                {selectedProject.relatedServices
                                  .filter((service) => service.id !== selectedProject.linkedServiceId)
                                  .map((service) => (
                                    <div key={service.id} className="rounded-lg border bg-background/80 px-3 py-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <div className="font-medium">{service.name}</div>
                                        <Badge variant={statusVariant(service.status)}>{service.status}</Badge>
                                      </div>
                                      <div className="mt-1 font-mono text-xs break-all text-muted-foreground">{service.command}</div>
                                    </div>
                                  ))}
                              </div>
                            ) : null}
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Recent output</div>
                              <ScrollArea className="h-56 rounded-lg border bg-muted/10">
                                <div className="space-y-2 p-3">
                                  {selectedProject.linkedService.recentOutput.length > 0 ? (
                                    selectedProject.linkedService.recentOutput.map((entry, index) => (
                                      <div key={`${entry.timestamp}-${index}`} className="rounded-md border bg-background/80 p-3">
                                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                          <span>{formatTimestamp(entry.timestamp)}</span>
                                          <Badge variant="outline">{entry.stream}</Badge>
                                        </div>
                                        <pre className="whitespace-pre-wrap break-words text-xs leading-5">{entry.text}</pre>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                                      No captured output yet.
                                    </div>
                                  )}
                                </div>
                              </ScrollArea>
                            </div>
                          </>
                        ) : (
                          <div className="rounded-lg border border-dashed px-4 py-10 text-sm text-muted-foreground">
                            Launch the project to create and link a publishing service.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Build history</CardTitle>
                        <CardDescription>The latest build result captured by Meowstik for this repository.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(selectedProject.build.status)}>{selectedProject.build.status}</Badge>
                          {selectedProject.build.command ? <Badge variant="outline">{selectedProject.build.command}</Badge> : null}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Last built: {formatTimestamp(selectedProject.build.lastBuiltAt)}
                          {selectedProject.build.exitCode !== null ? ` • exit ${selectedProject.build.exitCode}` : ""}
                        </div>
                        <ScrollArea className="h-72 rounded-lg border bg-muted/10">
                          <div className="p-4">
                            {selectedProject.build.output ? (
                              <pre className="whitespace-pre-wrap break-words text-xs leading-5">{selectedProject.build.output}</pre>
                            ) : (
                              <div className="rounded-lg border border-dashed px-4 py-12 text-sm text-muted-foreground">
                                No build output has been captured yet.
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
