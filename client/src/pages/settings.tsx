
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings, Palette, Mic, Brain, Bell, Shield, Link2, Check, ExternalLink, Loader2, Database, FileText, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AppSettings {
  model: "pro" | "flash";
  theme: string;
  voiceEnabled: boolean;
  ttsMode: "api" | "browser";
  ttsVoice: string;
  ttsSpeed: number;
  ttsPitch: number;
  preResponseFillerEnabled: boolean;
  preResponseFillerInterruptMode: "stop-immediately-on-first-model-text" | "finish-current-sentence-then-stop";
  preResponseFillerCadence: "5-10-seconds-random" | "fixed-6-seconds" | "fixed-8-seconds";
  notifications: boolean;
  saveHistory: boolean;
  streamResponses: boolean;
  knowledgeConversationTurns: number;
  knowledgeAutoIngest: boolean;
}

interface BrandingSettings {
  agentName: string;
  displayName: string;
  avatarUrl?: string;
  brandColor: string;
  githubSignature?: string;
  emailSignature?: string;
  canonicalDomain?: string;
}

interface McpLibraryEntry {
  key: string;
  name: string;
  description: string;
  transport: "stdio" | "streamable-http" | "sse";
  docsUrl?: string;
  homepage?: string;
  template: {
    endpointUrl?: string;
    command?: string;
    args?: string[];
    cwd?: string;
  };
}

interface McpServer {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  transport: "stdio" | "streamable-http" | "sse";
  enabled: boolean;
  source: "custom" | "library";
  libraryKey?: string | null;
  endpointUrl?: string | null;
  command?: string | null;
  args?: string[] | null;
  cwd?: string | null;
}

interface McpTestResult {
  ok: boolean;
  toolCount: number;
}

const defaultSettings: AppSettings = {
  model: "pro",
  theme: "system",
  voiceEnabled: true,
  ttsMode: "api",
  ttsVoice: "Kore",
  ttsSpeed: 1.0,
  ttsPitch: 1.0,
  preResponseFillerEnabled: true,
  preResponseFillerInterruptMode: "stop-immediately-on-first-model-text",
  preResponseFillerCadence: "5-10-seconds-random",
  notifications: true,
  saveHistory: true,
  streamResponses: true,
  knowledgeConversationTurns: 50,
  knowledgeAutoIngest: false
};

