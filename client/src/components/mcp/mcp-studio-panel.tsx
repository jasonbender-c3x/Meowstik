import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  Check,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  Eye,
  FileCode2,
  FileJson,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Music4,
  Network,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type McpTransport = "stdio" | "streamable-http" | "sse";
type McpLoggingLevel = "errors" | "basic" | "verbose";

type McpLibraryEntry = {
  key: string;
  name: string;
  description: string;
  transport: McpTransport;
  docsUrl?: string;
  homepage?: string;
  template: {
    endpointUrl?: string;
    command?: string;
    args?: string[];
    cwd?: string;
  };
};

type McpServer = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  transport: McpTransport;
  enabled: boolean;
  source: "custom" | "library";
  libraryKey?: string | null;
  endpointUrl?: string | null;
  command?: string | null;
  args?: string[] | null;
  cwd?: string | null;
};

type McpTestResult = {
  ok: boolean;
  toolCount: number;
};

type McpLoggingSettings = {
  userId: string;
  level: McpLoggingLevel;
  verboseBudget: number;
  captureResponses: boolean;
  updatedAt: number;
};

type McpTrafficLog = {
  id: string;
  serverId: string | null;
  serverName: string;
  transport: McpTransport | null;
  eventType: "list_tools" | "test_server" | "call_tool";
  toolName: string | null;
  status: "ok" | "error";
  summary: string;
  requestPayload: unknown;
  responsePayload: unknown;
  errorMessage: string | null;
  createdAt: number;
};

type McpCanonicalImportResult = {
  created: number;
  updated: number;
  skipped: Array<{ key: string; reason: string }>;
  servers: Array<{ key: string; id: string; action: "created" | "updated"; slug: string; name: string }>;
  configPath: string;
};

type StructuredFormat = "json" | "xml" | "text";

type StructuredNode = string | number | boolean | null | StructuredRecord | StructuredNode[];
type StructuredRecord = Record<string, StructuredNode>;

const defaultCustomMcp = {
  name: "",
  description: "",
  transport: "streamable-http" as McpTransport,
  endpointUrl: "http://localhost:8766/mcp",
  command: "",
  argsText: "[]",
  cwd: "",
  headersText: "{}",
  envText: "{}",
};

const builtInExamples = [
  {
    id: "example-list-tools",
    title: "Tool discovery",
    description: "Meowstik asks a server which tools it exposes before deciding what to call.",
    request: {
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
    },
    response: {
      tools: [
        {
          name: "filesystem-read_text_file",
          description: "Read a text file from disk",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
            },
            required: ["path"],
          },
        },
      ],
    },
  },
  {
    id: "example-call-tool",
    title: "Tool invocation",
    description: "After discovery, Meowstik sends the tool name plus structured arguments and gets a structured result back.",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "filesystem-read_text_file",
        arguments: {
          path: "/home/runner/workspace/Meowstik/README.md",
        },
      },
    },
    response: {
      content: [
        {
          type: "text",
          text: "# Meowstik\n\nA local-first assistant workspace...",
        },
      ],
    },
  },
  {
    id: "example-xml",
    title: "XML payload preview",
    description: "The same viewer can also parse XML into a navigable tree and card view when a server or tool returns markup instead of JSON.",
    request: "<toolResult><name>voiceWebhook</name><format>xml</format></toolResult>",
    response: "<Response><Say voice=\"alice\">Hello from Meowstik</Say><Pause length=\"1\"/></Response>",
  },
];

