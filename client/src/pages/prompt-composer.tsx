
/**
 * Prompt Composer Page
 *
 * Centralized UI for introspecting and editing all components of the assembled
 * system prompt. Provides:
 *  - Component breakdown with size/token estimates
 *  - Tabbed editors for Prime Directive, Personality, and Short-Term Memory
 *  - Read-only view of Environment Metadata
 *  - Real-time preview of the full assembled prompt
 *  - Save to disk with instant feedback
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Brain,
  RefreshCw,
  Save,
  Eye,
  FileText,
  Server,
  MemoryStick,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PromptComponent {
  name: string;
  content: string;
  charCount: number;
  lineCount: number;
}

interface ComponentsResponse {
  ok: boolean;
  components: PromptComponent[];
  totalChars: number;
  totalLines: number;
  estimatedTokens: number;
}

interface FileResponse {
  ok: boolean;
  name: string;
  content: string;
}

interface PreviewResponse {
  ok: boolean;
  prompt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function fmtTokens(n: number) {
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k tokens`;
  return `~${n} tokens`;
}

function fmtChars(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k chars`;
  return `${n} chars`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component size bar
// ─────────────────────────────────────────────────────────────────────────────

function SizeBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-primary/60 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component breakdown sidebar
// ─────────────────────────────────────────────────────────────────────────────

function ComponentBreakdown({
  data,
  isLoading,
  onRefresh,
}: {
  data?: ComponentsResponse;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <h2 className="font-semibold text-sm">Component Breakdown</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh breakdown"
          data-testid="button-refresh-breakdown"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Summary row */}
          <div className="px-4 py-2 border-b bg-muted/30 flex-shrink-0">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Total</span>
              <span>{fmtTokens(data.estimatedTokens)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{data.totalLines} lines</span>
              <span>{fmtChars(data.totalChars)}</span>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {data.components.map((comp) => {
                const isExpanded = expanded.has(comp.name);
                return (
                  <div
                    key={comp.name}
                    className="rounded-lg border bg-card overflow-hidden"
                  >
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => toggle(comp.name)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="flex-1 text-xs font-medium truncate">
                        {comp.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {fmtTokens(Math.ceil(comp.charCount / 4))}
                      </Badge>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-2 space-y-1.5">
                        <SizeBar
                          value={comp.charCount}
                          max={data.totalChars}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{comp.lineCount} lines</span>
                          <span>{fmtChars(comp.charCount)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
          No data
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Editable file section
// ─────────────────────────────────────────────────────────────────────────────

function FileEditor({
  fileName,
  label,
  description,
  readOnly = false,
}: {
  fileName: string;
  label: string;
  description: string;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<FileResponse>({
    queryKey: [`/api/prompt-composer/file/${fileName}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/prompt-composer/file/${fileName}`);
      return res.json();
    },
  });

  // Sync server content into local draft on first load
  useEffect(() => {
    if (data?.content !== undefined && draft === null) {
      setDraft(data.content);
    }
  }, [data?.content, draft]);

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("PUT", `/api/prompt-composer/file/${fileName}`, {
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      qc.invalidateQueries({ queryKey: [`/api/prompt-composer/file/${fileName}`] });
      qc.invalidateQueries({ queryKey: ["/api/prompt-composer/components"] });
      qc.invalidateQueries({ queryKey: ["/api/prompt-composer/preview"] });
      toast({ title: `${label} saved`, description: "Changes written to disk." });
    },
    onError: (err: Error) => {
      toast({
        title: "Save failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const isDirty = draft !== null && draft !== data?.content;

  const handleSave = () => {
    if (draft !== null) saveMutation.mutate(draft);
  };

  const handleReset = () => {
    if (data?.content !== undefined) setDraft(data.content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Section header */}
      <div className="flex items-center justify-between px-1 pb-2 flex-shrink-0">
        <div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={saveMutation.isPending}
                data-testid={`button-reset-${fileName}`}
              >
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saveMutation.isPending}
              className="gap-1.5"
              data-testid={`button-save-${fileName}`}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saved ? "Saved!" : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Editor */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Textarea
          className="flex-1 font-mono text-xs resize-none bg-muted/20"
          value={draft ?? ""}
          onChange={(e) => !readOnly && setDraft(e.target.value)}
          readOnly={readOnly}
          placeholder={readOnly ? "(read-only)" : `Enter ${label} content…`}
          data-testid={`editor-${fileName}`}
        />
      )}

      {/* Dirty indicator */}
      {isDirty && !readOnly && (
        <p className="text-[11px] text-yellow-600 dark:text-yellow-400 pt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Unsaved changes
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-prompt preview
// ─────────────────────────────────────────────────────────────────────────────

function PromptPreview() {
  const qc = useQueryClient();

  const { data, isLoading, isFetching } = useQuery<PreviewResponse>({
    queryKey: ["/api/prompt-composer/preview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prompt-composer/preview");
      return res.json();
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-2 flex-shrink-0">
        <p className="text-sm text-muted-foreground">
          Live assembled prompt sent to the LLM on every turn.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            qc.invalidateQueries({ queryKey: ["/api/prompt-composer/preview"] })
          }
          disabled={isFetching}
          data-testid="button-refresh-preview"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Textarea
          className="flex-1 font-mono text-xs resize-none bg-muted/20"
          value={data?.prompt ?? ""}
          readOnly
          data-testid="editor-preview"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function PromptComposerPage() {
  const qc = useQueryClient();

  const {
    data: componentsData,
    isLoading: componentsLoading,
  } = useQuery<ComponentsResponse>({
    queryKey: ["/api/prompt-composer/components"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prompt-composer/components");
      return res.json();
    },
  });

  const refreshBreakdown = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["/api/prompt-composer/components"] });
  }, [qc]);

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      data-testid="prompt-composer-page"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1
              className="text-xl font-semibold flex items-center gap-2"
              data-testid="text-page-title"
            >
              <Brain className="h-5 w-5 text-primary" />
              Prompt Composer
            </h1>
            <p className="text-sm text-muted-foreground">
              Introspect and edit every component of the assembled system prompt
            </p>
          </div>
          {componentsData && (
            <div className="hidden sm:flex flex-col items-end gap-0.5">
              <Badge variant="secondary" className="text-xs">
                {fmtTokens(componentsData.estimatedTokens)}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {componentsData.components.length} sections
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left sidebar – component breakdown */}
        <aside className="w-64 border-r flex-shrink-0 flex flex-col hidden lg:flex">
          <ComponentBreakdown
            data={componentsData}
            isLoading={componentsLoading}
            onRefresh={refreshBreakdown}
          />
        </aside>

        {/* Main editing area */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <Tabs defaultValue="prime-directive" className="flex-1 flex flex-col">
            <TabsList className="flex-shrink-0 mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger
                value="prime-directive"
                className="gap-1.5"
                data-testid="tab-prime-directive"
              >
                <ScrollText className="h-4 w-4" />
                Prime Directive
              </TabsTrigger>
              <TabsTrigger
                value="personality"
                className="gap-1.5"
                data-testid="tab-personality"
              >
                <FileText className="h-4 w-4" />
                Personality
              </TabsTrigger>
              <TabsTrigger
                value="short-term-memory"
                className="gap-1.5"
                data-testid="tab-short-term-memory"
              >
                <MemoryStick className="h-4 w-4" />
                Short-Term Memory
              </TabsTrigger>
              <TabsTrigger
                value="environment-metadata"
                className="gap-1.5"
                data-testid="tab-environment-metadata"
              >
                <Server className="h-4 w-4" />
                Environment
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="gap-1.5"
                data-testid="tab-preview"
              >
                <Eye className="h-4 w-4" />
                Full Preview
              </TabsTrigger>
            </TabsList>

            <Separator className="mb-4 flex-shrink-0" />

            {/* Prime Directive */}
            <TabsContent
              value="prime-directive"
              className="flex-1 flex flex-col mt-0"
            >
              <h2 className="text-base font-semibold mb-3">Prime Directive</h2>
              <FileEditor
                fileName="prime-directive"
                label="Prime Directive"
                description="Fundamental behavior rules and constraints loaded from prompts/core-directives.md."
              />
            </TabsContent>

            {/* Personality */}
            <TabsContent
              value="personality"
              className="flex-1 flex flex-col mt-0"
            >
              <h2 className="text-base font-semibold mb-3">Personality</h2>
              <FileEditor
                fileName="personality"
                label="Personality"
                description="Character, tone and communication style loaded from prompts/personality.md."
              />
            </TabsContent>

            {/* Short-Term Memory */}
            <TabsContent
              value="short-term-memory"
              className="flex-1 flex flex-col mt-0"
            >
              <h2 className="text-base font-semibold mb-3">
                Short-Term Memory
              </h2>
              <FileEditor
                fileName="short-term-memory"
                label="Short-Term Memory"
                description="Persistent user-defined memory injected into every prompt (logs/Short_Term_Memory.md). The AI can also append to this file automatically."
              />
            </TabsContent>

            {/* Environment Metadata (read-only) */}
            <TabsContent
              value="environment-metadata"
              className="flex-1 flex flex-col mt-0"
            >
              <h2 className="text-base font-semibold mb-3">
                Environment Metadata
              </h2>
              <FileEditor
                fileName="environment-metadata"
                label="Environment Metadata"
                description="Auto-generated environment context (hostname, NODE_ENV, etc.). Read-only — derived at runtime."
                readOnly
              />
            </TabsContent>

            {/* Full Preview */}
            <TabsContent
              value="preview"
              className="flex-1 flex flex-col mt-0"
            >
              <h2 className="text-base font-semibold mb-3">
                Full Assembled Prompt Preview
              </h2>
              <PromptPreview />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
