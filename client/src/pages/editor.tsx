/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      EDITOR.TSX - CODE EDITOR PAGE                            ║
 * ║                                                                               ║
 * ║  A full-featured code editor powered by Monaco Editor (same as VS Code).     ║
 * ║  Supports multiple open files in tabs with:                                   ║
 * ║                                                                               ║
 * ║    - Syntax highlighting and code completion                                  ║
 * ║    - Light/dark theme toggle                                                  ║
 * ║    - Multi-file tab support for collaborative editing                         ║
 * ║    - LLM integration for loading code into specific tabs                      ║
 * ║    - Local storage persistence                                                ║
 * ║    - Live preview integration                                                 ║
 * ║                                                                               ║
 * ║  Layout Structure:                                                            ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ Header: [Menu] Meowstik Editor    [Language] [Theme] [Save] [Preview]  │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │ Tabs: [file1.js] [file2.ts] [untitled.html] [+]                        │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │                     Monaco Editor (Full Height)                        │  ║
 * ║  │    1 │ <!DOCTYPE html>                                                 │  ║
 * ║  │    2 │ <html lang="en">                                                │  ║
 * ║  │   ...│                                                                 │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useLocation } from "wouter";
import { Play, Eye, Save, Menu, FileCode, Moon, Sun, X, Plus, Send, XCircle, SaveAll, ArrowLeft, MessageSquare, Maximize2 } from "lucide-react";
import { useCollaborativeEditing } from "@/hooks/use-collaborative-editing";
import type { Message } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { ChatMessage } from "@/components/chat/message";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Represents a single open file in the editor
 */
interface EditorFile {
  id: string;
  filename: string;
  code: string;
  language: string;
  isSaved: boolean;
}

// ============================================================================
// DEFAULT CODE TEMPLATE
// ============================================================================

const defaultCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      color: white;
    }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    p { font-size: 1.2rem; opacity: 0.9; }
    .card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 2rem;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <h1>Welcome to Meowstik Editor</h1>
  <p>Start editing to see changes in the preview!</p>
  <div class="card">
    <h2>Getting Started</h2>
    <p>This is a live HTML/CSS/JS editor. Your changes will appear in the preview instantly.</p>
  </div>
