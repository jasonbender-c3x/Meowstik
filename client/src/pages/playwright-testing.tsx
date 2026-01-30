import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play, Trash2, Camera, MousePointer, Type, Eye, Code, Globe, X, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface TestResult {
  id: string;
  command: string;
  success: boolean;
  message: string;
  result?: unknown;
  timestamp: Date;
}

interface CommandTemplate {
  name: string;
  icon: React.ReactNode;
  endpoint: string;
  fields: { name: string; label: string; placeholder: string; required?: boolean }[];
}

const COMMANDS: CommandTemplate[] = [
  {
    name: "Navigate",
    icon: <Globe className="h-4 w-4" />,
    endpoint: "/api/playwright/navigate",
    fields: [{ name: "url", label: "URL", placeholder: "https://example.com", required: true }]
  },
  {
    name: "Click",
    icon: <MousePointer className="h-4 w-4" />,
    endpoint: "/api/playwright/click",
    fields: [{ name: "selector", label: "Selector", placeholder: "#button, .class, [data-testid='btn']", required: true }]
  },
  {
    name: "Type",
    icon: <Type className="h-4 w-4" />,
    endpoint: "/api/playwright/type",
    fields: [
      { name: "selector", label: "Selector", placeholder: "#input, .form-field", required: true },
      { name: "text", label: "Text", placeholder: "Text to type", required: true }
    ]
  },
  {
    name: "Screenshot",
    icon: <Camera className="h-4 w-4" />,
    endpoint: "/api/playwright/screenshot",
    fields: []
  },
  {
    name: "Wait",
    icon: <Eye className="h-4 w-4" />,
    endpoint: "/api/playwright/wait",
    fields: [{ name: "selector", label: "Selector", placeholder: "#element", required: true }]
  },
  {
    name: "Get Text",
    icon: <Type className="h-4 w-4" />,
    endpoint: "/api/playwright/getText",
    fields: [{ name: "selector", label: "Selector", placeholder: "#element", required: true }]
  },
  {
    name: "Evaluate",
    icon: <Code className="h-4 w-4" />,
    endpoint: "/api/playwright/evaluate",
    fields: [{ name: "script", label: "JavaScript", placeholder: "document.title", required: true }]
  }
];

