/**
 * Voice Showcase — Investor Demo
 * Google Chirp3-HD voices
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, Play, Square } from "lucide-react";
import { Link } from "wouter";

// ─── Voice definitions ────────────────────────────────────────────────────────

interface ShowcaseVoice {
  id: string;
  name: string;
  gender: "F" | "M";
  label: string;
  color: string;
  demo: string;
}

const VOICES: ShowcaseVoice[] = [
  {
    id: "Kore",
    name: "Kore",
    gender: "F",
    label: "Warm · Professional",
    color: "#a78bfa",
    demo: "Welcome to Meowstik. We've been looking forward to showing you what's possible.",
  },
  {
    id: "Leda",
    name: "Leda",
    gender: "F",
    label: "Soft · Intimate",
    color: "#f472b6",
    demo: "(whispering) You know what the others don't? The real magic is what happens when no one's watching.",
  },
  {
    id: "Aoede",
    name: "Aoede",
    gender: "F",
    label: "Bright · Playful",
    color: "#fb923c",
    demo: "Oh! [giggles softly] Sorry — I just get so excited when I get to show off. Okay. Watch this.",
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    gender: "F",
    label: "Strong · Confident",
    color: "#ef4444",
    demo: "Meowstik doesn't ask for permission. It identifies the problem, solves it, and moves on.",
  },
  {
    id: "Sulafat",
    name: "Sulafat",
    gender: "F",
    label: "Mature · Authoritative",
    color: "#14b8a6",
    demo: "In ten years, every competitive advantage will be measured in how intelligently you operate. The question is whether you start now.",
  },
  {
    id: "Puck",
    name: "Puck",
    gender: "M",
    label: "Smooth · Reassuring",
    color: "#38bdf8",
    demo: "Whatever's been keeping you up at night? That's exactly what we built this for. You can sleep now.",
  },
  {
    id: "Charon",
    name: "Charon",
    gender: "M",
    label: "Deep · Cinematic",
    color: "#818cf8",
    demo: "The future doesn't wait. It doesn't ask if you're ready. Meowstik doesn't either.",
  },
  {
    id: "Orus",
    name: "Orus",
    gender: "M",
    label: "Commanding · Deep",
    color: "#22c55e",
    demo: "Three seconds. That's all it takes for Meowstik to understand your entire operation.",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    gender: "M",
    label: "Casual · Direct",
    color: "#eab308",
    demo: "Look — I'll be straight with you. This thing is going to change how you work. Full stop.",
  },
];

// ─── Waveform component ───────────────────────────────────────────────────────

function Waveform({ active, color }: { active: boolean; color: string }) {
  const bars = [0.4, 0.7, 1.0, 0.6, 0.85, 0.5, 0.9, 0.65, 0.75, 0.45];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 28 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: active ? color : "#374151",
            height: active ? `${Math.round(h * 100)}%` : "25%",
            transition: "height 0.15s ease",
            animation: active ? `wave-${i % 3} 0.8s ease-in-out infinite` : "none",
            animationDelay: active ? `${i * 0.08}s` : "0s",
          }}
        />
      ))}
      <style>{`
        @keyframes wave-0 { 0%,100%{height:25%} 50%{height:90%} }
        @keyframes wave-1 { 0%,100%{height:40%} 50%{height:70%} }
        @keyframes wave-2 { 0%,100%{height:60%} 50%{height:95%} }
      `}</style>
    </div>
  );
}

// ─── Voice card ───────────────────────────────────────────────────────────────

interface VoiceCardProps {
  voice: ShowcaseVoice;
  isPlaying: boolean;
  isLoading: boolean;
  isHighlighted: boolean;
  onPlay: (voiceId: string) => void;
  onStop: () => void;
}

function VoiceCard({ voice, isPlaying, isLoading, isHighlighted, onPlay, onStop }: VoiceCardProps) {
  return (
    <div
      style={{
        background: isHighlighted ? `${voice.color}18` : "#111827",
        border: `1px solid ${isHighlighted ? voice.color : "#1f2937"}`,
        borderRadius: 12,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "all 0.2s ease",
        boxShadow: isHighlighted ? `0 0 20px ${voice.color}30` : "none",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb" }}>{voice.name}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.05em",
                padding: "2px 7px",
                borderRadius: 20,
                background: `${voice.color}25`,
                color: voice.color,
              }}
            >
              {voice.gender === "F" ? "FEMALE" : "MALE"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{voice.label}</div>
        </div>
        <Waveform active={isPlaying} color={voice.color} />
      </div>

      {/* Demo text */}
      <p
        style={{
          fontSize: 13,
          color: isHighlighted ? "#d1d5db" : "#9ca3af",
          lineHeight: 1.6,
          fontStyle: "italic",
          margin: 0,
          flexGrow: 1,
        }}
      >
        "{voice.demo}"
      </p>

      {/* Play button */}
      <button
        onClick={isPlaying ? onStop : () => onPlay(voice.id)}
        disabled={isLoading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          padding: "8px 16px",
          borderRadius: 8,
          border: "none",
          cursor: isLoading ? "wait" : "pointer",
          fontWeight: 600,
          fontSize: 13,
          background: isPlaying ? `${voice.color}30` : isHighlighted ? `${voice.color}20` : "#1f2937",
          color: isHighlighted ? voice.color : "#9ca3af",
          transition: "all 0.2s",
          width: "100%",
        }}
      >
        {isLoading ? (
          <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
        ) : isPlaying ? (
          <Square size={14} />
        ) : (
          <Play size={14} />
        )}
        {isLoading ? "Generating…" : isPlaying ? "Stop" : "Play"}
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VoiceLabPage() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showcaseRunning, setShowcaseRunning] = useState(false);
  const [showcaseIdx, setShowcaseIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const showcaseRef = useRef(false);

  const stopCurrent = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
    setLoadingId(null);
  }, []);

  const playVoice = useCallback(async (voiceId: string): Promise<boolean> => {
    stopCurrent();
    const voice = VOICES.find(v => v.id === voiceId)!;
    setLoadingId(voiceId);

    try {
      const res = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voice.demo, voice: voiceId }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const data = await res.json();
      if (!data.audioBase64) throw new Error("No audio");

      const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
      audioRef.current = audio;
      setLoadingId(null);
      setPlayingId(voiceId);

      return new Promise<boolean>(resolve => {
        audio.onended = () => { setPlayingId(null); resolve(true); };
        audio.onerror = () => { setPlayingId(null); resolve(false); };
        audio.play().catch(() => { setPlayingId(null); resolve(false); });
      });
    } catch {
      setLoadingId(null);
      setPlayingId(null);
      return false;
    }
  }, [stopCurrent]);

  // Showcase: play all voices in sequence
  const runShowcase = useCallback(async () => {
    showcaseRef.current = true;
    setShowcaseRunning(true);
    setShowcaseIdx(0);

    for (let i = 0; i < VOICES.length; i++) {
      if (!showcaseRef.current) break;
      setShowcaseIdx(i);
      await playVoice(VOICES[i].id);
      if (!showcaseRef.current) break;
      await new Promise(r => setTimeout(r, 600)); // pause between voices
    }

    showcaseRef.current = false;
    setShowcaseRunning(false);
    setPlayingId(null);
  }, [playVoice]);

  const stopShowcase = useCallback(() => {
    showcaseRef.current = false;
    setShowcaseRunning(false);
    stopCurrent();
  }, [stopCurrent]);

  // Cleanup on unmount
  useEffect(() => () => { showcaseRef.current = false; audioRef.current?.pause(); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#030712", color: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #111827", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/">
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={18} />
          </button>
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>Voice Showcase</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Google Chirp3-HD · {VOICES.length} voices · HD quality</div>
        </div>
        <button
          onClick={showcaseRunning ? stopShowcase : runShowcase}
          disabled={!!(loadingId)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            background: showcaseRunning ? "#7f1d1d" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
            color: "#fff",
          }}
        >
          {showcaseRunning ? (
            <><Square size={14} /> Stop Showcase</>
          ) : (
            <><ChevronRight size={14} /> Play Full Showcase</>
          )}
        </button>
      </div>

      {/* Showcase progress bar */}
      {showcaseRunning && (
        <div style={{ background: "#111827", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#9ca3af" }}>
          <div style={{ flex: 1, height: 3, background: "#1f2937", borderRadius: 2 }}>
            <div style={{ height: "100%", background: "#7c3aed", borderRadius: 2, width: `${((showcaseIdx + 1) / VOICES.length) * 100}%`, transition: "width 0.4s" }} />
          </div>
          <span style={{ color: VOICES[showcaseIdx]?.color }}>{VOICES[showcaseIdx]?.name}</span>
          <span style={{ color: "#4b5563" }}>{showcaseIdx + 1} / {VOICES.length}</span>
        </div>
      )}

      {/* Grid */}
      <div style={{ padding: "32px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, maxWidth: 1200, margin: "0 auto" }}>
        {VOICES.map((voice, i) => (
          <VoiceCard
            key={voice.id}
            voice={voice}
            isPlaying={playingId === voice.id}
            isLoading={loadingId === voice.id}
            isHighlighted={playingId === voice.id || (showcaseRunning && showcaseIdx === i)}
            onPlay={playVoice}
            onStop={stopCurrent}
          />
        ))}
      </div>

      {/* Footer note */}
      <div style={{ textAlign: "center", padding: "24px", fontSize: 12, color: "#374151" }}>
        Voices powered by Google Chirp3-HD
      </div>
    </div>
  );
}
