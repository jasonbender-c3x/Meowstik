import { useState, useEffect } from "react";
import type { Chat } from "@shared/schema";

export interface UseChatHistoryReturn {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  chatsLoaded: boolean;
  loadChats: (autoSelect?: boolean) => Promise<void>;
  handleNewChat: () => Promise<string | null>;
  handleChatSelect: (chatId: string) => void;
}

export function useChatHistory(): UseChatHistoryReturn {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatsLoaded, setChatsLoaded] = useState(false);

  useEffect(() => {
    loadChats(true);
  }, []);

  const loadChats = async (autoSelect = false) => {
    try {
      const response = await fetch("/api/chats", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setChats(data);
        if (autoSelect && data.length > 0 && !currentChatId) {
          setCurrentChatId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load chats:", error);
    } finally {
      setChatsLoaded(true);
    }
  };

  const handleNewChat = async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "New Discussion" }),
      });

      if (response.ok) {
        const newChat = await response.json();
        setCurrentChatId(newChat.id);
        setChats((prev) => [newChat, ...prev]);
        return newChat.id;
      }
      return null;
    } catch (error) {
      console.error("Failed to create new chat:", error);
      return null;
    }
  };

  const handleChatSelect = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  return {
    chats,
    setChats,
    currentChatId,
    setCurrentChatId,
    chatsLoaded,
    loadChats,
    handleNewChat,
    handleChatSelect,
  };
}
