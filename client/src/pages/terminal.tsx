import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Terminal as TerminalIcon, Trash2, RefreshCw, Download, Wifi, WifiOff, Server } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface TerminalLine {
  id: string;
  type: "command" | "output" | "error" | "system" | "ssh";
  content: string;
  timestamp: Date;
  host?: string;
}

export default function TerminalPage() {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: "welcome",
      type: "system",
      content: "Terminal ready. Type commands below. WebSocket provides real-time streaming.",
      timestamp: new Date()
    }
  ]);
  const [command, setCommand] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeHost, setActiveHost] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((type: TerminalLine["type"], content: string, host?: string) => {
    const newLine: TerminalLine = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
      host
    };
    setLines(prev => [...prev, newLine]);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;
    
    console.log('[Terminal] Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Terminal] WebSocket connected');
      setWsConnected(true);
      addLine("system", "WebSocket connected - real-time streaming enabled");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'output' || msg.type === 'status') {
          const data = msg.data;
          const content = data.content || '';
          const source = data.source || 'local';
          const dataType = data.type || 'stdout';
          
          if (dataType === 'stderr') {
            addLine("error", content, source !== 'local' && source !== 'system' ? source : undefined);
          } else if (dataType === 'system' || msg.type === 'status') {
            addLine("system", content, source !== 'local' && source !== 'system' ? source : undefined);
          } else if (dataType === 'command') {
            addLine("command", content, source !== 'local' && source !== 'system' ? source : undefined);
          } else {
            addLine("output", content, source !== 'local' && source !== 'system' ? source : undefined);
          }
          
          if (source !== 'local' && source !== 'system' && !activeHost) {
            setActiveHost(source);
          }
        } else {
          console.log('[Terminal] Unknown message type:', msg);
        }
      } catch (e) {
        addLine("output", event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('[Terminal] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[Terminal] WebSocket closed');
      setWsConnected(false);
      wsRef.current = null;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[Terminal] Attempting reconnect...');
        connectWebSocket();
      }, 3000);
    };

    wsRef.current = ws;
  }, [addLine, activeHost]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setIsExecuting(true);
    const prefix = activeHost ? `[${activeHost}]` : "";
    addLine("command", `${prefix} $ ${cmd}`);
    setCommandHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommand("");

    try {
      const response = await fetch("/api/terminal/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd })
      });

      const data = await response.json();

      if (data.stdout) {
        addLine("output", data.stdout);
      }
      if (data.stderr) {
        addLine("error", data.stderr);
      }
      if (data.error) {
        addLine("error", `Error: ${data.error}`);
      }
      if (!data.stdout && !data.stderr && !data.error) {
        addLine("system", "(Command completed with no output)");
      }
    } catch (error) {
      addLine("error", `Failed to execute command: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isExecuting) {
      executeCommand(command);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand("");
      }
    } else if (e.key === "c" && e.ctrlKey) {
      addLine("system", "^C");
      setCommand("");
      setIsExecuting(false);
    }
  };

  const clearTerminal = () => {
    setLines([{
      id: "cleared",
      type: "system",
      content: "Terminal cleared.",
      timestamp: new Date()
    }]);
  };

  const downloadOutput = async () => {
    const content = lines.map(l => l.content).join('\n');
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terminal-output-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "command": return "text-cyan-400";
      case "output": return "text-gray-300";
      case "error": return "text-red-400";
      case "system": return "text-yellow-400";
      case "ssh": return "text-purple-400";
      default: return "text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="terminal-page">
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
              <TerminalIcon className="h-5 w-5 text-primary" />
              Terminal
            </h1>
            <p className="text-sm text-muted-foreground">
              Execute shell commands with real-time streaming • WebSocket support
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm",
              wsConnected ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
            )}>
              {wsConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {wsConnected ? "Connected" : "Disconnected"}
            </div>
            {activeHost && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-purple-500/10 text-purple-500">
                <Server className="h-4 w-4" />
                SSH: {activeHost}
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={downloadOutput}
              data-testid="button-download-output"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearTerminal}
              data-testid="button-clear-terminal"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 rounded-lg border border-border bg-[#1e1e1e] overflow-hidden flex flex-col m-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-[#888] text-xs ml-2 font-mono">
              {activeHost ? `ssh - ${activeHost}` : "bash - local"}
            </span>
            {isExecuting && (
              <div className="ml-auto flex items-center gap-2 text-yellow-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="text-xs">Executing...</span>
              </div>
            )}
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm"
            onClick={() => inputRef.current?.focus()}
            data-testid="terminal-output-area"
          >
            {lines.map((line) => (
              <div 
                key={line.id} 
                className={cn("py-0.5 whitespace-pre-wrap break-all", getLineColor(line.type))}
                data-testid={`terminal-line-${line.id}`}
              >
                {line.host && line.type !== "command" && (
                  <span className="text-purple-400/60">[{line.host}] </span>
                )}
                {line.content}
              </div>
            ))}
            
            <div className="flex items-center py-0.5">
              {activeHost && <span className="text-purple-400 mr-1">[{activeHost}]</span>}
              <span className="text-green-400 mr-2">$</span>
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isExecuting}
                className="flex-1 bg-transparent border-none outline-none text-gray-300 font-mono"
                placeholder={isExecuting ? "Executing..." : "Enter command..."}
                autoComplete="off"
                spellCheck={false}
                data-testid="input-terminal-command"
              />
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 text-xs text-muted-foreground">
          <p>Tips: Arrow keys for history. Ctrl+C to cancel. SSH commands stream output in real-time via WebSocket.</p>
        </div>
      </div>
    </div>
  );
}