const API_VOICES = [
  { value: "Kore", label: "Kore - Clear Female" },
  { value: "Puck", label: "Puck - Warm Male" },
  { value: "Charon", label: "Charon - Deep Male" },
  { value: "Fenrir", label: "Fenrir - Strong Male" },
  { value: "Aoede", label: "Aoede - Melodic Female" },
  { value: "Leda", label: "Leda - Soft Female" },
  { value: "Orus", label: "Orus - Authoritative Male" },
  { value: "Zephyr", label: "Zephyr - Gentle Neutral" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [mcpFormError, setMcpFormError] = useState<string | null>(null);
  const [mcpTestResults, setMcpTestResults] = useState<Record<string, McpTestResult>>({});
  const [customMcp, setCustomMcp] = useState({
    name: "",
    description: "",
    transport: "streamable-http" as "stdio" | "streamable-http" | "sse",
    endpointUrl: "http://localhost:8766/mcp",
    command: "",
    argsText: "[]",
    cwd: "",
    headersText: "{}",
    envText: "{}",
  });
  const queryClient = useQueryClient();

  // Branding settings
  const { data: brandingData, isLoading: brandingLoading } = useQuery({
    queryKey: ['/api/branding'],
    queryFn: async () => {
      const res = await fetch('/api/branding');
      if (!res.ok) {
        // If not authenticated or branding doesn't exist, return defaults
        return {
          branding: {
            agentName: 'Meowstik',
            displayName: 'Meowstik AI',
            avatarUrl: '',
            brandColor: '#4285f4',
            githubSignature: '',
            emailSignature: '',
            canonicalDomain: ''
          }
        };
      }
      return res.json() as Promise<{ branding: BrandingSettings }>;
    },
  });

  const updateBrandingMutation = useMutation({
    mutationFn: async (branding: Partial<BrandingSettings>) => {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding),
      });
      if (!res.ok) throw new Error('Failed to update branding');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branding'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const resetBrandingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/branding', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to reset branding');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branding'] });
    },
  });

  const { data: authStatus, isLoading: authLoading } = useQuery({
    queryKey: ['/api/auth/google/status'],
    queryFn: async () => {
      const res = await fetch('/api/auth/google/status', {
        credentials: 'include',
      });

      if (!res.ok) {
        return { authenticated: false, hasTokens: false };
      }

      return res.json() as Promise<{ authenticated: boolean; hasTokens: boolean; hasFullScopes?: boolean; authUrl?: string | null }>;
    },
    refetchInterval: 30000,
  });

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

  const revokeMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/auth/google/revoke', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/google/status'] });
    },
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
      setCustomMcp({
        name: "",
        description: "",
        transport: "streamable-http",
        endpointUrl: "http://localhost:8766/mcp",
        command: "",
        argsText: "[]",
        cwd: "",
        headersText: "{}",
        envText: "{}",
      });
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
  });

  const deleteMcpMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/mcp/servers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete MCP server");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/servers"] });
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
    },
  });

  const handleConnectGoogle = () => {
    // Use server-provided authUrl if available (ensures correct scopes), else fallback
    const url = authStatus?.authUrl ?? '/api/auth/google';
    window.open(url, '_blank');
  };

  const handleDisconnectGoogle = () => {
    revokeMutation.mutate();
  };

  const parseJsonRecord = (value: string, fieldName: string): Record<string, string> => {
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
  };

  const parseJsonArray = (value: string, fieldName: string): string[] => {
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
  };

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
        env: parseJsonRecord(customMcp.envText, "Environment") ,
      };

      setMcpFormError(null);
      createCustomMcpMutation.mutate(payload);
    } catch (error) {
      setMcpFormError(error instanceof Error ? error.message : "Invalid MCP configuration");
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('meowstic-settings');
    if (stored) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('meowstic-settings', JSON.stringify(newSettings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };


  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="settings-page">
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
              <Settings className="h-5 w-5 text-primary" />
              Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Customize your Meowstik experience
            </p>
          </div>
          {saved && (
            <Badge variant="default" className="bg-green-500 animate-in fade-in">
              <Check className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            <section className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">AI Model</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="model-toggle" className="font-medium">Flash Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      {settings.model === "flash" 
                        ? "Gemini 2.5 Flash - Fast and efficient" 
                        : "Gemini 3 Pro - Maximum capability (default)"}
                    </p>
                  </div>
                  <Switch
                    id="model-toggle"
                    data-testid="toggle-model"
                    checked={settings.model === "flash"}
                    onCheckedChange={(checked) => updateSetting('model', checked ? "flash" : "pro")}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Toggle on for faster responses with Gemini Flash. Toggle off for Gemini 3's advanced reasoning.
                </p>
              </div>
            </section>

            <section className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Palette className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Appearance</h2>
              </div>
              
              <div className="space-y-4">
                <Label htmlFor="theme-select">Theme</Label>
                <Select 
                  value={settings.theme} 
                  onValueChange={(value) => updateSetting('theme', value)}
                >
                  <SelectTrigger id="theme-select" data-testid="select-theme">
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System Default</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Custom Branding</h2>
              </div>
              
              {brandingLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Customize your AI assistant's identity, name, and signatures for a personalized experience.
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="agent-name">Agent Name</Label>
                      <Input
                        id="agent-name"
                        placeholder="e.g., Catpilot"
                        defaultValue={brandingData?.branding.agentName || 'Meowstik'}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== brandingData?.branding.agentName) {
                            updateBrandingMutation.mutate({ agentName: e.target.value });
                          }
                        }}
                        data-testid="input-agent-name"
                      />
                      <p className="text-xs text-muted-foreground">
                        The primary name of your AI assistant (e.g., "Catpilot" instead of "Meowstik")
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="display-name">Display Name</Label>
                      <Input
                        id="display-name"
                        placeholder="e.g., Catpilot Pro"
                        defaultValue={brandingData?.branding.displayName || 'Meowstik AI'}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== brandingData?.branding.displayName) {
                            updateBrandingMutation.mutate({ displayName: e.target.value });
                          }
                        }}
                        data-testid="input-display-name"
                      />
                      <p className="text-xs text-muted-foreground">
                        Full display name shown in UI (e.g., "Catpilot Pro")
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="canonical-domain">Canonical Domain</Label>
                      <Input
                        id="canonical-domain"
                        placeholder="e.g., catpilot.pro"
                        defaultValue={brandingData?.branding.canonicalDomain || ''}
                        onBlur={(e) => {
                          if (e.target.value !== brandingData?.branding.canonicalDomain) {
                            updateBrandingMutation.mutate({ canonicalDomain: e.target.value || undefined });
                          }
                        }}
                        data-testid="input-canonical-domain"
                      />
                      <p className="text-xs text-muted-foreground">
                        Your custom domain for branding (optional)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="avatar-url">Avatar URL</Label>
                      <Input
                        id="avatar-url"
                        placeholder="https://example.com/avatar.png"
                        defaultValue={brandingData?.branding.avatarUrl || ''}
                        onBlur={(e) => {
                          if (e.target.value !== brandingData?.branding.avatarUrl) {
                            updateBrandingMutation.mutate({ avatarUrl: e.target.value || undefined });
                          }
                        }}
                        data-testid="input-avatar-url"
                      />
                      <p className="text-xs text-muted-foreground">
                        URL to your custom avatar image (optional)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="brand-color">Brand Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="brand-color"
                          type="color"
                          className="w-20 h-10 cursor-pointer"
                          defaultValue={brandingData?.branding.brandColor || '#4285f4'}
                          onChange={(e) => {
                            if (e.target.value !== brandingData?.branding.brandColor) {
                              updateBrandingMutation.mutate({ brandColor: e.target.value });
                            }
                          }}
                          data-testid="input-brand-color"
                        />
                        <Input
                          value={brandingData?.branding.brandColor || '#4285f4'}
                          readOnly
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Primary brand color for UI elements
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="github-signature">GitHub Signature</Label>
                      <Textarea
                        id="github-signature"
                        placeholder="e.g., 🐱 Automated by Catpilot"
                        defaultValue={brandingData?.branding.githubSignature || ''}
                        onBlur={(e) => {
                          if (e.target.value !== brandingData?.branding.githubSignature) {
                            updateBrandingMutation.mutate({ githubSignature: e.target.value || undefined });
                          }
                        }}
                        rows={2}
                        data-testid="input-github-signature"
                      />
                      <p className="text-xs text-muted-foreground">
                        Signature added to GitHub commits and PRs (optional)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email-signature">Email Signature</Label>
                      <Textarea
                        id="email-signature"
                        placeholder="Best regards,\nYour AI Assistant"
                        defaultValue={brandingData?.branding.emailSignature || ''}
                        onBlur={(e) => {
                          if (e.target.value !== brandingData?.branding.emailSignature) {
                            updateBrandingMutation.mutate({ emailSignature: e.target.value || undefined });
                          }
                        }}
                        rows={3}
                        data-testid="input-email-signature"
                      />
                      <p className="text-xs text-muted-foreground">
                        Signature added to emails sent by the AI (optional)
                      </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => resetBrandingMutation.mutate()}
                        disabled={resetBrandingMutation.isPending}
                        data-testid="button-reset-branding"
                      >
                        {resetBrandingMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Reset to Defaults
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Mic className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Voice & Audio</h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="voice-toggle" className="font-medium">Text-to-Speech</Label>
                    <p className="text-sm text-muted-foreground">Read AI responses aloud</p>
                  </div>
                  <Switch 
                    id="voice-toggle"
                    checked={settings.voiceEnabled}
                    onCheckedChange={(checked) => updateSetting('voiceEnabled', checked)}
                    data-testid="switch-voice"
                  />
                </div>

                {settings.voiceEnabled && (
                  <>
                    <div className="space-y-3">
                      <Label htmlFor="tts-mode">TTS Mode</Label>
                      <Select 
                        value={settings.ttsMode} 
                        onValueChange={(value: "api" | "browser") => updateSetting('ttsMode', value)}
                      >
                        <SelectTrigger id="tts-mode" data-testid="select-tts-mode">
                          <SelectValue placeholder="Select TTS mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="api">
                            <div>
                              <div className="font-medium">Gemini API</div>
                              <div className="text-xs text-muted-foreground">High-quality, expressive voices</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="browser">
                            <div>
                              <div className="font-medium">Browser (Fallback)</div>
                              <div className="text-xs text-muted-foreground">Uses your device's built-in voices</div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        API mode uses Gemini TTS for natural speech. Browser mode works offline as a fallback.
                      </p>
                    </div>

                    {settings.ttsMode === "api" && (
                      <div className="space-y-3">
                        <Label htmlFor="tts-voice">Voice</Label>
                        <Select 
                          value={settings.ttsVoice} 
                          onValueChange={(value) => updateSetting('ttsVoice', value)}
                        >
                          <SelectTrigger id="tts-voice" data-testid="select-tts-voice">
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {API_VOICES.map((voice) => (
                              <SelectItem key={voice.value} value={voice.value}>
                                {voice.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Label htmlFor="tts-speed">Speed</Label>
                        <span className="text-sm text-muted-foreground">{settings.ttsSpeed.toFixed(1)}x</span>
                      </div>
                      <Slider
                        id="tts-speed"
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={[settings.ttsSpeed]}
                        onValueChange={([value]) => updateSetting('ttsSpeed', value)}
                        data-testid="slider-tts-speed"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Label htmlFor="tts-pitch">Pitch</Label>
                        <span className="text-sm text-muted-foreground">{settings.ttsPitch.toFixed(1)}</span>
                      </div>
                      <Slider
                        id="tts-pitch"
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={[settings.ttsPitch]}
                        onValueChange={([value]) => updateSetting('ttsPitch', value)}
                        data-testid="slider-tts-pitch"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="thinking-filler-toggle" className="font-medium">Speak while thinking</Label>
                        <p className="text-sm text-muted-foreground">
                          Use last turn&apos;s forward-thought cache to fill dead air while the next response starts.
                        </p>
                      </div>
                      <Switch
                        id="thinking-filler-toggle"
                        checked={settings.preResponseFillerEnabled}
                        onCheckedChange={(checked) => updateSetting('preResponseFillerEnabled', checked)}
                        data-testid="switch-thinking-filler"
                      />
                    </div>

                    {settings.preResponseFillerEnabled && (
                      <>
                        <div className="space-y-3">
                          <Label htmlFor="thinking-filler-interrupt">Interrupt behavior</Label>
                          <Select
                            value={settings.preResponseFillerInterruptMode}
                            onValueChange={(value: AppSettings["preResponseFillerInterruptMode"]) =>
                              updateSetting('preResponseFillerInterruptMode', value)
                            }
                          >
                            <SelectTrigger id="thinking-filler-interrupt" data-testid="select-thinking-filler-interrupt">
                              <SelectValue placeholder="Select interrupt behavior" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="stop-immediately-on-first-model-text">Stop immediately on first model text</SelectItem>
                              <SelectItem value="finish-current-sentence-then-stop">Finish current sentence, then stop</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="thinking-filler-cadence">Cadence</Label>
                          <Select
                            value={settings.preResponseFillerCadence}
                            onValueChange={(value: AppSettings["preResponseFillerCadence"]) =>
                              updateSetting('preResponseFillerCadence', value)
                            }
                          >
                            <SelectTrigger id="thinking-filler-cadence" data-testid="select-thinking-filler-cadence">
                              <SelectValue placeholder="Select cadence" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5-10-seconds-random">Random 5 to 10 seconds</SelectItem>
                              <SelectItem value="fixed-6-seconds">Fixed 6 seconds</SelectItem>
                              <SelectItem value="fixed-8-seconds">Fixed 8 seconds</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Notifications</h2>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications-toggle" className="font-medium">Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">Get notified about important updates</p>
                </div>
                <Switch 
                  id="notifications-toggle"
                  checked={settings.notifications}
                  onCheckedChange={(checked) => updateSetting('notifications', checked)}
                  data-testid="switch-notifications"
                />
              </div>
            </section>

            <section className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Privacy & Data</h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="history-toggle" className="font-medium">Save Chat History</Label>
                    <p className="text-sm text-muted-foreground">Keep your conversation history</p>
                  </div>
                  <Switch 
                    id="history-toggle"
                    checked={settings.saveHistory}
                    onCheckedChange={(checked) => updateSetting('saveHistory', checked)}
                    data-testid="switch-history"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="stream-toggle" className="font-medium">Stream Responses</Label>
                    <p className="text-sm text-muted-foreground">See AI responses as they're generated</p>
                  </div>
                  <Switch 
                    id="stream-toggle"
                    checked={settings.streamResponses}
                    onCheckedChange={(checked) => updateSetting('streamResponses', checked)}
                    data-testid="switch-stream"
                  />
                </div>
              </div>
            </section>

            <section className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Link2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Connected Accounts</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div>
                      <Label className="font-medium">Google Account</Label>
                      <p className="text-sm text-muted-foreground">
                      {authLoading ? 'Checking...' : authStatus?.authenticated && authStatus?.hasFullScopes ? 'Connected — Gmail, Calendar, Drive, Docs, Sheets, Tasks' : authStatus?.authenticated ? '⚠️ Limited access — re-authorize to enable Tasks & Gmail' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  
                  {authLoading ? (
                    <Button variant="outline" size="sm" disabled>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </Button>
                  ) : authStatus?.authenticated && authStatus?.hasFullScopes ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDisconnectGoogle}
                      disabled={revokeMutation.isPending}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      data-testid="button-disconnect-google"
                    >
                      {revokeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                    </Button>
                  ) : authStatus?.authenticated && !authStatus?.hasFullScopes ? (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleConnectGoogle}
                      className="gap-2 bg-amber-600 hover:bg-amber-700"
                      data-testid="button-reauth-google"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Re-authorize
                    </Button>
                  ) : (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleConnectGoogle}
                      className="gap-2"
                      data-testid="button-connect-google"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Connect
                    </Button>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Connect your Google account to enable access to Gmail, Calendar, Drive, Docs, Sheets, and Tasks directly from the chat.
                </p>
              </div>
            </section>

            <section className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Link2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">MCP Servers</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect Model Context Protocol servers so Meowstik can discover and use their tools. Library entries give one-click setup, and the custom form supports stdio, streamable HTTP, and legacy SSE MCP servers.
                  </p>

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
                              <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
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
                              <a className="underline" href={entry.homepage} target="_blank" rel="noreferrer">
                                Homepage
                              </a>
                            )}
                            {entry.docsUrl && (
                              <a className="underline" href={entry.docsUrl} target="_blank" rel="noreferrer">
                                Docs
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-4 space-y-4">
                  <div>
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
                        onValueChange={(value: "stdio" | "streamable-http" | "sse") =>
                          setCustomMcp((prev) => ({ ...prev, transport: value }))
                        }
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

                  <div className="space-y-2">
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
                    <>
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
                    </>
                  ) : (
                    <>
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
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="mcp-env">Environment JSON</Label>
                    <Textarea
                      id="mcp-env"
                      value={customMcp.envText}
                      onChange={(e) => setCustomMcp((prev) => ({ ...prev, envText: e.target.value }))}
                      placeholder='{"API_KEY":"..."}'
                      rows={3}
                    />
                  </div>

                  {mcpFormError && <p className="text-sm text-red-500">{mcpFormError}</p>}

                  <Button onClick={handleCreateCustomMcp} disabled={createCustomMcpMutation.isPending}>
                    {createCustomMcpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save MCP Server"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Configured MCP servers</h3>
                    <span className="text-sm text-muted-foreground">
                      {mcpServersData?.servers.length ?? 0} configured
                    </span>
                  </div>

                  {mcpServersLoading ? (
                    <p className="text-sm text-muted-foreground">Loading configured MCP servers...</p>
                  ) : (mcpServersData?.servers.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">No MCP servers configured yet.</p>
                  ) : (
                    mcpServersData?.servers.map((server) => (
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
                            <p className="text-xs text-muted-foreground break-all">
                              {server.transport === "streamable-http"
                                ? server.endpointUrl
                                : [server.command, ...(server.args || [])].filter(Boolean).join(" ")}
                            </p>
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
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="border border-border rounded-lg bg-muted/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Database className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Knowledge Ingestion</h2>
              </div>
              
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Ingest historical conversations from Gmail and Drive, processing them to build persistent memory across all your AI interactions.
                </p>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label htmlFor="conversation-turns">Conversation Turns to Reattach</Label>
                    <span className="text-sm text-muted-foreground font-mono">{settings.knowledgeConversationTurns}</span>
                  </div>
                  <Slider
                    id="conversation-turns"
                    min={10}
                    max={200}
                    step={10}
                    value={[settings.knowledgeConversationTurns]}
                    onValueChange={([value]) => updateSetting('knowledgeConversationTurns', value)}
                    data-testid="slider-conversation-turns"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of conversation turns to include when reattaching context. Higher values provide more context but use more tokens.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-ingest" className="font-medium">Auto-Ingest New Conversations</Label>
                    <p className="text-sm text-muted-foreground">Automatically process new LLM conversations</p>
                  </div>
                  <Switch 
                    id="auto-ingest"
                    checked={settings.knowledgeAutoIngest}
                    onCheckedChange={(checked) => updateSetting('knowledgeAutoIngest', checked)}
                    data-testid="switch-auto-ingest"
                  />
                </div>

                <Link href="/knowledge">
                  <Button variant="outline" className="w-full gap-2" data-testid="button-open-knowledge">
                    <FileText className="h-4 w-4" />
                    Open Knowledge Ingestion
                  </Button>
                </Link>
              </div>
            </section>

            <div className="border border-border rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-6">
              <h2 className="text-lg font-semibold mb-2">About Meowstik</h2>
              <p className="text-muted-foreground text-sm mb-3">
                Meowstik is a purrfect AI assistant powered by Google's Gemini models, with integrated Google Workspace services. Always curious, always helpful!
              </p>
              <p className="text-xs text-muted-foreground">Version 9.lives</p>
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