</body>
</html>`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Infer language from filename extension
 */
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'sh': 'shell',
    'bash': 'shell',
  };
  return langMap[ext] || 'plaintext';
}

/**
 * Generate unique ID for a new file
 */
function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty file
 */
function createNewFile(filename: string = 'untitled.html', code: string = '', language?: string): EditorFile {
  return {
    id: generateFileId(),
    filename,
    code: code || defaultCode,
    language: language || getLanguageFromFilename(filename),
    isSaved: code ? false : true,
  };
}

// ============================================================================
// EDITOR PAGE COMPONENT
// ============================================================================

export default function EditorPage() {
  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  /**
   * Array of open files (tabs)
   */
  const [files, setFiles] = useState<EditorFile[]>(() => [createNewFile()]);

  /**
   * Currently active file ID
   */
  const [activeFileId, setActiveFileId] = useState<string>(() => files[0]?.id || '');

  /**
   * Editor theme - Monaco's built-in themes
   */
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");

  /**
   * Prompt text for sending to LLM
   */
  const [prompt, setPrompt] = useState<string>("");

  /**
   * Router location for navigation
   */
  const [, setLocation] = useLocation();

  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(() => {
    return localStorage.getItem("meowstik-editor-chat-id");
  });
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  
  // Persist chat ID
  useEffect(() => {
    if (chatId) {
      localStorage.setItem("meowstik-editor-chat-id", chatId);
    }
  }, [chatId]);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatOpen]);

  /**
   * Collaborative Editing: Connect to receive AI updates
   */
  useCollaborativeEditing({
    sessionId: "global-editor",
    displayName: "User",
    onAIContentLoad: (filePath: string, content: string) => {
      // Extract filename from path
      const filename = filePath.split('/').pop() || 'untitled.txt';
      const language = getLanguageFromFilename(filename);

      setFiles(prev => {
        // Create new file object
        const newFile = createNewFile(filename, content, language);
        newFile.isSaved = false;

        // Check if file already exists
        const existingIndex = prev.findIndex(f => f.filename === filename);
        if (existingIndex >= 0) {
          const existingFile = prev[existingIndex];
          const updated = [...prev];

          // Create backup if unsaved changes exist
          if (!existingFile.isSaved) {
            const bakFilename = `${existingFile.filename}~bak`;
            const bakFile = {
              ...existingFile,
              id: `file-${Date.now()}-bak`,
              filename: bakFilename,
              isSaved: true
            };
            updated.push(bakFile);
            console.log(`[Editor] Created backup for ${filename}`);
          }

          // Update existing file content
          updated[existingIndex] = { ...existingFile, code: content, isSaved: false };
          setActiveFileId(existingFile.id);
          return updated;
        }

        // Add new file
        setActiveFileId(newFile.id);
        return [...prev, newFile];
      });
    }
  });

  /**
   * Get the currently active file
   */
  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  /**
   * Effect: Load saved files from localStorage on mount
   * Also checks for LLM-loaded code (takes priority)
   */
  useEffect(() => {
    // Check for LLM-loaded code first (priority)
    const llmCode = localStorage.getItem("meowstik-editor-llm-code");
    const llmLanguage = localStorage.getItem("meowstik-editor-llm-language");
    const llmFilename = localStorage.getItem("meowstik-editor-llm-filename");
    
    if (llmCode) {
      const filename = llmFilename || `untitled.${llmLanguage || 'txt'}`;
      const newFile = createNewFile(filename, llmCode, llmLanguage || undefined);
      newFile.isSaved = false;
      
      setFiles(prev => {
        // Check if a file with this filename already exists
        const existingIndex = prev.findIndex(f => f.filename === filename);
        if (existingIndex >= 0) {
          const existingFile = prev[existingIndex];
          const updated = [...prev];
          
          // If existing file has unsaved changes, create a backup first
          if (!existingFile.isSaved) {
            const bakFilename = `${existingFile.filename}~bak`;
            // Clone the file directly to preserve exact content (even empty strings)
            const bakFile: EditorFile = {
              id: `file-${Date.now()}-bak`,
              filename: bakFilename,
              code: existingFile.code, // Preserve exact content
              language: existingFile.language,
              isSaved: true // Backup is considered saved
            };
            updated.push(bakFile);
            console.log(`[Editor] Created backup: ${bakFilename}`);
          }
          
          // Update existing file and focus it
          updated[existingIndex] = { ...existingFile, code: llmCode, isSaved: false };
          setActiveFileId(updated[existingIndex].id); // Use existing file's ID
          return updated;
        }
        // Add new file and focus it
        setActiveFileId(newFile.id);
        return [...prev, newFile];
      });
      
      // Clear after loading
      localStorage.removeItem("meowstik-editor-llm-code");
      localStorage.removeItem("meowstik-editor-llm-language");
      localStorage.removeItem("meowstik-editor-llm-filename");
    } else {
      // Fall back to user-saved files
      const savedFiles = localStorage.getItem("meowstik-editor-files");
      const savedActiveId = localStorage.getItem("meowstik-editor-active");
      if (savedFiles) {
        try {
          const parsed = JSON.parse(savedFiles) as EditorFile[];
          if (parsed.length > 0) {
            setFiles(parsed);
            if (savedActiveId && parsed.some(f => f.id === savedActiveId)) {
              setActiveFileId(savedActiveId);
            } else {
              setActiveFileId(parsed[0].id);
            }
          }
        } catch (e) {
          console.error('Failed to parse saved files:', e);
        }
      }
    }
  }, []);
  
  /**
   * Effect: Listen for LLM code loads via storage events
   * Allows the chat to send code to the editor in real-time
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "meowstik-editor-llm-code" && e.newValue) {
        const llmLanguage = localStorage.getItem("meowstik-editor-llm-language");
        const llmFilename = localStorage.getItem("meowstik-editor-llm-filename");
        
        const filename = llmFilename || `untitled.${llmLanguage || 'txt'}`;
        const newFile = createNewFile(filename, e.newValue, llmLanguage || undefined);
        newFile.isSaved = false;
        
        setFiles(prev => {
          // Check if a file with this filename already exists
          const existingIndex = prev.findIndex(f => f.filename === filename);
          if (existingIndex >= 0) {
            const existingFile = prev[existingIndex];
            const updated = [...prev];
            
            // If existing file has unsaved changes, create a backup first
            if (!existingFile.isSaved) {
              const bakFilename = `${existingFile.filename}~bak`;
              // Clone the file directly to preserve exact content (even empty strings)
              const bakFile: EditorFile = {
                id: `file-${Date.now()}-bak`,
                filename: bakFilename,
                code: existingFile.code, // Preserve exact content
                language: existingFile.language,
                isSaved: true // Backup is considered saved
              };
              updated.push(bakFile);
              console.log(`[Editor] Created backup: ${bakFilename}`);
            }
            
            // Update existing file and focus it
            updated[existingIndex] = { ...existingFile, code: e.newValue!, isSaved: false };
            setActiveFileId(updated[existingIndex].id); // Use existing file's ID
            return updated;
          }
          // Add new file and focus it
          setActiveFileId(newFile.id);
          return [...prev, newFile];
        });
        
        // Clear after loading
        localStorage.removeItem("meowstik-editor-llm-code");
        localStorage.removeItem("meowstik-editor-llm-language");
        localStorage.removeItem("meowstik-editor-llm-filename");
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle editor content changes
   */
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined && activeFileId) {
      setFiles(prev => prev.map(f => 
        f.id === activeFileId ? { ...f, code: value, isSaved: false } : f
      ));
    }
  }, [activeFileId]);

  /**
   * Handle language change for active file
   */
  const handleLanguageChange = useCallback((lang: string) => {
    if (activeFileId) {
      setFiles(prev => prev.map(f =>
        f.id === activeFileId ? { ...f, language: lang } : f
      ));
    }
  }, [activeFileId]);

  /**
   * Save all files to localStorage
   */
  const handleSave = useCallback(() => {
    setFiles(prev => {
      const updated = prev.map(f => ({ ...f, isSaved: true }));
      localStorage.setItem("meowstik-editor-files", JSON.stringify(updated));
      localStorage.setItem("meowstik-editor-active", activeFileId);
      // Also save the active file's code for preview
      const active = updated.find(f => f.id === activeFileId);
      if (active) {
        localStorage.setItem("meowstic-editor-code", active.code);
      }
      return updated;
    });
  }, [activeFileId]);

  /**
   * Add a new empty file tab
   */
  const handleNewFile = useCallback(() => {
    const count = files.filter(f => f.filename.startsWith('untitled')).length;
    const newFile = createNewFile(`untitled${count > 0 ? count + 1 : ''}.html`);
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  }, [files]);

  /**
   * Close a file tab
   */
  const handleCloseFile = useCallback((fileId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger tab switch
    setFiles(prev => {
      if (prev.length === 1) {
        // Don't close the last tab, just reset it
        return [createNewFile()];
      }
      const filtered = prev.filter(f => f.id !== fileId);
      // If we're closing the active tab, switch to another
      if (fileId === activeFileId) {
        const closedIndex = prev.findIndex(f => f.id === fileId);
        const newActiveIndex = Math.max(0, closedIndex - 1);
        setActiveFileId(filtered[newActiveIndex]?.id || filtered[0].id);
      }
      return filtered;
    });
  }, [activeFileId]);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    setTheme(theme === "vs-dark" ? "light" : "vs-dark");
  };

  /**
   * Cancel - close editor and exit. Shows save dialog if dirty.
   */
  const handleCancel = useCallback(() => {
    const hasUnsavedChanges = files.some(f => !f.isSaved);
    
    if (hasUnsavedChanges) {
      // Show save/don't save/cancel dialog
      const result = window.confirm(
        "You have unsaved changes. Save before closing?\n\n" +
        "Click OK to save and close, or Cancel to go back to editing."
      );
      
      if (result) {
        // User chose to save
        handleSave();
        setLocation("/");
      }
      // If cancel, stay in editor (do nothing)
    } else {
      // No unsaved changes, just exit
      setLocation("/");
    }
  }, [files, handleSave, setLocation]);

  /**
   * Save As - rename the current file and save
   */
  const handleSaveAs = useCallback(() => {
    if (!activeFile) return;
    
    const newFilename = window.prompt("Save as:", activeFile.filename);
    if (!newFilename || newFilename === activeFile.filename) return;
    
    // Rename the current file and save
    setFiles(prev => {
      const updated = prev.map(f => 
        f.id === activeFile.id 
          ? { 
              ...f, 
              filename: newFilename, 
              language: getLanguageFromFilename(newFilename) || f.language,
              isSaved: true 
            }
          : f
      );
      localStorage.setItem("meowstik-editor-files", JSON.stringify(updated));
      localStorage.setItem("meowstik-editor-active", activeFileId);
      return updated;
    });
  }, [activeFile, activeFileId]);

  /**
   * Send - save the code and send to LLM
   */
  const handleSend = useCallback(async () => {
    if (!activeFile) return;
    
    // Save current state
    handleSave();
    
    // Open chat if closed
    if (!isChatOpen) setIsChatOpen(true);
    
    // Construct message with context
    const fileContext = `My current file ${activeFile.filename}:\n\`\`\`${activeFile.language}\n${activeFile.code}\n\`\`\``;
    const fullContent = prompt.trim() 
      ? `${prompt}\n\n${fileContext}`
      : `Here is my code for review:\n\n${fileContext}`;

    setIsSending(true);
    setPrompt(""); // Clear input immediately

    try {
      // 1. Ensure we have a chat session
      let currentChatId = chatId;
      if (!currentChatId) {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `Editor: ${activeFile.filename}` }),
        });
        if (!res.ok) throw new Error("Failed to create chat");
        const newChat = await res.json();
        currentChatId = newChat.id;
        setChatId(newChat.id);
      }

      // 2. Optimistic user message
      const userMsgId = Date.now();
      const userMsg: Message = {
        id: userMsgId,
        chatId: currentChatId!,
        role: "user",
        content: prompt || "Review code",
        createdAt: new Date(), // Use string or Date depending on type definition
      } as any; 
      
      setMessages(prev => [...prev, userMsg]);

      // 3. Send request
      const res = await fetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: fullContent,
          model: "claude-sonnet-4.6", // High capability for coding
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      // 4. Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      // Placeholder for AI response
      const aiMsgId = Date.now() + 1;
      setMessages(prev => [...prev, {
        id: aiMsgId,
        chatId: currentChatId!,
        role: "ai",
        content: "",
        createdAt: new Date(),
      } as any]);

      let aiContent = "";

      while (true) {
        const { done, value } = await reader?.read() || { done: true, value: undefined };
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                aiContent += parsed.content;
                setMessages(prev => prev.map(m => 
                  m.id === aiMsgId ? { ...m, content: aiContent } : m
                ));
              }
            } catch (e) {
              console.error("Parse error", e);
            }
          }
        }
      }

    } catch (error) {
      console.error("Chat error:", error);
      // Could show toast here
    } finally {
      setIsSending(false);
    }
  }, [activeFile, prompt, chatId, isChatOpen, handleSave]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="editor-page">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" data-testid="button-back-home" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              Code Editor
            </h1>
            <p className="text-sm text-muted-foreground">
              Edit code with syntax highlighting • Multiple file tabs • Live preview
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <Select value={activeFile?.language || 'html'} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-32 h-9 text-sm" data-testid="select-language">
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

            {/* Theme Toggle Button */}
            <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="button-theme">
              {theme === "vs-dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Preview Button */}
            <Button 
              variant={isPreviewOpen ? "secondary" : "outline"}
              size="sm" 
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              data-testid="button-preview-toggle"
            >
              <Eye className="h-4 w-4 mr-2" />
              {isPreviewOpen ? "Close Preview" : "Preview"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 border-t">
        {/* Editor Column (Panel) */}
        <ResizablePanel defaultSize={isChatOpen || isPreviewOpen ? 50 : 100} minSize={20}>
          <div className="h-full flex flex-col min-w-0">
            {/* Tab Bar */}
            <div className="flex items-center border-b bg-muted/30 overflow-x-auto flex-shrink-0">
              <div className="flex items-center min-w-0">
                {files.map(file => (
                  <button
                    key={file.id}
                    onClick={() => setActiveFileId(file.id)}
                    className={`
                      group flex items-center gap-2 px-3 py-1.5 text-sm border-r border-border
                      transition-colors min-w-0 max-w-[180px]
                      ${file.id === activeFileId 
                        ? 'bg-background text-foreground' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }
                    `}
                    data-testid={`tab-${file.filename}`}
                  >
                    <span className="truncate flex items-center gap-1">
                      {!file.isSaved && <span className="text-primary">●</span>}
                      {file.filename}
                    </span>
                    <button
                      onClick={(e) => handleCloseFile(file.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 rounded p-0.5 transition-opacity"
                      data-testid={`close-${file.filename}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </button>
                ))}
              </div>
              
              {/* New Tab Button */}
              <button
                onClick={handleNewFile}
                className="flex items-center justify-center px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                data-testid="button-new-tab"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Monaco Editor Container */}
            <div className="flex-1 overflow-hidden relative">
              <Editor
                height="100%"
                language={activeFile?.language || 'html'}
                value={activeFile?.code || ''}
                theme={theme}
                onChange={handleEditorChange}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: true },
                  padding: { top: 16 },
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
        </ResizablePanel>

        {/* Handle for Live Preview */}
        {isPreviewOpen && <ResizableHandle withHandle />}

        {/* Live Preview Panel (Split View) */}
        {isPreviewOpen && (
          <ResizablePanel defaultSize={isChatOpen ? 30 : 50} minSize={20}>
            <div className="h-full flex flex-col min-w-0 bg-background">
               <div className="p-2 border-b bg-muted/20 flex justify-between items-center flex-shrink-0">
                  <span className="text-xs font-semibold px-2 flex items-center gap-2">
                    <Eye className="h-3 w-3" />
                    Live Preview
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLocation("/preview")} title="Open in Full Page">
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsPreviewOpen(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
               </div>
               <div className="flex-1 relative bg-white overflow-hidden">
                  <iframe
                    className="w-full h-full border-0"
                    title="Live Preview"
                    sandbox="allow-scripts allow-same-origin"
                    srcDoc={activeFile?.code || ''}
                  />
               </div>
            </div>
          </ResizablePanel>
        )}

        {/* Handle for Chat Panel */}
        {isChatOpen && <ResizableHandle withHandle />}

        {/* Chat Panel (Right Side) */}
        {isChatOpen && (
          <ResizablePanel defaultSize={25} minSize={20} maxSize={50}>
            <div className="h-full flex flex-col bg-background/50 backdrop-blur-sm shadow-xl z-10 transition-all duration-300">
              <div className="p-3 border-b flex justify-between items-center bg-muted/20 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">AI Assistant</span>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsChatOpen(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm p-4">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                      <MessageSquare className="h-8 w-8 text-primary" />
                    </div>
                    <p className="font-medium mb-1">AI Assistant Ready</p>
                    <p className="text-xs opacity-70 max-w-[200px]">
                      Ask me to explain code, fix bugs, or implement new features. I can read your open file automatically.
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mb-4"
                    >
                      <ChatMessage
                        id={m.id.toString()}
                        chatId={m.chatId}
                        role={m.role as "user" | "ai"}
                        content={m.content}
                        createdAt={new Date(m.createdAt)}
                      />
                    </motion.div>
                  ))
                )}
                {isSending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-muted-foreground text-xs p-4 bg-muted/30 rounded-lg"
                  >
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce"></div>
                    </div>
                    <span>Thinking...</span>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </ResizablePanel>
        )}
      </ResizablePanelGroup>

      {/* Bottom Action Bar */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          {/* Prompt Input */}
          <div className="flex-1 relative">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI to edit or explain..."
              className="pr-10 h-10 shadow-sm transition-all focus:ring-2 focus:ring-primary/20"
              data-testid="input-prompt"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button 
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={handleSend}
              disabled={!prompt.trim() || isSending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 border-l pl-3 ml-1">
            {/* Cancel Button */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleCancel}
              title="Close Editor"
              className="text-muted-foreground hover:text-destructive"
            >
              <XCircle className="h-5 w-5" />
            </Button>

            {/* Save As Button */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleSaveAs}
              title="Save As..."
            >
              <SaveAll className="h-5 w-5" />
            </Button>

            {/* Save Button */}
            <Button 
              variant={files.every(f => f.isSaved) ? "ghost" : "default"} 
              size="sm"
              onClick={handleSave}
              className={`gap-2 transition-all ${files.every(f => f.isSaved) ? 'text-muted-foreground' : ''}`}
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{files.every(f => f.isSaved) ? "Saved" : "Save"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
