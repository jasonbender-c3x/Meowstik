/**
 * =============================================================================
 * MEOWSTIK - RE-RANKING SERVICE
 * =============================================================================
 * 
 * Implements result re-ranking to improve retrieval precision.
 * Uses LLM-based semantic re-ranking for high-quality relevance scoring.
 * 
 * ARCHITECTURE:
 * -------------
 * Initial Results → [Re-ranker] → Re-scored & Re-ordered Results
 * 
 * RE-RANKING STRATEGIES:
 * 1. LLM-based: Use Gemini Flash to score relevance
 * 2. Diversity: Reduce redundancy in results
 * 3. Recency: Boost recent content
 * 4. Importance: Use user-defined importance scores
 * 
 * This is part of the Cognitive Architecture 2.0 upgrade.
 * =============================================================================
 */

import { GoogleGenAI } from "@google/genai";
import type { DocumentChunk } from "@shared/schema";

export interface RerankerResult {
  chunk: DocumentChunk;
  originalScore: number;
  rerankedScore: number;
  rank: number;
  reasoning?: string;
}

export interface RerankerOptions {
  /** Strategy to use */
  strategy?: "llm" | "diversity" | "recency" | "importance" | "hybrid";
  /** Number of results to return */
  topK?: number;
  /** Enable LLM-based scoring */
  useLLM?: boolean;
  /** Weight for diversity (0-1) */
  diversityWeight?: number;
  /** Weight for recency (0-1) */
  recencyWeight?: number;
  /** Weight for importance (0-1) */
  importanceWeight?: number;
}

const DEFAULT_OPTIONS: Required<RerankerOptions> = {
  strategy: "hybrid",
  topK: 10,
  useLLM: true,
  diversityWeight: 0.2,
  recencyWeight: 0.1,
  importanceWeight: 0.1,
};

/**
 * Re-ranking Service
 */
