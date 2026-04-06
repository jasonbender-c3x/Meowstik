import { useState, useRef, useEffect } from "react";
import type { Chat, Message } from "@shared/schema";
import { useTTS } from "@/contexts/tts-context";
import { playSound } from "@/lib/soundboard";

interface Attachment {
  id: string;
  filename: string;
  type: "file" | "screenshot";
  mimeType: string;
  size: number;
  preview?: string;
  dataUrl: string;
}

interface UseChatOptions {
  currentChatId: string | null;
  chats: Chat[];
  chatsLoaded: boolean;
  handleNewChat: () => Promise<string | null>;
  loadChats: (autoSelect?: boolean) => Promise<void>;
  setIsWorkbenchOpen: (open: boolean) => void;
  setWorkbenchTab: (tab: "editor" | "terminal") => void;
}

export function useChat({
  currentChatId,
  chats,
  chatsLoaded,
  handleNewChat,
  loadChats,
  setIsWorkbenchOpen,
  setWorkbenchTab,
}: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    speak,
    shouldPlayHDAudio,
    shouldPlayBrowserTTS,
    unlockAudio,
    registerHDAudio,
    playAudioBase64,
    verbosityMode,
  } = useTTS();

  const [pendingEditorMessage, setPendingEditorMessage] = useState<
    string | null
  >(() => localStorage.getItem("meowstik-editor-send-message"));

  // Load messages when switching chats
  useEffect(() => {
    if (currentChatId) {
      loadChatMessages(currentChatId);
    }
  }, [currentChatId]);

  // Auto-send pending editor message once chats are loaded
  useEffect(() => {
    if (pendingEditorMessage && chatsLoaded && !isLoading) {
      const timer = setTimeout(async () => {
        try {
          await handleSendMessage(pendingEditorMessage, []);
          localStorage.removeItem("meowstik-editor-send-message");
          localStorage.removeItem("meowstik-editor-send-filename");
          setPendingEditorMessage(null);
        } catch (err) {
          console.error("[Editor Send] Failed to send message:", err);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pendingEditorMessage, chatsLoaded, isLoading]);

  const loadChatMessages = async (
    chatId: string
  ): Promise<Message[] | undefined> => {
    try {
      const response = await fetch(`/api/chats/${chatId}?limit=30`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const messagesWithMetadata = (data.messages || []).map((msg: any) => ({
          ...msg,
          metadata: msg.metadata || undefined,
        }));
        setMessages(messagesWithMetadata);
        setHasMoreMessages(data.hasMore || false);
        return messagesWithMetadata;
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
    return undefined;
  };

  const loadMoreMessages = async () => {
    if (!currentChatId || isLoadingMore || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
      const oldestMessageId = messages[0]?.id;
      const response = await fetch(
        `/api/chats/${currentChatId}/messages?limit=30&before=${oldestMessageId}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        const olderMessages = (data.messages || []).map((msg: any) => ({
          ...msg,
          metadata: msg.metadata || undefined,
        }));
        setMessages((prev) => [...olderMessages, ...prev]);
        setHasMoreMessages(data.hasMore || false);
      }
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async (
    content: string,
    attachments: Attachment[] = []
  ) => {
    console.log(
      "[handleSendMessage] Starting with content:",
      content.substring(0, 50)
    );

    try {
      await unlockAudio();
    } catch (e) {
      console.warn("[handleSendMessage] Audio unlock failed:", e);
    }

    try {
      let chatId = currentChatId;

      if (!chatId) {
        console.log("[handleSendMessage] No chat ID, creating new chat...");
        const newChatId = await handleNewChat();
        if (!newChatId) {
          console.error("[handleSendMessage] Failed to create chat");
          return;
        }
        chatId = newChatId;
        // Clear messages for the brand-new chat (mirrors original handleNewChat behaviour)
        setMessages([]);
        console.log("[handleSendMessage] Created new chat:", chatId);
      }

      const tempUserMessage = {
        id: `temp-${Date.now()}`,
        chatId: chatId,
        role: "user",
        content,
        createdAt: new Date(),
        metadata: null,
      } as unknown as Message;
      setMessages((prev) => [...prev, tempUserMessage]);
      setIsLoading(true);

      const storedSettings = localStorage.getItem("meowstic-settings");
      const modelMode = storedSettings
        ? JSON.parse(storedSettings).model
        : "pro";

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortController.signal,
        body: JSON.stringify({
          content,
          model: modelMode,
          verbosityMode,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            type: a.type,
            mimeType: a.mimeType,
            size: a.size,
            dataUrl: a.dataUrl,
          })),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error("[Chat] Authentication failed - redirecting to login");
          window.location.href = "/login";
          return;
        }
        const errorText = await response.text();
        console.error("[Chat] Message failed:", response.status, errorText);
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let aiMessageContent = "";
      let buffer = "";
      let streamMetadata: any = null;
      let speechEventsReceived = 0;
      let cleanContentForTTS = "";

      const audioQueue: Array<{
        base64: string;
        mimeType: string;
        utterance: string;
      }> = [];
      let isPlayingAudio = false;

      const playNextInQueue = async () => {
        if (isPlayingAudio || audioQueue.length === 0) return;
        isPlayingAudio = true;
        const item = audioQueue.shift()!;
        try {
          const played = await playAudioBase64(item.base64, item.mimeType);
          if (!played) {
            console.warn("[TTS] AudioContext failed, trying HTML Audio");
            try {
              const audioBlob = new Blob(
                [Uint8Array.from(atob(item.base64), (c) => c.charCodeAt(0))],
                { type: item.mimeType }
              );
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              audio.volume = 1.0;
              registerHDAudio(audio);
              await new Promise<void>((resolve, reject) => {
                audio.onended = () => {
                  URL.revokeObjectURL(audioUrl);
                  registerHDAudio(null);
                  resolve();
                };
                audio.onerror = () => {
                  URL.revokeObjectURL(audioUrl);
                  registerHDAudio(null);
                  reject(new Error("Audio playback error"));
                };
                audio.play().catch(reject);
              });
            } catch (fallbackErr) {
              console.error("[TTS] All playback methods failed:", fallbackErr);
            }
          }
        } catch (err) {
          console.error("[TTS] Playback error:", err);
        }
        isPlayingAudio = false;
        playNextInQueue();
      };

      const SSE_INACTIVITY_TIMEOUT_MS = 30_000;
      let sseTimeoutId: ReturnType<typeof setTimeout> | null = null;
      const resetSseTimeout = () => {
        if (sseTimeoutId !== null) clearTimeout(sseTimeoutId);
        sseTimeoutId = setTimeout(() => {
          console.warn("[SSE] Inactivity timeout — forcing stream completion");
          setIsLoading(false);
        }, SSE_INACTIVITY_TIMEOUT_MS);
      };
      resetSseTimeout();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetSseTimeout();

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error && data.errorType === "ai_error_response") {
                console.error(
                  "[Chat] AI returned error response:",
                  data.message
                );
                const errorContent = `⚠️ **Error:** ${data.message}\n\n${data.details || ""}`;
                aiMessageContent = errorContent;
                setMessages((prev) => {
                  const filtered = prev.filter(
                    (m) => !m.id.startsWith("temp-ai-")
                  );
                  return [
                    ...filtered,
                    {
                      id: `temp-ai-${Date.now()}`,
                      chatId: chatId,
                      role: "ai",
                      content: aiMessageContent,
                      createdAt: new Date().toISOString(),
                    } as unknown as Message,
                  ];
                });
                continue;
              }

              if (data.text) {
                aiMessageContent += data.text;
                setMessages((prev) => {
                  const filtered = prev.filter(
                    (m) => !m.id.startsWith("temp-ai-")
                  );
                  return [
                    ...filtered,
                    {
                      id: `temp-ai-${Date.now()}`,
                      chatId: chatId,
                      role: "ai",
                      content: aiMessageContent,
                      createdAt: new Date().toISOString(),
                    } as unknown as Message,
                  ];
                });
              }

              if (data.finalContent !== undefined) {
                aiMessageContent = data.finalContent;
                setMessages((prev) => {
                  const filtered = prev.filter(
                    (m) => !m.id.startsWith("temp-ai-")
                  );
                  return [
                    ...filtered,
                    {
                      id: `temp-ai-${Date.now()}`,
                      chatId: chatId,
                      role: "ai",
                      content: aiMessageContent,
                      createdAt: new Date().toISOString(),
                    } as unknown as Message,
                  ];
                });
              }

              if (data.speech) {
                const speechData = data.speech as {
                  utterance: string;
                  audioGenerated?: boolean;
                  audioBase64?: string;
                  mimeType?: string;
                  duration?: number;
                  streaming?: boolean;
                  index?: number;
                };
                speechEventsReceived++;
                const hdPermitted = shouldPlayHDAudio();
                const browserTTSPermitted = shouldPlayBrowserTTS();

                console.log(
                  `[TTS] Incoming speech event #${speechEventsReceived}:`,
                  {
                    streaming: speechData.streaming,
                    audioGenerated: speechData.audioGenerated,
                    hasAudio: !!speechData.audioBase64,
                    hdPermitted,
                    browserTTSPermitted,
                    utterance: speechData.utterance?.substring(0, 30) + "...",
                  }
                );

                if (
                  speechData.audioGenerated &&
                  speechData.audioBase64 &&
                  hdPermitted
                ) {
                  console.log("[TTS] Queueing HD audio for playback");
                  audioQueue.push({
                    base64: speechData.audioBase64,
                    mimeType: speechData.mimeType || "audio/mpeg",
                    utterance: speechData.utterance || "",
                  });
                  playNextInQueue();
                } else if (
                  speechData.audioGenerated === false &&
                  speechData.utterance
                ) {
                  console.log(
                    "[TTS] say tool reported audioGenerated:false, using browser TTS fallback"
                  );
                  speak(speechData.utterance);
                } else if (browserTTSPermitted && speechData.utterance) {
                  console.log(
                    "[TTS] Falling back to browser TTS for this speech event"
                  );
                  speak(speechData.utterance);
                }
              }

              if (data.openUrl) {
                console.log(
                  "[OPEN_URL] Received openUrl event:",
                  data.openUrl
                );
                const openUrlData = data.openUrl as { url: string };
                if (openUrlData.url) {
                  try {
                    console.log(
                      "[OPEN_URL] Opening URL in new tab:",
                      openUrlData.url
                    );
                    window.open(openUrlData.url, "_blank");
                    console.log(
                      "[OPEN_URL] ✓ Successfully triggered window.open()"
                    );
                  } catch (err) {
                    console.error("[OPEN_URL] Error opening URL:", err);
                  }
                }
              }

              if (data.soundboard) {
                const { sound, volume } = data.soundboard as {
                  sound: string;
                  volume?: number;
                };
                console.log(`[SOUNDBOARD] Playing: ${sound}`);
                playSound(sound, volume ?? 0.8);
              }

              if (data.metadata) {
                streamMetadata = data.metadata;

                if (streamMetadata.toolResults) {
                  for (const toolResult of streamMetadata.toolResults) {
                    if (
                      toolResult.type === "send_chat" &&
                      toolResult.success &&
                      toolResult.result
                    ) {
                      const { content } = toolResult.result as {
                        content: string;
                      };
                      if (content) {
                        cleanContentForTTS = content;
                      }
                    }

                    if (
                      toolResult.type === "file_put" &&
                      toolResult.success &&
                      toolResult.result
                    ) {
                      const result = toolResult.result as {
                        path: string;
                        destination: string;
                        content: string;
                        mimeType?: string;
                      };
                      if (result.destination === "editor" && result.content) {
                        const filename =
                          result.path.split("/").pop() || "untitled";
                        const ext =
                          filename.split(".").pop()?.toLowerCase() || "";
                        const langMap: Record<string, string> = {
                          js: "javascript",
                          ts: "typescript",
                          tsx: "typescript",
                          jsx: "javascript",
                          py: "python",
                          css: "css",
                          html: "html",
                          json: "json",
                          md: "markdown",
                          sql: "sql",
                        };
                        const language = langMap[ext] || "plaintext";

                        localStorage.setItem(
                          "meowstik-editor-llm-code",
                          result.content
                        );
                        localStorage.setItem(
                          "meowstik-editor-llm-language",
                          language
                        );
                        localStorage.setItem(
                          "meowstik-editor-llm-filename",
                          filename
                        );
                        window.dispatchEvent(
                          new CustomEvent("meowstik-editor-llm-update")
                        );
                        setIsWorkbenchOpen(true);
                        setWorkbenchTab("editor");
                        console.log(
                          `[Chat] File saved to editor canvas: ${filename}`
                        );
                      }
                    }
                  }
                }

                setMessages((prev) => {
                  const filtered = prev.filter(
                    (m) => !m.id.startsWith("temp-ai-")
                  );
                  return [
                    ...filtered,
                    {
                      id: `temp-ai-${Date.now()}`,
                      chatId: chatId,
                      role: "ai",
                      content: aiMessageContent,
                      createdAt: new Date(),
                      metadata: streamMetadata,
                    } as unknown as Message & { metadata?: any },
                  ];
                });
              }

              if (data.done) {
                console.log("[SSE] Done event received");
                if (sseTimeoutId !== null) {
                  clearTimeout(sseTimeoutId);
                  sseTimeoutId = null;
                }
                setIsLoading(false);

                const textToSpeak = cleanContentForTTS || aiMessageContent;
                const stripped = textToSpeak.trim();
                const isNonSpeakable =
                  stripped.startsWith("{") ||
                  stripped.startsWith("[") ||
                  stripped.startsWith("<thinking>") ||
                  stripped.startsWith("```") ||
                  /^[\s\W]+$/.test(stripped);
                const browserTTSPermitted = shouldPlayBrowserTTS();

                console.log("[TTS] Final Stream Check:", {
                  speechEventsReceived,
                  browserTTSPermitted,
                  isNonSpeakable,
                  textLength: textToSpeak?.length || 0,
                  cleanContentForTTS_Len: cleanContentForTTS?.length || 0,
                  aiMessageContent_Len: aiMessageContent?.length || 0,
                });

                if (
                  textToSpeak &&
                  speechEventsReceived === 0 &&
                  browserTTSPermitted &&
                  !isNonSpeakable
                ) {
                  console.log(
                    "[TTS] No speech events received, triggered full response browser TTS fallback"
                  );
                  speak(textToSpeak);
                } else if (speechEventsReceived > 0) {
                  console.log(
                    `[TTS] ${speechEventsReceived} speech events already handled, suppressing full response fallback`
                  );
                }

                if (data.savedMessage) {
                  console.log(
                    "[SSE] Replacing temp message with saved message:",
                    data.savedMessage.id
                  );
                  setMessages((prev) => {
                    const filtered = prev.filter(
                      (m) => !m.id.startsWith("temp-ai-")
                    );
                    return [
                      ...filtered,
                      {
                        id: data.savedMessage.id,
                        chatId: chatId,
                        role: data.savedMessage.role,
                        content: data.savedMessage.content,
                        createdAt: new Date(data.savedMessage.createdAt),
                        metadata: data.savedMessage.metadata,
                      } as unknown as Message & { metadata?: any },
                    ];
                  });

                  if (data.pendingAutoexec) {
                    pollForAutoexecResult(chatId, data.savedMessage.id);
                  }
                } else {
                  console.warn(
                    "[SSE] No savedMessage in done event, falling back to full reload"
                  );
                  const updatedMessages = await loadChatMessages(chatId);

                  if (data.pendingAutoexec && updatedMessages) {
                    const aiMessage = updatedMessages.find(
                      (m: Message) => m.role === "ai" && m.metadata
                    );
                    if (aiMessage) {
                      pollForAutoexecResult(chatId, aiMessage.id);
                    }
                  }
                }

                await loadChats();
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }
      if (sseTimeoutId !== null) {
        clearTimeout(sseTimeoutId);
        sseTimeoutId = null;
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("[handleSendMessage] Request aborted by user");
      } else {
        console.error("[handleSendMessage] Failed to send message:", error);
      }
      setIsLoading(false);
      abortControllerRef.current = null;
    } finally {
      setTimeout(() => {
        setIsLoading((current) => {
          if (current) {
            console.warn(
              "[handleSendMessage] Force clearing loading state after timeout"
            );
            return false;
          }
          return current;
        });
      }, 60000);
    }
  };

  const handleStopGeneration = () => {
    console.log("[handleStopGeneration] Stop button clicked");
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const pollForAutoexecResult = async (
    chatId: string,
    messageId: string
  ) => {
    const maxAttempts = 30;
    const pollInterval = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(
          `/api/messages/${messageId}/metadata`,
          { credentials: "include" }
        );
        if (response.ok) {
          const data = await response.json();

          if (data.hasAutoexecResult) {
            await loadChatMessages(chatId);

            const autoexec = data.metadata.autoexecResult;
            const followUpContent = `[Terminal Output]\nCommand: ${autoexec.command}\nExit Code: ${autoexec.exitCode}\nOutput:\n\`\`\`\n${autoexec.output || "(no output)"}\n\`\`\`\n\nPlease review the terminal output and respond accordingly.`;

            await handleSendMessage(followUpContent, []);
            return;
          }
        }
      } catch (error) {
        console.error("Error polling for autoexec result:", error);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    console.warn("Autoexec polling timed out");
  };

  return {
    messages,
    setMessages,
    isLoading,
    hasMoreMessages,
    isLoadingMore,
    loadChatMessages,
    loadMoreMessages,
    handleSendMessage,
    handleStopGeneration,
  };
}
