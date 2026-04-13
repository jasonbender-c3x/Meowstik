import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { useTTS } from "@/contexts/tts-context";

interface ChatMessageProps {
  id?: string;
  chatId?: string;
  role: "user" | "ai" | "assistant" | "system";
  content: string;
  createdAt?: string | number | Date | null;
  isThinking?: boolean;
  metadata?: any;
  promptSnapshot?: any;
  feedback?: string | null;
}

export function ChatMessage({
  role,
  content,
  createdAt,
  isThinking,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const { speak, stopSpeaking } = useTTS();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleSpeak = useCallback(() => {
    if (isSpeakingLocal) {
      stopSpeaking();
      setIsSpeakingLocal(false);
    } else {
      setIsSpeakingLocal(true);
      speak(content).then(() => setIsSpeakingLocal(false)).catch(() => setIsSpeakingLocal(false));
    }
  }, [isSpeakingLocal, content, speak, stopSpeaking]);

  const isAI = role === "ai" || role === "assistant";

  const bgClass = role === "user" ? "bg-background" : role === "system" ? "bg-muted/50" : "bg-card";
  const avatar = isAI ? "😻" : role === "system" ? "⚙️" : "👨‍💻";

  const htmlContent = useMemo(() => renderMarkdown(content), [content]);

  const timestamp = useMemo(() => {
    if (!createdAt) return "";
    let d: Date;
    if (createdAt instanceof Date) {
      d = createdAt;
    } else {
      const num = Number(createdAt);
      if (!isNaN(num)) {
        // PostgreSQL may return microseconds — if timestamp implies year > 3000, divide down to ms
        const ms = num > 32503680000000 ? Math.round(num / 1000) : num;
        d = new Date(ms);
      } else {
        d = new Date(String(createdAt));
      }
    }
    return isNaN(d.getTime()) ? "" : format(d, "MMM d yyyy, h:mm a");
  }, [createdAt]);

  return (
    <div className={`${bgClass} px-4 py-3 flex gap-3`}>
      <div className="text-xl w-8 shrink-0">{avatar}</div>
      <div className="flex-1 min-w-0">
        {isThinking ? (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">Meowstik is thinking...</span>
          </div>
        ) : (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-foreground break-words [overflow-wrap:anywhere] prose-p:break-words prose-li:break-words prose-code:break-words prose-pre:max-w-full prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:[overflow-wrap:anywhere]"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-muted-foreground">{timestamp}</span>
          <div className="flex-1" />
          <button onClick={handleCopy} className="text-xs text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer p-0">
            {copied ? "✓ Copied" : "Copy"}
          </button>
          <button onClick={handleSpeak} className="text-xs text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer p-0">
            {isSpeakingLocal ? "Stop" : "Speak"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;
