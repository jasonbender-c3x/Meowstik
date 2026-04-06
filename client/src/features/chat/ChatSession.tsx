import type { Chat } from "@shared/schema";
import { Sidebar } from "@/components/chat/sidebar";

interface ChatSessionProps {
  chats: Chat[];
  currentChatId: string | null;
  onNewChat: () => Promise<string | null>;
  onChatSelect: (chatId: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export function ChatSession({
  chats,
  currentChatId,
  onNewChat,
  onChatSelect,
  isOpen,
  setIsOpen,
  isCollapsed,
  setIsCollapsed,
}: ChatSessionProps) {
  return (
    <Sidebar
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onNewChat={onNewChat}
      chats={chats}
      currentChatId={currentChatId}
      onChatSelect={onChatSelect}
      isCollapsed={isCollapsed}
      setIsCollapsed={setIsCollapsed}
    />
  );
}
