/**
 * MetricsDashboard Component
 * 
 * Displays aggregated RAG performance metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Search, Clock, TrendingUp, AlertCircle, FileText } from "lucide-react";

interface RagMetrics {
  hourStart: Date;
  documentsIngested: number;
  chunksCreated: number;
  chunksFiltered: number;
  avgIngestionDurationMs: number;
  queriesProcessed: number;
  avgQueryDurationMs: number;
  avgSearchResults: number;
  avgContextTokens: number;
  avgSimilarityScore: string;
  emptyResultCount: number;
  errorCount: number;
  embeddingApiCalls: number;
  vectorSearchOperations: number;
}

interface MetricsDashboardProps {
  metrics: RagMetrics[];
  period: "hour" | "day" | "week";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatScore(score: string): string {
  const num = parseFloat(score);
  if (isNaN(num)) return "N/A";
  return `${Math.round(num * 100)}%`;
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trend 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className="mt-2">
            {trend === "up" && (
              <Badge variant="default" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                Improving
              </Badge>
            )}
            {trend === "down" && (
              <Badge variant="destructive" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1 rotate-180" />
                Declining
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricsDashboard({ metrics, period }: MetricsDashboardProps) {
  // Aggregate metrics across the time period
  const totals = metrics.reduce(
    (acc, m) => ({
      documentsIngested: acc.documentsIngested + m.documentsIngested,
      chunksCreated: acc.chunksCreated + m.chunksCreated,
      chunksFiltered: acc.chunksFiltered + m.chunksFiltered,
      queriesProcessed: acc.queriesProcessed + m.queriesProcessed,
      errorCount: acc.errorCount + m.errorCount,
      emptyResultCount: acc.emptyResultCount + m.emptyResultCount,
      embeddingApiCalls: acc.embeddingApiCalls + m.embeddingApiCalls,
      avgIngestionDurationMs: acc.avgIngestionDurationMs + (m.avgIngestionDurationMs || 0),
      avgQueryDurationMs: acc.avgQueryDurationMs + (m.avgQueryDurationMs || 0),
      avgSearchResults: acc.avgSearchResults + (m.avgSearchResults || 0),
      avgContextTokens: acc.avgContextTokens + (m.avgContextTokens || 0),
      count: acc.count + 1,
    }),
    {
      documentsIngested: 0,
      chunksCreated: 0,
      chunksFiltered: 0,
      queriesProcessed: 0,
      errorCount: 0,
      emptyResultCount: 0,
      embeddingApiCalls: 0,
      avgIngestionDurationMs: 0,
      avgQueryDurationMs: 0,
      avgSearchResults: 0,
      avgContextTokens: 0,
      count: 0,
    }
  );

  const avgIngestionDuration = totals.count > 0 
    ? Math.round(totals.avgIngestionDurationMs / totals.count)
    : 0;
  
  const avgQueryDuration = totals.count > 0
    ? Math.round(totals.avgQueryDurationMs / totals.count)
    : 0;
    
  const avgSearchResults = totals.count > 0
    ? Math.round(totals.avgSearchResults / totals.count)
    : 0;
    
  const avgContextTokens = totals.count > 0
    ? Math.round(totals.avgContextTokens / totals.count)
    : 0;

  // Calculate latest similarity score
  const latestMetric = metrics[metrics.length - 1];
  const avgScore = latestMetric?.avgSimilarityScore || "0";

  const errorRate = totals.queriesProcessed > 0
    ? ((totals.errorCount / totals.queriesProcessed) * 100).toFixed(1)
    : "0";

  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <p>No metrics available for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Documents Ingested"
          value={totals.documentsIngested}
          subtitle={`${totals.chunksCreated} chunks created`}
          icon={FileText}
        />
        
        <MetricCard
          title="Queries Processed"
          value={totals.queriesProcessed}
          subtitle={`${avgSearchResults} avg results`}
          icon={Search}
        />
        
        <MetricCard
          title="Avg Query Time"
          value={formatDuration(avgQueryDuration)}
          subtitle={`Ingestion: ${formatDuration(avgIngestionDuration)}`}
          icon={Clock}
        />
        
        <MetricCard
          title="Avg Similarity"
          value={formatScore(avgScore)}
          subtitle={`${totals.emptyResultCount} empty results`}
          icon={Activity}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Embedding API Calls"
          value={totals.embeddingApiCalls}
          subtitle="Total requests"
          icon={Database}
        />
        
        <MetricCard
          title="Avg Context Tokens"
          value={avgContextTokens}
          subtitle="Tokens per query"
          icon={FileText}
        />
        
        <MetricCard
          title="Error Rate"
          value={`${errorRate}%`}
          subtitle={`${totals.errorCount} errors`}
          icon={AlertCircle}
          trend={parseFloat(errorRate) < 5 ? "up" : "down"}
        />
      </div>

      {totals.chunksFiltered > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Chunk Filtering</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {totals.chunksFiltered} chunks filtered out
              </span>
              <Badge variant="outline">
                {((totals.chunksFiltered / (totals.chunksCreated + totals.chunksFiltered)) * 100).toFixed(1)}% filtered
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
