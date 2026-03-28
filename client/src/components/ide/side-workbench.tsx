
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Code2,
  Eye,
  FolderOpen,
  Moon,
  PanelRightClose,
  Plus,
  Save,
  Send,
  Sun,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  Play,
  Square,
  X,
} from "lucide-react";
import { ScreenRecorder } from "@/components/ide/screen-recorder";

interface EditorFile {
  id: string;
  filename: string;
  code: string;
  language: string;
  isSaved: boolean;
}

type WorkbenchTab = "editor" | "terminal";

interface SideWorkbenchProps {
  activeTab: WorkbenchTab;
  onActiveTabChange: (tab: WorkbenchTab) => void;
  onCollapse: () => void;
  onSendToChat: (message: string) => void | Promise<void>;
}

const defaultCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
</head>
<body>
  <h1>Hello from Meowstik</h1>
  <p>Edit this file, then flip to the terminal while you work.</p>
</body>
</html>`;

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    html: "html",
    htm: "html",
    css: "css",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    py: "python",
    sh: "shell",
    bash: "shell",
  };
  return langMap[ext] || "plaintext";
}

function createNewFile(filename = "untitled.html", code = defaultCode): EditorFile {
  return {
    id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    filename,
    code,
    language: getLanguageFromFilename(filename),
    isSaved: code !== defaultCode,
  };
}

function buildEditorMessage(activeFile: EditorFile, files: EditorFile[], prompt: string): string {
  const payload = {
    type: "editor_content",
    filename: activeFile.filename,
    language: activeFile.language,
    code: activeFile.code,
    prompt: prompt.trim() || null,
    metadata: {
      lineCount: activeFile.code.split("\n").length,
      charCount: activeFile.code.length,
      timestamp: new Date().toISOString(),
      allOpenFiles: files.map((file) => ({
        filename: file.filename,
        language: file.language,
        isSaved: file.isSaved,
      })),
    },
  };

  return prompt.trim()
    ? `${prompt}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``
    : `Here's my code from the editor:\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

interface CanvasProps {
  activeTab: WorkbenchTab;
  onActiveTabChange: (tab: WorkbenchTab) => void;
  onCollapse: () => void;
  onSendToChat: (message: string) => void | Promise<void>;
  readOnly?: boolean;
}

export function Canvas({
  activeTab,
  onActiveTabChange,
  onCollapse,
  onSendToChat,
  readOnly = false,
}: CanvasProps) {
  const [files, setFiles] = useState<EditorFile[]>(() => [createNewFile()]);
  const [activeFileId, setActiveFileId] = useState("");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [prompt, setPrompt] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractiveRef = useRef(false);

  useEffect(() => {
    isInteractiveRef.current = isInteractive;
  }, [isInteractive]);

  useEffect(() => {
    if (!activeFileId && files[0]) {
      setActiveFileId(files[0].id);
    }
  }, [activeFileId, files]);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeFileId) || files[0],
    [activeFileId, files],
  );

  const persistEditorState = useCallback(
    (nextFiles: EditorFile[], nextActiveId: string) => {
      localStorage.setItem("meowstik-editor-files", JSON.stringify(nextFiles));
      localStorage.setItem("meowstik-editor-active", nextActiveId);

      const nextActiveFile = nextFiles.find((file) => file.id === nextActiveId) || nextFiles[0];
      if (nextActiveFile) {
        localStorage.setItem("meowstic-editor-code", nextActiveFile.code);
      }
    },
    [],
  );

  const applyIncomingEditorCode = useCallback(
    (code: string, language?: string | null, filename?: string | null) => {
      const resolvedFilename = filename || `untitled.${language || "txt"}`;
      const resolvedLanguage = language || getLanguageFromFilename(resolvedFilename);

      setFiles((previous) => {
        const existingIndex = previous.findIndex((file) => file.filename === resolvedFilename);
        let nextFiles = [...previous];

        if (existingIndex >= 0) {
          nextFiles[existingIndex] = {
            ...nextFiles[existingIndex],
            code,
            language: resolvedLanguage,
            isSaved: false,
          };
          setActiveFileId(nextFiles[existingIndex].id);
        } else {
          const incomingFile: EditorFile = {
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            filename: resolvedFilename,
            code,
            language: resolvedLanguage,
            isSaved: false,
          };
          nextFiles = [...nextFiles, incomingFile];
          setActiveFileId(incomingFile.id);
        }

        persistEditorState(nextFiles, existingIndex >= 0 ? nextFiles[existingIndex].id : nextFiles[nextFiles.length - 1].id);
        return nextFiles;
      });

      localStorage.removeItem("meowstik-editor-llm-code");
      localStorage.removeItem("meowstik-editor-llm-language");
      localStorage.removeItem("meowstik-editor-llm-filename");
    },
    [persistEditorState],
  );

  useEffect(() => {
    const llmCode = localStorage.getItem("meowstik-editor-llm-code");
    const llmLanguage = localStorage.getItem("meowstik-editor-llm-language");
    const llmFilename = localStorage.getItem("meowstik-editor-llm-filename");

    if (llmCode) {
      applyIncomingEditorCode(llmCode, llmLanguage, llmFilename);
      return;
    }

    const savedFiles = localStorage.getItem("meowstik-editor-files");
    const savedActiveId = localStorage.getItem("meowstik-editor-active");
    if (!savedFiles) {
      return;
    }

    try {
      const parsed = JSON.parse(savedFiles) as EditorFile[];
      if (parsed.length === 0) {
        return;
      }

      setFiles(parsed);
      setActiveFileId(
        savedActiveId && parsed.some((file) => file.id === savedActiveId) ? savedActiveId : parsed[0].id,
      );
    } catch (error) {
      console.error("[Workbench] Failed to parse saved editor state:", error);
    }
  }, [applyIncomingEditorCode]);

  useEffect(() => {
    const syncIncomingCode = () => {
      const llmCode = localStorage.getItem("meowstik-editor-llm-code");
      if (!llmCode) {
        return;
      }

      const llmLanguage = localStorage.getItem("meowstik-editor-llm-language");
      const llmFilename = localStorage.getItem("meowstik-editor-llm-filename");
      applyIncomingEditorCode(llmCode, llmLanguage, llmFilename);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "meowstik-editor-llm-code" && event.newValue) {
        syncIncomingCode();
      }
    };

    const handleWorkbenchUpdate = () => {
      syncIncomingCode();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("meowstik-editor-llm-update", handleWorkbenchUpdate);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("meowstik-editor-llm-update", handleWorkbenchUpdate);
    };
  }, [applyIncomingEditorCode]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined || !activeFile) {
        return;
      }

      setFiles((previous) =>
        previous.map((file) =>
          file.id === activeFile.id ? { ...file, code: value, isSaved: false } : file,
        ),
      );
    },
    [activeFile],
  );

  const handleLanguageChange = useCallback(
    (language: string) => {
      if (!activeFile) {
        return;
      }

      setFiles((previous) =>
        previous.map((file) =>
          file.id === activeFile.id ? { ...file, language } : file,
        ),
      );
    },
    [activeFile],
  );

  const handleSave = useCallback(() => {
    if (!activeFile) {
      return;
    }

    setFiles((previous) => {
      const nextFiles = previous.map((file) =>
        file.id === activeFile.id ? { ...file, isSaved: true } : file,
      );
      persistEditorState(nextFiles, activeFile.id);
      return nextFiles;
    });
  }, [activeFile, persistEditorState]);

  const handleNewFile = useCallback(() => {
    const untitledCount = files.filter((file) => file.filename.startsWith("untitled")).length;
    const nextFile = createNewFile(`untitled${untitledCount ? untitledCount + 1 : ""}.html`, defaultCode);
    const nextFiles = [...files, nextFile];
    setFiles(nextFiles);
    setActiveFileId(nextFile.id);
    persistEditorState(nextFiles, nextFile.id);
  }, [files, persistEditorState]);

  const handleCloseFile = useCallback(
    (fileId: string) => {
      if (files.length === 1) {
        const resetFile = createNewFile();
        setFiles([resetFile]);
        setActiveFileId(resetFile.id);
        persistEditorState([resetFile], resetFile.id);
        return;
      }

      const nextFiles = files.filter((file) => file.id !== fileId);
      const nextActiveId = activeFileId === fileId ? nextFiles[0].id : activeFileId;
      setFiles(nextFiles);
      setActiveFileId(nextActiveId);
      persistEditorState(nextFiles, nextActiveId);
    },
    [activeFileId, files, persistEditorState],
  );

  const handleOpenFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const nextFile = createNewFile(file.name, content);
      const nextFiles = [...files, nextFile];
      setFiles(nextFiles);
      setActiveFileId(nextFile.id);
      persistEditorState(nextFiles, nextFile.id);
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = "";
  };

  const handlePreview = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleSend = useCallback(async () => {
    if (!activeFile) {
      return;
    }

    const nextFiles = files.map((file) =>
      file.id === activeFile.id ? { ...file, isSaved: true } : file,
    );
    setFiles(nextFiles);
    persistEditorState(nextFiles, activeFile.id);

    await onSendToChat(buildEditorMessage(activeFile, nextFiles, prompt));
    setPrompt("");
  }, [activeFile, files, onSendToChat, persistEditorState, prompt]);

  const startShell = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !fitAddonRef.current) {
      return;
    }

    const dimensions = fitAddonRef.current.proposeDimensions();
    wsRef.current.send(
      JSON.stringify({
        type: "start_shell",
        data: {
          cols: dimensions?.cols || 100,
          rows: dimensions?.rows || 28,
        },
      }),
    );
  }, []);

  const stopShell = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_shell" }));
    }
  }, []);

  useEffect(() => {
    if (!terminalContainerRef.current || terminalRef.current) {
      return;
    }

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      theme: {
        background: "#111827",
        foreground: "#d1d5db",
        cursor: "#f9fafb",
        selectionBackground: "#1f2937",
        black: "#111827",
        red: "#f87171",
        green: "#34d399",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e5e7eb",
        brightBlack: "#6b7280",
        brightRed: "#fca5a5",
        brightGreen: "#6ee7b7",
        brightYellow: "#fcd34d",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#ffffff",
      },
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(terminalContainerRef.current);
    fitAddon.fit();
    term.writeln("\x1b[33mMeowstik terminal ready.\x1b[0m");
    term.writeln("\x1b[90mSwitch to this tab to auto-start an interactive shell.\x1b[0m");
    term.writeln("");

    term.onData((data) => {
      if (isInteractiveRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "input", data: { content: data } }));
      }
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  const connectTerminal = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);

    ws.onopen = () => {
      setWsConnected(true);
      terminalRef.current?.writeln("\x1b[32mConnected to terminal service.\x1b[0m");
      if (activeTab === "terminal") {
        setTimeout(() => startShell(), 150);
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "pty_data") {
          terminalRef.current?.write(message.data?.content || "");
          return;
        }

        if (message.type === "status") {
          const content = message.data?.content || "";
          if (content.includes("Interactive shell started")) {
            setIsInteractive(true);
            terminalRef.current?.writeln(`\r\n\x1b[33m${content}\x1b[0m`);
          } else if (content.includes("Interactive shell stopped") || content.includes("Shell exited")) {
            setIsInteractive(false);
            terminalRef.current?.writeln(`\r\n\x1b[33m${content}\x1b[0m`);
          } else {
            terminalRef.current?.writeln(`\r\n\x1b[33m${content}\x1b[0m`);
          }
          return;
        }

        if (message.type === "output") {
          const content = message.data?.content || "";
          if (message.data?.type === "stderr") {
            terminalRef.current?.writeln(`\x1b[31m${content.replace(/\n$/, "")}\x1b[0m`);
          } else {
            terminalRef.current?.writeln(content.replace(/\n$/, ""));
          }
        }
      } catch (error) {
        console.error("[Workbench Terminal] Failed to parse WS message:", error);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setIsInteractive(false);
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connectTerminal, 3000);
    };

    ws.onerror = (error) => {
      console.error("[Workbench Terminal] WebSocket error:", error);
    };

    wsRef.current = ws;
  }, [activeTab, startShell]);

  useEffect(() => {
    connectTerminal();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connectTerminal]);

  useEffect(() => {
    if (activeTab !== "terminal") {
      return;
    }

    fitAddonRef.current?.fit();
    if (wsConnected && !isInteractive) {
      const timer = setTimeout(() => startShell(), 120);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isInteractive, startShell, wsConnected]);

  useEffect(() => {
    const handleResize = () => {
      fitAddonRef.current?.fit();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background border-l border-border shadow-2xl animate-in slide-in-from-right duration-300">
      {/* 
       * CANVAS HEADER
       * Minimalist, elegant header with integrated controls
       */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border/50 bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-500 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Canvas</h2>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest leading-none">
              {activeFile?.filename || "Untitled"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {/* Tab System - Pill style */}
           <div className="flex items-center bg-muted/50 rounded-full p-1 mr-2">
             <button
               onClick={() => onActiveTabChange("editor")}
               className={cn(
                 "px-4 py-1.5 text-xs font-bold rounded-full transition-all",
                 activeTab === "editor" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
               )}
             >
               Code
             </button>
             <button
               onClick={() => onActiveTabChange("terminal")}
               className={cn(
                 "px-4 py-1.5 text-xs font-bold rounded-full transition-all",
                 activeTab === "terminal" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
               )}
             >
               Terminal
             </button>
           </div>

           <Button 
             variant="ghost" 
             size="icon" 
             className="rounded-full h-8 w-8 hover:bg-muted" 
             onClick={onCollapse}
             title="Close Canvas"
           >
             <PanelRightClose className="h-4 w-4" />
           </Button>
        </div>
      </div>

      {/* 
       * ACTION BAR
       * Dynamic tools based on context
       */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border/30 bg-muted/5">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <Select value={activeFileId} onValueChange={setActiveFileId}>
            <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted/50 text-xs font-medium focus:ring-0 w-auto gap-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {files.map(file => (
                <SelectItem key={file.id} value={file.id} className="text-xs">
                  {file.filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground" onClick={handleNewFile}>
            <Plus className="h-4 w-4" />
          </Button>
          
          <div className="h-4 w-[1px] bg-border/50 mx-1" />

          <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs font-bold text-muted-foreground hover:text-primary" onClick={handlePreview}>
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>

          <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs font-bold text-muted-foreground hover:text-green-500" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>

        <div className="flex items-center gap-2">
           <Button 
             size="sm" 
             variant="default" 
             className="h-8 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-2 shadow-lg shadow-blue-500/20"
             onClick={() => {
                setIsPublishing(true);
                setTimeout(() => setIsPublishing(false), 2000);
             }}
             disabled={isPublishing}
           >
             {isPublishing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
             {isPublishing ? "Publishing..." : "Publish to Web"}
           </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {activeTab === "editor" ? (
          <div className="absolute inset-0 flex flex-col">
             {/* File Tabs for multi-file editing */}
             <div className="flex items-center gap-1 overflow-x-auto border-b bg-muted/20 px-2 py-1.5 no-scrollbar">
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setActiveFileId(file.id)}
                    className={cn(
                      "group flex max-w-[180px] items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                      activeFileId === file.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    <span className="truncate">
                      {!file.isSaved && <span className="mr-1.5 text-primary">●</span>}
                      {file.filename}
                    </span>
                    <span
                      role="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCloseFile(file.id);
                      }}
                      className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted/80"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>

            <div className="flex-1">
              <Editor
                height="100%"
                language={activeFile?.language || "html"}
                value={activeFile?.code || ""}
                theme={theme}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: '"JetBrains Mono", monospace',
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlink: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  lineNumbers: "on",
                  roundedSelection: true,
                  readOnly: readOnly,
                  contextmenu: true,
                  automaticLayout: true,
                }}
              />
            </div>

            {/* Canvas Prompt - Chat with Code */}
            <div className="p-4 bg-muted/10 border-t border-border/20">
              <div className="relative group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Brain className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask Meowstik to edit this code..."
                  className="w-full pl-10 pr-20 py-2.5 bg-background border border-border/50 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
                <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1">
                   <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider"
                    onClick={() => void handleSend()}
                    disabled={!prompt.trim()}
                   >
                     Apply
                   </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-[#111827] flex flex-col p-4">
             <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2">
                 <div className={cn("w-2 h-2 rounded-full", wsConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                   {wsConnected ? "System Interactive" : "Disconnected"}
                 </span>
               </div>
               <div className="flex items-center gap-1">
                 <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-gray-500 hover:text-white" onClick={stopShell} title="Restart Shell">
                   <RefreshCw className="h-3.5 w-3.5" />
                 </Button>
                 <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-gray-500 hover:text-white" onClick={() => terminalRef.current?.clear()} title="Clear">
                   <Trash2 className="h-3.5 w-3.5" />
                 </Button>
               </div>
             </div>
             <div ref={terminalContainerRef} className="flex-1 min-h-0 rounded-lg overflow-hidden border border-white/5 shadow-inner" />
          </div>
        )}
      </div>

      {/* Footer / Meta */}
      <div className="px-4 py-2 border-t border-border/30 bg-muted/10 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground/60">
           <span className="flex items-center gap-1.5 uppercase tracking-wider">
             <Code className="h-3 w-3" />
             {activeFile?.language || "plain"}
           </span>
           <span className="flex items-center gap-1.5 uppercase tracking-wider font-bold">
             <Terminal className="h-3 w-3" />
             Interactive
           </span>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setTheme(theme === "vs-dark" ? "light" : "vs-dark")}
             className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
           >
             {theme === "vs-dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
           </button>
        </div>
      </div>
    </div>
  );
}



