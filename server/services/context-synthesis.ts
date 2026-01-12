/**
 * =============================================================================
 * MEOWSTIK - CONTEXT SYNTHESIS SERVICE
 * =============================================================================
 * 
 * Implements intelligent context compression and synthesis for RAG.
 * Ensures the most relevant information fits within LLM context windows.
 * 
 * TECHNIQUES:
 * 1. Token-aware truncation
 * 2. Relevance-based pruning
 * 3. Hierarchical summarization
 * 4. Deduplication and merging
 * 5. Priority-based selection
 * 
 * This is part of the Cognitive Architecture 2.0 upgrade.
 * =============================================================================
 */

import { GoogleGenAI } from "@google/genai";
import type { DocumentChunk } from "@shared/schema";

export interface SynthesizedContext {
  /** The synthesized context text */
  content: string;
  /** Estimated token count */
  tokenCount: number;
  /** Number of original chunks */
  sourceChunkCount: number;
  /** Number of chunks after synthesis */
  synthesizedChunkCount: number;
  /** Compression ratio (0-1, lower = more compressed) */
  compressionRatio: number;
  /** Sources used */
  sources: Array<{
    documentId: string;
    chunkIndex: number;
    relevance: number;
  }>;
}

export interface ContextSynthesisOptions {
  /** Maximum token budget */
  maxTokens?: number;
  /** Strategy: "truncate" | "summarize" | "extract" | "hybrid" */
  strategy?: "truncate" | "summarize" | "extract" | "hybrid";
  /** Enable deduplication */
  deduplicate?: boolean;
  /** Minimum chunk relevance to include (0-1) */
  minRelevance?: number;
  /** Enable hierarchical summarization */
  hierarchical?: boolean;
}

const DEFAULT_OPTIONS: Required<ContextSynthesisOptions> = {
  maxTokens: 4000,
  strategy: "hybrid",
  deduplicate: true,
  minRelevance: 0.3,
  hierarchical: true,
};

/**
 * Context Synthesis Service
 */
export class ContextSynthesisService {
  private client: GoogleGenAI | null = null;
  private readonly CHARS_PER_TOKEN = 4; // Rough estimate

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Synthesize context from chunks
   */
  async synthesize(
    query: string,
    chunks: { chunk: DocumentChunk; relevance: number }[],
    options: ContextSynthesisOptions = {}
  ): Promise<SynthesizedContext> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Filter by minimum relevance
    let relevantChunks = chunks.filter(c => c.relevance >= opts.minRelevance);

    // Deduplicate if enabled
    if (opts.deduplicate) {
      relevantChunks = this.deduplicateChunks(relevantChunks);
    }