export class RerankerService {
  private client: GoogleGenAI | null = null;

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
   * Re-rank search results
   */
  async rerank(
    query: string,
    results: { chunk: DocumentChunk; score: number }[],
    options: RerankerOptions = {}
  ): Promise<RerankerResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    switch (opts.strategy) {
      case "llm":
        return this.rerankWithLLM(query, results, opts);
      case "diversity":
        return this.rerankByDiversity(results, opts);
      case "recency":
        return this.rerankByRecency(results, opts);
      case "importance":
        return this.rerankByImportance(results, opts);
      case "hybrid":
        return this.rerankHybrid(query, results, opts);
      default:
        return results.map((r, i) => ({
          chunk: r.chunk,
          originalScore: r.score,
          rerankedScore: r.score,
          rank: i + 1,
        }));
    }
  }

  /**
   * Re-rank using LLM to score relevance
   * This is more accurate but slower than pure vector similarity
   */
  private async rerankWithLLM(
    query: string,
    results: { chunk: DocumentChunk; score: number }[],
    options: Required<RerankerOptions>
  ): Promise<RerankerResult[]> {
    if (results.length === 0) {
      return [];
    }

    const client = this.getClient();
    const rerankedResults: RerankerResult[] = [];

    // Batch re-ranking in chunks to avoid token limits
    const batchSize = 5;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, Math.min(i + batchSize, results.length));
      
      // Create prompt for re-ranking
      const prompt = this.buildRerankingPrompt(query, batch);

      try {
        const response = await client.models.generateContent({
          model: "gemini-3-flash-preview-exp",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, // Low temperature for consistent scoring
            maxOutputTokens: 500,
          },
        });

        // Handle different response formats
        const text = response.text || response.response?.text?.() || "";
        const scores = this.parseRerankedScores(text, batch.length);

        // Combine with original scores
        for (let j = 0; j < batch.length; j++) {
          const result = batch[j];
          const llmScore = scores[j] ?? result.score;
          
          rerankedResults.push({
            chunk: result.chunk,
            originalScore: result.score,
            rerankedScore: llmScore * 0.7 + result.score * 0.3, // Blend LLM and vector scores
            rank: 0, // Will be assigned after sorting
          });
        }
      } catch (error) {
        console.error("[Reranker] LLM re-ranking failed:", error);
        // Fallback to original scores
        for (const result of batch) {
          rerankedResults.push({
            chunk: result.chunk,
            originalScore: result.score,
            rerankedScore: result.score,
            rank: 0,
          });
        }
      }
    }

    // Sort and assign ranks
    rerankedResults.sort((a, b) => b.rerankedScore - a.rerankedScore);
    rerankedResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    return rerankedResults.slice(0, options.topK);
  }

  /**
   * Build prompt for LLM-based re-ranking
   */
  private buildRerankingPrompt(
    query: string,
    results: { chunk: DocumentChunk; score: number }[]
  ): string {
    const chunks = results.map((r, i) => {
      const preview = r.chunk.content.slice(0, 200);
      return `[${i + 1}] ${preview}`;
    }).join("\n\n");

    return `You are a relevance scoring system. Score how relevant each text chunk is to the user's query.

Query: "${query}"

Text Chunks:
${chunks}

For each chunk, provide a relevance score from 0.0 (not relevant) to 1.0 (highly relevant).
Output only the scores as a JSON array of numbers, e.g., [0.9, 0.7, 0.3, 0.8, 0.5]

Scores:`;
  }

  /**
   * Parse LLM response to extract scores
   */
  private parseRerankedScores(text: string, expectedCount: number): number[] {
    try {
      // Try to extract JSON array
      const jsonMatch = text.match(/\[[\d\s.,]+\]/);
      if (jsonMatch) {
        const scores = JSON.parse(jsonMatch[0]) as number[];
        if (scores.length === expectedCount) {
          return scores;
        }
      }

      // Fallback: extract individual numbers
      const numbers = text.match(/\d+\.\d+/g);
      if (numbers && numbers.length >= expectedCount) {
        return numbers.slice(0, expectedCount).map(n => parseFloat(n));
      }
    } catch (error) {
      console.error("[Reranker] Failed to parse LLM scores:", error);
    }

    // Return neutral scores as fallback
    return Array(expectedCount).fill(0.5);
  }

  /**
   * Re-rank by diversity to reduce redundancy
   * Uses Maximal Marginal Relevance (MMR) algorithm
   */
  private rerankByDiversity(
    results: { chunk: DocumentChunk; score: number }[],
    options: Required<RerankerOptions>
  ): RerankerResult[] {
    if (results.length === 0) {
      return [];
    }

    const selected: RerankerResult[] = [];
    const remaining = [...results];
    const lambda = 1 - options.diversityWeight; // Balance relevance vs diversity

    // Select first result (highest score)
    const first = remaining.shift()!;
    selected.push({
      chunk: first.chunk,
      originalScore: first.score,
      rerankedScore: first.score,
      rank: 1,
    });

    // Pre-compute selected chunk tokens for faster comparison
    const selectedTokenSets = [new Set(this.tokenize(first.chunk.content))];

    // Iteratively select results that maximize MMR
    while (remaining.length > 0 && selected.length < options.topK) {
      let bestScore = -Infinity;
      let bestIndex = 0;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const candidateTokens = new Set(this.tokenize(candidate.chunk.content));
        
        // Calculate max similarity to already selected results
        // Using pre-computed token sets for efficiency
        let maxSimilarity = 0;
        for (const selectedTokens of selectedTokenSets) {
          const similarity = this.calculateJaccardSimilarity(candidateTokens, selectedTokens);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        // MMR score: balance relevance and diversity
        const mmrScore = lambda * candidate.score - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      // Add best candidate
      const best = remaining.splice(bestIndex, 1)[0];
      const bestTokens = new Set(this.tokenize(best.chunk.content));
      selectedTokenSets.push(bestTokens);
      
      selected.push({
        chunk: best.chunk,
        originalScore: best.score,
        rerankedScore: bestScore,
        rank: selected.length + 1,
      });
    }

    return selected;
  }

  /**
   * Re-rank by recency (boost recent content)
   */
  private rerankByRecency(
    results: { chunk: DocumentChunk; score: number }[],
    options: Required<RerankerOptions>
  ): RerankerResult[] {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const reranked = results.map(result => {
      // Extract timestamp from metadata
      const metadata = result.chunk.metadata as { timestamp?: string } | null;
      const timestamp = metadata?.timestamp ? new Date(metadata.timestamp).getTime() : 0;
      
      // Calculate recency score (exponential decay)
      const age = now - timestamp;
      const recencyScore = timestamp > 0 ? Math.exp(-age / thirtyDaysMs) : 0;
      
      // Combine with original score
      const rerankedScore = 
        result.score * (1 - options.recencyWeight) + 
        recencyScore * options.recencyWeight;

      return {
        chunk: result.chunk,
        originalScore: result.score,
        rerankedScore,
        rank: 0,
      };
    });

    // Sort and assign ranks
    reranked.sort((a, b) => b.rerankedScore - a.rerankedScore);
    reranked.forEach((result, index) => {
      result.rank = index + 1;
    });

    return reranked.slice(0, options.topK);
  }

  /**
   * Re-rank by importance (user-defined or inferred)
   */
  private rerankByImportance(
    results: { chunk: DocumentChunk; score: number }[],
    options: Required<RerankerOptions>
  ): RerankerResult[] {
    const reranked = results.map(result => {
      // Extract importance from metadata
      const metadata = result.chunk.metadata as { importance?: number } | null;
      const importance = metadata?.importance ?? 0.5;
      
      // Combine with original score
      const rerankedScore = 
        result.score * (1 - options.importanceWeight) + 
        importance * options.importanceWeight;

      return {
        chunk: result.chunk,
        originalScore: result.score,
        rerankedScore,
        rank: 0,
      };
    });

    // Sort and assign ranks
    reranked.sort((a, b) => b.rerankedScore - a.rerankedScore);
    reranked.forEach((result, index) => {
      result.rank = index + 1;
    });

    return reranked.slice(0, options.topK);
  }

  /**
   * Hybrid re-ranking combining multiple strategies
   */
  private async rerankHybrid(
    query: string,
    results: { chunk: DocumentChunk; score: number }[],
    options: Required<RerankerOptions>
  ): Promise<RerankerResult[]> {
    // First, apply diversity
    const diversified = this.rerankByDiversity(results, {
      ...options,
      topK: Math.min(results.length, options.topK * 2), // Get more candidates
    });

    // Then apply recency
    const withRecency = this.rerankByRecency(
      diversified.map(r => ({ chunk: r.chunk, score: r.rerankedScore })),
      options
    );

    // Then apply importance
    const withImportance = this.rerankByImportance(
      withRecency.map(r => ({ chunk: r.chunk, score: r.rerankedScore })),
      options
    );

    // Finally, optionally apply LLM re-ranking to top candidates
    if (options.useLLM) {
      const topCandidates = withImportance.slice(0, Math.min(10, withImportance.length));
      return this.rerankWithLLM(
        query,
        topCandidates.map(r => ({ chunk: r.chunk, score: r.rerankedScore })),
        { ...options, topK: options.topK }
      );
    }

    return withImportance;
  }

  /**
   * Calculate text similarity (Jaccard similarity on word sets)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.tokenize(text1));
    const words2 = new Set(this.tokenize(text2));
    return this.calculateJaccardSimilarity(words1, words2);
  }

  /**
   * Calculate Jaccard similarity between two sets
   * Optimized for performance with pre-computed sets
   */
  private calculateJaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 && set2.size === 0) return 1;
    if (set1.size === 0 || set2.size === 0) return 0;

    let intersectionSize = 0;
    // Iterate over smaller set for efficiency
    const [smaller, larger] = set1.size < set2.size ? [set1, set2] : [set2, set1];
    
    for (const item of smaller) {
      if (larger.has(item)) {
        intersectionSize++;
      }
    }

    const unionSize = set1.size + set2.size - intersectionSize;
    return unionSize > 0 ? intersectionSize / unionSize : 0;
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

export const rerankerService = new RerankerService();
