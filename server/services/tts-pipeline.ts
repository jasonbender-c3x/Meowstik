/**
 * TTS Pipeline Service
 *
 * Pure utilities for sentence detection and buffer management, plus a per-request
 * stateful pipeline factory that drives speech generation over SSE.
 */

import type { Response } from "express";
import { parseVoiceStyle } from "./style-parser";

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export const TTS_COMMON_ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "u.s",
  "u.k",
]);

/**
 * Append a streaming chunk to the TTS buffer, inserting a space between tokens
 * only when neither the tail of the buffer nor the head of the chunk has
 * existing whitespace or punctuation that already provides separation.
 */
export function appendTtsChunk(buffer: string, chunk: string): string {
  if (!buffer) return chunk;
  if (!chunk) return buffer;

  if (/[\s([{'"-]$/.test(buffer) || /^[\s)\]}.,!?;:'"-]/.test(chunk)) {
    return buffer + chunk;
  }

  return `${buffer} ${chunk}`;
}

/**
 * Scan the buffer for complete sentences (terminated by . ! ? or a blank line)
 * and return them split from any incomplete trailing text.
 *
 * Handles:
 * - Common abbreviations (Mr. Mrs. Dr. …) — not treated as sentence ends
 * - Decimal numbers (3.14) — not treated as sentence ends
 * - Lowercase-starting next word after period — not a sentence end
 * - Closing quotes/brackets after punctuation
 * - Double-newline paragraph breaks
 */
export function extractTtsSentences(buffer: string): {
  sentences: string[];
  remainder: string;
} {
  const sentences: string[] = [];
  let start = 0;

  const flush = (end: number) => {
    const sentence = buffer.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
  };

  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];

    // Blank-line paragraph break
    if (char === "\n" && buffer[i + 1] === "\n") {
      flush(i);
      start = i + 2;
      i = start - 1;
      continue;
    }

    if (char !== "." && char !== "!" && char !== "?") continue;

    // Advance past closing quotes/brackets attached to the punctuation
    let boundaryEnd = i + 1;
    while (boundaryEnd < buffer.length && /["')\]]/.test(buffer[boundaryEnd])) {
      boundaryEnd++;
    }

    // Skip whitespace to find the first char of the next word
    let next = boundaryEnd;
    while (next < buffer.length && /[ \t]/.test(buffer[next])) {
      next++;
    }
    const nextChar = buffer[next] ?? "";

    // Keep decimal numbers intact (e.g. 3.14)
    if (char === "." && /\d/.test(buffer[i - 1] ?? "") && /\d/.test(nextChar)) {
      continue;
    }

    // Extract the token immediately before the period for abbreviation check
    const tokenMatch = buffer
      .slice(start, i + 1)
      .trim()
      .match(/([A-Za-z][A-Za-z']*)\.?$/);
    const token = tokenMatch?.[1]?.toLowerCase() ?? "";

    // Known abbreviations or single lowercase letters — not a sentence boundary
    if (char === "." && (TTS_COMMON_ABBREVIATIONS.has(token) || /^[a-z]$/.test(token))) {
      continue;
    }

    // Period followed immediately by a lowercase letter — mid-sentence
    if (char === "." && nextChar && /[a-z]/.test(nextChar)) {
      continue;
    }

    // Skip trailing whitespace into the next token
    while (boundaryEnd < buffer.length && /\s/.test(buffer[boundaryEnd])) {
      boundaryEnd++;
    }

    flush(boundaryEnd);
    i = boundaryEnd - 1;
  }

  return {
    sentences,
    remainder: buffer.slice(start).trimStart(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATEFUL PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

export interface SpeechEvent {
  utterance: string;
  audioGenerated: boolean;
  audioBase64?: string;
  mimeType?: string;
  duration?: number;
  streaming?: boolean;
  index?: number;
  fallback?: boolean;
}

export interface TtsPipeline {
  writeSpeechEvent(event: SpeechEvent): void;
  writeSpeechControlEvent(action: "stop", reason: string): void;
  generateSpeechAudio(
    utterance: string,
    voice?: string,
  ): Promise<{ audioBase64?: string; mimeType?: string; duration?: number; error?: string }>;
  queueSentenceForTTS(sentence: string): void;
  queueStreamingTTSFromText(chunk: string): void;
  flushStreamingTTS(): Promise<void>;
  readonly speechEventsSent: number;
}

/**
 * Create a per-request TTS pipeline that drives streaming speech over an SSE
 * response.  All TTS calls are serialised through a promise chain so speech
 * arrives in the order sentences were queued, even if generation latencies vary.
 */
export function createTtsPipeline(res: Response, useVoice: boolean): TtsPipeline {
  let sentenceBuffer = "";
  let speechEventsSentCount = 0;
  let nextSpeechIndex = 0;
  let ttsChain: Promise<void> = Promise.resolve();

  function writeSpeechEvent(event: SpeechEvent): void {
    if (res.writableEnded || res.destroyed) return;
    speechEventsSentCount++;
    res.write(`data: ${JSON.stringify({ speech: event })}\n\n`);
  }

  function writeSpeechControlEvent(action: "stop", reason: string): void {
    if (res.writableEnded || res.destroyed) return;
    res.write(`data: ${JSON.stringify({ speechControl: { action, reason } })}\n\n`);
  }

  async function generateSpeechAudio(
    utterance: string,
    voice?: string,
  ): Promise<{ audioBase64?: string; mimeType?: string; duration?: number; error?: string }> {
    const { generateSingleSpeakerAudio, DEFAULT_TTS_VOICE } = await import(
      "../integrations/expressive-tts"
    );
    return generateSingleSpeakerAudio(utterance, voice || DEFAULT_TTS_VOICE);
  }

  function queueSentenceForTTS(sentence: string): void {
    const utterance = parseVoiceStyle(sentence).cleanText.trim();
    if (!utterance) return;

    const index = nextSpeechIndex++;
    ttsChain = ttsChain.then(async () => {
      try {
        const ttsResult = await generateSpeechAudio(utterance);
        if (ttsResult.audioBase64) {
          writeSpeechEvent({
            utterance,
            audioGenerated: true,
            audioBase64: ttsResult.audioBase64,
            mimeType: ttsResult.mimeType || "audio/mpeg",
            duration: ttsResult.duration,
            streaming: true,
            index,
          });
        } else {
          console.warn(`[TTS] No audio for sentence ${index}: ${ttsResult.error}`);
          writeSpeechEvent({ utterance, audioGenerated: false, streaming: true, index });
        }
      } catch (err) {
        console.error(`[TTS] Failed for sentence ${index}:`, err);
        writeSpeechEvent({ utterance, audioGenerated: false, streaming: true, index });
      }
    });
  }

  function queueStreamingTTSFromText(chunk: string): void {
    if (!useVoice || !chunk.trim()) return;

    sentenceBuffer = appendTtsChunk(sentenceBuffer, chunk);
    const { sentences, remainder } = extractTtsSentences(sentenceBuffer);
    sentenceBuffer = remainder;

    for (const sentence of sentences) {
      queueSentenceForTTS(sentence);
    }
  }

  async function flushStreamingTTS(): Promise<void> {
    const trailing = parseVoiceStyle(sentenceBuffer).cleanText.trim();
    sentenceBuffer = "";
    if (trailing) queueSentenceForTTS(trailing);
    await ttsChain;
  }

  return {
    writeSpeechEvent,
    writeSpeechControlEvent,
    generateSpeechAudio,
    queueSentenceForTTS,
    queueStreamingTTSFromText,
    flushStreamingTTS,
    get speechEventsSent() {
      return speechEventsSentCount;
    },
  };
}
