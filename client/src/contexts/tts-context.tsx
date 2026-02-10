/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     TTS-CONTEXT.TSX - TEXT-TO-SPEECH CONTEXT                  ║
 * ║                                                                               ║
 * ║  Provides app-wide text-to-speech functionality with:                         ║
 * ║    - Verbosity mode (mute/quiet/verbose/experimental)                         ║
 * ║    - Speak function using Google Gemini TTS                                   ║
 * ║    - Persistent verbosity preference in localStorage                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

/**
 * Verbosity Modes:
 * - mute: Silent - no speech or chat output except critical alerts
 * - low: Concise responses - both text and speech kept brief, only essential information
 * - normal: Verbose responses - comprehensive text and speech, detailed explanations (default)
 * - experimental: Dual-voice discussion - model generates two-voice dialogue until user interrupts
 */
export type VerbosityMode = "mute" | "low" | "normal" | "experimental";

interface TTSContextValue {
  verbosityMode: VerbosityMode;
  setVerbosityMode: (mode: VerbosityMode) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  isUsingBrowserTTS: boolean;
  shouldPlayHDAudio: () => boolean;
  shouldPlayBrowserTTS: () => boolean;
  unlockAudio: () => Promise<void>;
  isAudioUnlocked: boolean;
  playTestTone: () => Promise<boolean>;
  registerHDAudio: (audio: HTMLAudioElement | null) => void;
  playAudioBase64: (base64: string, mimeType?: string) => Promise<boolean>;
}

const TTSContext = createContext<TTSContextValue | undefined>(undefined);

const TTS_STORAGE_KEY = "meowstic-tts-muted";
const VERBOSITY_STORAGE_KEY = "meowstik-verbosity-mode";

