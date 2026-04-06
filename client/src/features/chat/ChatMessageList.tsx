import { useRef, useEffect } from "react";
import type { Message } from "@shared/schema";
import { ChatMessage } from "@/components/chat/message";

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  loadMoreMessages: () => void;
  currentChatId: string | null;
}

export function ChatMessageList({
  messages,
  isLoading,
  hasMoreMessages,
  isLoadingMore,
  loadMoreMessages,
  currentChatId,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col gap-2 py-6 min-h-full">
      {hasMoreMessages && (
        <div className="flex justify-center py-4">
          <button
            onClick={loadMoreMessages}
            disabled={isLoadingMore}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            data-testid="button-load-more"
          >
            {isLoadingMore ? "Loading..." : "Load older messages"}
          </button>
        </div>
      )}

      {messages.map((msg, index) => {
        let promptSnapshot: string | undefined;
        if (msg.role === "ai" && index > 0) {
          for (let i = index - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
              promptSnapshot = messages[i].content;
              break;
            }
          }
        }

        const isLastMessage = index === messages.length - 1;

        return (
          <div key={msg.id} ref={isLastMessage ? lastMessageRef : undefined}>
            <ChatMessage
              id={msg.id}
              chatId={currentChatId || undefined}
              role={msg.role as "user" | "ai"}
              content={msg.content}
              metadata={(msg as any).metadata}
              createdAt={msg.createdAt}
              promptSnapshot={promptSnapshot}
            />
          </div>
        );
      })}

      {isLoading && <ChatMessage role="ai" content="" isThinking={true} />}

      <div ref={scrollRef} className="h-4" />
    </div>
  );
}
