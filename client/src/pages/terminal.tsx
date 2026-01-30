import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Terminal as TerminalIcon, Trash2, Download, Wifi, WifiOff, Server, Play, Square, PanelRightClose, PanelRight, ArrowUp, ArrowDown, Activity } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface TrafficEntry {
  id: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  type: string;
  size: number;
  preview: string;
  source: string;
}

export default function TerminalPage() {
  const [wsConnected, setWsConnected] = useState(false);
  const [activeHost, setActiveHost] = useState<string | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);
  const [showTrafficPanel, setShowTrafficPanel] = useState(true);
  const [trafficLog, setTrafficLog] = useState<TrafficEntry[]>([]);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > 1024);
  
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const trafficWsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > 1024);
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && wsRef.current?.readyState === WebSocket.OPEN && isInteractive) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            data: { cols: dims.cols, rows: dims.rows }
          }));
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isInteractive]);

  useEffect(() => {
    if (!terminalContainerRef.current || terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#6a9955',
        brightYellow: '#dcdcaa',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
      },
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    
    term.open(terminalContainerRef.current);
    fitAddon.fit();
    
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[33mTerminal ready. Click "Start Shell" for interactive mode.\x1b[0m');
    term.writeln('\x1b[90mType commands and press Enter to execute.\x1b[0m');
    term.writeln('');

    let currentLine = '';
    
    term.onData((data) => {
      if (isInteractive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          data: { content: data }
        }));
      } else {
        if (data === '\r') {
          term.writeln('');
          if (currentLine.trim()) {
            executeCommand(currentLine);
          }
          currentLine = '';
        } else if (data === '\x7f') {
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            term.write('\b \b');
          }
        } else if (data === '\x03') {
          term.writeln('^C');
          currentLine = '';
          term.write('\x1b[32m$ \x1b[0m');
        } else if (data >= ' ') {
          currentLine += data;
          term.write(data);
        }
      }
    });

    const executeCommand = async (cmd: string) => {
      try {
        const response = await fetch("/api/terminal/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: cmd })
        });
        const result = await response.json();
        
        if (result.stdout) {
          term.writeln(result.stdout.replace(/\n$/, ''));
        }
        if (result.stderr) {
          term.writeln(`\x1b[31m${result.stderr.replace(/\n$/, '')}\x1b[0m`);
        }
        if (result.error) {
          term.writeln(`\x1b[31mError: ${result.error}\x1b[0m`);
        }
        term.write('\x1b[32m$ \x1b[0m');
      } catch (error) {
        term.writeln(`\x1b[31mFailed to execute: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
        term.write('\x1b[32m$ \x1b[0m');
      }
    };

    term.write('\x1b[32m$ \x1b[0m');

    return () => {
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [isInteractive]);

  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims && wsRef.current?.readyState === WebSocket.OPEN && isInteractive) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            data: { cols: dims.cols, rows: dims.rows }
          }));
        }
      }, 100);
    }
  }, [showTrafficPanel, isLandscape, isInteractive]);

  const connectTrafficWebSocket = useCallback(() => {
    if (trafficWsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal-traffic`;
    
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'history') {
          setTrafficLog(msg.data);
        } else if (msg.type === 'traffic') {
          setTrafficLog(prev => [msg.data, ...prev].slice(0, 200));
        }
      } catch (e) {
        console.error('[Traffic WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      trafficWsRef.current = null;
      setTimeout(connectTrafficWebSocket, 5000);
    };

    trafficWsRef.current = ws;
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      terminalRef.current?.writeln('\x1b[33mWebSocket connected.\x1b[0m');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'pty_data') {
          const content = msg.data?.content || '';
          terminalRef.current?.write(content);
          return;
        }
        
        if (msg.type === 'status') {
          const content = msg.data?.content || '';
          if (content.includes('Interactive shell started')) {
            setIsInteractive(true);
            terminalRef.current?.clear();
          } else if (content.includes('Shell exited') || content.includes('Interactive shell stopped')) {
            setIsInteractive(false);
            terminalRef.current?.writeln('\x1b[33m' + content + '\x1b[0m');
            terminalRef.current?.write('\x1b[32m$ \x1b[0m');
          } else {
            terminalRef.current?.writeln('\x1b[33m' + content + '\x1b[0m');
          }
        }
        
        if (msg.type === 'output') {
          const data = msg.data;
          const content = data.content || '';
          const source = data.source || 'local';
          
          if (source !== 'local' && source !== 'system' && !activeHost) {
            setActiveHost(source);
          }
          
          if (data.type === 'stderr') {
            terminalRef.current?.writeln('\x1b[31m' + content + '\x1b[0m');
          } else {
            terminalRef.current?.writeln(content);
          }
        }
      } catch (e) {
        terminalRef.current?.writeln(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('[Terminal] WebSocket error:', error);
    };

    ws.onclose = () => {
      setWsConnected(false);
      setIsInteractive(false);
      wsRef.current = null;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    wsRef.current = ws;
  }, [activeHost]);

  useEffect(() => {
    connectWebSocket();
    connectTrafficWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (trafficWsRef.current) {
        trafficWsRef.current.close();
      }
    };
  }, [connectWebSocket, connectTrafficWebSocket]);

  const startShell = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && fitAddonRef.current) {
      const dims = fitAddonRef.current.proposeDimensions();
      wsRef.current.send(JSON.stringify({
        type: 'start_shell',
        data: { 
          cols: dims?.cols || 80, 
          rows: dims?.rows || 24 
        }
      }));
    }
  };

  const stopShell = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_shell' }));
    }
  };

  const clearTerminal = () => {
    terminalRef.current?.clear();
    terminalRef.current?.writeln('\x1b[33mTerminal cleared.\x1b[0m');
    terminalRef.current?.write('\x1b[32m$ \x1b[0m');
  };

  const downloadOutput = () => {
    const term = terminalRef.current;
    if (!term) return;
    
    let content = '';
    const buffer = term.buffer.active;
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        content += line.translateToString(true) + '\n';
      }
    }
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terminal-output-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTrafficTime = (timestamp: string) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
           '.' + d.getMilliseconds().toString().padStart(3, '0');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="terminal-page">
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
              Interactive Terminal
            </h1>
            <p className="text-sm text-muted-foreground">
              Full shell support with xterm.js • SSH sessions • WebSocket streaming
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
            {isInteractive && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-green-500/10 text-green-500">
                <Activity className="h-4 w-4" />
                Interactive
              </div>
            )}
            {activeHost && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-purple-500/10 text-purple-500">
                <Server className="h-4 w-4" />
                SSH: {activeHost}
              </div>
            )}
            {!isInteractive ? (
              <Button variant="default" size="sm" onClick={startShell} disabled={!wsConnected}>
                <Play className="h-4 w-4 mr-2" />
                Start Shell
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={stopShell}>
                <Square className="h-4 w-4 mr-2" />
                Stop Shell
              </Button>
            )}
            {isLandscape && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTrafficPanel(!showTrafficPanel)}
              >
                {showTrafficPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={downloadOutput}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={clearTerminal}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        <div className={cn(
          "flex-1 overflow-hidden flex flex-col m-4 mr-2",
          isLandscape && showTrafficPanel ? "w-2/3" : "w-full mr-4"
        )}>
          <div className="flex-1 rounded-lg border border-border bg-[#1e1e1e] overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-[#888] text-xs ml-2 font-mono">
                {isInteractive ? "interactive shell (pty)" : activeHost ? `ssh - ${activeHost}` : "bash - command mode"}
              </span>
            </div>

            <div 
              ref={terminalContainerRef}
              className="flex-1 p-2"
              data-testid="terminal-xterm-container"
            />
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            <p>
              {isInteractive 
                ? "Interactive mode: Full terminal emulation active. Type 'exit' to quit shell."
                : "Command mode: Type commands and press Enter. Click 'Start Shell' for vim, ssh, etc."}
            </p>
          </div>
        </div>

        {isLandscape && showTrafficPanel && (
          <div className="w-1/3 m-4 ml-2 flex flex-col">
            <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">WebSocket Traffic</span>
                <span className="ml-auto text-xs text-muted-foreground">{trafficLog.length} entries</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 text-xs font-mono">
                {trafficLog.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    No traffic yet. Commands and responses will appear here.
                  </div>
                ) : (
                  trafficLog.map((entry) => (
                    <div 
                      key={entry.id}
                      className={cn(
                        "py-1.5 px-2 rounded mb-1 border-l-2",
                        entry.direction === 'inbound' 
                          ? "bg-blue-500/5 border-blue-500" 
                          : "bg-green-500/5 border-green-500"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {entry.direction === 'inbound' ? (
                          <ArrowDown className="h-3 w-3 text-blue-500" />
                        ) : (
                          <ArrowUp className="h-3 w-3 text-green-500" />
                        )}
                        <span className={cn(
                          "text-[10px] font-medium uppercase",
                          entry.direction === 'inbound' ? "text-blue-500" : "text-green-500"
                        )}>
                          {entry.type}
                        </span>
                        <span className="text-muted-foreground text-[10px] ml-auto">
                          {formatTrafficTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {entry.preview || '(empty)'}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/60">
                        <span>{entry.size} bytes</span>
                        <span>•</span>
                        <span>{entry.source}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
