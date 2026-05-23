import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  GitBranch,
  Loader2,
  RefreshCw,
  Rocket,
  RotateCcw,
  Server,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RepositoryAvailability = "ready" | "missing" | "error";
type ServiceStatus = "stopped" | "starting" | "running" | "failed";
type BuildStatus = "idle" | "succeeded" | "failed";
type LaunchScriptName = "preview" | "start" | "dev";
type DeploymentActivationMode = "reactivate" | "rollback";
type DeploymentHistoryStatus = ServiceStatus | "inactive";

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

interface GitRevisionSnapshot {
  hash: string | null;
  shortHash: string | null;
  branchName: string | null;
  detachedHead: boolean;
}

interface DeploymentHistoryEntry {
  id: string;
  revisionHash: string | null;
  revisionShortHash: string | null;
  branchName: string | null;
  detachedHead: boolean;
  startedAt: string | null;
  createdAt: string;
  launchScript: LaunchScriptName | null;
  serviceName: string | null;
  port: number | null;
  healthCheckPath: string | null;
  logPaths: string[];
  serviceId: string | null;
  previewUrl: string | null;
  recordedStatus: ServiceStatus | null;
  buildStatus: BuildStatus;
  activationKind: "launch" | "reactivate" | "rollback";
  sourceDeploymentId: string | null;
  isActive: boolean;
  currentStatus: DeploymentHistoryStatus;
  actionMode: DeploymentActivationMode;
  activationBlockedReason: string | null;
}

interface DeploymentsProjectOverview {
  publishing: {
    repo: PublishingRepositoryOption;
    linkedServiceId: string | null;
    linkedService: {
      id: string;
      name: string;
      status: ServiceStatus;
      port?: number | null;
      healthCheckPath?: string | null;
      startedAt?: string;
    } | null;
    previewUrl: string | null;
    build: {
      status: BuildStatus;
      lastBuiltAt: string | null;
    };
    status: {
      state: "ready" | "attention" | "blocked";
      headline: string;
      nextAction: string;
    };
  };
  currentRevision: GitRevisionSnapshot;
  hasTrackedChanges: boolean;
  activeDeploymentId: string | null;
  deployments: DeploymentHistoryEntry[];
}

