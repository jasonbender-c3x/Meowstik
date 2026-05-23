import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogsEntry {
  id: string;
  timestamp?: string;
  level?: string;
  stream?: string;
  text: string;
  meta?: string;
}

interface LogsSourceSummary {
  id: string;
  kind: "runtime-stream" | "runtime-file" | "app-buffer" | "orchestration" | "io-input" | "io-output";
  label: string;
  description?: string;
  status: "ready" | "pending" | "error";
  entryCount: number;
  serviceId?: string;
  serviceName?: string;
  pathDisplay?: string;
  updatedAt?: string;
  mimeType?: string;
  error?: string;
}

interface LogsSourceSnapshot {
  source: LogsSourceSummary;
  entries: LogsEntry[];
  truncated?: boolean;
}

interface LogsOverview {
  generatedAt: string;
  selectedSourceId: string | null;
  sources: LogsSourceSummary[];
  selectedSource: LogsSourceSnapshot | null;
}

function formatTimestamp(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function sourceKindLabel(kind: LogsSourceSummary["kind"]): string {
  switch (kind) {
    case "runtime-stream":
      return "runtime";
    case "runtime-file":
      return "file";
    case "app-buffer":
      return "app";
    case "orchestration":
      return "orchestration";
    case "io-input":
      return "LLM input";
    case "io-output":
      return "LLM output";
  }
}

function statusVariant(status: LogsSourceSummary["status"]): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ready":
      return "default";
    case "pending":
      return "secondary";
    case "error":
      return "destructive";
  }
}

export default function LogsPage() {
  const initialSourceId = new URLSearchParams(window.location.search).get("sourceId");
  const serviceId = new URLSearchParams(window.location.search).get("serviceId") || undefined;
  const [overview, setOverview] = useState<LogsOverview | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(initialSourceId);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    if (!overview) {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (selectedSourceId) {
        params.set("sourceId", selectedSourceId);
      }
      if (serviceId) {
        params.set("serviceId", serviceId);
      }

      const response = await fetch(`/api/logs/overview?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load logs");
      }

      setOverview(data);
      setSelectedSourceId(data.selectedSourceId || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [overview, selectedSourceId, serviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(loadData, 5000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  const filteredEntries = useMemo(() => {
    const entries = overview?.selectedSource?.entries || [];
    const query = filter.trim().toLowerCase();
    if (!query) {
      return entries;
    }

    return entries.filter((entry) =>
      `${entry.timestamp || ""} ${entry.level || ""} ${entry.stream || ""} ${entry.text} ${entry.meta || ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [filter, overview]);

  const exportSelected = async () => {
    if (!overview?.selectedSource) return;

    setExporting(true);
    try {
      const response = await fetch(`/api/logs/sources/${encodeURIComponent(overview.selectedSource.source.id)}/export?limit=200`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to export logs");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const label = overview.selectedSource.source.label.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
      anchor.href = url;
      anchor.download = `${label || "logs"}.log`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-logs">
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Logs
            </h1>
            <p className="text-sm text-muted-foreground">
              Unified view of runtime output, managed file tails, app buffer logs, orchestration events, and saved LLM IO captures.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/runtime">
              <Button variant="outline">Runtime</Button>
            </Link>
            <Button onClick={loadData} variant="ghost" size="icon">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full p-6">
          {error ? (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading && !overview ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading logs…
            </div>
          ) : null}

          {overview ? (
            <div className="grid h-full gap-6 lg:grid-cols-[320px,1fr]">
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Sources</CardTitle>
                  <CardDescription>
                    {overview.sources.length} available source{overview.sources.length === 1 ? "" : "s"} • updated {formatTimestamp(overview.generatedAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-240px)]">
                    <div className="space-y-2 p-4">
                      {overview.sources.map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          onClick={() => setSelectedSourceId(source.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            selectedSourceId === source.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium">{source.label}</div>
                            <Badge variant="outline">{sourceKindLabel(source.kind)}</Badge>
                            <Badge variant={statusVariant(source.status)}>{source.status}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{source.description}</div>
                          {source.pathDisplay ? <div className="mt-2 font-mono text-xs break-all text-muted-foreground">{source.pathDisplay}</div> : null}
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{source.entryCount} lines</span>
                            <span>{formatTimestamp(source.updatedAt)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>{overview.selectedSource?.source.label || "No source selected"}</CardTitle>
                    <CardDescription>{overview.selectedSource?.source.description || "Choose a log source from the left."}</CardDescription>
                    {overview.selectedSource?.source.pathDisplay ? (
                      <div className="mt-2 font-mono text-xs text-muted-foreground break-all">
                        {overview.selectedSource.source.pathDisplay}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                      placeholder="Filter current source"
                      className="w-full lg:w-56"
                    />
                    <Button
                      variant="outline"
                      onClick={exportSelected}
                      disabled={!overview.selectedSource || exporting}
                    >
                      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span className="ml-2">Export</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {overview.selectedSource?.source.error ? (
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      {overview.selectedSource.source.error}
                    </div>
                  ) : null}

                  {overview.selectedSource?.truncated ? (
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      The current preview is truncated. Use export if you need the captured slice as a file.
                    </div>
                  ) : null}

                  <ScrollArea className="h-[calc(100vh-280px)] rounded-lg border bg-muted/10">
                    <div className="space-y-3 p-4">
                      {filteredEntries.length > 0 ? (
                        filteredEntries.map((entry) => (
                          <div key={entry.id} className="rounded-md border bg-background/80 p-3">
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {entry.timestamp ? <span>{formatTimestamp(entry.timestamp)}</span> : null}
                              {entry.level ? <Badge variant="outline">{entry.level}</Badge> : null}
                              {entry.stream ? <Badge variant="secondary">{entry.stream}</Badge> : null}
                            </div>
                            <pre className="whitespace-pre-wrap break-words text-xs leading-5">{entry.text}</pre>
                            {entry.meta ? <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{entry.meta}</pre> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-sm text-muted-foreground">
                          {overview.selectedSource
                            ? overview.selectedSource.source.status === "pending"
                              ? "This source is configured, but it has not produced any lines yet."
                              : "No log lines match the current filter."
                            : "Select a source to inspect its logs."}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
