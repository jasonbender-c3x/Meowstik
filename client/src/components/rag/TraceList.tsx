/**
 * TraceList Component
 * 
 * Displays a list of RAG traces with expandable details
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileText, Search, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TraceEvent {
  stage: string;
  timestamp: Date;
  durationMs?: number;
  chunksCreated?: number;
  searchResults?: number;
  scores?: string[];
  tokensUsed?: number;
  errorMessage?: string;
}

interface TraceSummary {
  traceId: string;
  type: "ingestion" | "query";
  query?: string;
  documentId?: string;
  results?: number;
  duration?: number;
  success: boolean;
  startTime: Date;
  endTime?: Date;
}

interface Trace {
  traceId: string;
  type: "ingestion" | "query";
  summary: TraceSummary;
  events: TraceEvent[];
}

interface TraceListProps {
  traces: Trace[];
  onTraceClick?: (traceId: string) => void;
}

function formatTime(date: Date): string {
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

function TraceIcon({ type, success }: { type: string; success: boolean }) {
  if (!success) {
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
  
  return type === "query" ? (
    <Search className="h-4 w-4 text-blue-500" />
  ) : (
    <FileText className="h-4 w-4 text-green-500" />
  );
}

export function TraceList({ traces, onTraceClick }: TraceListProps) {
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());

  const toggleTrace = (traceId: string) => {
    const newExpanded = new Set(expandedTraces);
    if (newExpanded.has(traceId)) {
      newExpanded.delete(traceId);
    } else {
      newExpanded.add(traceId);
    }
    setExpandedTraces(newExpanded);
  };

  if (traces.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <p>No traces found. Traces will appear here as RAG operations occur.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {traces.map((trace) => {
        const isExpanded = expandedTraces.has(trace.traceId);
        
        return (
          <Collapsible
            key={trace.traceId}
            open={isExpanded}
            onOpenChange={() => toggleTrace(trace.traceId)}
          >
            <Card className={cn(
              "transition-colors hover:bg-accent/50",
              !trace.summary.success && "border-red-200 dark:border-red-900"
            )}>
              <CollapsibleTrigger className="w-full">
                <CardContent className="flex items-center gap-3 p-4">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  
                  <TraceIcon type={trace.type} success={trace.summary.success} />
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <Badge variant={trace.type === "query" ? "default" : "secondary"}>
                        {trace.type}
                      </Badge>
                      
                      {trace.summary.query && (
                        <span className="text-sm font-medium truncate max-w-md">
                          "{trace.summary.query}"
                        </span>
                      )}
                      
                      {trace.summary.documentId && !trace.summary.query && (
                        <span className="text-sm text-muted-foreground truncate">
                          {trace.summary.documentId}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {trace.summary.results !== undefined && (
                      <div className="flex items-center gap-1">
                        <Search className="h-3 w-3" />
                        <span>{trace.summary.results}</span>
                      </div>
                    )}
                    
                    {trace.summary.duration && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(trace.summary.duration)}</span>
                      </div>
                    )}
                    
                    <span className="text-xs">
                      {formatTime(trace.summary.startTime)}
                    </span>
                    
                    {trace.summary.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-2">
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">Pipeline Events</h4>
                    <div className="space-y-1">
                      {trace.events.map((event, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-accent/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-32">
                              {event.stage}
                            </span>
                            {event.chunksCreated && (
                              <Badge variant="outline" className="text-xs">
                                {event.chunksCreated} chunks
                              </Badge>
                            )}
                            {event.searchResults && (
                              <Badge variant="outline" className="text-xs">
                                {event.searchResults} results
                              </Badge>
                            )}
                            {event.errorMessage && (
                              <Badge variant="destructive" className="text-xs">
                                Error
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {event.durationMs !== undefined && formatDuration(event.durationMs)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {onTraceClick && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTraceClick(trace.traceId);
                      }}
                    >
                      View Full Details
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