interface DeploymentsOverview {
  cwd: string;
  selectedRepoId: string | null;
  repositories: PublishingRepositoryOption[];
  selectedProject: DeploymentsProjectOverview | null;
  starterSite: {
    repoId: string | null;
    headline: string;
    detail: string;
  };
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatRevision(revision: { revisionShortHash: string | null; revisionHash: string | null }): string {
  return revision.revisionShortHash ?? revision.revisionHash?.slice(0, 7) ?? "unknown";
}

function availabilityVariant(status: RepositoryAvailability): "default" | "secondary" | "destructive" {
  if (status === "ready") return "default";
  if (status === "missing") return "secondary";
  return "destructive";
}

function deploymentStatusVariant(status: DeploymentHistoryStatus | BuildStatus | "unknown"): "default" | "secondary" | "destructive" | "outline" {
  if (status === "running" || status === "succeeded") {
    return "default";
  }
  if (status === "inactive" || status === "starting" || status === "idle" || status === "stopped") {
    return "secondary";
  }
  if (status === "failed") {
    return "destructive";
  }
  return "outline";
}

function actionLabel(mode: DeploymentActivationMode): string {
  return mode === "rollback" ? "Rollback" : "Re-activate";
}

export default function DeploymentsPage() {
  const initialRepoId = new URLSearchParams(window.location.search).get("repoId");
  const [overview, setOverview] = useState<DeploymentsOverview | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(initialRepoId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const selectedProject = overview?.selectedProject ?? null;
  const activeDeployment = useMemo(
    () =>
      selectedProject?.deployments.find((deployment) => deployment.id === selectedProject.activeDeploymentId) ?? null,
    [selectedProject]
  );

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

        const response = await fetch(`/api/deployments/overview${params.toString() ? `?${params.toString()}` : ""}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load deployments overview");
        }

        setOverview(data as DeploymentsOverview);
        setSelectedRepoId((data as DeploymentsOverview).selectedRepoId);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load deployments overview");
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

  const handleRepoChange = async (repoId: string) => {
    setSelectedRepoId(repoId);
    setSuccessMessage(null);
    await loadOverview(repoId);
  };

  const handleActivate = async (deploymentId: string, mode: DeploymentActivationMode) => {
    if (!selectedRepoId) {
      return;
    }

    const actionKey = `${mode}:${deploymentId}`;
    setPendingAction(actionKey);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/deployments/projects/${encodeURIComponent(selectedRepoId)}/deployments/${encodeURIComponent(deploymentId)}/activate`,
        { method: "POST" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Deployment activation failed");
      }

      setOverview(data as DeploymentsOverview);
      setSelectedRepoId((data as DeploymentsOverview).selectedRepoId);
      setSuccessMessage(mode === "rollback" ? "Rollback activated." : "Deployment re-activated.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Deployment activation failed");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-deployments">
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/publishing">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Deployments
            </h1>
            <p className="text-sm text-muted-foreground">
              Review local release history, see the active revision, and roll back or re-activate through the existing publishing flow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/publishing">
              <Button variant="outline">Publishing</Button>
            </Link>
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
              Loading deployments…
            </div>
          ) : null}

          {overview ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Project selection</CardTitle>
                  <CardDescription>Choose the tracked repository whose local deployment history you want to manage.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,320px),1fr]">
                  <div className="space-y-2">
                    <Select value={selectedRepoId ?? undefined} onValueChange={(value) => void handleRepoChange(value)}>
                      <SelectTrigger>
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
                        <div className="font-medium">{selectedProject.publishing.repo.name}</div>
                        <Badge variant={availabilityVariant(selectedProject.publishing.repo.availability)}>
                          {selectedProject.publishing.repo.availability}
                        </Badge>
                        {selectedProject.currentRevision.branchName ? (
                          <Badge variant="outline">{selectedProject.currentRevision.branchName}</Badge>
                        ) : (
                          <Badge variant="outline">detached HEAD</Badge>
                        )}
                        {selectedProject.hasTrackedChanges ? <Badge variant="secondary">tracked changes present</Badge> : null}
                      </div>
                      <div className="font-mono text-xs break-all text-muted-foreground">{selectedProject.publishing.repo.path}</div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{selectedProject.publishing.repo.changedFilesCount} changed files</span>
                        <span>{selectedProject.publishing.repo.ahead} ahead</span>
                        <span>{selectedProject.publishing.repo.behind} behind</span>
                        <span>{selectedProject.publishing.repo.upstream || "no upstream"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground">
                      Select a tracked repo from Publishing. {overview.starterSite.detail}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedProject ? (
                <>
                  <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Rocket className="h-5 w-5 text-primary" />
                          Active release
                        </CardTitle>
                        <CardDescription>{selectedProject.publishing.status.headline}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={deploymentStatusVariant(selectedProject.publishing.status.state === "blocked" ? "failed" : selectedProject.publishing.linkedService?.status ?? "unknown")}>
                            service {selectedProject.publishing.linkedService?.status ?? "unknown"}
                          </Badge>
                          <Badge variant={deploymentStatusVariant(selectedProject.publishing.build.status)}>
                            build {selectedProject.publishing.build.status}
                          </Badge>
                          <Badge variant="outline">
                            {selectedProject.currentRevision.detachedHead
                              ? `detached @ ${selectedProject.currentRevision.shortHash ?? "unknown"}`
                              : selectedProject.currentRevision.branchName || "no branch"}
                          </Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border bg-muted/10 p-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Revision</div>
                            <div className="mt-1 font-mono text-sm">{selectedProject.currentRevision.hash ?? "Unknown"}</div>
                          </div>
                          <div className="rounded-lg border bg-muted/10 p-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activated</div>
                            <div className="mt-1 text-sm">{formatTimestamp(activeDeployment?.startedAt ?? selectedProject.publishing.linkedService?.startedAt)}</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{selectedProject.publishing.status.nextAction}</p>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/publishing?repoId=${encodeURIComponent(selectedProject.publishing.repo.id)}`}>
                            <Button variant="outline" size="sm">Publishing</Button>
                          </Link>
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
                          <Link href={selectedProject.publishing.linkedServiceId ? `/logs?serviceId=${encodeURIComponent(selectedProject.publishing.linkedServiceId)}` : "/logs"}>
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4" />
                              <span className="ml-2">Logs</span>
                            </Button>
                          </Link>
                          {selectedProject.publishing.previewUrl ? (
                            <a href={selectedProject.publishing.previewUrl} target="_blank" rel="noreferrer">
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
                        <CardTitle>Deployment notes</CardTitle>
                        <CardDescription>Rollbacks rebuild and relaunch the selected revision. Re-activation keeps the current checkout but restarts the recorded launch settings.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <div className="rounded-lg border bg-muted/10 p-3">
                          Rollback switches the repo to a detached HEAD for the recorded commit so the exact revision can be relaunched.
                        </div>
                        <div className="rounded-lg border bg-muted/10 p-3">
                          Rollback and re-activation both require a clean tracked working tree. Untracked files alone do not block activation.
                        </div>
                        <div className="rounded-lg border bg-muted/10 p-3">
                          Deployment history is capped so the local publishing state stays stable and fast to rewrite.
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Deployment history</CardTitle>
                      <CardDescription>
                        {selectedProject.deployments.length} recorded release{selectedProject.deployments.length === 1 ? "" : "s"} for this repo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedProject.deployments.length === 0 ? (
                        <div className="rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground">
                          No deployments recorded yet. Launch this repo from Publishing to create the first local release entry.
                        </div>
                      ) : (
                        <ScrollArea className="max-h-[32rem] pr-4">
                          <div className="space-y-4">
                            {selectedProject.deployments.map((deployment) => {
                              const actionKey = `${deployment.actionMode}:${deployment.id}`;
                              return (
                                <div key={deployment.id} className="rounded-lg border bg-muted/10 p-4 space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-medium font-mono">{formatRevision(deployment)}</div>
                                    <Badge variant={deploymentStatusVariant(deployment.currentStatus)}>{deployment.currentStatus}</Badge>
                                    <Badge variant="outline">{deployment.launchScript ?? "unknown script"}</Badge>
                                    {deployment.branchName ? <Badge variant="outline">{deployment.branchName}</Badge> : null}
                                    {deployment.detachedHead ? <Badge variant="outline">detached</Badge> : null}
                                    <Badge variant="outline">{deployment.activationKind}</Badge>
                                  </div>
                                  <div className="grid gap-3 lg:grid-cols-[1.2fr,0.8fr,0.8fr]">
                                    <div>
                                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Service</div>
                                      <div className="mt-1 text-sm">{deployment.serviceName ?? "Unknown service"}</div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        Started {formatTimestamp(deployment.startedAt)} • recorded {formatTimestamp(deployment.createdAt)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Build</div>
                                      <div className="mt-1 text-sm">{deployment.buildStatus}</div>
                                      {deployment.port ? <div className="mt-1 text-xs text-muted-foreground">Port {deployment.port}</div> : null}
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</div>
                                      <div className="mt-1 text-sm">
                                        {deployment.sourceDeploymentId ? `From ${deployment.sourceDeploymentId.slice(0, 7)}` : "Direct launch"}
                                      </div>
                                    </div>
                                  </div>
                                  {deployment.activationBlockedReason ? (
                                    <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                                      {deployment.activationBlockedReason}
                                    </div>
                                  ) : null}
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      disabled={pendingAction !== null || Boolean(deployment.activationBlockedReason)}
                                      onClick={() => void handleActivate(deployment.id, deployment.actionMode)}
                                    >
                                      {pendingAction === actionKey ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <RotateCcw className="h-4 w-4" />
                                      )}
                                      <span className="ml-2">{actionLabel(deployment.actionMode)}</span>
                                    </Button>
                                    {deployment.previewUrl ? (
                                      <a href={deployment.previewUrl} target="_blank" rel="noreferrer">
                                        <Button variant="outline" size="sm">
                                          <ExternalLink className="h-4 w-4" />
                                          <span className="ml-2">Preview</span>
                                        </Button>
                                      </a>
                                    ) : null}
                                    {deployment.serviceId ? (
                                      <Link href={`/logs?serviceId=${encodeURIComponent(deployment.serviceId)}`}>
                                        <Button variant="outline" size="sm">
                                          <FileText className="h-4 w-4" />
                                          <span className="ml-2">Logs</span>
                                        </Button>
                                      </Link>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
