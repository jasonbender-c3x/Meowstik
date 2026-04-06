import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, AlertTriangle, Code2, Terminal, PanelRight, PanelRightClose } from "lucide-react";
import { VerbositySlider } from "@/components/ui/verbosity-slider";
import { LocalDriveButton } from "@/components/ui/local-drive-button";
import { useLocation } from "wouter";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";
import { SideWorkbench } from "@/components/ide/side-workbench";
import { ChatInputArea } from "@/components/chat/input-area";
import { useTTS } from "@/contexts/tts-context";
import { useAuth } from "@/hooks/useAuth";
import { useChatHistory } from "./useChatHistory";
import { useChat } from "./useChat";
import { ChatSession } from "./ChatSession";
import { ChatMessageList } from "./ChatMessageList";
import { ChatWelcomeScreen } from "./ChatWelcomeScreen";

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(true);
  const [workbenchTab, setWorkbenchTab] = useState<"editor" | "terminal">(
    "editor"
  );
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [, navigate] = useLocation();

  const { isSupported: isTTSSupported } = useTTS();
  const { user, isAuthenticated } = useAuth();

  const displayName = user?.displayName || "Guest";
  const userInitials = user
    ? (user.displayName?.[0] || user.email?.[0] || "U").toUpperCase()
    : "G";

  const {
    chats,
    currentChatId,
    chatsLoaded,
    loadChats,
    handleNewChat,
    handleChatSelect,
  } = useChatHistory();

  const {
    messages,
    isLoading,
    hasMoreMessages,
    isLoadingMore,
    loadMoreMessages,
    handleSendMessage,
    handleStopGeneration,
  } = useChat({
    currentChatId,
    chats,
    chatsLoaded,
    handleNewChat,
    loadChats,
    setIsWorkbenchOpen,
    setWorkbenchTab,
  });

  // Close sidebar on mobile after creating a new chat
  const wrappedNewChat = async () => {
    const id = await handleNewChat();
    if (id) setIsSidebarOpen(false);
    return id;
  };

  // Expand/collapse sidebar based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      setIsSidebarCollapsed(false);
    } else {
      setIsSidebarCollapsed(true);
    }
  }, [isAuthenticated]);

  // Detect desktop viewport for workbench panel
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    setIsDesktopViewport(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Poll for LLM error count
  useEffect(() => {
    const checkErrors = async () => {
      try {
        const res = await fetch("/api/status");
        if (res.ok) {
          const data = await res.json();
          setErrorCount(data.errorCount || 0);
        }
      } catch {}
    };
    checkErrors();
    const interval = setInterval(checkErrors, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <ChatSession
        chats={chats}
        currentChatId={currentChatId}
        onNewChat={wrappedNewChat}
        onChatSelect={handleChatSelect}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <div className="flex-1 h-full overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel
            defaultSize={isDesktopViewport && isWorkbenchOpen ? 58 : 100}
            minSize={35}
          >
            <div className="flex h-full flex-col relative">
              {/* Mobile header */}
              <div className="flex items-center justify-between p-4 lg:hidden sticky top-0 bg-background/80 backdrop-blur-md z-30">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <Menu className="h-6 w-6" />
                  </Button>
                  <span className="ml-3 font-display font-semibold text-lg">
                    Meowstik
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <LocalDriveButton />
                  {errorCount > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate("/debug?tab=errors")}
                      className="rounded-full h-11 w-11 ring-2 ring-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]"
                      data-testid="button-error-indicator-mobile"
                      title={`${errorCount} API error(s) - click to view`}
                    >
                      <AlertTriangle className="h-6 w-6 text-red-400" />
                    </Button>
                  )}
                  {isTTSSupported && <VerbositySlider />}
                </div>
              </div>

              {/* Desktop header controls */}
              <div className="hidden lg:flex absolute top-4 right-4 z-30 gap-2 items-center">
                <div className="flex items-center gap-1 rounded-full border bg-background/80 p-1 backdrop-blur">
                  <Button
                    variant={
                      isWorkbenchOpen && workbenchTab === "editor"
                        ? "secondary"
                        : "ghost"
                    }
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => {
                      setIsWorkbenchOpen(true);
                      setWorkbenchTab("editor");
                    }}
                    data-testid="button-open-editor-pane"
                    title="Open editor pane"
                  >
                    <Code2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={
                      isWorkbenchOpen && workbenchTab === "terminal"
                        ? "secondary"
                        : "ghost"
                    }
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => {
                      setIsWorkbenchOpen(true);
                      setWorkbenchTab("terminal");
                    }}
                    data-testid="button-open-terminal-pane"
                    title="Open terminal pane"
                  >
                    <Terminal className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => setIsWorkbenchOpen((prev) => !prev)}
                    data-testid="button-toggle-workbench"
                    title={
                      isWorkbenchOpen
                        ? "Collapse workbench"
                        : "Expand workbench"
                    }
                  >
                    {isWorkbenchOpen ? (
                      <PanelRightClose className="h-4 w-4" />
                    ) : (
                      <PanelRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <LocalDriveButton />

                {errorCount > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/debug?tab=errors")}
                    className="rounded-full h-11 w-11 ring-2 ring-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]"
                    data-testid="button-error-indicator"
                    title={`${errorCount} API error(s) - click to view`}
                  >
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </Button>
                )}

                {isTTSSupported && <VerbositySlider />}

                {isAuthenticated ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => (window.location.href = "/api/logout")}
                    title={`Logged in as ${user?.displayName || user?.email || "User"} - Click to logout`}
                    data-testid="button-user-avatar"
                  >
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt="Profile"
                        className="w-7 h-7 rounded-full"
                      />
                    ) : (
                      <span className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                        {userInitials}
                      </span>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="rounded-full"
                    onClick={() => (window.location.href = "/api/login")}
                    data-testid="button-login"
                  >
                    Login
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto scroll-smooth">
                {messages.length === 0 ? (
                  <ChatWelcomeScreen
                    displayName={displayName}
                    onSendMessage={handleSendMessage}
                  />
                ) : (
                  <ChatMessageList
                    messages={messages}
                    isLoading={isLoading}
                    hasMoreMessages={hasMoreMessages}
                    isLoadingMore={isLoadingMore}
                    loadMoreMessages={loadMoreMessages}
                    currentChatId={currentChatId}
                  />
                )}
              </div>

              <div className="w-full bg-gradient-to-t from-background via-background to-transparent pt-4 pb-2 px-4 z-20">
                <ChatInputArea
                  onSend={handleSendMessage}
                  isLoading={isLoading}
                  promptHistory={messages
                    .filter((m) => m.role === "user")
                    .map((m) => m.content)}
                  onStop={handleStopGeneration}
                />
              </div>
            </div>
          </ResizablePanel>

          {isDesktopViewport && isWorkbenchOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={42} minSize={24} maxSize={58}>
                <SideWorkbench
                  activeTab={workbenchTab}
                  onActiveTabChange={setWorkbenchTab}
                  onCollapse={() => setIsWorkbenchOpen(false)}
                  onSendToChat={(message) => handleSendMessage(message, [])}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
