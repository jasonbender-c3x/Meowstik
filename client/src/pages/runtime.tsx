import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface AppStatus {
  liveMode: boolean;
  buildRevision: string;
  revision: string;
  environment: string;
  homeDevMode: boolean;
  errorCount: number;
  timestamp: string;
}

interface RuntimeLogEntry {
  timestamp: string;
  stream: "stdout" | "stderr" | "system";
  text: string;
}

interface RuntimeService {
  id: string;
  name: string;
  command: string;
  cwd: string;
  port?: number | null;
  healthCheckPath?: string | null;
  healthCheckUrl?: string | null;
  logPaths?: string[];
  status: "stopped" | "starting" | "running" | "failed";
  pid: number | null;
  portStatus: "open" | "closed" | "unknown";
  healthStatus: "healthy" | "unhealthy" | "unknown";
  healthDetail?: string;
  startedAt?: string;
  stoppedAt?: string;
  lastExitCode?: number | null;
  lastExitSignal?: string | null;
  recentOutput: RuntimeLogEntry[];
}

interface RuntimeListener {
  protocol: string;
  localAddress: string;
  host: string;
  port: number | null;
  processName?: string;
  pid?: number;
}

interface RuntimeOverview {
  cwd: string;
  processInfo: {
    pid: number;
    platform: string;
    nodeVersion: string;
    uptimeSeconds: number;
  };
  services: RuntimeService[];
  listeners: RuntimeListener[];
  dispatcher: {
    stats: {
      isRunning: boolean;
      queueStats: {
        pending: number;
        queued: number;
        running: number;
        completed: number;
        failed: number;
      };
      poolStats: {
        activeWorkers: number;
        idleWorkers: number;
        busyWorkers: number;
        totalJobsProcessed: number;
        totalTokensUsed: number;
      };
    };
    workers: Array<{
      id: string;
      status: string;
      lastHeartbeat?: string | null;
      totalJobsProcessed?: number | null;
    }>;
  };
}

interface RuntimeFormState {
  name: string;
  command: string;
  cwd: string;
  port: string;
  healthCheckPath: string;
  healthCheckUrl: string;
  logPaths: string;
}

