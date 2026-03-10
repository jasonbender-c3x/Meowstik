/**
 * RAG Debug Page
 * 
 * Provides visibility into the RAG (Retrieval-Augmented Generation) pipeline:
 * - Ingestion timeline with chunk/embed/store events
 * - Query traces with search results and scores
 * - Statistics on the RAG system performance
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshCw, Trash2, ChevronDown, ChevronRight, Database, Search, FileText, AlertCircle, CheckCircle, Clock, Zap, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TraceList } from "@/components/rag/TraceList";
import { MetricsDashboard } from "@/components/rag/MetricsDashboard";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface RagTraceEvent {
  id: string;
  traceId: string;
  timestamp: string;
  stage: string;
  documentId?: string;
  filename?: string;
  contentType?: string;
  contentLength?: number;
  chunksCreated?: number;
  chunksFiltered?: number;
  chunkingStrategy?: string;
  query?: string;
  queryLength?: number;
  searchResults?: number;
  threshold?: number;
  topK?: number;
  scores?: number[];
  chunkIds?: string[];
  chunkPreviews?: string[];
  tokensUsed?: number;
  sourcesCount?: number;
  durationMs: number;
  error?: string;
  userId?: string;
  chatId?: string;
  role?: string;
}

interface RagTraceGroup {
  traceId: string;
  type: "ingestion" | "query";
  startTime: string;
  endTime?: string;
  totalDurationMs?: number;
  events: RagTraceEvent[];
  success: boolean;
  summary: {
    documentId?: string;
    filename?: string;
    query?: string;
    chunksCreated?: number;
    chunksFiltered?: number;
    searchResults?: number;
    tokensUsed?: number;
  };
}

interface RagStats {
  totalEvents: number;
  ingestionCount: number;
  queryCount: number;
  errorCount: number;
  avgIngestionDuration: number;
  avgQueryDuration: number;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", { 
    hour: "2-digit", 
    minute: "2-digit", 
    second: "2-digit",
    hour12: false 
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function StageIcon({ stage }: { stage: string }) {
  switch (stage) {
    case "ingest_start":
    case "ingest_complete":
      return <FileText className="h-4 w-4 text-blue-500" />;
    case "chunk":
      return <Database className="h-4 w-4 text-purple-500" />;
    case "embed":
      return <Zap className="h-4 w-4 text-yellow-500" />;
    case "store":
      return <Database className="h-4 w-4 text-green-500" />;
    case "query_start":
    case "query_complete":
      return <Search className="h-4 w-4 text-blue-500" />;
    case "query_embed":
      return <Zap className="h-4 w-4 text-yellow-500" />;
    case "search":
      return <Search className="h-4 w-4 text-purple-500" />;
    case "retrieve":
      return <Database className="h-4 w-4 text-green-500" />;
    case "inject":
      return <FileText className="h-4 w-4 text-cyan-500" />;
    case "ingest_filtered":
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

function StageBadge({ stage }: { stage: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    ingest_start: "default",
    chunk: "secondary",
    embed: "secondary",
    store: "secondary",
    ingest_complete: "default",
    ingest_filtered: "destructive",
    query_start: "default",
    query_embed: "secondary",
    search: "secondary",
    retrieve: "secondary",
    inject: "secondary",
    query_complete: "default",
    error: "destructive",
  };
  
  return (
    <Badge variant={variants[stage] || "outline"} className="text-xs">
      {stage.replace(/_/g, " ")}
    </Badge>
  );
}

function TraceGroupCard({ group }: { group: RagTraceGroup }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const isIngestion = group.type === "ingestion";
  const title = isIngestion 
    ? group.summary.filename || group.summary.documentId || "Unknown Document"
    : group.summary.query?.slice(0, 50) || "Unknown Query";
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`mb-2 border border-border rounded-lg bg-card ${group.success ? "" : "border-red-500/50"}`}>
        <CollapsibleTrigger className="w-full">
          <div className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {isIngestion ? <FileText className="h-4 w-4 text-blue-500" /> : <Search className="h-4 w-4 text-purple-500" />}
                <span className="font-medium text-sm truncate max-w-[300px]" data-testid={`trace-title-${group.traceId}`}>
                  {title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {group.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs text-muted-foreground">{formatTime(group.startTime)}</span>
                {group.totalDurationMs !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    {formatDuration(group.totalDurationMs)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
              {isIngestion ? (
                <>
                  {group.summary.chunksCreated !== undefined && (
                    <span>{group.summary.chunksCreated} chunks</span>
                  )}
                  {group.summary.chunksFiltered !== undefined && group.summary.chunksFiltered > 0 && (
                    <span className="text-yellow-600">{group.summary.chunksFiltered} filtered</span>
                  )}
                </>
              ) : (
                <>
                  {group.summary.searchResults !== undefined && (
                    <span>{group.summary.searchResults} results</span>
                  )}
                  {group.summary.tokensUsed !== undefined && (
                    <span>{group.summary.tokensUsed} tokens</span>
                  )}
                </>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-0 pb-3 px-4">
            <Separator className="mb-3" />
            <div className="space-y-2">
              {group.events.map((event) => (
                <div key={event.id} className="flex items-start gap-2 text-xs" data-testid={`event-${event.id}`}>
                  <StageIcon stage={event.stage} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <StageBadge stage={event.stage} />
                      <span className="text-muted-foreground">{formatDuration(event.durationMs)}</span>
                    </div>
                    {event.error && (
                      <p className="text-red-500 mt-1">{event.error}</p>
                    )}
                    {event.scores && event.scores.length > 0 && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {event.scores.slice(0, 5).map((score, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {score.toFixed(3)}
                          </Badge>
                        ))}
                        {event.scores.length > 5 && (
                          <span className="text-muted-foreground">+{event.scores.length - 5} more</span>
                        )}
                      </div>
                    )}
                    {event.chunkPreviews && event.chunkPreviews.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {event.chunkPreviews.slice(0, 3).map((preview, i) => (
                          <p key={i} className="text-muted-foreground truncate max-w-[400px]">
                            "{preview}..."
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function RagDebugPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"live" | "persistent">("live");

  const { data: traceGroups, isLoading: groupsLoading, refetch: refetchGroups } = useQuery<RagTraceGroup[]>({
    queryKey: ["/api/debug/rag/traces"],
    refetchInterval: 5000,
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<RagStats>({
    queryKey: ["/api/debug/rag/stats"],
    refetchInterval: 5000,
  });

  // New: Query persistent traces
  const { data: persistentTraces, isLoading: persistentLoading, refetch: refetchPersistent } = useQuery<{traces: RagTraceGroup[]}>({
    queryKey: ["/api/debug/rag/traceability/traces", { limit: 50 }],
    enabled: viewMode === "persistent",
  });

  // New: Query metrics
  const { data: metricsData, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<{metrics: any[]; period: string}>({
    queryKey: ["/api/debug/rag/traceability/metrics"],
    enabled: viewMode === "persistent",
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/debug/rag/clear", { method: "POST" });
      if (!res.ok) throw new Error("Failed to clear");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debug/rag"] });
    },
  });

  const handleRefresh = () => {
    refetchGroups();
    refetchStats();
    if (viewMode === "persistent") {
      refetchPersistent();
      refetchMetrics();
    }
  };

  const filteredGroups = traceGroups?.filter((g) => {
    if (activeTab === "all") return true;
    if (activeTab === "ingestion") return g.type === "ingestion";
    if (activeTab === "query") return g.type === "query";
    if (activeTab === "errors") return !g.success;
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="rag-debug-page">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              RAG Debug Console
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor ingestion and retrieval pipeline events
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              data-testid="button-refresh"
            >
              {!groupsLoading && !statsLoading ? (
                <RefreshCw className="h-4 w-4 mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Refresh
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              data-testid="button-clear"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="px-4 py-6 space-y-6 max-w-6xl mx-auto w-full">

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="text-2xl font-bold" data-testid="stat-total">{stats?.totalEvents || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">Total Events</p>
            </div>
            <div className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="text-2xl font-bold text-blue-500" data-testid="stat-ingestion">{stats?.ingestionCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">Ingestions</p>
              {stats?.avgIngestionDuration ? (
                <p className="text-xs text-muted-foreground">Avg: {formatDuration(stats.avgIngestionDuration)}</p>
              ) : null}
            </div>
            <div className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="text-2xl font-bold text-purple-500" data-testid="stat-query">{stats?.queryCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">Queries</p>
              {stats?.avgQueryDuration ? (
                <p className="text-xs text-muted-foreground">Avg: {formatDuration(stats.avgQueryDuration)}</p>
              ) : null}
            </div>
            <div className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="text-2xl font-bold text-red-500" data-testid="stat-errors">{stats?.errorCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">Errors</p>
            </div>
          </div>

          {/* Trace Groups Section */}
          <div className="border border-border rounded-lg bg-muted/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all" data-testid="tab-all">
                    All ({traceGroups?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="ingestion" data-testid="tab-ingestion">
                    Ingestion ({traceGroups?.filter(g => g.type === "ingestion").length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="query" data-testid="tab-query">
                    Queries ({traceGroups?.filter(g => g.type === "query").length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="errors" data-testid="tab-errors">
                    Errors ({traceGroups?.filter(g => !g.success).length || 0})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "live" | "persistent")}>
                <TabsList>
                  <TabsTrigger value="live">
                    <Clock className="h-3 w-3 mr-1" />
                    Live (Memory)
                  </TabsTrigger>
                  <TabsTrigger value="persistent">
                    <Database className="h-3 w-3 mr-1" />
                    Persistent (DB)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {viewMode === "live" ? (
              <div className="h-[500px] border border-border rounded-lg">
                {groupsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Database className="h-8 w-8 mb-2" />
                    <p>No trace events yet</p>
                    <p className="text-xs">Send a message or upload a document to see traces</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-2">
                      {filteredGroups.map((group) => (
                        <TraceGroupCard key={group.traceId} group={group} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Database className="h-4 w-4" />
                  <span>Viewing persistent traces from database</span>
                </div>
                
                <div className="h-[500px] border border-border rounded-lg">
                  {persistentLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : persistentTraces?.traces?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Database className="h-8 w-8 mb-2" />
                      <p>No persistent traces found</p>
                      <p className="text-xs">Traces are automatically saved to the database</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="p-4">
                        <TraceList traces={persistentTraces?.traces as any || []} />
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metrics Dashboard - Only visible in persistent mode */}
          {viewMode === "persistent" && metricsData?.metrics && metricsData.metrics.length > 0 && (
            <div className="border border-border rounded-lg bg-muted/20 p-6">
              <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
              <MetricsDashboard 
                metrics={metricsData.metrics} 
                period={(metricsData.period || "hour") as "hour" | "day" | "week"} 
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </main>
    </div>
  );
}
