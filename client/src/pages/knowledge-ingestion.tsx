import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Database, Mail, FileText, RefreshCw, Play, CheckCircle2, Clock, AlertCircle, Loader2, Search } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";

interface ConversationSource {
  id: string;
  type: "gmail" | "drive";
  title: string;
  participants: string[];
  messageCount: number;
  dateStart: string;
  dateEnd: string;
  status: "pending" | "processing" | "completed" | "failed";
}

interface IngestionJob {
  id: string;
  source: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  messagesProcessed: number;
  totalMessages: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export default function KnowledgeIngestionPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("sources");
  const queryClient = useQueryClient();

  const { data: sources, isLoading: sourcesLoading, refetch: refetchSources } = useQuery({
    queryKey: ['/api/knowledge/sources'],
    queryFn: async () => {
      const res = await fetch('/api/knowledge/sources');
      if (!res.ok) return [];
      return res.json() as Promise<ConversationSource[]>;
    },
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/knowledge/jobs'],
    queryFn: async () => {
      const res = await fetch('/api/knowledge/jobs');
      if (!res.ok) return [];
      return res.json() as Promise<IngestionJob[]>;
    },
    refetchInterval: 2000,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/knowledge/scan', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/sources'] });
    },
  });

  const ingestMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await fetch(`/api/knowledge/ingest/${sourceId}`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/jobs'] });
    },
  });

  const ingestAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/knowledge/ingest-all', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/jobs'] });
    },
  });

  const filteredSources = sources?.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.participants.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "processing": 
      case "running": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case "processing": 
      case "running": return <Badge variant="default" className="bg-blue-500">Processing</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-knowledge-ingestion">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="button-back-settings">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Log Parser
            </h1>
            <p className="text-sm text-muted-foreground">
              Ingest historical LLM conversations • Extract knowledge from Gmail and Drive
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              data-testid="button-scan-sources"
            >
              {scanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Scan Sources
            </Button>
            <Button 
              onClick={() => ingestAllMutation.mutate()}
              disabled={ingestAllMutation.isPending || !sources?.length}
              data-testid="button-ingest-all"
            >
              {ingestAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Ingest All
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <main className="max-w-6xl mx-auto p-6 w-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sources" data-testid="tab-sources">
                  <FileText className="h-4 w-4 mr-2" />
                  Sources ({sources?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="jobs" data-testid="tab-jobs">
                  <Database className="h-4 w-4 mr-2" />
                  Jobs ({jobs?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sources" className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations by title or participant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-sources"
                  />
                </div>

                {sourcesLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSources.length === 0 ? (
                  <div className="border border-dashed border-border rounded-lg bg-muted/20 p-6 flex flex-col items-center justify-center text-center">
                    <Database className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Conversation Sources Found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click "Scan Sources" to find LLM conversations in your Gmail and Drive.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => scanMutation.mutate()}
                      disabled={scanMutation.isPending}
                    >
                      {scanMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Scan Now
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredSources.map((source) => (
                      <div key={source.id} className="border border-border rounded-lg bg-muted/20 p-6 hover:border-primary/50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            {source.type === "gmail" ? (
                              <Mail className="h-5 w-5 text-red-500 flex-shrink-0" />
                            ) : (
                              <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-base">{source.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {source.participants.join(", ")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {getStatusBadge(source.status)}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => ingestMutation.mutate(source.id)}
                              disabled={ingestMutation.isPending || source.status === "completed"}
                              data-testid={`button-ingest-${source.id}`}
                            >
                              {ingestMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{source.messageCount} messages</span>
                          <span>|</span>
                          <span>{new Date(source.dateStart).toLocaleDateString()} - {new Date(source.dateEnd).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="jobs" className="space-y-4">
                {jobsLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !jobs?.length ? (
                  <div className="border border-dashed border-border rounded-lg bg-muted/20 p-6 flex flex-col items-center justify-center text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Ingestion Jobs</h3>
                    <p className="text-sm text-muted-foreground">
                      Start ingesting conversations to see processing jobs here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {jobs.map((job) => (
                      <div key={job.id} className="border border-border rounded-lg bg-muted/20 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1">
                            {getStatusIcon(job.status)}
                            <div className="flex-1">
                              <h3 className="font-semibold text-base">{job.source}</h3>
                              <p className="text-sm text-muted-foreground">
                                {job.messagesProcessed} / {job.totalMessages} messages processed
                              </p>
                            </div>
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                        <div className="space-y-3">
                          <Progress value={job.progress} className="h-2" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{job.progress}% complete</span>
                            {job.startedAt && (
                              <span>Started: {new Date(job.startedAt).toLocaleTimeString()}</span>
                            )}
                          </div>
                          {job.error && (
                            <p className="text-sm text-red-500">{job.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-8 p-4 rounded-lg border border-border bg-muted/20">
              <h3 className="font-semibold mb-2">How it works</h3>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li><strong>Scan</strong> - Find LLM conversations in Gmail (AI Studio, Gemini) and Drive docs</li>
                <li><strong>Ingest</strong> - Download and parse conversation content</li>
                <li><strong>Process</strong> - Extract knowledge using the Cognitive Cascade (Strategist → Analyst → Technician)</li>
                <li><strong>Store</strong> - Route extracted knowledge to appropriate buckets (Personal/Creator/Projects)</li>
              </ol>
            </div>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
