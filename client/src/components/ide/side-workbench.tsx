"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTTS } from "@/contexts/tts-context";
import { extractSpeakableTerminalText } from "@/lib/terminal-speech";
import {
  Code2,
  Eye,
  FolderOpen,
  Moon,
  PanelRightClose,
  Plus,
  Save,
  Sun,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  Play,
  Square,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";

interface EditorFile {
  id: string;
  filename: string;
  code: string;
  language: string;
  isSaved: boolean;
}

type WorkbenchTab = "editor" | "terminal";

interface TerminalInputRequest {
  id: string;
  input: string;
}

interface SideWorkbenchProps {
  activeTab: WorkbenchTab;
  onActiveTabChange: (tab: WorkbenchTab) => void;
  onCollapse: () => void;
  terminalInputRequest?: TerminalInputRequest | null;
  onTerminalInputHandled?: (requestId: string) => void;
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

export function SideWorkbench({
  activeTab,
  onActiveTabChange,
  onCollapse,
  terminalInputRequest = null,
  onTerminalInputHandled,
}: SideWorkbenchProps) {
  const [files, setFiles] = useState<EditorFile[]>(() => [createNewFile()]);
  const [activeFileId, setActiveFileId] = useState("");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [wsConnected, setWsConnected] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [terminalSpeechEnabled, setTerminalSpeechEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return localStorage.getItem("meowstik-workbench-terminal-speech") === "true";
  });
  const { speak, stopSpeaking } = useTTS();

  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractiveRef = useRef(false);
  const lastTerminalInputIdRef = useRef<string | null>(null);
  const queuedTerminalInputsRef = useRef<string[]>([]);
  const autoPrimeCopilotOnNextShellRef = useRef(false);
  const copilotPrimedForShellRef = useRef(false);
  const speechBufferRef = useRef("");
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const flushTerminalInputQueue = useCallback(() => {
    if (!isInteractiveRef.current || wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    while (queuedTerminalInputsRef.current.length > 0) {
      const nextInput = queuedTerminalInputsRef.current.shift();
      if (!nextInput) {
        continue;
      }

      wsRef.current.send(JSON.stringify({
        type: "input",
        data: { content: `${nextInput}\r` },
      }));
    }
  }, []);

  const queueTerminalSpeech = useCallback((chunk: string) => {
    if (!terminalSpeechEnabled || activeTab !== "terminal") {
      return;
    }

    const speakable = extractSpeakableTerminalText(chunk);
    if (!speakable) {
      return;
    }

    speechBufferRef.current = `${speechBufferRef.current}\n${speakable}`.trim();

    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
    }

    speechTimeoutRef.current = setTimeout(() => {
      const text = speechBufferRef.current.trim();
      speechBufferRef.current = "";
      speechTimeoutRef.current = null;
      if (text) {
        void speak(text);
      }
    }, 700);
  }, [activeTab, speak, terminalSpeechEnabled]);

  const primeCopilotShell = useCallback(() => {
    if (
      !isInteractiveRef.current ||
      wsRef.current?.readyState !== WebSocket.OPEN ||
      copilotPrimedForShellRef.current
    ) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: "input",
      data: { content: "gh copilot\r" },
    }));
    copilotPrimedForShellRef.current = true;

    window.setTimeout(() => {
      flushTerminalInputQueue();
    }, 250);
  }, [flushTerminalInputQueue]);

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
    if (!terminalInputRequest || lastTerminalInputIdRef.current === terminalInputRequest.id) {
      return;
    }

    lastTerminalInputIdRef.current = terminalInputRequest.id;
    queuedTerminalInputsRef.current.push(terminalInputRequest.input);
    onTerminalInputHandled?.(terminalInputRequest.id);

    if (!isInteractiveRef.current) {
      autoPrimeCopilotOnNextShellRef.current = true;
      startShell();
      return;
    }

    flushTerminalInputQueue();
  }, [flushTerminalInputQueue, onTerminalInputHandled, startShell, terminalInputRequest]);

  useEffect(() => {
    localStorage.setItem("meowstik-workbench-terminal-speech", String(terminalSpeechEnabled));
    if (!terminalSpeechEnabled) {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
      speechBufferRef.current = "";
      stopSpeaking();
    }
  }, [stopSpeaking, terminalSpeechEnabled]);

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
          const content = message.data?.content || "";
          terminalRef.current?.write(content);
          queueTerminalSpeech(content);
          return;
        }

        if (message.type === "status") {
          const content = message.data?.content || "";
          if (content.includes("Interactive shell started")) {
            setIsInteractive(true);
            terminalRef.current?.writeln(`\r\n\x1b[33m${content}\x1b[0m`);
            copilotPrimedForShellRef.current = false;
            if (autoPrimeCopilotOnNextShellRef.current) {
              autoPrimeCopilotOnNextShellRef.current = false;
              setTimeout(() => primeCopilotShell(), 120);
            } else {
              setTimeout(() => flushTerminalInputQueue(), 120);
            }
          } else if (content.includes("Interactive shell stopped") || content.includes("Shell exited")) {
            setIsInteractive(false);
            copilotPrimedForShellRef.current = false;
            terminalRef.current?.writeln(`\r\n\x1b[33m${content}\x1b[0m`);
          } else {
            terminalRef.current?.writeln(`\r\n\x1b[33m${content}\x1b[0m`);
          }
          queueTerminalSpeech(content);
          return;
        }

        if (message.type === "output") {
          const content = message.data?.content || "";
          if (message.data?.type === "stderr") {
            terminalRef.current?.writeln(`\x1b[31m${content.replace(/\n$/, "")}\x1b[0m`);
          } else {
            terminalRef.current?.writeln(content.replace(/\n$/, ""));
          }
          queueTerminalSpeech(content);
        }
      } catch (error) {
        console.error("[Workbench Terminal] Failed to parse WS message:", error);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setIsInteractive(false);
      copilotPrimedForShellRef.current = false;
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connectTerminal, 3000);
    };

    ws.onerror = (error) => {
      console.error("[Workbench Terminal] WebSocket error:", error);
    };

    wsRef.current = ws;
  }, [activeTab, flushTerminalInputQueue, primeCopilotShell, queueTerminalSpeech, startShell]);

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
      autoPrimeCopilotOnNextShellRef.current = true;
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

  useEffect(() => {
    return () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b bg-card px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          <Button
            variant={activeTab === "editor" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-2 px-3"
            onClick={() => onActiveTabChange("editor")}
            data-testid="button-workbench-editor"
          >
            <Code2 className="h-4 w-4" />
            Editor
          </Button>
          <Button
            variant={activeTab === "terminal" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-2 px-3"
            onClick={() => onActiveTabChange("terminal")}
            data-testid="button-workbench-terminal"
          >
            <Terminal className="h-4 w-4" />
            Terminal
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onCollapse}
          data-testid="button-workbench-collapse"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      {activeTab === "editor" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b bg-card/60 px-3 py-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleOpenFile}
              className="hidden"
              accept=".html,.css,.js,.ts,.json,.md,.txt"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewFile} data-testid="button-workbench-new-file" title="New File">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()} data-testid="button-workbench-open-file" title="Open File">
              <FolderOpen className="h-4 w-4" />
            </Button>

            <Select value={activeFile?.language || "html"} onValueChange={handleLanguageChange}>
              <SelectTrigger className="h-8 w-32" data-testid="select-workbench-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="css">CSS</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="typescript">TypeScript</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="shell">Shell</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setTheme((previous) => (previous === "vs-dark" ? "light" : "vs-dark"))}
              data-testid="button-workbench-theme"
            >
              {theme === "vs-dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePreview} title="Preview">
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleSave} data-testid="button-workbench-save">
                <Save className="h-4 w-4" />
                {files.every((file) => file.isSaved) ? "Saved" : "Save"}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto border-b bg-muted/40 px-2 py-1.5">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveFileId(file.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "group flex max-w-[180px] items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  activeFileId === file.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted",
                )}
                data-testid={`tab-workbench-${file.filename}`}
              >
                <span className="truncate">
                  {!file.isSaved && <span className="mr-1 text-primary">●</span>}
                  {file.filename}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCloseFile(file.id);
                  }}
                  className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="min-h-0 flex-1">
            <Editor
              height="100%"
              language={activeFile?.language || "html"}
              value={activeFile?.code || ""}
              theme={theme}
              onChange={handleEditorChange}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                padding: { top: 12 },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                lineNumbers: "on",
                renderWhitespace: "selection",
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b bg-card/60 px-3 py-2">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {wsConnected ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
                {wsConnected ? "Connected" : "Reconnecting"}
              </span>
              <span className="inline-flex items-center gap-1">
                {isInteractive ? <Play className="h-4 w-4 text-emerald-500" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                {isInteractive ? "Shell live" : "Shell idle"}
              </span>
              <span className="hidden items-center gap-1 md:inline-flex">
                <Terminal className="h-4 w-4 text-primary" />
                Auto-starts gh copilot on fresh shells
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={terminalSpeechEnabled ? "secondary" : "outline"}
                size="sm"
                className="h-8 gap-2"
                onClick={() => setTerminalSpeechEnabled((current) => !current)}
                data-testid="button-workbench-terminal-speech"
                title={terminalSpeechEnabled ? "Disable terminal speech" : "Enable terminal speech"}
              >
                {terminalSpeechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {terminalSpeechEnabled ? "Speech on" : "Speech off"}
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-2" onClick={startShell} data-testid="button-workbench-start-shell">
                <Play className="h-4 w-4" />
                Start
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-2" onClick={stopShell} data-testid="button-workbench-stop-shell">
                <Square className="h-4 w-4" />
                Stop
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => terminalRef.current?.clear()}
                data-testid="button-workbench-clear-terminal"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={terminalContainerRef} className="min-h-0 flex-1 bg-[#111827]" data-testid="workbench-terminal" />
        </div>
      )}
    </div>
  );
}
