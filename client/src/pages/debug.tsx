import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ArrowLeft, 
  Brain, 
  RefreshCw, 
  Trash2, 
  Clock, 
  Wrench, 
  Eye, 
  MessageSquare, 
  Settings, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Search,
  Loader2,
  Network,
  Zap
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface LLMInteraction {
  id: string;
  timestamp: string;
  chatId: string;
  messageId: string;
  systemPrompt: string;
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  attachments: Array<{ type: string; filename?: string; mimeType?: string; content?: string; size?: number }>;
  ragContext?: Array<{ source: string; content: string; score?: number; metadata?: Record<string, unknown> }>;
  injectedFiles?: Array<{ filename: string; content: string; mimeType?: string }>;
  injectedJson?: Array<{ name: string; data: unknown }>;
  rawResponse: string;
  parsedToolCalls: unknown[];
  cleanContent: string;
  toolResults: Array<{ toolId: string; type: string; success: boolean; result?: unknown; error?: string }>;
  model: string;
  durationMs: number;
  tokenEstimate?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export default function DebugPage() {
  const [interactions, setInteractions] = useState<LLMInteraction[]>([]);
  const [selectedInteraction, setSelectedInteraction] = useState<LLMInteraction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailTab, setDetailTab] = useState<"inputs" | "system" | "outputs" | "orchestration">("inputs");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    userMessage: true,
    history: false,
    ragContext: false,
    injectedFiles: false,
    injectedJson: false,
    attachments: false,
    systemPrompt: true,
    cleanResponse: true,
    rawResponse: false,
    toolCalls: true,
    toolResults: true,
    metadata: true,
    timing: false
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"memory" | "persistent">("memory");

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadInteractions = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = dataSource === "persistent" 
        ? '/api/debug/llm/persistent' 
        : '/api/debug/llm';
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setInteractions(data);
      }
    } catch (error) {
      console.error('Failed to load LLM interactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dataSource]);

  const clearInteractions = async () => {
    try {
      await fetch('/api/debug/llm', { method: 'DELETE' });
      setInteractions([]);
      setSelectedInteraction(null);
    } catch (error) {
      console.error('Failed to clear LLM interactions:', error);
    }
  };

  useEffect(() => {
    loadInteractions();
    const interval = setInterval(loadInteractions, 5000);
    return () => clearInterval(interval);
  }, [loadInteractions]);

  const filteredInteractions = interactions.filter(interaction => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      interaction.userMessage.toLowerCase().includes(query) ||
      interaction.cleanContent.toLowerCase().includes(query) ||
      interaction.model.toLowerCase().includes(query) ||
      interaction.id.toLowerCase().includes(query)
    );
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const truncateText = (text: string, maxLen: number) => {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="debug-llm-page">
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
              <Brain className="h-5 w-5 text-primary" />
              LLM Debug Console
            </h1>
            <p className="text-sm text-muted-foreground">
              View detailed LLM interaction traces • {dataSource === "memory" ? "Last 10 cycles (Memory)" : "Historical data (Database)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadInteractions}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearInteractions}
              data-testid="button-clear"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Interaction List */}
        <aside className="w-80 border-r bg-muted/20 flex-shrink-0 flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search interactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            
            {/* Data Source Toggle */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Source:</span>
              <div className="flex gap-1">
                <Button
                  variant={dataSource === "memory" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDataSource("memory")}
                  className="h-7 text-xs"
                >
                  Memory (Recent)
                </Button>
                <Button
                  variant={dataSource === "persistent" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDataSource("persistent")}
                  className="h-7 text-xs"
                >
                  Database (All)
                </Button>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              {filteredInteractions.length} of {interactions.length} interactions
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {filteredInteractions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No matching interactions" : "No interactions yet"}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Send a message to capture LLM traces
                    </p>
                  )}
                </div>
              ) : (
                filteredInteractions.map((interaction) => (
                  <button
                    key={interaction.id}
                    onClick={() => setSelectedInteraction(interaction)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all",
                      selectedInteraction?.id === interaction.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-muted/50 border-border"
                    )}
                    data-testid={`interaction-${interaction.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs opacity-70">
                        {formatTime(interaction.timestamp)}
                      </span>
                      <Badge
                        variant={selectedInteraction?.id === interaction.id ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {interaction.model.split('/').pop()}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium mb-1 line-clamp-2">
                      {truncateText(interaction.userMessage, 80)}
                    </p>
                    <div className="flex items-center gap-2 text-xs opacity-70">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(interaction.durationMs)}
                      </span>
                      {interaction.toolResults.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          {interaction.toolResults.length}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content - Detail View */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedInteraction ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Select an Interaction</h2>
                <p className="text-muted-foreground mb-6">
                  Choose an LLM interaction from the sidebar to view detailed trace information including inputs, system prompts, outputs, and orchestration state.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-2">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span><strong>Inputs:</strong> User prompts, RAG context, attachments</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Settings className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span><strong>System:</strong> System prompts and configuration</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span><strong>Outputs:</strong> AI responses and tool results</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Network className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span><strong>Orchestration:</strong> Metadata, timing, state</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="border-b bg-card px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    Interaction Details
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(selectedInteraction.timestamp)} • {selectedInteraction.model}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedInteraction.messageId && (
                    <Link href={`/database?table=messages&id=${selectedInteraction.messageId}`}>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        View Message
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(selectedInteraction, null, 2), 'full-json')}
                    data-testid="button-copy-json"
                  >
                    {copiedId === 'full-json' ? (
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copy JSON
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as typeof detailTab)} className="flex-1 flex flex-col min-h-0">
                <div className="border-b px-4">
                  <TabsList className="h-12">
                    <TabsTrigger value="inputs" className="flex items-center gap-2" data-testid="tab-inputs">
                      <MessageSquare className="h-4 w-4" />
                      Inputs
                      {(selectedInteraction.ragContext?.length || 0) > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          +RAG
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="system" className="flex items-center gap-2" data-testid="tab-system">
                      <Settings className="h-4 w-4" />
                      System
                    </TabsTrigger>
                    <TabsTrigger value="outputs" className="flex items-center gap-2" data-testid="tab-outputs">
                      <FileText className="h-4 w-4" />
                      Outputs
                      {selectedInteraction.toolResults.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {selectedInteraction.toolResults.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="orchestration" className="flex items-center gap-2" data-testid="tab-orchestration">
                      <Network className="h-4 w-4" />
                      Orchestration
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 overflow-hidden">
                  {/* Inputs Tab */}
                  <TabsContent value="inputs" className="h-full mt-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-4">
                        {/* User Message */}
                        <Collapsible open={expandedSections.userMessage} onOpenChange={() => toggleSection('userMessage')}>
                          <div className="flex items-center justify-between w-full p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/15 transition-colors">
                            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                              <MessageSquare className="h-4 w-4 text-blue-400" />
                              <span className="text-sm font-medium">User Message</span>
                              <span className="text-xs text-muted-foreground">({selectedInteraction.userMessage?.length || 0} chars)</span>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(selectedInteraction.userMessage || '', 'user-msg'); }}
                              >
                                {copiedId === 'user-msg' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <CollapsibleTrigger>
                                {expandedSections.userMessage ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="p-4 mt-2 rounded-lg bg-[#1e1e1e] border border-border">
                              <pre className="text-sm whitespace-pre-wrap text-[#e0e0e0] font-mono leading-relaxed">
                                {selectedInteraction.userMessage || <span className="text-[#666] italic">(No user message)</span>}
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Conversation History */}
                        {selectedInteraction.conversationHistory.length > 0 && (
                          <Collapsible open={expandedSections.history} onOpenChange={() => toggleSection('history')}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-secondary/30 border border-border hover:bg-secondary/40 transition-colors">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Conversation History</span>
                                <Badge variant="outline" className="text-xs">{selectedInteraction.conversationHistory.length}</Badge>
                              </div>
                              {expandedSections.history ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="space-y-2 mt-2 p-3 rounded-lg bg-secondary/10 border border-border">
                                {selectedInteraction.conversationHistory.map((msg, idx) => (
                                  <div key={idx} className="p-3 rounded bg-[#1e1e1e] border border-[#333]">
                                    <div className="flex items-center justify-between mb-2">
                                      <Badge variant={msg.role === 'user' ? 'default' : 'secondary'} className="text-xs">
                                        {msg.role.toUpperCase()}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">{msg.content.length} chars</span>
                                    </div>
                                    <pre className="text-sm text-[#c5c5c5] whitespace-pre-wrap font-mono leading-relaxed">{msg.content}</pre>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* RAG Context */}
                        {selectedInteraction.ragContext && selectedInteraction.ragContext.length > 0 && (
                          <Collapsible open={expandedSections.ragContext} onOpenChange={() => toggleSection('ragContext')}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/15 transition-colors">
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-cyan-400" />
                                <span className="text-sm font-medium">RAG Context</span>
                                <Badge variant="outline" className="text-xs">{selectedInteraction.ragContext.length} items</Badge>
                              </div>
                              {expandedSections.ragContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 rounded-lg bg-[#1e1e1e] border border-border max-h-[400px] overflow-y-auto">
                                {selectedInteraction.ragContext.map((ctx, idx) => (
                                  <div key={idx} className="p-3 border-b border-[#333] last:border-b-0">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-mono text-cyan-400">{ctx.source}</span>
                                      {ctx.score !== undefined && (
                                        <span className="text-xs text-muted-foreground">score: {ctx.score.toFixed(3)}</span>
                                      )}
                                    </div>
                                    <pre className="text-xs text-[#c5c5c5] whitespace-pre-wrap font-mono">{ctx.content}</pre>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Injected Files */}
                        {selectedInteraction.injectedFiles && selectedInteraction.injectedFiles.length > 0 && (
                          <Collapsible open={expandedSections.injectedFiles} onOpenChange={() => toggleSection('injectedFiles')}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/15 transition-colors">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-orange-400" />
                                <span className="text-sm font-medium">Injected Files</span>
                                <Badge variant="outline" className="text-xs">{selectedInteraction.injectedFiles.length}</Badge>
                              </div>
                              {expandedSections.injectedFiles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 rounded-lg bg-[#1e1e1e] border border-border max-h-[300px] overflow-y-auto">
                                {selectedInteraction.injectedFiles.map((file, idx) => (
                                  <div key={idx} className="p-3 border-b border-[#333] last:border-b-0">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-mono text-orange-400">{file.filename}</span>
                                      {file.mimeType && <span className="text-xs text-muted-foreground">{file.mimeType}</span>}
                                    </div>
                                    <pre className="text-xs text-[#c5c5c5] whitespace-pre-wrap font-mono max-h-[150px] overflow-y-auto">{file.content}</pre>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Attachments */}
                        {selectedInteraction.attachments.length > 0 && (
                          <Collapsible open={expandedSections.attachments} onOpenChange={() => toggleSection('attachments')}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-secondary/30 border border-border hover:bg-secondary/40 transition-colors">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Attachments</span>
                                <Badge variant="outline" className="text-xs">{selectedInteraction.attachments.length}</Badge>
                              </div>
                              {expandedSections.attachments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 rounded-lg bg-[#1e1e1e] border border-border p-3">
                                {selectedInteraction.attachments.map((att, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-secondary/20 mb-2 last:mb-0">
                                    <span className="text-xs font-mono">{att.filename || att.type}</span>
                                    <div className="flex items-center gap-2">
                                      {att.mimeType && <span className="text-xs text-muted-foreground">{att.mimeType}</span>}
                                      {att.size && <span className="text-xs text-muted-foreground">{(att.size / 1024).toFixed(1)}KB</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* System Tab */}
                  <TabsContent value="system" className="h-full mt-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-4">
                        <Collapsible open={expandedSections.systemPrompt} onOpenChange={() => toggleSection('systemPrompt')}>
                          <div className="flex items-center justify-between w-full p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/15 transition-colors">
                            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                              <Settings className="h-4 w-4 text-purple-400" />
                              <span className="text-sm font-medium">System Prompt</span>
                              <span className="text-xs text-muted-foreground">({selectedInteraction.systemPrompt?.length || 0} chars)</span>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(selectedInteraction.systemPrompt || '', 'system-prompt'); }}
                              >
                                {copiedId === 'system-prompt' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <CollapsibleTrigger>
                                {expandedSections.systemPrompt ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="p-4 mt-2 rounded-lg bg-[#1e1e1e] border border-border">
                              <pre className="text-sm font-mono whitespace-pre-wrap text-[#c5c5c5] leading-relaxed max-h-[600px] overflow-y-auto">
                                {selectedInteraction.systemPrompt}
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Outputs Tab */}
                  <TabsContent value="outputs" className="h-full mt-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-4">
                        {/* Clean Response */}
                        <Collapsible open={expandedSections.cleanResponse} onOpenChange={() => toggleSection('cleanResponse')}>
                          <div className="flex items-center justify-between w-full p-3 rounded-lg bg-green-500/10 border border-green-500/30 hover:bg-green-500/15 transition-colors">
                            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                              <FileText className="h-4 w-4 text-green-400" />
                              <span className="text-sm font-medium">AI Response (Clean)</span>
                              <span className="text-xs text-muted-foreground">({selectedInteraction.cleanContent?.length || 0} chars)</span>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(selectedInteraction.cleanContent || '', 'clean-response'); }}
                              >
                                {copiedId === 'clean-response' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <CollapsibleTrigger>
                                {expandedSections.cleanResponse ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="p-4 mt-2 rounded-lg bg-[#1e1e1e] border border-border">
                              <pre className="text-sm whitespace-pre-wrap text-[#e0e0e0] font-mono leading-relaxed">
                                {selectedInteraction.cleanContent || <span className="text-[#666] italic">(empty)</span>}
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Raw Response */}
                        <Collapsible open={expandedSections.rawResponse} onOpenChange={() => toggleSection('rawResponse')}>
                          <div className="flex items-center justify-between w-full p-3 rounded-lg bg-gray-500/10 border border-gray-500/30 hover:bg-gray-500/15 transition-colors">
                            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                              <span className="text-sm font-medium">Raw Response</span>
                              <span className="text-xs text-muted-foreground">({selectedInteraction.rawResponse?.length || 0} chars)</span>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(selectedInteraction.rawResponse || '', 'raw-response'); }}
                              >
                                {copiedId === 'raw-response' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <CollapsibleTrigger>
                                {expandedSections.rawResponse ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="p-4 mt-2 rounded-lg bg-[#1e1e1e] border border-border">
                              <pre className="text-sm font-mono whitespace-pre-wrap text-[#b0b0b0] leading-relaxed max-h-[400px] overflow-y-auto">{selectedInteraction.rawResponse}</pre>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Tool Execution */}
                        {(selectedInteraction.parsedToolCalls.length > 0 || selectedInteraction.toolResults.length > 0) && (
                          <Collapsible open={expandedSections.toolCalls} onOpenChange={() => toggleSection('toolCalls')}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors">
                              <div className="flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-amber-400" />
                                <span className="text-sm font-medium">Tool Execution</span>
                                <Badge variant="outline" className="text-xs">
                                  {selectedInteraction.parsedToolCalls.length} calls / {selectedInteraction.toolResults.length} results
                                </Badge>
                              </div>
                              {expandedSections.toolCalls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 space-y-3">
                                {/* Tool Calls */}
                                {selectedInteraction.parsedToolCalls.length > 0 && (
                                  <div className="rounded-lg bg-[#1e1e1e] border border-amber-500/20 overflow-hidden">
                                    <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
                                      <span className="text-xs font-semibold text-amber-400">TOOL CALLS</span>
                                    </div>
                                    <div className="p-3 max-h-[300px] overflow-y-auto">
                                      {selectedInteraction.parsedToolCalls.map((call: any, idx: number) => (
                                        <div key={idx} className="mb-3 last:mb-0 p-2 rounded bg-[#252525] border border-[#333]">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-mono text-amber-300">{call.name || `tool_${idx}`}</span>
                                            {call.id && <span className="text-xs text-muted-foreground">#{call.id}</span>}
                                          </div>
                                          <pre className="text-xs font-mono text-[#a0a0a0] whitespace-pre-wrap">
                                            {JSON.stringify(call.args || call, null, 2)}
                                          </pre>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Tool Results */}
                                {selectedInteraction.toolResults.length > 0 && (
                                  <div className="rounded-lg bg-[#1e1e1e] border border-border overflow-hidden">
                                    <div className="px-3 py-2 bg-secondary/30 border-b border-border">
                                      <span className="text-xs font-semibold text-muted-foreground">TOOL RESULTS</span>
                                    </div>
                                    <div className="p-3 max-h-[400px] overflow-y-auto space-y-2">
                                      {selectedInteraction.toolResults.map((result, idx) => (
                                        <div key={idx} className={cn(
                                          "p-3 rounded-lg border",
                                          result.success ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'
                                        )}>
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="font-mono text-xs">{result.type}</span>
                                            <Badge variant={result.success ? "default" : "destructive"} className="text-xs">
                                              {result.success ? 'SUCCESS' : 'FAILED'}
                                            </Badge>
                                          </div>
                                          {result.error && (
                                            <p className="text-xs text-red-400 mb-2">{result.error}</p>
                                          )}
                                          {result.result !== undefined && result.result !== null && (
                                            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                                              {typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)}
                                            </pre>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Orchestration Tab */}
                  <TabsContent value="orchestration" className="h-full mt-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-4">
                        {/* Metadata */}
                        <Collapsible open={expandedSections.metadata} onOpenChange={() => toggleSection('metadata')}>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/15 transition-colors">
                            <div className="flex items-center gap-2">
                              <Network className="h-4 w-4 text-indigo-400" />
                              <span className="text-sm font-medium">Metadata</span>
                            </div>
                            {expandedSections.metadata ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 grid grid-cols-2 gap-3 p-4 rounded-lg bg-[#1e1e1e] border border-border">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Interaction ID</p>
                                <p className="font-mono text-sm">{selectedInteraction.id}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Model</p>
                                <p className="font-mono text-sm">{selectedInteraction.model}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Chat ID</p>
                                <p className="font-mono text-xs truncate" title={selectedInteraction.chatId}>
                                  {selectedInteraction.chatId}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Message ID</p>
                                <p className="font-mono text-xs truncate" title={selectedInteraction.messageId}>
                                  {selectedInteraction.messageId}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Duration</p>
                                <p className="font-mono text-sm">{formatDuration(selectedInteraction.durationMs)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Timestamp</p>
                                <p className="font-mono text-sm">{new Date(selectedInteraction.timestamp).toLocaleString()}</p>
                              </div>
                              {selectedInteraction.tokenEstimate && (
                                <>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Input Tokens</p>
                                    <p className="font-mono text-sm">{selectedInteraction.tokenEstimate.inputTokens.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Output Tokens</p>
                                    <p className="font-mono text-sm">{selectedInteraction.tokenEstimate.outputTokens.toLocaleString()}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* State Information */}
                        <div className="p-4 rounded-lg bg-secondary/10 border border-border">
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            State Summary
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Conversation History</span>
                              <Badge variant="outline">{selectedInteraction.conversationHistory.length} messages</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Attachments</span>
                              <Badge variant="outline">{selectedInteraction.attachments.length}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">RAG Context Items</span>
                              <Badge variant="outline">{selectedInteraction.ragContext?.length || 0}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Tool Calls</span>
                              <Badge variant="outline">{selectedInteraction.parsedToolCalls.length}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Tool Results</span>
                              <Badge variant="outline">{selectedInteraction.toolResults.length}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Successful Tools</span>
                              <Badge variant="outline">
                                {selectedInteraction.toolResults.filter(r => r.success).length}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