export default function PlaywrightTestingPage() {
  const [sessionId, setSessionId] = useState<string>(`session_${Date.now()}`);
  const [isHeadless, setIsHeadless] = useState(true);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState(COMMANDS[0]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const addResult = useCallback((command: string, success: boolean, message: string, result?: unknown) => {
    setResults(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      command,
      success,
      message,
      result,
      timestamp: new Date()
    }]);
  }, []);

  const executeCommand = async () => {
    if (isRunning) return;

    for (const field of selectedCommand.fields) {
      if (field.required && !formData[field.name]) {
        addResult(selectedCommand.name, false, `${field.label} is required`, null);
        return;
      }
    }

    setIsRunning(true);

    try {
      const body: Record<string, unknown> = { sessionId };
      
      if (selectedCommand.name === "Navigate") {
        body.headless = isHeadless;
      }
      
      for (const field of selectedCommand.fields) {
        body[field.name] = formData[field.name];
      }

      const response = await fetch(selectedCommand.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      if (data.success && data.result?.base64) {
        setScreenshot(data.result.base64);
      }

      addResult(selectedCommand.name, data.success, data.message || data.error, data.result);
    } catch (error) {
      addResult(selectedCommand.name, false, error instanceof Error ? error.message : "Command failed", null);
    } finally {
      setIsRunning(false);
    }
  };

  const closeSession = async () => {
    try {
      await fetch("/api/playwright/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      setSessionId(`session_${Date.now()}`);
      setScreenshot(null);
      addResult("Close Session", true, "Session closed", null);
    } catch (error) {
      addResult("Close Session", false, "Failed to close session", null);
    }
  };

  const clearResults = () => {
    setResults([]);
    setScreenshot(null);
  };

  useEffect(() => {
    if (resultsRef.current) {
      resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
    }
  }, [results]);

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="playwright-testing-page">
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
              <Play className="h-5 w-5 text-primary" />
              Playwright Testing
            </h1>
            <p className="text-sm text-muted-foreground">
              Automated browser testing with Playwright • Session: <code className="bg-secondary px-2 py-0.5 rounded text-xs">{sessionId.slice(0, 20)}...</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Switch
                id="headless"
                checked={isHeadless}
                onCheckedChange={setIsHeadless}
                data-testid="switch-headless"
              />
              <Label htmlFor="headless" className="text-sm">Headless</Label>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={closeSession}
              data-testid="button-close-session"
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearResults}
              data-testid="button-clear-results"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden">
          {/* Left Panel - Commands */}
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Command Section */}
            <div className="border border-border rounded-lg bg-muted/20 p-4 flex flex-col overflow-hidden">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" />
                Commands
              </h3>
              
              <Tabs value={selectedCommand.name} onValueChange={(v) => {
                const cmd = COMMANDS.find(c => c.name === v);
                if (cmd) {
                  setSelectedCommand(cmd);
                  setFormData({});
                }
              }} className="flex flex-col flex-1 min-h-0">
                <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full mb-4">
                  {COMMANDS.map(cmd => (
                    <TabsTrigger key={cmd.name} value={cmd.name} className="text-xs" title={cmd.name}>
                      {cmd.icon}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {COMMANDS.map(cmd => (
                    <TabsContent key={cmd.name} value={cmd.name} className="space-y-3 mt-0">
                      <h4 className="font-medium text-sm">{cmd.name}</h4>
                      {cmd.fields.map(field => (
                        <div key={field.name}>
                          <Label htmlFor={field.name} className="text-xs">{field.label}</Label>
                          <Input
                            id={field.name}
                            placeholder={field.placeholder}
                            value={formData[field.name] || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                            className="mt-1 text-sm"
                            data-testid={`input-${field.name}`}
                          />
                        </div>
                      ))}
                      {cmd.fields.length === 0 && (
                        <p className="text-sm text-muted-foreground">No additional parameters required.</p>
                      )}
                    </TabsContent>
                  ))}
                </div>
              </Tabs>

              <Button
                onClick={executeCommand}
                disabled={isRunning}
                className="w-full mt-4"
                data-testid="button-execute-command"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Execute {selectedCommand.name}
                  </>
                )}
              </Button>
            </div>

            {/* Results Section */}
            <div className="border border-border rounded-lg bg-muted/20 p-4 flex flex-col overflow-hidden flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Results
                </h3>
                <span className="text-xs text-muted-foreground">{results.length} commands</span>
              </div>
              <ScrollArea className="flex-1">
                <div ref={resultsRef} className="p-3 font-mono text-xs space-y-2" data-testid="results-area">
                  {results.length === 0 ? (
                    <span className="text-muted-foreground">Execute a command to see results...</span>
                  ) : (
                    results.map((result) => {
                      const resultJson = result.result && typeof result.result === "object" && !("base64" in (result.result as Record<string, unknown>))
                        ? JSON.stringify(result.result, null, 2)
                        : null;
                      
                      return (
                        <div key={result.id} className={cn(
                          "p-2 rounded border-l-2",
                          result.success ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"
                        )}>
                          <div className="flex items-center gap-2">
                            <span className={result.success ? "text-green-400" : "text-red-400"}>
                              {result.success ? "✓" : "✗"}
                            </span>
                            <span className="font-semibold">{result.command}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {result.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs mt-1 text-gray-400">{result.message}</p>
                          {resultJson && (
                            <pre className="text-xs mt-1 text-gray-500 overflow-x-auto">
                              {resultJson}
                            </pre>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right Panel - Screenshot Preview */}
          <div className="border border-border rounded-lg bg-muted/20 p-4 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Screenshot Preview</h3>
            </div>
            <div className="flex-1 flex items-center justify-center min-h-[400px] bg-muted/20 rounded-lg overflow-hidden">
              {screenshot ? (
                <img 
                  src={screenshot} 
                  alt="Browser screenshot" 
                  className="max-w-full max-h-full object-contain rounded"
                  data-testid="screenshot-preview"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No screenshot yet</p>
                  <p className="text-xs">Navigate to a page and take a screenshot</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Tips */}
        <div className="border-t bg-card px-4 py-3 flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            💡 Tips: Start with Navigate to open a page. Use CSS selectors or data-testid attributes for interactions. Screenshots are captured in PNG format.
          </p>
        </div>
      </main>
    </div>
  );
}
