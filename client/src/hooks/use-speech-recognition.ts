/**
 * Web Speech API Hook for Streaming Speech-to-Text
 * 
 * Provides real-time speech recognition with interim results for
 * cognitive endpointing and natural conversation flow.
 */

import { useRef, useCallback, useEffect, useState } from 'react';

interface SpeechRecognitionConfig {
  /** Language for recognition (e.g., 'en-US') */
  language?: string;
  /** Whether to return interim results */
  interimResults?: boolean;
  /** Whether to keep listening after each result */
  continuous?: boolean;
  /** Maximum number of alternatives per result */
  maxAlternatives?: number;
}

interface SpeechRecognitionResult {
  /** Whether this is a final (vs interim) result */
  isFinal: boolean;
  /** The recognized text */
  transcript: string;
  /** Confidence score (0-1) */
  confidence: number;
}

interface UseSpeechRecognitionReturn {
  /** Whether recognition is currently active */
  isListening: boolean;
  /** Current interim or final transcript */
  transcript: string;
  /** Whether the last result was final */
  isFinal: boolean;
  /** Start listening */
  start: () => void;
  /** Stop listening */
  stop: () => void;
  /** Whether the browser supports speech recognition */
  isSupported: boolean;
  /** Any error that occurred */
  error: string | null;
}

// Type definitions for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export function useSpeechRecognition(
  onResult?: (result: SpeechRecognitionResult) => void,
  onEnd?: () => void,
  config: SpeechRecognitionConfig = {}
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isManualStopRef = useRef(false);

  // Check browser support
  const SpeechRecognition = 
    typeof window !== 'undefined' && 
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  
  const isSupported = !!SpeechRecognition;

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }

    const recognition = new SpeechRecognition();
    
    recognition.lang = config.language || 'en-US';
    recognition.interimResults = config.interimResults ?? true;
    recognition.continuous = config.continuous ?? true;
    recognition.maxAlternatives = config.maxAlternatives || 1;

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Started');
      setIsListening(true);
      setError(null);
      isManualStopRef.current = false;
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      const alternative = lastResult[0];
      
      const result: SpeechRecognitionResult = {
        isFinal: lastResult.isFinal,
        transcript: alternative.transcript,
        confidence: alternative.confidence || 0,
      };

      setTranscript(result.transcript);
      setIsFinal(result.isFinal);
      
      onResult?.(result);
    };

    recognition.onerror = (event: any) => {
      console.error('[SpeechRecognition] Error:', event.error);
      
      // Ignore 'no-speech' errors as they're expected during silence
      if (event.error !== 'no-speech') {
        setError(`Speech recognition error: ${event.error}`);
      }
      
      // Stop on certain error types
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      console.log('[SpeechRecognition] Ended');
      setIsListening(false);
      
      // Restart automatically if not manually stopped and continuous mode
      if (!isManualStopRef.current && config.continuous) {
        try {
          recognition.start();
        } catch (e) {
          console.error('[SpeechRecognition] Failed to restart:', e);
        }
      } else {
        onEnd?.();
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {
      console.error('[SpeechRecognition] Failed to start:', e);
      setError('Failed to start speech recognition');
    }
  }, [isSupported, config, onResult, onEnd]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      isManualStopRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('[SpeechRecognition] Failed to stop:', e);
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
    setIsFinal(false);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        isManualStopRef.current = true;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    isFinal,
    start,
    stop,
    isSupported,
    error,
  };
}