    // Select synthesis strategy
    switch (opts.strategy) {
      case "truncate":
        return this.truncateContext(relevantChunks, opts);
      case "summarize":
        return this.summarizeContext(query, relevantChunks, opts);
      case "extract":
        return this.extractContext(query, relevantChunks, opts);
      case "hybrid":
        return this.hybridSynthesis(query, relevantChunks, opts);
      default:
        return this.truncateContext(relevantChunks, opts);
    }
  }

  /**
   * Simple truncation strategy
   * Takes chunks in order of relevance until token budget is reached
   */
  private truncateContext(
    chunks: { chunk: DocumentChunk; relevance: number }[],
    options: Required<ContextSynthesisOptions>
  ): SynthesizedContext {
    const maxChars = options.maxTokens * this.CHARS_PER_TOKEN;
    const selected: typeof chunks = [];
    let totalChars = 0;

    // Sort by relevance
    const sorted = [...chunks].sort((a, b) => b.relevance - a.relevance);

    for (const item of sorted) {
      const chunkChars = item.chunk.content.length;
      if (totalChars + chunkChars <= maxChars) {
        selected.push(item);
        totalChars += chunkChars;
      }
    }

    const content = selected
      .map(item => {
        const meta = item.chunk.metadata as { filename?: string } | null;
        const filename = meta?.filename || "unknown";
        return `[Source: ${filename}, Relevance: ${item.relevance.toFixed(2)}]\n${item.chunk.content}`;
      })
      .join("\n\n---\n\n");

    return {
      content,
      tokenCount: Math.ceil(totalChars / this.CHARS_PER_TOKEN),
      sourceChunkCount: chunks.length,
      synthesizedChunkCount: selected.length,
      compressionRatio: selected.length / chunks.length,
      sources: selected.map(item => ({
        documentId: item.chunk.documentId,
        chunkIndex: item.chunk.chunkIndex,
        relevance: item.relevance,
      })),
    };
  }

  /**
   * Summarization strategy
   * Uses LLM to create a concise summary of all chunks
   */
  private async summarizeContext(
    query: string,
    chunks: { chunk: DocumentChunk; relevance: number }[],
    options: Required<ContextSynthesisOptions>
  ): Promise<SynthesizedContext> {
    if (chunks.length === 0) {
      return {
        content: "",
        tokenCount: 0,
        sourceChunkCount: 0,
        synthesizedChunkCount: 0,
        compressionRatio: 0,
        sources: [],
      };
    }

    const client = this.getClient();

    // If chunks fit within budget, use hierarchical summarization
    const totalChars = chunks.reduce((sum, c) => sum + c.chunk.content.length, 0);
    if (options.hierarchical && totalChars > options.maxTokens * this.CHARS_PER_TOKEN * 2) {
      return this.hierarchicalSummarize(query, chunks, options);
    }

    // Create summarization prompt
    const chunksText = chunks
      .slice(0, 10) // Limit to top 10 chunks for summarization
      .map((item, i) => `[${i + 1}] ${item.chunk.content}`)
      .join("\n\n");

    const prompt = `You are a context compression system. Summarize the following text chunks into a concise form that preserves all information relevant to the query.

Query: "${query}"

Text Chunks:
${chunksText}

Provide a concise summary that:
1. Keeps all information relevant to the query
2. Removes redundancy
3. Preserves key facts, entities, and relationships
4. Stays within ${options.maxTokens} tokens

Summary:`;

    try {
      const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: options.maxTokens,
        },
      });

      // Handle different response formats
      const summary = response.text || response.response?.text?.() || "";
      const tokenCount = Math.ceil(summary.length / this.CHARS_PER_TOKEN);

      return {
        content: summary,
        tokenCount,
        sourceChunkCount: chunks.length,
        synthesizedChunkCount: 1,
        compressionRatio: 1 / chunks.length,
        sources: chunks.map(item => ({
          documentId: item.chunk.documentId,
          chunkIndex: item.chunk.chunkIndex,
          relevance: item.relevance,
        })),
      };
    } catch (error) {
      console.error("[ContextSynthesis] Summarization failed:", error);
      // Fallback to truncation
      return this.truncateContext(chunks, options);
    }
  }

  /**
   * Hierarchical summarization for large contexts
   * Summarizes in stages: chunks → summaries → final summary
   */
  private async hierarchicalSummarize(
    query: string,
    chunks: { chunk: DocumentChunk; relevance: number }[],
    options: Required<ContextSynthesisOptions>
  ): Promise<SynthesizedContext> {
    const client = this.getClient();
    const batchSize = 5;
    const summaries: string[] = [];

    // Stage 1: Summarize batches of chunks
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
      const batchText = batch.map(item => item.chunk.content).join("\n\n");

      const prompt = `Summarize the following text, preserving information relevant to: "${query}"

Text:
${batchText}

Summary:`;

      try {
        const response = await client.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
          },
        });

        // Handle different response formats
        summaries.push(response.text || response.response?.text?.() || "");
      } catch (error) {
        console.error("[ContextSynthesis] Batch summarization failed:", error);
        // Use original text as fallback
        summaries.push(batchText.slice(0, 500));
      }
    }

    // Stage 2: Summarize the summaries if needed
    const combinedSummaries = summaries.join("\n\n");
    const combinedChars = combinedSummaries.length;

    if (combinedChars > options.maxTokens * this.CHARS_PER_TOKEN) {
      const finalPrompt = `Create a final concise summary of these summaries, relevant to: "${query}"

Summaries:
${combinedSummaries}

Final Summary (max ${options.maxTokens} tokens):`;

      try {
        const response = await client.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: options.maxTokens,
          },
        });

        // Handle different response formats
        const finalSummary = response.text || response.response?.text?.() || "";
        return {
          content: finalSummary,
          tokenCount: Math.ceil(finalSummary.length / this.CHARS_PER_TOKEN),
          sourceChunkCount: chunks.length,
          synthesizedChunkCount: 1,
          compressionRatio: 1 / chunks.length,
          sources: chunks.map(item => ({
            documentId: item.chunk.documentId,
            chunkIndex: item.chunk.chunkIndex,
            relevance: item.relevance,
          })),
        };
      } catch (error) {
        console.error("[ContextSynthesis] Final summarization failed:", error);
      }
    }

    return {
      content: combinedSummaries,
      tokenCount: Math.ceil(combinedChars / this.CHARS_PER_TOKEN),
      sourceChunkCount: chunks.length,
      synthesizedChunkCount: summaries.length,
      compressionRatio: summaries.length / chunks.length,
      sources: chunks.map(item => ({
        documentId: item.chunk.documentId,
        chunkIndex: item.chunk.chunkIndex,
        relevance: item.relevance,
      })),
    };
  }

  /**
   * Extraction strategy
   * Extracts only the most relevant sentences/paragraphs
   */
  private extractContext(
    query: string,
    chunks: { chunk: DocumentChunk; relevance: number }[],
    options: Required<ContextSynthesisOptions>
  ): SynthesizedContext {
    const maxChars = options.maxTokens * this.CHARS_PER_TOKEN;
    const extracted: string[] = [];
    let totalChars = 0;

    // Extract sentences from chunks
    for (const item of chunks) {
      const sentences = this.extractSentences(item.chunk.content);
      
      for (const sentence of sentences) {
        if (totalChars + sentence.length <= maxChars) {
          // Check relevance of sentence to query
          if (this.isSentenceRelevant(sentence, query)) {
            extracted.push(sentence);
            totalChars += sentence.length;
          }
        } else {
          break;
        }
      }

      if (totalChars >= maxChars) {
        break;
      }
    }

    const content = extracted.join(" ");

    return {
      content,
      tokenCount: Math.ceil(totalChars / this.CHARS_PER_TOKEN),
      sourceChunkCount: chunks.length,
      synthesizedChunkCount: extracted.length,
      compressionRatio: extracted.length / chunks.length,
      sources: chunks.map(item => ({
        documentId: item.chunk.documentId,
        chunkIndex: item.chunk.chunkIndex,
        relevance: item.relevance,
      })),
    };
  }

  /**
   * Hybrid strategy
   * Combines truncation and extraction for best results
   */
  private async hybridSynthesis(
    query: string,
    chunks: { chunk: DocumentChunk; relevance: number }[],
    options: Required<ContextSynthesisOptions>
  ): Promise<SynthesizedContext> {
    // First, truncate to top chunks
    const truncated = this.truncateContext(chunks, {
      ...options,
      maxTokens: options.maxTokens * 1.5, // Get slightly more for extraction
    });

    // If we're within budget, return truncated result
    if (truncated.tokenCount <= options.maxTokens) {
      return truncated;
    }

    // Otherwise, extract relevant sentences
    const extracted = this.extractContext(
      query,
      chunks.slice(0, truncated.synthesizedChunkCount),
      options
    );

    return extracted;
  }

  /**
   * Deduplicate chunks based on content similarity
   */
  private deduplicateChunks(
    chunks: { chunk: DocumentChunk; relevance: number }[]
  ): typeof chunks {
    const deduplicated: typeof chunks = [];
    
    for (const candidate of chunks) {
      let isDuplicate = false;
      
      for (const existing of deduplicated) {
        const similarity = this.calculateSimilarity(
          candidate.chunk.content,
          existing.chunk.content
        );
        
        // If very similar (>80% overlap), consider it a duplicate
        if (similarity > 0.8) {
          isDuplicate = true;
          // Keep the one with higher relevance
          if (candidate.relevance > existing.relevance) {
            const index = deduplicated.indexOf(existing);
            deduplicated[index] = candidate;
          }
          break;
        }
      }
      
      if (!isDuplicate) {
        deduplicated.push(candidate);
      }
    }
    
    return deduplicated;
  }

  /**
   * Extract sentences from text
   */
  private extractSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Check if sentence is relevant to query
   */
  private isSentenceRelevant(sentence: string, query: string): boolean {
    const queryWords = new Set(
      query.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );
    const sentenceWords = new Set(
      sentence.toLowerCase().split(/\s+/)
    );

    // Calculate word overlap
    let overlap = 0;
    for (const word of queryWords) {
      if (sentenceWords.has(word)) {
        overlap++;
      }
    }

    // Relevant if at least 1 query word appears
    return overlap > 0;
  }

  /**
   * Calculate text similarity (Jaccard similarity)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.tokenize(text1));
    const words2 = new Set(this.tokenize(text2));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }
}

export const contextSynthesisService = new ContextSynthesisService();