function parseJsonRecord(value: string, fieldName: string): Record<string, string> {
  if (!value.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${fieldName} must be valid JSON`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, entryValue]) => [key, String(entryValue)]),
  );
}

function parseJsonArray(value: string, fieldName: string): string[] {
  if (!value.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${fieldName} must be valid JSON`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON array`);
  }

  return parsed.map((entry) => String(entry));
}

function looksLikeXml(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("<") && trimmed.endsWith(">");
}

function xmlElementToObject(element: Element): StructuredRecord {
  const children = Array.from(element.children);
  const attributes = Array.from(element.attributes).reduce<StructuredRecord>((acc, attribute) => {
    acc[`@${attribute.name}`] = attribute.value;
    return acc;
  }, {});

  const textContent = element.textContent?.trim();

  if (children.length === 0) {
    if (Object.keys(attributes).length === 0) {
      return { "#text": textContent ?? "" };
    }

    return {
      ...attributes,
      ...(textContent ? { "#text": textContent } : {}),
    };
  }

  const groupedChildren = children.reduce<StructuredRecord>((acc, child) => {
    const childValue = xmlElementToObject(child);
    const existing = acc[child.tagName];
    if (existing === undefined) {
      acc[child.tagName] = childValue;
      return acc;
    }

    if (Array.isArray(existing)) {
      acc[child.tagName] = [...existing, childValue];
      return acc;
    }

    acc[child.tagName] = [existing, childValue];
    return acc;
  }, {});

  return {
    ...attributes,
    ...groupedChildren,
    ...(textContent && children.length === 0 ? { "#text": textContent } : {}),
  };
}

function normalizeStructuredValue(value: unknown): {
  format: StructuredFormat;
  rawText: string;
  structured: StructuredNode | null;
} {
  if (value === null || value === undefined) {
    return { format: "text", rawText: String(value), structured: null };
  }

  if (typeof value === "object") {
    return {
      format: "json",
      rawText: JSON.stringify(value, null, 2),
      structured: value as StructuredNode,
    };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return { format: "text", rawText: value, structured: value };
    }

    try {
      const parsed = JSON.parse(trimmed) as StructuredNode;
      return {
        format: "json",
        rawText: JSON.stringify(parsed, null, 2),
        structured: parsed,
      };
    } catch {
      if (looksLikeXml(trimmed)) {
        try {
          const xml = new DOMParser().parseFromString(trimmed, "application/xml");
          const parserError = xml.querySelector("parsererror");
          if (!parserError && xml.documentElement) {
            const structured = {
              [xml.documentElement.tagName]: xmlElementToObject(xml.documentElement),
            };
            return {
              format: "xml",
              rawText: value,
              structured,
            };
          }
        } catch {
          // fall through to text
        }
      }

      return {
        format: "text",
        rawText: value,
        structured: value,
      };
    }
  }

  return {
    format: "text",
    rawText: String(value),
    structured: value as StructuredNode,
  };
}

function summarizeNode(value: StructuredNode): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value === null) return "null";
  if (typeof value === "object") return `${Object.keys(value).length} field(s)`;
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inferMimeKind(mimeType?: string, filename?: string): "image" | "audio" | "midi" | "json" | "xml" | "text" | "link" | "object" {
  const lowerMime = mimeType?.toLowerCase() ?? "";
  const lowerName = filename?.toLowerCase() ?? "";

  if (lowerMime.startsWith("image/")) return "image";
  if (lowerMime === "audio/midi" || lowerMime === "audio/x-midi" || lowerName.endsWith(".mid") || lowerName.endsWith(".midi")) {
    return "midi";
  }
  if (lowerMime.startsWith("audio/")) return "audio";
  if (lowerMime.includes("json") || lowerName.endsWith(".json")) return "json";
  if (lowerMime.includes("xml") || lowerName.endsWith(".xml")) return "xml";
  if (lowerMime.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".md")) return "text";
  if (lowerMime === "text/uri-list") return "link";
  return "object";
}

function toDataUrl(mimeType: string, payload?: string): string | null {
  if (!payload) return null;
  if (payload.startsWith("data:")) return payload;
  if (/^[A-Za-z0-9+/=\n\r]+$/.test(payload)) {
    return `data:${mimeType};base64,${payload.replace(/\s+/g, "")}`;
  }
  return null;
}

function describeAsset(value: unknown):
  | {
      kind: ReturnType<typeof inferMimeKind>;
      mimeType?: string;
      filename?: string;
      label: string;
      description: string;
      previewSrc?: string | null;
      snippet?: string;
      linkUrl?: string;
    }
  | null {
  if (typeof value === "string") {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return {
        kind: "link",
        label: "Link",
        description: value,
        linkUrl: value,
      };
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const mimeType =
    (typeof value.mimeType === "string" ? value.mimeType : undefined) ||
    (typeof value.contentType === "string" ? value.contentType : undefined) ||
    undefined;
  const filename =
    (typeof value.filename === "string" ? value.filename : undefined) ||
    (typeof value.name === "string" ? value.name : undefined) ||
    undefined;
  const content =
    (typeof value.content === "string" ? value.content : undefined) ||
    (typeof value.base64 === "string" ? value.base64 : undefined) ||
    undefined;
  const url = typeof value.url === "string" ? value.url : undefined;

  if (!mimeType && !filename && !url && !content) {
    return null;
  }

  const kind = inferMimeKind(mimeType, filename);
  const label = filename || mimeType || (url ? "Linked asset" : "Structured asset");
  const snippet =
    typeof value.text === "string"
      ? value.text
      : kind === "text" || kind === "json" || kind === "xml"
        ? typeof value.content === "string"
          ? value.content.slice(0, 180)
          : undefined
        : undefined;

  return {
    kind,
    mimeType,
    filename,
    label,
    description: mimeType || url || "Structured object",
    previewSrc: kind === "image" ? url || (mimeType ? toDataUrl(mimeType, content) : null) : undefined,
    snippet,
    linkUrl: url,
  };
}

function AssetChip({ entryKey, value }: { entryKey: string; value: StructuredNode }) {
  const asset = describeAsset(value);

  if (!asset) {
    return (
      <>
        <div className="text-sm font-medium">{entryKey}</div>
        <div className="text-xs text-muted-foreground">{summarizeNode(value)}</div>
      </>
    );
  }

  const icon = (() => {
    switch (asset.kind) {
      case "image":
        return <ImageIcon className="h-4 w-4 text-primary" />;
      case "audio":
      case "midi":
        return <Music4 className="h-4 w-4 text-primary" />;
      case "json":
        return <FileJson className="h-4 w-4 text-primary" />;
      case "xml":
        return <FileCode2 className="h-4 w-4 text-primary" />;
      case "text":
      case "link":
        return <FileText className="h-4 w-4 text-primary" />;
      default:
        return <FileJson className="h-4 w-4 text-primary" />;
    }
  })();

  return (
    <div className="space-y-2">
      {asset.previewSrc ? (
        <div className="h-20 overflow-hidden rounded-md border border-border bg-black/5">
          <img src={asset.previewSrc} alt={asset.label} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{entryKey}</span>
        </div>
      )}
      <div className="text-xs font-medium">{asset.label}</div>
      <div className="line-clamp-2 text-xs text-muted-foreground">{asset.description}</div>
    </div>
  );
}

function AssetPreview({ value }: { value: StructuredNode }) {
  const asset = describeAsset(value);
  if (!asset) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-2">
        {asset.kind === "image" ? <ImageIcon className="h-4 w-4 text-primary" /> : asset.kind === "audio" || asset.kind === "midi" ? <Music4 className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
        <div className="text-sm font-medium">{asset.label}</div>
        <Badge variant="outline">{asset.kind}</Badge>
      </div>
      {asset.previewSrc && (
        <div className="mb-3 overflow-hidden rounded-md border border-border bg-background">
          <img src={asset.previewSrc} alt={asset.label} className="max-h-48 w-full object-contain" />
        </div>
      )}
      {asset.linkUrl && (
        <a
          href={asset.linkUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-2 inline-flex items-center gap-1 text-sm text-primary underline"
        >
          Open linked asset
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {asset.snippet && (
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs">
          {asset.snippet}
        </pre>
      )}
    </div>
  );
}

function TreeNode({ name, value, depth = 0 }: { name: string; value: StructuredNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  const isBranch = typeof value === "object" && value !== null;

  if (!isBranch) {
    return (
      <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm">
        <span className="font-medium text-foreground">{name}:</span>{" "}
        <span className="break-all text-muted-foreground">{String(value)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry] as const)
    : Object.entries(value);

  return (
    <div className="rounded-md border border-border/60 bg-background/60">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <div className="flex items-center gap-2">
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          <span className="font-medium">{name}</span>
        </div>
        <span className="text-xs text-muted-foreground">{summarizeNode(value)}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-3">
          {entries.map(([childName, childValue]) => (
            <div key={`${name}-${childName}`} className={cn(depth > 0 && "ml-3")}>
              <TreeNode name={childName} value={childValue as StructuredNode} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RolodexViewer({ value }: { value: StructuredNode }) {
  const entries = useMemo(() => {
    if (Array.isArray(value)) {
      return value.map((entry, index) => [`#${index + 1}`, entry] as const);
    }
    if (value && typeof value === "object") {
      return Object.entries(value);
    }
    return [["value", value] as const];
  }, [value]);

  const [selectedKey, setSelectedKey] = useState(entries[0]?.[0] ?? "value");
  const selectedEntry = entries.find(([key]) => key === selectedKey) ?? entries[0];

  if (!selectedEntry) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {entries.map(([key, entryValue]) => (
          <button
            key={key}
            type="button"
            className={cn(
              "min-w-[140px] rounded-lg border px-3 py-2 text-left transition-colors",
              selectedKey === key
                ? "border-primary bg-primary/5"
                : "border-border bg-background hover:bg-muted/60",
            )}
            onClick={() => setSelectedKey(key)}
          >
            <AssetChip entryKey={key} value={entryValue as StructuredNode} />
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{selectedEntry[0]}</div>
            <div className="text-xs text-muted-foreground">Preview card</div>
          </div>
          <Badge variant="outline">rolodex</Badge>
        </div>
        <AssetPreview value={selectedEntry[1] as StructuredNode} />
        <StructuredDataViewer value={selectedEntry[1]} label={selectedEntry[0]} nested />
      </div>
    </div>
  );
}

function StructuredDataViewer({
  label,
  value,
  nested = false,
}: {
  label: string;
  value: unknown;
  nested?: boolean;
}) {
  const normalized = useMemo(() => normalizeStructuredValue(value), [value]);
  const [copied, setCopied] = useState(false);

  const copyRaw = async () => {
    await navigator.clipboard.writeText(normalized.rawText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const canExplore = normalized.structured !== null && typeof normalized.structured === "object";

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20", nested && "border-dashed")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          {normalized.format === "xml" ? <FileCode2 className="h-4 w-4 text-primary" /> : <FileJson className="h-4 w-4 text-primary" />}
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="outline">{normalized.format}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={copyRaw}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="p-3">
        {canExplore ? (
          <Tabs defaultValue="tree" className="space-y-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tree">Tree</TabsTrigger>
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>
            <TabsContent value="tree" className="space-y-2">
              <TreeNode name={label} value={normalized.structured as StructuredNode} />
            </TabsContent>
            <TabsContent value="cards">
              <RolodexViewer value={normalized.structured as StructuredNode} />
            </TabsContent>
            <TabsContent value="raw">
              <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap break-all rounded-md bg-background p-3 text-xs">
                {normalized.rawText}
              </pre>
            </TabsContent>
          </Tabs>
        ) : (
          <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap break-all rounded-md bg-background p-3 text-xs">
            {normalized.rawText}
          </pre>
        )}
      </div>
    </div>
  );
}

function formatLocation(server: McpServer): string {
  return server.transport === "stdio"
    ? [server.command, ...(server.args ?? [])].filter(Boolean).join(" ")
    : server.endpointUrl || "No endpoint configured";
}

function formatWhen(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function McpStudioPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mcpFormError, setMcpFormError] = useState<string | null>(null);
  const [mcpTestResults, setMcpTestResults] = useState<Record<string, McpTestResult>>({});
  const [customMcp, setCustomMcp] = useState(defaultCustomMcp);
  const [verboseBurstCount, setVerboseBurstCount] = useState("3");

  const { data: mcpLibraryData, isLoading: mcpLibraryLoading } = useQuery({
    queryKey: ["/api/mcp/library"],
    queryFn: async () => {
      const res = await fetch("/api/mcp/library");
      if (!res.ok) throw new Error("Failed to load MCP library");
      return res.json() as Promise<{ library: McpLibraryEntry[] }>;
    },
  });

  const { data: mcpServersData, isLoading: mcpServersLoading } = useQuery({
    queryKey: ["/api/mcp/servers"],
    queryFn: async () => {
      const res = await fetch("/api/mcp/servers");
      if (!res.ok) throw new Error("Failed to load MCP servers");
      return res.json() as Promise<{ servers: McpServer[] }>;
    },
  });

  const { data: loggingData, isLoading: loggingLoading } = useQuery({
    queryKey: ["/api/mcp/logging"],
    queryFn: async () => {
      const res = await fetch("/api/mcp/logging");
      if (!res.ok) throw new Error("Failed to load MCP logging settings");
      return res.json() as Promise<{ settings: McpLoggingSettings }>;
    },
  });

  const { data: trafficData, isLoading: trafficLoading } = useQuery({
    queryKey: ["/api/mcp/logs"],
    queryFn: async () => {
      const res = await fetch("/api/mcp/logs?limit=40");
      if (!res.ok) throw new Error("Failed to load MCP traffic logs");
      return res.json() as Promise<{ logs: McpTrafficLog[] }>;
    },
    refetchInterval: 5000,
  });

  const addLibraryMcpMutation = useMutation({
    mutationFn: async (libraryKey: string) => {
      const res = await fetch("/api/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryKey }),
      });
      if (!res.ok) throw new Error("Failed to add MCP server from library");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/servers"] });
      toast({ title: "MCP server added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add MCP server", description: error.message, variant: "destructive" });
    },
  });

  const createCustomMcpMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create MCP server");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/servers"] });
      setMcpFormError(null);
      setCustomMcp(defaultCustomMcp);
      toast({ title: "Custom MCP server saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save MCP server", description: error.message, variant: "destructive" });
    },
  });

  const toggleMcpMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/mcp/servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to update MCP server");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/servers"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update MCP server", description: error.message, variant: "destructive" });
    },
  });

  const deleteMcpMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/mcp/servers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete MCP server");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/servers"] });
      toast({ title: "MCP server deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete MCP server", description: error.message, variant: "destructive" });
    },
  });

  const testMcpMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/mcp/servers/${id}/test`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to test MCP server");
      return res.json() as Promise<McpTestResult>;
    },
    onSuccess: (data, id) => {
      setMcpTestResults((prev) => ({ ...prev, [id]: data }));
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/logs"] });
      toast({ title: "MCP server tested", description: `${data.toolCount} tool(s) discovered` });
    },
    onError: (error: Error) => {
      toast({ title: "MCP test failed", description: error.message, variant: "destructive" });
    },
  });

  const updateLoggingMutation = useMutation({
    mutationFn: async (payload: Partial<Pick<McpLoggingSettings, "level" | "captureResponses" | "verboseBudget">>) => {
      const res = await fetch("/api/mcp/logging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update logging settings");
      return res.json() as Promise<{ settings: McpLoggingSettings }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/logging"] });
      toast({ title: "Logging settings saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save logging settings", description: error.message, variant: "destructive" });
    },
  });

  const armVerboseMutation = useMutation({
    mutationFn: async (operations: number) => {
      const res = await fetch("/api/mcp/logging/arm-verbose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations }),
      });
      if (!res.ok) throw new Error("Failed to arm verbose logging");
      return res.json() as Promise<{ settings: McpLoggingSettings }>;
    },
    onSuccess: (_data, operations) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/logging"] });
      toast({ title: "Verbose capture armed", description: `The next ${operations} MCP operation(s) will be captured.` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to arm verbose capture", description: error.message, variant: "destructive" });
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/mcp/logs", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear MCP logs");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/logs"] });
      toast({ title: "MCP logs cleared" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to clear MCP logs", description: error.message, variant: "destructive" });
    },
  });

  const importCanonicalMcpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/mcp/import-canonical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to import canonical MCP config");
      return res.json() as Promise<McpCanonicalImportResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/servers"] });
      toast({
        title: "Canonical MCP config imported",
        description: `${data.created} created, ${data.updated} updated${data.skipped.length ? `, ${data.skipped.length} skipped` : ""}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to import canonical MCP config", description: error.message, variant: "destructive" });
    },
  });

  const examples = useMemo(() => {
    const captured = (trafficData?.logs ?? [])
      .filter((entry) => entry.requestPayload || entry.responsePayload)
      .slice(0, 2)
      .map((entry) => ({
        id: entry.id,
        title: `${entry.serverName} — ${entry.eventType}`,
        description: entry.summary,
        request: entry.requestPayload,
        response: entry.responsePayload ?? { error: entry.errorMessage },
      }));

    return [...captured, ...builtInExamples];
  }, [trafficData?.logs]);

  const handleCreateCustomMcp = () => {
    try {
      const payload = {
        name: customMcp.name,
        description: customMcp.description,
        transport: customMcp.transport,
        endpointUrl: customMcp.transport !== "stdio" ? customMcp.endpointUrl : undefined,
        command: customMcp.transport === "stdio" ? customMcp.command : undefined,
        args: customMcp.transport === "stdio" ? parseJsonArray(customMcp.argsText, "Args") : undefined,
        cwd: customMcp.transport === "stdio" ? customMcp.cwd : undefined,
        headers: customMcp.transport !== "stdio" ? parseJsonRecord(customMcp.headersText, "Headers") : undefined,
        env: parseJsonRecord(customMcp.envText, "Environment"),
      };

      setMcpFormError(null);
      createCustomMcpMutation.mutate(payload);
    } catch (error) {
      setMcpFormError(error instanceof Error ? error.message : "Invalid MCP configuration");
    }
  };

  const armVerboseBurst = () => {
    const operations = Number.parseInt(verboseBurstCount, 10);
    if (!Number.isFinite(operations) || operations < 1) {
      toast({ title: "Enter a valid operation count", variant: "destructive" });
      return;
    }
    armVerboseMutation.mutate(operations);
  };

  const loggingSettings = loggingData?.settings;

  return (
    <div className="space-y-6" data-testid="mcp-studio-panel">
      <section className="rounded-lg border border-border bg-muted/20 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">MCP Studio</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure Model Context Protocol servers, inspect request/response traffic, and learn the MCP message shape from real examples.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{mcpServersData?.servers.length ?? 0} server(s)</Badge>
            <Badge variant="outline">{trafficData?.logs.length ?? 0} recent log(s)</Badge>
            {loggingSettings && <Badge variant="secondary">default: {loggingSettings.level}</Badge>}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/20 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Logging controls</h3>
            </div>
            {loggingLoading || !loggingSettings ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading logging settings...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="mcp-log-level">Default log level</Label>
                  <Select
                    value={loggingSettings.level}
                    onValueChange={(value: McpLoggingLevel) =>
                      updateLoggingMutation.mutate({
                        level: value,
                        captureResponses: loggingSettings.captureResponses,
                        verboseBudget: loggingSettings.verboseBudget,
                      })
                    }
                  >
                    <SelectTrigger id="mcp-log-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="errors">Errors only</SelectItem>
                      <SelectItem value="basic">Basic exchanges</SelectItem>
                      <SelectItem value="verbose">Verbose always-on</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Keep the normal state quiet, then temporarily burst into verbose capture while debugging.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
                  <div className="space-y-1">
                    <Label htmlFor="mcp-capture-responses" className="font-medium">Save response copies</Label>
                    <p className="text-sm text-muted-foreground">
                      Preserve structured responses so valuable payloads remain inspectable after the tool call ends.
                    </p>
                  </div>
                  <Switch
                    id="mcp-capture-responses"
                    checked={loggingSettings.captureResponses}
                    onCheckedChange={(checked) =>
                      updateLoggingMutation.mutate({
                        level: loggingSettings.level,
                        captureResponses: checked,
                        verboseBudget: loggingSettings.verboseBudget,
                      })
                    }
                  />
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Bug className="h-4 w-4 text-primary" />
                    <p className="font-medium">Temporary verbose capture</p>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <Input
                      value={verboseBurstCount}
                      onChange={(event) => setVerboseBurstCount(event.target.value)}
                      className="md:w-32"
                      inputMode="numeric"
                    />
                    <Button onClick={armVerboseBurst} disabled={armVerboseMutation.isPending}>
                      {armVerboseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Capture next operations
                    </Button>
                    <Badge variant="outline">{loggingSettings.verboseBudget} remaining</Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    This captures full in/out exchanges for a bounded number of MCP operations, then falls back to your default log level automatically.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Server library</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {mcpLibraryLoading ? (
                <div className="text-sm text-muted-foreground">Loading MCP library...</div>
              ) : (
                mcpLibraryData?.library.map((entry) => (
                  <div key={entry.key} className="rounded-lg border border-border bg-background p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{entry.name}</p>
                          <Badge variant="outline">{entry.transport}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => addLibraryMcpMutation.mutate(entry.key)}
                        disabled={addLibraryMcpMutation.isPending}
                      >
                        {addLibraryMcpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {entry.template.endpointUrl && <span>{entry.template.endpointUrl}</span>}
                      {entry.homepage && (
                        <a className="inline-flex items-center gap-1 underline" href={entry.homepage} target="_blank" rel="noreferrer">
                          Homepage
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {entry.docsUrl && (
                        <a className="inline-flex items-center gap-1 underline" href={entry.docsUrl} target="_blank" rel="noreferrer">
                          Docs
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-6">
            <div className="mb-4">
              <h3 className="font-medium">Add custom MCP server</h3>
              <p className="text-sm text-muted-foreground">
                Use this for any other MCP server Meowstik should connect to.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mcp-name">Name</Label>
                <Input
                  id="mcp-name"
                  value={customMcp.name}
                  onChange={(e) => setCustomMcp((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="My MCP Server"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-transport">Transport</Label>
                <Select
                  value={customMcp.transport}
                  onValueChange={(value: McpTransport) => setCustomMcp((prev) => ({ ...prev, transport: value }))}
                >
                  <SelectTrigger id="mcp-transport">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="streamable-http">HTTP</SelectItem>
                    <SelectItem value="sse">SSE</SelectItem>
                    <SelectItem value="stdio">stdio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="mcp-description">Description</Label>
              <Textarea
                id="mcp-description"
                value={customMcp.description}
                onChange={(e) => setCustomMcp((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What this MCP server is for"
                rows={2}
              />
            </div>

            {customMcp.transport !== "stdio" ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mcp-endpoint">Endpoint URL</Label>
                  <Input
                    id="mcp-endpoint"
                    value={customMcp.endpointUrl}
                    onChange={(e) => setCustomMcp((prev) => ({ ...prev, endpointUrl: e.target.value }))}
                    placeholder="http://localhost:8766/mcp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcp-headers">Headers JSON</Label>
                  <Textarea
                    id="mcp-headers"
                    value={customMcp.headersText}
                    onChange={(e) => setCustomMcp((prev) => ({ ...prev, headersText: e.target.value }))}
                    placeholder='{"Authorization":"Bearer ..."}'
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mcp-command">Command</Label>
                    <Input
                      id="mcp-command"
                      value={customMcp.command}
                      onChange={(e) => setCustomMcp((prev) => ({ ...prev, command: e.target.value }))}
                      placeholder="npx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mcp-cwd">Working directory</Label>
                    <Input
                      id="mcp-cwd"
                      value={customMcp.cwd}
                      onChange={(e) => setCustomMcp((prev) => ({ ...prev, cwd: e.target.value }))}
                      placeholder="servers/my-mcp"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcp-args">Args JSON</Label>
                  <Textarea
                    id="mcp-args"
                    value={customMcp.argsText}
                    onChange={(e) => setCustomMcp((prev) => ({ ...prev, argsText: e.target.value }))}
                    placeholder='["tsx","src/index.ts"]'
                    rows={3}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <Label htmlFor="mcp-env">Environment JSON</Label>
              <Textarea
                id="mcp-env"
                value={customMcp.envText}
                onChange={(e) => setCustomMcp((prev) => ({ ...prev, envText: e.target.value }))}
                placeholder='{"API_KEY":"..."}'
                rows={3}
              />
            </div>

            {mcpFormError && <p className="mt-3 text-sm text-red-500">{mcpFormError}</p>}

            <div className="mt-4">
              <Button onClick={handleCreateCustomMcp} disabled={createCustomMcpMutation.isPending}>
                {createCustomMcpMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save MCP Server
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">Configured MCP servers</h3>
                <p className="text-sm text-muted-foreground">
                  Import the canonical Copilot inventory from <code>~/.copilot/mcp-config.json</code> to keep Meowstik aligned with Copilot CLI and VS Code.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{mcpServersData?.servers.length ?? 0} configured</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => importCanonicalMcpMutation.mutate()}
                  disabled={importCanonicalMcpMutation.isPending}
                >
                  {importCanonicalMcpMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Import shared config
                </Button>
              </div>
            </div>

            {mcpServersLoading ? (
              <p className="text-sm text-muted-foreground">Loading configured MCP servers...</p>
            ) : (mcpServersData?.servers.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No MCP servers configured yet.</p>
            ) : (
              <div className="space-y-3">
                {mcpServersData?.servers.map((server) => (
                  <div key={server.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{server.name}</p>
                          <Badge variant={server.enabled ? "default" : "secondary"}>
                            {server.enabled ? "enabled" : "disabled"}
                          </Badge>
                          <Badge variant="outline">{server.transport}</Badge>
                          <Badge variant="outline">{server.source}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{server.description || server.slug}</p>
                        <p className="text-xs text-muted-foreground break-all">{formatLocation(server)}</p>
                        {mcpTestResults[server.id] && (
                          <p className="text-xs text-muted-foreground">
                            Last test: {mcpTestResults[server.id].toolCount} tool(s) discovered
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testMcpMutation.mutate(server.id)}
                          disabled={testMcpMutation.isPending}
                        >
                          {testMcpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleMcpMutation.mutate({ id: server.id, enabled: !server.enabled })}
                          disabled={toggleMcpMutation.isPending}
                        >
                          {server.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMcpMutation.mutate(server.id)}
                          disabled={deleteMcpMutation.isPending}
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/20 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">MCP message explorer</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              The same viewer handles JSON and XML, lets you browse nested objects as a tree, and flips through child nodes like cards so the payload shape is easier to grasp.
            </p>
            <Tabs defaultValue={examples[0]?.id ?? "example-list-tools"} className="space-y-4">
              <TabsList className="grid h-auto w-full grid-cols-1 gap-2 md:grid-cols-2">
                {examples.slice(0, 4).map((example) => (
                  <TabsTrigger key={example.id} value={example.id} className="whitespace-normal text-left">
                    {example.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              {examples.slice(0, 4).map((example) => (
                <TabsContent key={example.id} value={example.id} className="space-y-4">
                  <div>
                    <h4 className="font-medium">{example.title}</h4>
                    <p className="text-sm text-muted-foreground">{example.description}</p>
                  </div>
                  <StructuredDataViewer label="Request" value={example.request} />
                  <StructuredDataViewer label="Response" value={example.response} />
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Recent traffic</h3>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/mcp/logs"] })}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={() => clearLogsMutation.mutate()} disabled={clearLogsMutation.isPending}>
                  {clearLogsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Clear
                </Button>
              </div>
            </div>

            {trafficLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading MCP traffic...
              </div>
            ) : (trafficData?.logs.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No MCP traffic logged yet. Test a server or arm a verbose capture burst to see exchanges appear here.
              </p>
            ) : (
              <ScrollArea className="h-[50rem] pr-4">
                <div className="space-y-4">
                  {trafficData?.logs.map((entry) => (
                    <details key={entry.id} className="rounded-lg border border-border bg-background p-4">
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{entry.summary}</p>
                              <Badge variant={entry.status === "ok" ? "default" : "destructive"}>{entry.status}</Badge>
                              <Badge variant="outline">{entry.eventType}</Badge>
                              {entry.transport && <Badge variant="outline">{entry.transport}</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {entry.serverName}
                              {entry.toolName ? ` • ${entry.toolName}` : ""}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground">{formatWhen(entry.createdAt)}</div>
                        </div>
                      </summary>
                      <div className="mt-4 space-y-4 border-t border-border pt-4">
                        {entry.errorMessage && (
                          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
                            {entry.errorMessage}
                          </div>
                        )}
                        {entry.requestPayload !== null && entry.requestPayload !== undefined && (
                          <StructuredDataViewer label="Request" value={entry.requestPayload} />
                        )}
                        {entry.responsePayload !== null && entry.responsePayload !== undefined && (
                          <StructuredDataViewer label="Response" value={entry.responsePayload} />
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