export function TTSProvider({ children }: { children: ReactNode }) {
  const [verbosityMode, setVerbosityModeState] = useState<VerbosityMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(VERBOSITY_STORAGE_KEY);
      // Map old values to new ones for backwards compatibility
      if (saved === "quiet") return "low";
      if (saved === "verbose") return "normal";
      if (saved === "high") return "normal";
      if (saved === "demo-hd") return "normal";
      if (saved === "podcast") return "experimental";
      if (saved && ["mute", "low", "normal", "experimental"].includes(saved)) {
        return saved as VerbosityMode;
      }
    }
    return "normal"; // Default: verbose text and speech
  });
  
  const [isMuted, setIsMutedState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TTS_STORAGE_KEY);
      return saved === "true";
    }
    return false;
  });
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUsingBrowserTTS, setIsUsingBrowserTTS] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  const isSupported = true;

  const getOrCreateAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      return audioContextRef.current;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    audioContextRef.current = ctx;
    console.log("[TTS] AudioContext created, state:", ctx.state);
    return ctx;
  }, []);

  const unlockAudio = useCallback(async () => {
    if (isAudioUnlocked) return;
    
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
        console.log("[TTS] AudioContext resumed, state:", ctx.state);
      }
      
      setIsAudioUnlocked(true);
      console.log("[TTS] Audio unlocked successfully");
    } catch (err) {
      console.warn("[TTS] Failed to unlock audio:", err);
    }
  }, [isAudioUnlocked, getOrCreateAudioContext]);

  const playAudioBase64 = useCallback(async (base64: string, mimeType?: string): Promise<boolean> => {
    try {
      const ctx = getOrCreateAudioContext();
      if (!ctx) {
        console.warn("[TTS] No AudioContext available");
        return false;
      }
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch {}
      }
      if (ctx.state !== 'running') {
        console.warn("[TTS] AudioContext not running, state:", ctx.state);
        return false;
      }
      
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      
      if (activeSourceRef.current) {
        try { activeSourceRef.current.stop(); } catch {}
        activeSourceRef.current = null;
      }
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      activeSourceRef.current = source;
      
      setIsSpeaking(true);
      
      source.onended = () => {
        console.log("[TTS] AudioContext playback ended");
        activeSourceRef.current = null;
        setIsSpeaking(false);
      };
      
      source.start(0);
      console.log("[TTS] AudioContext playback started, duration:", audioBuffer.duration.toFixed(1) + "s");
      return true;
    } catch (err) {
      console.error("[TTS] AudioContext playback failed:", err);
      return false;
    }
  }, [getOrCreateAudioContext]);

  const playTestTone = useCallback(async (): Promise<boolean> => {
    try {
      await unlockAudio();
      
      const ctx = getOrCreateAudioContext();
      if (!ctx) {
        console.warn("[TTS] AudioContext not supported");
        return false;
      }
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 440;
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.stop(ctx.currentTime + 0.3);
      
      console.log("[TTS] Test tone played successfully");
      return true;
    } catch (err) {
      console.error("[TTS] Failed to play test tone:", err);
      return false;
    }
  }, [unlockAudio, getOrCreateAudioContext]);

  useEffect(() => {
    localStorage.setItem(TTS_STORAGE_KEY, String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem(VERBOSITY_STORAGE_KEY, verbosityMode);
  }, [verbosityMode]);

  // On mount: sync mute state with verbosity mode to clear any stale legacy mute flags
  useEffect(() => {
    if (verbosityMode !== "mute" && isMuted) {
      // User previously had mute enabled, but now using a non-mute mode
      // Clear the mute flag so audio can play
      setIsMutedState(false);
    } else if (verbosityMode === "mute" && !isMuted) {
      // Mute mode should always be muted
      setIsMutedState(true);
    }
  }, []); // Only run on mount

  // Register an external HD audio element so stopSpeaking can halt it
  const registerHDAudio = useCallback((audio: HTMLAudioElement | null) => {
    // Stop any previous audio first
    if (audioRef.current && audioRef.current !== audio) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    audioRef.current = audio;
    if (audio) {
      setIsSpeaking(true);
    } else {
      // Clear speaking state when audio is unregistered (ended/error)
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch {}
      activeSourceRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsUsingBrowserTTS(false);
  }, []);

  const setVerbosityMode = useCallback((mode: VerbosityMode) => {
    setVerbosityModeState(mode);
    
    // Sync mute state with verbosity mode:
    // - Mute mode = muted (no audio)
    // - All other modes = unmuted (audio allowed based on mode rules)
    if (mode === "mute") {
      setIsMutedState(true);
      // Stop any active speech when switching to mute
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      setIsUsingBrowserTTS(false);
    } else {
      // Clear the legacy mute flag for non-mute modes
      setIsMutedState(false);
    }
  }, []);

  // Helper: Should HD audio from "say" tool be played?
  // Play in all modes except mute
  const shouldPlayHDAudio = useCallback(() => {
    return !isMuted && verbosityMode !== "mute";
  }, [isMuted, verbosityMode]);

  // Helper: Should browser TTS speak the chat response?
  // In normal and experimental modes, all content is spoken
  const shouldPlayBrowserTTS = useCallback(() => {
    return !isMuted && (verbosityMode === "normal" || verbosityMode === "experimental");
  }, [isMuted, verbosityMode]);

  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    if (muted) {
      stopSpeaking();
    }
  }, [stopSpeaking]);

  const toggleMuted = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted, setIsMuted]);

  const speakWithBrowserTTS = useCallback((cleanText: string) => {
    if (!("speechSynthesis" in window)) {
      setIsSpeaking(false);
      setIsUsingBrowserTTS(false);
      return;
    }
    
    setIsUsingBrowserTTS(true);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = "en-US";
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsUsingBrowserTTS(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsUsingBrowserTTS(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text: string) => {
    console.log("[TTS Context] speak() called, isMuted:", isMuted, "verbosityMode:", verbosityMode);
    if (isMuted) {
      console.log("[TTS Context] Skipping - muted");
      return;
    }
    
    stopSpeaking();
    
    const cleanText = text
      .replace(/```\w*\n?/g, "")
      .replace(/```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[_~]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();
    
    if (!cleanText) {
      console.log("[TTS Context] No text to speak after cleaning");
      return;
    }
    
    console.log("[TTS Context] Speaking:", cleanText.substring(0, 50) + "...");
    speakWithBrowserTTS(cleanText);
  }, [isMuted, verbosityMode, stopSpeaking, speakWithBrowserTTS]);

  return (
    <TTSContext.Provider
      value={{
        verbosityMode,
        setVerbosityMode,
        isMuted,
        setIsMuted,
        toggleMuted,
        speak,
        stopSpeaking,
        isSpeaking,
        isSupported,
        isUsingBrowserTTS,
        shouldPlayHDAudio,
        shouldPlayBrowserTTS,
        unlockAudio,
        isAudioUnlocked,
        playTestTone,
        registerHDAudio,
        playAudioBase64
      }}
    >
      {children}
    </TTSContext.Provider>
  );
}

export function useTTS() {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error("useTTS must be used within a TTSProvider");
  }
  return context;
}
