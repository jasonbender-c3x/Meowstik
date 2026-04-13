
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    INPUT-AREA.TSX - CHAT INPUT COMPONENT                      ║
 * ║                                                                               ║
 * ║  A modern, Google-style chat input component with:                            ║
 * ║    - Auto-resizing textarea that grows with content                           ║
 * ║    - Action buttons for attachments and voice input                           ║
 * ║    - Animated send button with loading state                                  ║
 * ║    - Keyboard shortcut support (Enter to send)                                ║
 * ║                                                                               ║
 * ║  Visual Layout:                                                               ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │  Ask Meowstic anything...                                                │  ║
 * ║  │  [user input text here]                                                │  ║
 * ║  │  ──────────────────────────────────────────────────────────────────── │  ║
 * ║  │  [🖼️] [📎] [🎤]                                              [➤ Send] │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ║  ︎                                                                             ║
 * ║  Meowstic may display inaccurate info...                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * React Hooks
 * - useState: Manage input text state
 * - useRef: Reference to textarea for auto-resize
 * - useEffect: Handle auto-resize on input change
 */
import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of files to process when uploading a directory
 * Prevents overwhelming the system with too many files at once
 */
const MAX_FOLDER_FILES = 50;

/**
 * UI Components from shadcn/ui
 * - Button: Styled action buttons
 * - Native textarea is used for input
 */
import { Button } from "@/components/ui/button";

/**
 * Lucide Icons
 * - Mic/MicOff: Voice input button (toggle)
 * - Send: Send message button
 * - Paperclip: File attachment button
 * - Monitor: Screen capture button
 * - X: Remove attachment button
 * - Folder: Directory picker button
 */
import { Mic, MicOff, Send, Paperclip, Monitor, X, Camera, Folder } from "lucide-react";

/**
 * Voice hook for speech-to-text functionality
 */
import { useVoice } from "@/hooks/use-voice";
import { useTTS } from "@/contexts/tts-context";

/**
 * Toast notifications for user feedback
 */
import { useToast } from "@/hooks/use-toast";

/**
 * Framer Motion for animations
 * - motion: Animated component wrapper
 * - AnimatePresence: Handles component enter/exit animations
 */
import { motion, AnimatePresence } from "framer-motion";

/**
 * Utility for conditional class names
 */
import { cn } from "@/lib/utils";

/**
 * File picker utilities for modern file system access
 */
import { openFilePicker, openDirectoryPicker, readFileAsDataURL, isFileSystemAccessSupported } from "@/lib/file-picker";

// ============================================================================
// IMAGE COMPRESSION UTILITY
// ============================================================================

/**
 * Compress an image using Canvas API
 * Resizes large images and converts to JPEG at specified quality
 * 
 * @param dataUrl - The original image data URL
 * @param maxWidth - Maximum width (default 2048px)
 * @param maxHeight - Maximum height (default 2048px)
 * @param quality - JPEG quality 0-1 (default 0.8)
 * @returns Promise with compressed data URL and new size
 */
async function compressImage(
  dataUrl: string,
  maxWidth = 2048,
  maxHeight = 2048,
  quality = 0.8
): Promise<{ dataUrl: string; size: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      
      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to JPEG
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      
      // Calculate approximate size from base64
      const base64Length = compressedDataUrl.split(",")[1]?.length || 0;
      const size = Math.round((base64Length * 3) / 4);
      
      resolve({
        dataUrl: compressedDataUrl,
        size,
        mimeType: "image/jpeg"
      });
    };
    
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Attachment type for files and screenshots
 */
interface Attachment {
  id: string;
  filename: string;
  type: "file" | "screenshot";
  mimeType: string;
  size: number;
  preview?: string;
  dataUrl: string;
}

/**
 * Props for the ChatInputArea component
 * 
 * @property {(message: string, attachments: Attachment[]) => void} onSend - Callback when user sends a message
 * @property {boolean} isLoading - Whether AI is processing (disables input)
 * @property {string[]} promptHistory - Array of previous user prompts for up-arrow navigation
 * @property {() => void} onStop - Callback to stop/cancel the current AI request
 */
interface InputAreaProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  promptHistory?: string[];
  onStop?: () => void;
}

// ============================================================================
// CHAT INPUT AREA COMPONENT
// ============================================================================

