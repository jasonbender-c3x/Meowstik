
/**
 * Voice Activity Detection (VAD) Hook
 * 
 * Detects when the user is speaking vs. silent using audio volume analysis.
 * This enables automatic microphone activation and natural conversation flow.
 */

import { useRef, useCallback, useEffect, useState } from 'react';

interface VADConfig {
  /** Minimum audio volume to consider as speech (0-1 scale) */
  threshold: number;
  /** Milliseconds of silence before considering speech ended */
  silenceDuration: number;
  /** Milliseconds of speech before considering it started */
  speechDuration: number;
  /** Sample rate for audio processing */
  sampleRate: number;
}

interface VADResult {
  /** Whether voice activity is currently detected */
  isSpeaking: boolean;
  /** Current audio volume level (0-1) */
  volume: number;
  /** Start voice activity detection */
  start: (input?: VADStartInput) => Promise<void>;
  /** Stop voice activity detection */
  stop: () => void;
  /** Update VAD configuration */
  updateConfig: (config: Partial<VADConfig>) => void;
}

const DEFAULT_CONFIG: VADConfig = {
  threshold: 0.015,       // Minimum volume to detect speech
  silenceDuration: 1000,  // 1 second of silence to end speech
  speechDuration: 300,    // 300ms of speech to start
  sampleRate: 16000,      // 16kHz audio
};

type OnVolumeChangeArg = ((volume: number) => void) | Partial<VADConfig> | undefined;
type VADStartInput =
  | MediaStream
  | {
      stream?: MediaStream;
      sourceNode?: MediaStreamAudioSourceNode;
      audioContext?: AudioContext;
    }
  | undefined;

function isVADConfig(value: OnVolumeChangeArg): value is Partial<VADConfig> {
  return typeof value === "object" && value !== null;
}

export function normalizeVoiceActivityDetectionArgs(
  onVolumeChange: OnVolumeChangeArg,
  initialConfig: Partial<VADConfig> = {},
) {
  if (typeof onVolumeChange === "function") {
    return {
      onVolumeChange,
      initialConfig,
    };
  }

  return {
    onVolumeChange: undefined,
    initialConfig: isVADConfig(onVolumeChange) ? { ...initialConfig, ...onVolumeChange } : initialConfig,
  };
}

function normalizeVADStartInput(input: VADStartInput) {
  if (input instanceof MediaStream) {
    return { stream: input };
  }

  return input ?? {};
}

export function useVoiceActivityDetection(
  onSpeechStart?: () => void,
  onSpeechEnd?: () => void,
  onVolumeChange?: OnVolumeChangeArg,
  initialConfig: Partial<VADConfig> = {}
): VADResult {
  const normalizedArgs = normalizeVoiceActivityDetectionArgs(onVolumeChange, initialConfig);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [config, setConfig] = useState<VADConfig>({ ...DEFAULT_CONFIG, ...normalizedArgs.initialConfig });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(false);
  const ownsAudioContextRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef(false);
  const volumeThresholdCountRef = useRef(0);

  const updateConfig = useCallback((newConfig: Partial<VADConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const detectVoiceActivity = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const checkVolume = () => {
      if (!analyserRef.current) return;

      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square) volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      setVolume(rms);
      normalizedArgs.onVolumeChange?.(rms);

      // Check if volume exceeds threshold
      const isLoudEnough = rms > config.threshold;

      if (isLoudEnough) {
        volumeThresholdCountRef.current++;

        // Start speech after sustained volume
        if (!isSpeakingRef.current && volumeThresholdCountRef.current * 20 >= config.speechDuration) {
          if (speechTimerRef.current) {
            clearTimeout(speechTimerRef.current);
            speechTimerRef.current = null;
          }

          isSpeakingRef.current = true;
          setIsSpeaking(true);
          onSpeechStart?.();
        }

        // Reset silence timer while speaking
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else {
        volumeThresholdCountRef.current = 0;

        // Start silence timer if currently speaking
        if (isSpeakingRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            onSpeechEnd?.();
            silenceTimerRef.current = null;
          }, config.silenceDuration);
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }, [config, normalizedArgs.onVolumeChange, onSpeechStart, onSpeechEnd]);

  const start = useCallback(async (input?: VADStartInput) => {
    try {
      const { stream, sourceNode, audioContext } = normalizeVADStartInput(input);
      const activeStream =
        stream ??
        (await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: config.sampleRate,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }));

      streamRef.current = activeStream;
      ownsStreamRef.current = !stream;
      audioContextRef.current =
        audioContext ?? new AudioContext({ sampleRate: config.sampleRate });
      ownsAudioContextRef.current = !audioContext;

      const source =
        sourceNode ?? audioContextRef.current.createMediaStreamSource(activeStream);
      const analyser = audioContextRef.current.createAnalyser();
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      analyserRef.current = analyser;
      
      detectVoiceActivity();
    } catch (error) {
      console.error('[VAD] Failed to start:', error);
      throw error;
    }
  }, [config.sampleRate, detectVoiceActivity]);

  const stop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }

    if (streamRef.current) {
      if (ownsStreamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      streamRef.current = null;
    }
    ownsStreamRef.current = false;

    if (audioContextRef.current) {
      if (ownsAudioContextRef.current) {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    ownsAudioContextRef.current = false;

    analyserRef.current = null;
    isSpeakingRef.current = false;
    volumeThresholdCountRef.current = 0;
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isSpeaking,
    volume,
    start,
    stop,
    updateConfig,
  };
}
