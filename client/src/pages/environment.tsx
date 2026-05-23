import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type VariableScope = "server" | "runtime" | "all";
type VariableStatus = "configured" | "pending_restart" | "missing";
type VariableSource = "managed" | "managed+environment" | "environment" | "missing";

interface EnvironmentSummary {
  environment: "production" | "local";
  server_hostname: string;
  cwd: string;
  processStartTime: string;
  overrideFilePath: string;
  stateFilePath: string;
  managedVariableCount: number;
  configuredCatalogCount: number;
  serverRestartNeeded: boolean;
  lastChangedAt?: string | null;
  lastServerChangeAt?: string | null;
  lastRuntimeChangeAt?: string | null;
  staleRuntimeServiceIds: string[];
  staleRuntimeServices: Array<{
    id: string;
    name: string;
    startedAt?: string;
  }>;
}

interface EnvironmentVariable {
  key: string;
  label: string;
  group: string;
  description?: string | null;
  scope: VariableScope | null;
  scopeHint: VariableScope;
  isSecret: boolean;
  source: VariableSource;
  status: VariableStatus;
  valuePreview: string | null;
  revealable: boolean;
  hasManagedValue: boolean;
  hasLiveValue: boolean;
  serverRestartNeeded: boolean;
  runtimeRestartNeeded: boolean;
  updatedAt?: string;
}

interface EnvironmentOverview {
  summary: EnvironmentSummary;
  catalog: EnvironmentVariable[];
  managed: EnvironmentVariable[];
}

interface EnvironmentFormState {
  key: string;
  value: string;
  scope: VariableScope;
  description: string;
}

const emptyForm: EnvironmentFormState = {
  key: "",
  value: "",
  scope: "server",
  description: "",
};

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function formatScope(scope: VariableScope | null): string {
  return scope ? scope.replace("_", " ") : "not managed";
}

function formatSource(source: VariableSource): string {
  switch (source) {
    case "managed+environment":
      return "managed + live env";
    case "environment":
      return "live env";
    case "managed":
      return "managed";
    default:
      return "missing";
  }
}

function statusBadgeVariant(status: VariableStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "configured") {
    return "default";
  }
  if (status === "pending_restart") {
    return "secondary";
  }
  return "outline";
}

function scopeBadgeVariant(scope: VariableScope | null): "secondary" | "outline" {
  return scope ? "secondary" : "outline";
}