/**
 * ChatInputArea Component - Message Input Interface
 * 
 * A sophisticated input component for the chat interface that provides:
 * 
 * Features:
 * - Auto-resizing textarea (grows up to 200px)
 * - Enter to send (Shift+Enter for newline)
 * - Placeholder action buttons (image, file, voice)
 * - Animated send button with loading state
 * - Disabled state during AI response
 * 
 * Auto-Resize Logic:
 * 1. Reset height to "auto" to get true scrollHeight
 * 2. Set height to scrollHeight (actual content height)
 * 3. CSS max-height prevents infinite growth
 * 
 * @param {InputAreaProps} props - Component properties
 * @returns {JSX.Element} The chat input area
 * 
 * @example
 * <ChatInputArea
 *   onSend={(message) => handleSendMessage(message)}
 *   isLoading={isWaitingForAI}
 * />
 */
export function ChatInputArea({ onSend, isLoading, promptHistory = [], onStop }: InputAreaProps) {
  // ===========================================================================
  // STATE & REFS
  // ===========================================================================

  /**
   * Current input text value
   * Cleared after successful send
   */
  const [input, setInput] = useState("");

  /**
   * Ghost text state - when user presses up arrow, shows previous prompt greyed out
   * User must press Tab to activate (make editable)
   */
  const [ghostText, setGhostText] = useState<string | null>(null);

  /**
   * History navigation index - tracks position in prompt history
   * -1 means not navigating history
   */
  const [historyIndex, setHistoryIndex] = useState(-1);

  /**
   * Reference to textarea element for height manipulation
   * Used for auto-resize functionality
   */
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Reference to hidden file input for file uploads
   */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Attachments state - stores files and screenshots to be sent with message
   */
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  /**
   * Auto-screenshot mode - when ON, every send includes a screenshot
   */
  const [autoScreenshotMode, setAutoScreenshotMode] = useState(false);

  /**
   * Cursor position when STT button was clicked
   * Used to insert transcribed text at the correct position
   */
  const cursorPositionRef = useRef<number | null>(null);

  /**
   * Track the last transcript length we've already inserted
   * This prevents re-inserting the entire accumulated transcript
   */
  const lastTranscriptLengthRef = useRef<number>(0);

  /**
   * Voice-to-text hook for speech recognition
   */
  const { 
    isListening, 
    transcript, 
    isSupported: isVoiceSupported, 
    startListening, 
    stopListening,
    abortListening,
    resetTranscript,
    error: voiceError 
  } = useVoice({ continuous: true, interimResults: true });

  const { isSpeaking: isTtsSpeaking } = useTTS();

  /**
   * Toast notifications
   */
  const { toast } = useToast();

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  /**
   * Effect: Auto-resize textarea based on content
   * 
   * How it works:
   * 1. Reset height to "auto" to allow shrinking
   * 2. Read scrollHeight (actual content height)
   * 3. Set height to scrollHeight
   * 4. CSS max-height (200px) prevents unlimited growth
   * 
   * Triggers on every input change for responsive resizing.
   */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  /**
   * Effect: Update input with voice transcript
   * Only inserts the NEW portion of the transcript (delta since last update)
   * This prevents duplication when the transcript accumulates
   */
  useEffect(() => {
    if (transcript && transcript.length > lastTranscriptLengthRef.current) {
      // Extract only the new portion we haven't inserted yet
      const newText = transcript.slice(lastTranscriptLengthRef.current);
      
      setInput(prev => {
        const pos = cursorPositionRef.current;
        if (pos !== null && pos <= prev.length) {
          // Insert at cursor position
          return prev.slice(0, pos) + newText + prev.slice(pos);
        }
        // Fallback: append to end
        return prev + newText;
      });
      
      // Update cursor position to end of inserted text
      if (cursorPositionRef.current !== null) {
        cursorPositionRef.current += newText.length;
      }
      
      // Update the tracked length
      lastTranscriptLengthRef.current = transcript.length;
    }
  }, [transcript]);

  /**
   * Effect: Show voice errors
   */
  useEffect(() => {
    if (voiceError) {
      toast({
        title: "Voice Error",
        description: voiceError,
        variant: "destructive"
      });
    }
  }, [voiceError, toast]);

  const stopVoiceInput = useCallback((immediate: boolean = false) => {
    if (isListening) {
      if (immediate) {
        abortListening();
      } else {
        stopListening();
      }
    }

    cursorPositionRef.current = null;
    lastTranscriptLengthRef.current = 0;
    resetTranscript();
  }, [abortListening, isListening, resetTranscript, stopListening]);

  useEffect(() => {
    if (isTtsSpeaking && isListening) {
      stopVoiceInput(true);
    }
  }, [isListening, isTtsSpeaking, stopVoiceInput]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle send button click or Enter key
   * If auto-screenshot mode is on, captures screenshot first
   */
  const handleSend = async () => {
    const hasContent = input.trim() || attachments.length > 0;
    if (hasContent && !isLoading) {
      stopVoiceInput(true);
      const finalAttachments = [...attachments];
      
      // If auto-screenshot mode is on, capture screenshot
      if (autoScreenshotMode) {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "monitor" } as MediaTrackConstraints
          });
          const video = document.createElement("video");
          video.srcObject = stream;
          await video.play();
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const rawDataUrl = canvas.toDataURL("image/png");
            stream.getTracks().forEach(track => track.stop());
            const compressed = await compressImage(rawDataUrl);
            finalAttachments.push({
              id: `auto-screenshot-${Date.now()}`,
              filename: `screenshot-${Date.now()}.jpg`,
              type: "screenshot",
              mimeType: compressed.mimeType,
              size: compressed.size,
              dataUrl: compressed.dataUrl,
              preview: compressed.dataUrl
            });
          }
        } catch (error: any) {
          if (error.name !== "AbortError") {
            toast({ title: "Auto-screenshot failed", variant: "destructive" });
          }
        }
      }
      
      onSend(input, finalAttachments);
      setInput("");
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  /**
   * Handle screenshot + send button click
   * Captures a screenshot and sends it with the current message
   */
  const handleScreenshotSend = async () => {
    if (isLoading) return;
    stopVoiceInput(true);
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints
      });
      
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const rawDataUrl = canvas.toDataURL("image/png");
        stream.getTracks().forEach(track => track.stop());
        
        let finalDataUrl = rawDataUrl;
        let finalSize = 0;
        let finalMimeType = "image/png";
        
        try {
          const compressed = await compressImage(rawDataUrl);
          finalDataUrl = compressed.dataUrl;
          finalSize = compressed.size;
          finalMimeType = compressed.mimeType;
        } catch (error) {
          console.error("Screenshot compression failed:", error);
          const response = await fetch(rawDataUrl);
          const blob = await response.blob();
          finalSize = blob.size;
        }
        
        const filename = `screenshot-${Date.now()}.jpg`;
        const screenshotAttachment: Attachment = {
          id: `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename,
          type: "screenshot",
          mimeType: finalMimeType,
          size: finalSize,
          dataUrl: finalDataUrl,
          preview: finalDataUrl
        };
        
        const allAttachments = [...attachments, screenshotAttachment];
        onSend(input, allAttachments);
        setInput("");
        setAttachments([]);
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast({
          title: "Capture Failed",
          description: "Unable to capture screen. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  /**
   * Remove an attachment by ID
   */
  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  /**
   * Handle file selection from file input
   * Compresses images before adding as attachments
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });
      
      const isImage = file.type.startsWith("image/");
      
      let finalDataUrl = dataUrl;
      let finalSize = file.size;
      let finalMimeType = file.type;
      
      // Compress images to reduce size
      if (isImage) {
        try {
          const compressed = await compressImage(dataUrl);
          finalDataUrl = compressed.dataUrl;
          finalSize = compressed.size;
          finalMimeType = compressed.mimeType;
        } catch (error) {
          console.error("Image compression failed, using original:", error);
        }
      }
      
      const attachment: Attachment = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: file.name,
        type: "file",
        mimeType: finalMimeType,
        size: finalSize,
        dataUrl: finalDataUrl,
        preview: isImage ? finalDataUrl : undefined
      };
      
      setAttachments(prev => [...prev, attachment]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Handle enhanced file picker using File System Access API
   * Provides a better native file picker experience in supported browsers
   */
  const handleEnhancedFilePicker = async () => {
    try {
      const files = await openFilePicker({
        accept: {
          'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
          'application/pdf': ['.pdf'],
          'text/*': ['.txt', '.md', '.json', '.csv'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
        multiple: true,
        description: 'Select files to attach'
      });

      if (files.length === 0) return; // User cancelled

      // Process files similar to handleFileUpload
      for (const file of files) {
        const dataUrl = await readFileAsDataURL(file);
        const isImage = file.type.startsWith("image/");
        
        let finalDataUrl = dataUrl;
        let finalSize = file.size;
        let finalMimeType = file.type;
        
        // Compress images to reduce size
        if (isImage) {
          try {
            const compressed = await compressImage(dataUrl);
            finalDataUrl = compressed.dataUrl;
            finalSize = compressed.size;
            finalMimeType = compressed.mimeType;
          } catch (error) {
            console.error("Image compression failed, using original:", error);
          }
        }
        
        const attachment: Attachment = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename: file.name,
          type: "file",
          mimeType: finalMimeType,
          size: finalSize,
          dataUrl: finalDataUrl,
          preview: isImage ? finalDataUrl : undefined
        };
        
        setAttachments(prev => [...prev, attachment]);
      }

      toast({
        title: "Files Attached",
        description: `${files.length} file(s) added to the message`
      });
    } catch (error) {
      console.error("Enhanced file picker failed:", error);
      toast({
        title: "File Selection Failed",
        description: "Unable to select files. Please try again.",
        variant: "destructive"
      });
    }
  };

  /**
   * Handle directory picker to upload entire folders
   * Uses File System Access API when available, falls back to webkitdirectory
   */
  const handleDirectoryPicker = async () => {
    try {
      const entries = await openDirectoryPicker({
        description: 'Select a folder to upload'
      });

      if (entries.length === 0) return; // User cancelled

      let fileCount = 0;

      for (const entry of entries.slice(0, MAX_FOLDER_FILES)) {
        const { file, path } = entry;
        const dataUrl = await readFileAsDataURL(file);
        const isImage = file.type.startsWith("image/");
        
        let finalDataUrl = dataUrl;
        let finalSize = file.size;
        let finalMimeType = file.type;
        
        // Compress images to reduce size
        if (isImage) {
          try {
            const compressed = await compressImage(dataUrl);
            finalDataUrl = compressed.dataUrl;
            finalSize = compressed.size;
            finalMimeType = compressed.mimeType;
          } catch (error) {
            console.error("Image compression failed, using original:", error);
          }
        }
        
        const attachment: Attachment = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename: path, // Use full path to preserve directory structure
          type: "file",
          mimeType: finalMimeType,
          size: finalSize,
          dataUrl: finalDataUrl,
          preview: isImage ? finalDataUrl : undefined
        };
        
        setAttachments(prev => [...prev, attachment]);
        fileCount++;
      }

      toast({
        title: "Folder Uploaded",
        description: `${fileCount} file(s) from folder added to the message${entries.length > MAX_FOLDER_FILES ? ` (limited to ${MAX_FOLDER_FILES} files)` : ''}`
      });
    } catch (error) {
      console.error("Directory picker failed:", error);
      toast({
        title: "Folder Selection Failed",
        description: "Unable to select folder. Please try again.",
        variant: "destructive"
      });
    }
  };

  /**
   * Handle keyboard events in textarea
   * 
   * Implements:
   * - Enter: Send message (default)
   * - Shift+Enter: Insert newline (browser default)
   * - ArrowUp: Navigate to previous prompt (shows as ghost text)
   * - ArrowDown: Navigate to next prompt in history
   * - Tab: Activate ghost text (make it editable)
   * - Escape: Clear ghost text
   * 
   * @param {React.KeyboardEvent} e - Keyboard event
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Up arrow - navigate to previous prompt
    if (e.key === "ArrowUp" && !input.trim() && promptHistory.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex === -1 ? promptHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setGhostText(promptHistory[newIndex]);
      return;
    }

    // Down arrow - navigate forward in history or clear
    if (e.key === "ArrowDown" && ghostText !== null) {
      e.preventDefault();
      if (historyIndex < promptHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setGhostText(promptHistory[newIndex]);
      } else {
        // At the end, clear ghost text
        setGhostText(null);
        setHistoryIndex(-1);
      }
      return;
    }

    // Tab - activate ghost text
    if (e.key === "Tab" && ghostText !== null) {
      e.preventDefault();
      setInput(ghostText);
      setGhostText(null);
      setHistoryIndex(-1);
      return;
    }

    // Escape - clear ghost text
    if (e.key === "Escape" && ghostText !== null) {
      e.preventDefault();
      setGhostText(null);
      setHistoryIndex(-1);
      return;
    }
  };

  /**
   * Toggle voice-to-text listening
   * Starts or stops speech recognition based on current state
   * Saves cursor position to insert transcribed text at that location
   */
  const handleMicClick = () => {
    if (!isVoiceSupported) {
      toast({
        title: "Not Supported",
        description: "Voice input is not supported in your browser",
        variant: "destructive"
      });
      return;
    }

    if (isTtsSpeaking) {
      return;
    }
    
    if (isListening) {
      stopVoiceInput();
    } else {
      // Clear any stale transcript from previous session
      stopVoiceInput();
      
      // Save cursor position before starting
      const cursorPos = textareaRef.current?.selectionStart ?? input.length;
      cursorPositionRef.current = cursorPos;
      
      // Reset transcript tracker for fresh session
      lastTranscriptLengthRef.current = 0;
      
      // Always start fresh (don't use append mode to avoid stale data)
      startListening(false);
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="w-full max-w-4xl mx-auto px-2 pb-4">
      {/* Hidden file input for file uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.json,.csv,.xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
        data-testid="input-file-upload"
      />

      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex flex-wrap gap-2 mb-3 px-2"
          >
            {attachments.map((attachment) => (
              <motion.div
                key={attachment.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="group relative flex items-center gap-2 p-1.5 bg-secondary/50 rounded-xl border border-border/50 text-xs animate-in zoom-in-95 duration-200"
                data-testid={`attachment-preview-${attachment.id}`}
              >
                {attachment.preview ? (
                  <img src={attachment.preview} alt={attachment.filename} className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="max-w-[120px] truncate text-muted-foreground font-medium px-1">
                  {attachment.filename}
                </span>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="p-1 hover:bg-background rounded-full transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative group">
        {/* Main input container - Gemini-style pill */}
        <div className={cn(
          "relative flex flex-col w-full rounded-[28px] border bg-muted/30 hover:bg-muted/50 focus-within:bg-background transition-all duration-300 shadow-sm focus-within:shadow-md focus-within:ring-1 focus-within:ring-primary/20",
          isLoading && "opacity-80 pointer-events-none"
        )}>
          {/* Ghost Text Overlay - Shows previous prompt when navigating history */}
          <AnimatePresence>
            {ghostText !== null && !input && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 px-6 py-4 pointer-events-none z-0"
              >
                <div className="text-base text-muted-foreground/50 whitespace-pre-wrap break-words">
                  {ghostText}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Clear ghost text when user starts typing
              if (ghostText !== null) {
                setGhostText(null);
                setHistoryIndex(-1);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={ghostText !== null ? "" : "Ask Meowstik anything..."}
            className="w-full px-6 py-4 bg-transparent border-none focus:ring-0 resize-none text-base min-h-[56px] max-h-[400px] scrollbar-thin overflow-y-auto relative z-10 outline-none"
            rows={1}
            disabled={isLoading}
            data-testid="input-chat-message"
          />

          {/* Action Bar (inside the pill) */}
          <div className="flex items-center justify-between px-3 pb-3 relative z-20">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={isFileSystemAccessSupported() ? handleEnhancedFilePicker : () => fileInputRef.current?.click()}
                className="h-10 w-10 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                data-testid="button-file-attach"
                title="Attach files"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleDirectoryPicker}
                className="h-10 w-10 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                data-testid="button-folder-attach"
                title="Attach entire folder"
              >
                <Folder className="h-5 w-5" />
              </Button>

              <Button
                variant={isListening ? "secondary" : "ghost"}
                size="icon"
                onClick={handleMicClick}
                disabled={isLoading || isTtsSpeaking}
                className={cn(
                  "h-10 w-10 rounded-full transition-all duration-300",
                  isListening 
                    ? "text-red-500 bg-red-500/10 hover:bg-red-500/20 animate-pulse" 
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                data-testid="button-voice-input"
                title={isTtsSpeaking ? "Voice input disabled while Meowstik is speaking" : isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>

              <Button
                variant={autoScreenshotMode ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setAutoScreenshotMode(!autoScreenshotMode)}
                className={cn(
                  "h-10 w-10 rounded-full transition-all duration-300",
                  autoScreenshotMode 
                    ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 ring-1 ring-amber-500/20" 
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title={autoScreenshotMode ? "Auto-screenshot: ON" : "Auto-screenshot: OFF"}
              >
                <Monitor className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                onClick={handleScreenshotSend}
                disabled={isLoading}
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                data-testid="button-screenshot-send"
                title="Capture screenshot and send"
              >
                <Camera className="h-5 w-5" />
              </Button>

              {isLoading && onStop ? (
                <Button
                  onClick={onStop}
                  size="icon"
                  className="h-10 w-10 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
                  title="Stop generation"
                >
                  <X className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  size="icon"
                  className={cn(
                    "h-10 w-10 rounded-full transition-all duration-300",
                    input.trim() || attachments.length > 0
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-100"
                      : "bg-muted text-muted-foreground scale-95 opacity-50"
                  )}
                  data-testid="button-send"
                >
                  <Send className="h-5 w-5 ml-0.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}


