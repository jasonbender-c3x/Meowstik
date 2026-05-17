import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Mic, MicOff, Phone, PhoneOff, Radio, Volume2, VolumeX, Waves, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useVoiceActivityDetection } from "@/hooks/use-voice-activity-detection";
import { getMicrophoneErrorMessage } from "@/lib/microphone-errors";
import { getLiveModeSettings, type LiveModeSettings } from "@/lib/live-mode-settings";
import { cn } from "@/lib/utils";

interface LiveModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "dialog" | "embedded";
  className?: string;
  autoConnectOnOpen?: boolean;
}

interface TranscriptEntry {
  id: string;
  speaker: "user" | "ai";
  text: string;
  timestamp: Date;
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (value) =>
    (+value ^ (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (+value / 4)).toString(16),
  );
}

export function LiveModeDialog({
  open,
  onOpenChange,
  variant = "dialog",
  className,
  autoConnectOnOpen = true,
}: LiveModeDialogProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [liveSettings, setLiveSettings] = useState<LiveModeSettings>(() => getLiveModeSettings());
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState("");
  const [userInterimTranscript, setUserInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const speechRecognitionRef = useRef<ReturnType<typeof useSpeechRecognition> | null>(null);
  const connectionStateRef = useRef<ConnectionState>("disconnected");
  const startListeningRef = useRef<(() => Promise<void>) | null>(null);
  const disconnectRef = useRef<(() => Promise<void>) | null>(null);
  const autoConnectAttemptedRef = useRef(false);

  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLiveSettings(getLiveModeSettings());
  }, [open]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, userInterimTranscript, interimText, isSpeaking]);

  const addTranscriptEntry = useCallback((speaker: "user" | "ai", text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return;
    }

    setTranscript((previous) => [
      ...previous,
      {
        id: generateUUID(),
        speaker,
        text: trimmedText,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleBargeIn = useCallback(() => {
    audioQueueRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Ignore stop errors for sources that have already drained.
      }
    });
    audioQueueRef.current = [];

    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "interrupt" }));
    }

    setIsSpeaking(false);
    setInterimText("");
  }, []);

  const speechRecognition = useSpeechRecognition(
    useCallback(
      (result: { isFinal: boolean; transcript: string }) => {
        const transcriptText = result.transcript.trim();
        if (!transcriptText) {
          return;
        }

        if (result.isFinal) {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "text",
                text: transcriptText,
              }),
            );
          }

          addTranscriptEntry("user", transcriptText);
          setUserInterimTranscript("");
        } else {
          setUserInterimTranscript(transcriptText);
        }
      },
      [addTranscriptEntry],
    ),
    useCallback(() => {
      setUserInterimTranscript("");
    }, []),
    { continuous: true, interimResults: true },
  );

  useEffect(() => {
    speechRecognitionRef.current = speechRecognition;
  }, [speechRecognition]);

  const vad = useVoiceActivityDetection(
    useCallback(() => {
      if (liveSettings.liveModeContinuousListening && isSpeaking) {
        handleBargeIn();
      }

      setUserInterimTranscript("");

      if (
        liveSettings.liveModeContinuousListening &&
        liveSettings.liveModeSTTEnabled &&
        speechRecognitionRef.current &&
        !speechRecognitionRef.current.isListening
      ) {
        speechRecognitionRef.current.start();
      }
    }, [handleBargeIn, isSpeaking, liveSettings.liveModeContinuousListening, liveSettings.liveModeSTTEnabled]),
    useCallback(() => {
      if (speechRecognitionRef.current?.isListening) {
        speechRecognitionRef.current.stop();
      }

      setUserInterimTranscript("");
    }, []),
    undefined,
    {
      threshold: liveSettings.liveModeVADSensitivity,
      silenceDuration: liveSettings.liveModeVadSilenceDurationMs,
      speechDuration: liveSettings.liveModeVadSpeechDurationMs,
    },
  );

  useEffect(() => {
    vad.updateConfig({
      threshold: liveSettings.liveModeVADSensitivity,
      silenceDuration: liveSettings.liveModeVadSilenceDurationMs,
      speechDuration: liveSettings.liveModeVadSpeechDurationMs,
    });
  }, [
    liveSettings.liveModeVADSensitivity,
    liveSettings.liveModeVadSilenceDurationMs,
    liveSettings.liveModeVadSpeechDurationMs,
    vad,
  ]);

  const playAudioChunk = useCallback(
    async (base64Data: string) => {
      if (isMuted) {
        return;
      }

      try {
        if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
          playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
          nextStartTimeRef.current = playbackContextRef.current.currentTime + 0.1;
        }

        if (playbackContextRef.current.state === "suspended") {
          await playbackContextRef.current.resume();
        }

        const audioContext = playbackContextRef.current;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let index = 0; index < binaryString.length; index++) {
          bytes[index] = binaryString.charCodeAt(index);
        }

        const audioBuffer = audioContext.createBuffer(1, bytes.length / 2, 24000);
        const channelData = audioBuffer.getChannelData(0);
        const int16Array = new Int16Array(bytes.buffer);

        for (let index = 0; index < int16Array.length; index++) {
          channelData[index] = int16Array[index] / 32768;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        if (nextStartTimeRef.current < audioContext.currentTime) {
          nextStartTimeRef.current = audioContext.currentTime + 0.05;
        }

        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;

        source.onended = () => {
          const sourceIndex = audioQueueRef.current.indexOf(source);
          if (sourceIndex >= 0) {
            audioQueueRef.current.splice(sourceIndex, 1);
          }
        };

        audioQueueRef.current.push(source);

        if (speakingTimeoutRef.current) {
          clearTimeout(speakingTimeoutRef.current);
        }

        speakingTimeoutRef.current = setTimeout(() => {
          setIsSpeaking(false);
        }, 500);
      } catch (playbackError) {
        console.error("[LiveMode] Failed to play audio:", playbackError);
      }
    },
    [isMuted],
  );

  const stopListening = useCallback(() => {
    vad.stop();

    if (speechRecognitionRef.current?.isListening) {
      speechRecognitionRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    workletNodeRef.current = null;
    setIsListening(false);
    setUserInterimTranscript("");
  }, [vad]);

  const disconnect = useCallback(async () => {
    stopListening();

    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }

    audioQueueRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Ignore stop errors for sources that have already drained.
      }
    });
    audioQueueRef.current = [];

    if (playbackContextRef.current) {
      try {
        await playbackContextRef.current.close();
      } catch {
        // Ignore close errors during teardown.
      }
      playbackContextRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (sessionIdRef.current) {
      try {
        await fetch(`/api/live/session/${sessionIdRef.current}`, {
          method: "DELETE",
        });
      } catch (closeError) {
        console.error("[LiveMode] Failed to close live session:", closeError);
      }
      sessionIdRef.current = null;
    }

    setConnectionState("disconnected");
    setIsListening(false);
    setIsSpeaking(false);
    setInterimText("");
    setUserInterimTranscript("");
  }, [stopListening]);

  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  useEffect(() => {
    if (!open) {
      autoConnectAttemptedRef.current = false;
      void disconnectRef.current?.();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      void disconnectRef.current?.();
    };
  }, []);

  const startListening = useCallback(async () => {
    if (connectionStateRef.current !== "connected" || isListening) {
      return;
    }

    const mediaDevicesAvailable =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    const secureContext =
      typeof window === "undefined" ? true : window.isSecureContext;

    if (!mediaDevicesAvailable) {
      setError(
        getMicrophoneErrorMessage(null, {
          hasMediaDevices: false,
          isSecureContext: secureContext,
        }),
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (microphoneError) {
      console.error("[LiveMode] Failed to acquire microphone:", microphoneError);
      setError(
        getMicrophoneErrorMessage(microphoneError, {
          hasMediaDevices: mediaDevicesAvailable,
          isSecureContext: secureContext,
        }),
      );
      return;
    }

    streamRef.current = stream;

    try {
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      await audioContextRef.current.audioWorklet.addModule("/audio-processor.js");

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContextRef.current, "audio-processor");
      const silentOutput = audioContextRef.current.createGain();
      silentOutput.gain.value = 0;
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          return;
        }

        if (!liveSettings.liveModeContinuousListening || vad.isSpeaking) {
          const pcmBuffer = event.data;
          const uint8Array = new Uint8Array(pcmBuffer);
          let binaryString = "";
          const chunkSize = 0x8000;

          for (let index = 0; index < uint8Array.byteLength; index += chunkSize) {
            binaryString += String.fromCharCode.apply(
              null,
              uint8Array.subarray(index, Math.min(index + chunkSize, uint8Array.byteLength)) as unknown as number[],
            );
          }

          wsRef.current.send(
            JSON.stringify({
              type: "audio",
              data: btoa(binaryString),
              mimeType: "audio/pcm",
            }),
          );
        }
      };

      source.connect(workletNode);
      workletNode.connect(silentOutput);
      silentOutput.connect(audioContextRef.current.destination);

      if (liveSettings.liveModeContinuousListening) {
        await vad.start({
          stream,
          sourceNode: source,
          audioContext: audioContextRef.current,
        });
      }

      setError(null);
      setIsListening(true);
    } catch (startError) {
      console.error("[LiveMode] Failed to start listening:", startError);
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setError(startError instanceof Error ? startError.message : "Could not start live audio.");
    }
  }, [isListening, liveSettings.liveModeContinuousListening, vad]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const connect = useCallback(async () => {
    if (connectionStateRef.current === "connecting" || connectionStateRef.current === "connected") {
      return;
    }

    setConnectionState("connecting");
    setError(null);
    setTranscript([]);
    setInterimText("");
    setUserInterimTranscript("");

    try {
      if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      if (playbackContextRef.current.state === "suspended") {
        await playbackContextRef.current.resume();
      }

      const sessionId = generateUUID();
      sessionIdRef.current = sessionId;

      const response = await fetch("/api/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          voiceName: liveSettings.ttsVoice,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create live session");
      }

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/live/stream/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState("connected");
        connectionStateRef.current = "connected";

        if (liveSettings.liveModeContinuousListening) {
          window.setTimeout(() => {
            void startListeningRef.current?.();
          }, 100);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "audio" && message.data) {
            setIsSpeaking(true);
            void playAudioChunk(message.data);
          } else if (message.type === "transcript" && message.text) {
            addTranscriptEntry("ai", message.text);
            setInterimText("");
          } else if (message.type === "text" && message.text) {
            setInterimText(message.text);
          } else if (message.type === "end") {
            setIsSpeaking(false);
            setInterimText("");
          } else if (message.type === "error") {
            setError(message.error || "Connection error");
          }
        } catch (messageError) {
          console.error("[LiveMode] Failed to parse message:", messageError);
        }
      };

      ws.onerror = () => {
        setError("Connection error");
        setConnectionState("error");
        connectionStateRef.current = "error";
      };

      ws.onclose = () => {
        if (connectionStateRef.current === "connected" || connectionStateRef.current === "connecting") {
          setConnectionState("disconnected");
          connectionStateRef.current = "disconnected";
        }
      };
    } catch (connectError) {
      console.error("[LiveMode] Failed to connect:", connectError);
      setError(connectError instanceof Error ? connectError.message : "Failed to connect");
      setConnectionState("error");
      connectionStateRef.current = "error";
    }
  }, [addTranscriptEntry, liveSettings.liveModeContinuousListening, liveSettings.ttsVoice, playAudioChunk]);

  useEffect(() => {
    if (!open || !autoConnectOnOpen) {
      return;
    }

    if (connectionState === "connected" || connectionState === "connecting" || autoConnectAttemptedRef.current) {
      return;
    }

    autoConnectAttemptedRef.current = true;
    void connect();
  }, [autoConnectOnOpen, connect, connectionState, open]);

  const content = (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
              <Radio className="h-5 w-5 text-primary" />
              Live Mode
            </h2>
            <p className="text-sm text-muted-foreground">
              Real-time voice chat from the main composer. Voice and barge-in tuning come from Settings.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Voice: {liveSettings.ttsVoice}</span>
              <span>&middot;</span>
              <span>{liveSettings.liveModeContinuousListening ? "Continuous listening" : "Push to talk"}</span>
              <span>&middot;</span>
              <span>Barge-in threshold {liveSettings.liveModeVADSensitivity.toFixed(3)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                connectionState === "connected"
                  ? "default"
                  : connectionState === "connecting"
                    ? "secondary"
                    : connectionState === "error"
                      ? "destructive"
                      : "outline"
              }
            >
              {connectionState === "connected" ? (
                <span className="mr-1.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              ) : null}
              {connectionState}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted((value) => !value)}
              title={isMuted ? "Unmute live audio" : "Mute live audio"}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              title={variant === "embedded" ? "Hide Live Mode" : "Close Live Mode"}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}

        {!speechRecognition.isSupported && liveSettings.liveModeSTTEnabled ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Browser speech recognition is unavailable here, so live mode will fall back to audio-only turn detection.
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-muted/20">
          <div className="border-b px-4 py-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Waves className="h-4 w-4" />
              Conversation
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {connectionState === "disconnected"
                ? "Connect to start a live conversation."
                : connectionState === "connecting"
                  ? "Connecting to Meowstik..."
                  : liveSettings.liveModeContinuousListening
                    ? vad.isSpeaking
                      ? "Listening to you..."
                      : isListening
                        ? "Waiting for you to speak..."
                        : "Ready"
                    : isListening
                      ? "Listening..."
                      : "Press the mic button to speak."}
            </p>
          </div>

          <div ref={transcriptRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {transcript.length === 0 && !userInterimTranscript && !interimText ? (
              <div className="flex h-full min-h-[260px] items-center justify-center text-center text-muted-foreground">
                <div>
                  <Radio className="mx-auto mb-4 h-10 w-10 opacity-20" />
                  <p>Your live conversation will appear here.</p>
                  <p className="mt-1 text-sm">
                    {connectionState === "connecting" ? "Connecting automatically..." : "Reconnecting will start the session again."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn("flex", entry.speaker === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2",
                        entry.speaker === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <p className="text-sm">{entry.text}</p>
                      <span className="mt-1 block text-xs opacity-60">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}

                {userInterimTranscript ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl border border-primary/50 bg-primary/20 px-4 py-2">
                      <p className="text-sm italic">{userInterimTranscript}</p>
                      <span className="mt-1 block text-xs opacity-60">Speaking...</span>
                    </div>
                  </div>
                ) : null}

                {interimText ? (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl border border-dashed bg-muted/50 px-4 py-2">
                      <p className="text-sm italic text-muted-foreground">{interimText}</p>
                    </div>
                  </div>
                ) : null}

                {isSpeaking ? (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-sm text-muted-foreground">Speaking...</span>
                      {liveSettings.liveModeContinuousListening ? (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleBargeIn}>
                          Interrupt
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 py-2">
          {connectionState === "disconnected" || connectionState === "error" ? (
              <Button size="lg" className="h-16 w-16 rounded-full" onClick={connect}>
                <Phone className="h-6 w-6" />
              </Button>
          ) : connectionState === "connecting" ? (
            <Button size="lg" className="h-16 w-16 rounded-full" disabled>
              <Loader2 className="h-6 w-6 animate-spin" />
            </Button>
          ) : (
            <div className="flex items-center gap-4">
              {!liveSettings.liveModeContinuousListening ? (
                <Button
                  size="lg"
                  variant={isListening ? "default" : "outline"}
                  className={cn(
                    "h-16 w-16 rounded-full transition-all",
                    isListening && "animate-pulse ring-4 ring-primary/30",
                    vad.isSpeaking && "ring-4 ring-green-500/30",
                  )}
                  onClick={isListening ? stopListening : () => void startListening()}
                >
                  {isListening ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                </Button>
              ) : null}

              <Button size="lg" variant="destructive" className="h-16 w-16 rounded-full" onClick={() => void disconnect()}>
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {connectionState === "connected" && liveSettings.liveModeContinuousListening
              ? "Speak naturally and Meowstik will barge in when you do."
              : connectionState === "connected" && isListening
                ? "Speak now. Audio is streaming live."
                : connectionState === "connected"
                  ? "Tap the microphone when you want to talk."
                  : "Live mode connects automatically when opened. Use the call button only to retry."}
          </p>
        </div>
      </div>
    </div>
  );

  if (variant === "embedded") {
    if (!open) {
      return null;
    }

    return (
      <div className={cn("h-[70vh] max-h-[720px] overflow-hidden rounded-2xl border bg-background shadow-sm", className)}>
        {content}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-4xl h-[85vh] overflow-hidden p-0", className)}>
        {content}
      </DialogContent>
    </Dialog>
  );
}