export default function EnvironmentPage() {
  const [overview, setOverview] = useState<EnvironmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyLocked, setKeyLocked] = useState(false);
  const [form, setForm] = useState<EnvironmentFormState>(emptyForm);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/environment/overview");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load environment overview");
      }

      const data = (await response.json()) as EnvironmentOverview;
      setOverview(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load environment overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const openCreateDialog = () => {
    setEditingKey(null);
    setKeyLocked(false);
    setForm(emptyForm);
    setDialogLoading(false);
    setDialogOpen(true);
  };

  const openManageDialog = async (variable: EnvironmentVariable) => {
    setEditingKey(variable.hasManagedValue ? variable.key : null);
    setKeyLocked(variable.hasManagedValue || variable.source !== "missing" || variable.group !== "Custom");
    setDialogLoading(variable.hasManagedValue);
    setForm({
      key: variable.key,
      value: "",
      scope: variable.scope ?? variable.scopeHint,
      description: variable.description ?? "",
    });
    setDialogOpen(true);

    if (!variable.hasManagedValue) {
      setDialogLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/environment/variables/${encodeURIComponent(variable.key)}/value`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to reveal variable value");
      }

      const data = (await response.json()) as { value: string };
      setForm((current) => ({ ...current, value: data.value }));
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "Failed to reveal variable value");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const url = editingKey ? `/api/environment/variables/${encodeURIComponent(editingKey)}` : "/api/environment/variables";
      const method = editingKey ? "PUT" : "POST";
      const payload = editingKey
        ? {
            value: form.value,
            scope: form.scope,
            description: form.description || null,
          }
        : {
            key: form.key,
            value: form.value,
            scope: form.scope,
            description: form.description || null,
          };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save variable");
      }

      setDialogOpen(false);
      setRevealedValues((current) => {
        const next = { ...current };
        if (editingKey) {
          delete next[editingKey];
        }
        return next;
      });
      await loadOverview();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save variable");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`Delete managed variable ${key}?`)) {
      return;
    }

    setPendingActionKey(key);
    setError(null);

    try {
      const response = await fetch(`/api/environment/variables/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete variable");
      }

      setRevealedValues((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      await loadOverview();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete variable");
    } finally {
      setPendingActionKey(null);
    }
  };

  const toggleReveal = async (key: string) => {
    if (revealedValues[key] !== undefined) {
      setRevealedValues((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }

    setPendingActionKey(key);
    setError(null);

    try {
      const response = await fetch(`/api/environment/variables/${encodeURIComponent(key)}/value`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to reveal variable value");
      }

      const data = (await response.json()) as { value: string };
      setRevealedValues((current) => ({
        ...current,
        [key]: data.value,
      }));
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "Failed to reveal variable value");
    } finally {
      setPendingActionKey(null);
    }
  };

  if (loading && !overview) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto flex max-w-6xl items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading environment controls…
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Environment</CardTitle>
              <CardDescription>{error ?? "Environment overview is unavailable."}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => void loadOverview()}>Retry</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              Local platform / Secrets & Environment
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Environment</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Manage Meowstik&apos;s local environment variables with explicit server/runtime scopes. Managed values are
              owner-visible here, masked by default, and applied through a generated local overrides file plus runtime
              injection for newly started services.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void loadOverview()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <Link href="/runtime">
                <Server className="mr-2 h-4 w-4" />
                Runtime
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
            <Button onClick={openCreateDialog} data-testid="button-add-managed-variable">
              <Plus className="mr-2 h-4 w-4" />
              Add variable
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border-destructive/40">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Process</CardTitle>
              <CardDescription>{overview.summary.environment} on {overview.summary.server_hostname}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div><span className="font-medium text-foreground">Started:</span> {formatTimestamp(overview.summary.processStartTime)}</div>
              <div><span className="font-medium text-foreground">Working dir:</span> {overview.summary.cwd}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Managed state</CardTitle>
              <CardDescription>{overview.summary.managedVariableCount} managed variables</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div><span className="font-medium text-foreground">Catalog configured:</span> {overview.summary.configuredCatalogCount}</div>
              <div><span className="font-medium text-foreground">Last change:</span> {formatTimestamp(overview.summary.lastChangedAt)}</div>
              <div><span className="font-medium text-foreground">Overrides file:</span> {overview.summary.overrideFilePath}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Server restart</CardTitle>
              <CardDescription>
                {overview.summary.serverRestartNeeded ? "Restart Meowstik to apply server-scoped changes." : "Server-scoped values are current."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <Badge variant={overview.summary.serverRestartNeeded ? "secondary" : "default"}>
                {overview.summary.serverRestartNeeded ? "restart needed" : "in sync"}
              </Badge>
              <div><span className="font-medium text-foreground">Last server change:</span> {formatTimestamp(overview.summary.lastServerChangeAt)}</div>
              <div><span className="font-medium text-foreground">State file:</span> {overview.summary.stateFilePath}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Runtime drift</CardTitle>
              <CardDescription>
                {overview.summary.staleRuntimeServices.length > 0
                  ? "Restart these managed services to pick up runtime-scoped changes."
                  : "No managed services are stale."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <Badge variant={overview.summary.staleRuntimeServices.length > 0 ? "secondary" : "default"}>
                {overview.summary.staleRuntimeServices.length > 0
                  ? `${overview.summary.staleRuntimeServices.length} stale service${overview.summary.staleRuntimeServices.length === 1 ? "" : "s"}`
                  : "runtime in sync"}
              </Badge>
              <div><span className="font-medium text-foreground">Last runtime change:</span> {formatTimestamp(overview.summary.lastRuntimeChangeAt)}</div>
              {overview.summary.staleRuntimeServices.length > 0 ? (
                <div className="text-foreground">
                  {overview.summary.staleRuntimeServices.map((service) => service.name).join(", ")}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Common integrations</CardTitle>
            <CardDescription>
              Known environment keys Meowstik already depends on. Live env values stay masked unless you create a managed
              override here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[220px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.catalog.map((variable) => (
                  <TableRow key={variable.key}>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="font-medium">{variable.label}</div>
                        <div className="font-mono text-xs text-muted-foreground">{variable.key}</div>
                        <div className="text-xs text-muted-foreground">
                          {variable.group} · {variable.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={statusBadgeVariant(variable.status)}>
                        {variable.status === "pending_restart" ? "pending restart" : variable.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={scopeBadgeVariant(variable.scope)}>
                        {formatScope(variable.scope ?? variable.scopeHint)}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">{formatSource(variable.source)}</TableCell>
                    <TableCell className="align-top">
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {revealedValues[variable.key] ?? variable.valuePreview ?? "—"}
                      </code>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end gap-2">
                        {variable.revealable ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void toggleReveal(variable.key)}
                            disabled={pendingActionKey === variable.key}
                          >
                            {pendingActionKey === variable.key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : revealedValues[variable.key] !== undefined ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        ) : null}
                        <Button variant="outline" size="sm" onClick={() => void openManageDialog(variable)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {variable.hasManagedValue ? "Edit" : "Manage"}
                        </Button>
                        {variable.hasManagedValue ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDelete(variable.key)}
                            disabled={pendingActionKey === variable.key}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Managed custom variables</CardTitle>
            <CardDescription>
              Variables not in the built-in catalog. These still respect the same server/runtime scope rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.managed.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No custom managed variables yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variable</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-[220px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.managed.map((variable) => (
                    <TableRow key={variable.key}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-mono text-sm">{variable.key}</div>
                          <div className="text-xs text-muted-foreground">{variable.description || "Custom managed variable"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{formatScope(variable.scope)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(variable.status)}>
                          {variable.status === "pending_restart" ? "pending restart" : variable.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-xs">
                          {revealedValues[variable.key] ?? variable.valuePreview ?? "—"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void toggleReveal(variable.key)}
                            disabled={pendingActionKey === variable.key}
                          >
                            {pendingActionKey === variable.key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : revealedValues[variable.key] !== undefined ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => void openManageDialog(variable)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDelete(variable.key)}
                            disabled={pendingActionKey === variable.key}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingKey ? "Edit managed variable" : "Add managed variable"}</DialogTitle>
            <DialogDescription>
              Server-scoped values apply after Meowstik restarts. Runtime-scoped values apply to newly started managed
              services, and existing ones may need a restart from the Runtime page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="environment-key">Variable key</Label>
                <Input
                  id="environment-key"
                  value={form.key}
                  onChange={(event) => setForm((current) => ({ ...current, key: event.target.value.toUpperCase() }))}
                  placeholder="GEMINI_API_KEY"
                  disabled={keyLocked || submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment-scope">Scope</Label>
                <Select
                  value={form.scope}
                  onValueChange={(value: VariableScope) => setForm((current) => ({ ...current, scope: value }))}
                  disabled={submitting}
                >
                  <SelectTrigger id="environment-scope">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="server">server</SelectItem>
                    <SelectItem value="runtime">runtime</SelectItem>
                    <SelectItem value="all">all</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment-description">Description</Label>
                <Input
                  id="environment-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What this variable does"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment-value">Value</Label>
              <Textarea
                id="environment-value"
                value={form.value}
                onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                placeholder='Paste the full value here. JSON and multiline secrets are supported.'
                rows={8}
                disabled={submitting || dialogLoading}
              />
              {dialogLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Revealing current value…
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting || dialogLoading}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingKey ? "Save changes" : "Add variable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
