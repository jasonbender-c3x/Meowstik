import { createContext, useContext, useState, ReactNode } from "react";
import type { Chat, Message } from "@shared/schema";

interface ChatContextValue {
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <ChatContext.Provider
      value={{
        currentChatId,
        setCurrentChatId,
        chats,
        setChats,
        messages,
        setMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