const emptyForm: RuntimeFormState = {
  name: "",
  command: "",
  cwd: "",
  port: "",
  healthCheckPath: "",
  healthCheckUrl: "",
  logPaths: "",
};

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function statusBadgeVariant(status: RuntimeService["status"]): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running":
      return "default";
    case "starting":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export default function RuntimePage() {
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [overview, setOverview] = useState<RuntimeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<RuntimeService | null>(null);
  const [form, setForm] = useState<RuntimeFormState>(emptyForm);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!overview) {
      setLoading(true);
    }

    try {
      const [statusResponse, overviewResponse] = await Promise.all([
        fetch("/api/status"),
        fetch("/api/runtime/overview"),
      ]);

      const statusData = await statusResponse.json();
      const overviewData = await overviewResponse.json();

      if (!statusResponse.ok) {
        throw new Error(statusData.error || "Failed to load app status");
      }
      if (!overviewResponse.ok) {
        throw new Error(overviewData.error || "Failed to load runtime overview");
      }

      setAppStatus(statusData);
      setOverview(overviewData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [overview]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(loadData, 5000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  const openCreateDialog = () => {
    setEditingService(null);
    setForm({
      ...emptyForm,
      cwd: overview?.cwd || "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (service: RuntimeService) => {
    setEditingService(service);
    setForm({
      name: service.name,
      command: service.command,
      cwd: service.cwd,
      port: service.port ? String(service.port) : "",
      healthCheckPath: service.healthCheckPath || "",
      healthCheckUrl: service.healthCheckUrl || "",
      logPaths: (service.logPaths || []).join("\n"),
    });
    setDialogOpen(true);
  };

  const submitForm = async () => {
    setPendingAction("save-service");
    try {
      const payload = {
        name: form.name,
        command: form.command,
        cwd: form.cwd,
        port: form.port.trim() ? Number(form.port) : null,
        healthCheckPath: form.healthCheckPath.trim() || null,
        healthCheckUrl: form.healthCheckUrl.trim() || null,
        logPaths: form.logPaths
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
      };

      const response = await fetch(
        editingService ? `/api/runtime/services/${editingService.id}` : "/api/runtime/services",
        {
          method: editingService ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save service");
      }

      setDialogOpen(false);
      setForm(emptyForm);
      setEditingService(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPendingAction(null);
    }
  };

  const runServiceAction = async (serviceId: string, action: "start" | "stop" | "restart" | "delete") => {
    setPendingAction(`${action}-${serviceId}`);
    try {
      const response = await fetch(
        action === "delete" ? `/api/runtime/services/${serviceId}` : `/api/runtime/services/${serviceId}/${action}`,
        {
          method: action === "delete" ? "DELETE" : "POST",
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} service`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPendingAction(null);
    }
  };

  const toggleDispatcher = async () => {
    if (!overview) return;
    const endpoint = overview.dispatcher.stats.isRunning ? "stop" : "start";
    setPendingAction(`dispatcher-${endpoint}`);
    try {
      const response = await fetch(`/api/runtime/dispatcher/${endpoint}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${endpoint} dispatcher`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPendingAction(null);
    }
  };

  const managedPorts = useMemo(
    () => new Set((overview?.services || []).map((service) => service.port).filter((port): port is number => Boolean(port))),
    [overview]
  );

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-runtime">
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Runtime
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage long-lived local processes, watch ports, and keep an eye on the job dispatcher.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/terminal">
              <Button variant="outline" data-testid="button-open-terminal">
                <Terminal className="h-4 w-4" />
                <span className="ml-2">Terminal</span>
              </Button>
            </Link>
            <Link href="/queue">
              <Button variant="outline" data-testid="button-open-queue">
                <Activity className="h-4 w-4" />
                <span className="ml-2">Queue</span>
              </Button>
            </Link>
            <Link href="/logs">
              <Button variant="outline" data-testid="button-open-logs">
                <Terminal className="h-4 w-4" />
                <span className="ml-2">Logs</span>
              </Button>
            </Link>
            <Button onClick={loadData} variant="ghost" size="icon" data-testid="button-refresh-runtime">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-7xl mx-auto p-6 space-y-6">
            {error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive" data-testid="runtime-error">
                {error}
              </div>
            ) : null}

            {loading && !overview ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading runtime overview…
              </div>
            ) : null}

            {overview ? (
              <>
                <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Meowstik health</CardTitle>
                      <CardDescription>Current app health, environment, and platform runtime info.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Revision</div>
                        <div className="mt-1 text-lg font-semibold">{appStatus?.revision || "—"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{appStatus?.environment || "unknown"}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Server process</div>
                        <div className="mt-1 text-lg font-semibold">PID {overview.processInfo.pid}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {overview.processInfo.platform} • {overview.processInfo.nodeVersion}
                        </div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Uptime</div>
                        <div className="mt-1 text-lg font-semibold">{formatDuration(overview.processInfo.uptimeSeconds)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Errors buffered: {appStatus?.errorCount ?? 0}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Working directory</div>
                        <div className="mt-1 text-sm font-medium break-all">{overview.cwd}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {appStatus?.homeDevMode ? "Home dev mode" : "Standard auth mode"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle>Job dispatcher</CardTitle>
                        <CardDescription>Background worker pool state and queue depth.</CardDescription>
                      </div>
                      <Button onClick={toggleDispatcher} data-testid="button-toggle-dispatcher">
                        {pendingAction?.startsWith("dispatcher-") ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : overview.dispatcher.stats.isRunning ? (
                          <Square className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        <span className="ml-2">{overview.dispatcher.stats.isRunning ? "Stop" : "Start"}</span>
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Queue</div>
                          <div className="mt-2 text-sm">
                            Pending {overview.dispatcher.stats.queueStats.pending} • Queued {overview.dispatcher.stats.queueStats.queued}
                          </div>
                          <div className="text-sm">
                            Running {overview.dispatcher.stats.queueStats.running} • Failed {overview.dispatcher.stats.queueStats.failed}
                          </div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Workers</div>
                          <div className="mt-2 text-sm">
                            Active {overview.dispatcher.stats.poolStats.activeWorkers} • Idle {overview.dispatcher.stats.poolStats.idleWorkers}
                          </div>
                          <div className="text-sm">
                            Busy {overview.dispatcher.stats.poolStats.busyWorkers} • Jobs {overview.dispatcher.stats.poolStats.totalJobsProcessed}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Recent workers</div>
                        <div className="space-y-2">
                          {overview.dispatcher.workers.slice(0, 4).map((worker) => (
                            <div key={worker.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                              <div>
                                <div className="font-medium">{worker.id}</div>
                                <div className="text-muted-foreground">Last heartbeat {formatTimestamp(worker.lastHeartbeat)}</div>
                              </div>
                              <Badge variant={worker.status === "idle" ? "outline" : "secondary"}>{worker.status}</Badge>
                            </div>
                          ))}
                          {overview.dispatcher.workers.length === 0 ? (
                            <div className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
                              No workers registered yet.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>Managed services</CardTitle>
                      <CardDescription>
                        Start, stop, and restart local processes. Commands run as direct executables with args — no shell pipelines or redirects in this first slice.
                      </CardDescription>
                    </div>
                    <Button onClick={openCreateDialog} data-testid="button-add-runtime-service">
                      <Plus className="h-4 w-4" />
                      <span className="ml-2">Add service</span>
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {overview.services.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                        No runtime services defined yet. Add a dev server, worker, or background process to manage it here.
                      </div>
                    ) : (
                      overview.services.map((service) => (
                        <div key={service.id} className="rounded-xl border p-4 space-y-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold">{service.name}</h2>
                                <Badge variant={statusBadgeVariant(service.status)}>{service.status}</Badge>
                                <Badge variant={service.healthStatus === "healthy" ? "default" : service.healthStatus === "unhealthy" ? "destructive" : "outline"}>
                                  health: {service.healthStatus}
                                </Badge>
                                <Badge variant={service.portStatus === "open" ? "default" : service.portStatus === "closed" ? "secondary" : "outline"}>
                                  port: {service.portStatus}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground break-all font-mono">{service.command}</div>
                              <div className="text-sm text-muted-foreground break-all">{service.cwd}</div>
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span>PID {service.pid ?? "—"}</span>
                                <span>Port {service.port ?? "—"}</span>
                                <span>Started {formatTimestamp(service.startedAt)}</span>
                                <span>Stopped {formatTimestamp(service.stoppedAt)}</span>
                              </div>
                              {service.healthCheckUrl || service.healthCheckPath ? (
                                <div className="text-xs text-muted-foreground">
                                  Health target: {service.healthCheckUrl || `${service.port}${service.healthCheckPath}`}
                                  {service.healthCheckUrl ? <ExternalLink className="inline-block h-3 w-3 ml-1" /> : null}
                                </div>
                              ) : null}
                              {service.healthDetail ? (
                                <div className="text-xs text-muted-foreground">{service.healthDetail}</div>
                              ) : null}
                              {service.logPaths && service.logPaths.length > 0 ? (
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  <div>Managed file logs:</div>
                                  {service.logPaths.map((logPath) => (
                                    <div key={logPath} className="font-mono break-all">
                                      {logPath}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Link href={`/logs?serviceId=${encodeURIComponent(service.id)}`}>
                                <Button variant="outline" disabled={pendingAction !== null}>
                                  Logs
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                onClick={() => openEditDialog(service)}
                                disabled={pendingAction !== null}
                                data-testid={`button-edit-service-${service.id}`}
                              >
                                Edit
                              </Button>
                              {service.status === "running" || service.status === "starting" ? (
                                <Button
                                  onClick={() => runServiceAction(service.id, "stop")}
                                  disabled={pendingAction !== null}
                                  data-testid={`button-stop-service-${service.id}`}
                                >
                                  {pendingAction === `stop-${service.id}` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Square className="h-4 w-4" />
                                  )}
                                  <span className="ml-2">Stop</span>
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => runServiceAction(service.id, "start")}
                                  disabled={pendingAction !== null}
                                  data-testid={`button-start-service-${service.id}`}
                                >
                                  {pendingAction === `start-${service.id}` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                  <span className="ml-2">Start</span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                onClick={() => runServiceAction(service.id, "restart")}
                                disabled={pendingAction !== null}
                                data-testid={`button-restart-service-${service.id}`}
                              >
                                {pendingAction === `restart-${service.id}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                                <span className="ml-2">Restart</span>
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => runServiceAction(service.id, "delete")}
                                disabled={pendingAction !== null}
                                data-testid={`button-delete-service-${service.id}`}
                              >
                                {pendingAction === `delete-${service.id}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="rounded-lg bg-muted/20 p-3">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recent output</div>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">
                              {service.recentOutput.length > 0
                                ? service.recentOutput.map((entry) => `[${entry.timestamp}] ${entry.stream}: ${entry.text}`).join("\n")
                                : "No logs captured yet."}
                            </pre>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Listening ports</CardTitle>
                    <CardDescription>Current TCP listeners on this machine. Managed service ports are highlighted.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 pr-4 font-medium">Port</th>
                            <th className="py-2 pr-4 font-medium">Address</th>
                            <th className="py-2 pr-4 font-medium">Process</th>
                            <th className="py-2 pr-4 font-medium">PID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.listeners.map((listener) => (
                            <tr key={`${listener.localAddress}-${listener.pid || "none"}`} className="border-b last:border-0">
                              <td className="py-2 pr-4">
                                <div className="flex items-center gap-2">
                                  <span>{listener.port ?? "—"}</span>
                                  {listener.port && managedPorts.has(listener.port) ? <Badge variant="secondary">managed</Badge> : null}
                                </div>
                              </td>
                              <td className="py-2 pr-4 font-mono text-xs">{listener.localAddress}</td>
                              <td className="py-2 pr-4">{listener.processName || "unknown"}</td>
                              <td className="py-2 pr-4">{listener.pid ?? "—"}</td>
                            </tr>
                          ))}
                          {overview.listeners.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-muted-foreground">
                                No listening ports detected.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit runtime service" : "Add runtime service"}</DialogTitle>
            <DialogDescription>
              Use a direct executable plus args, like <code>pnpm dev</code> or <code>python -m http.server 4173</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="runtime-name">Name</Label>
              <Input id="runtime-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="runtime-command">Command</Label>
              <Input
                id="runtime-command"
                value={form.command}
                onChange={(event) => setForm((current) => ({ ...current, command: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="runtime-cwd">Working directory</Label>
              <Input id="runtime-cwd" value={form.cwd} onChange={(event) => setForm((current) => ({ ...current, cwd: event.target.value }))} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="runtime-port">Port</Label>
                <Input
                  id="runtime-port"
                  inputMode="numeric"
                  value={form.port}
                  onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
                  placeholder="3000"
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="runtime-health-path">Health check path</Label>
                <Input
                  id="runtime-health-path"
                  value={form.healthCheckPath}
                  onChange={(event) => setForm((current) => ({ ...current, healthCheckPath: event.target.value }))}
                  placeholder="/health"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="runtime-health-url">Explicit health URL</Label>
              <Input
                id="runtime-health-url"
                value={form.healthCheckUrl}
                onChange={(event) => setForm((current) => ({ ...current, healthCheckUrl: event.target.value }))}
                placeholder="http://127.0.0.1:3000/health"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="runtime-log-paths">Managed log files</Label>
              <Textarea
                id="runtime-log-paths"
                value={form.logPaths}
                onChange={(event) => setForm((current) => ({ ...current, logPaths: event.target.value }))}
                placeholder={"logs/app.log\nlogs/worker/error.log"}
                rows={4}
              />
              <div className="text-xs text-muted-foreground">
                One path per line. Relative paths are resolved from the service working directory and must stay inside it.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={pendingAction === "save-service"}>
              {pendingAction === "save-service" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">{editingService ? "Save changes" : "Create service"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
