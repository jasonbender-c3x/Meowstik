/**
 * =============================================================================
 * MEOWSTIK - HYBRID SEARCH SERVICE
 * =============================================================================
 * 
 * Implements advanced retrieval combining:
 * 1. Semantic Search (vector similarity)
 * 2. Keyword Search (BM25 algorithm)
 * 3. Fusion Ranking (Reciprocal Rank Fusion)
 * 
 * This is part of the Cognitive Architecture 2.0 upgrade.
 * 
 * ARCHITECTURE:
 * -------------
 * Query → [Semantic Search] → Results A (scored 0-1)
 *      ↘ [Keyword Search]  → Results B (scored 0-1)
 *                          ↘ [Fusion] → Merged & Ranked
 * =============================================================================
 */

import type { DocumentChunk } from "@shared/schema";

export interface HybridSearchResult {
  chunk: DocumentChunk;
  semanticScore: number;
  keywordScore: number;
  fusedScore: number;
  rank: number;
}

export interface HybridSearchOptions {
  /** Number of results to return */
  topK?: number;
  /** Weight for semantic search (0-1) */
  semanticWeight?: number;
  /** Weight for keyword search (0-1) */
  keywordWeight?: number;
  /** Minimum semantic similarity threshold */
  semanticThreshold?: number;
  /** Enable query expansion */
  queryExpansion?: boolean;
}

const DEFAULT_OPTIONS: Required<HybridSearchOptions> = {
  topK: 20,
  semanticWeight: 0.7,
  keywordWeight: 0.3,
  semanticThreshold: 0.25,
  queryExpansion: false,
};

/**
 * BM25 Scoring Implementation
 * 
 * BM25 (Best Matching 25) is a ranking function used for keyword-based search.
 * It's more sophisticated than TF-IDF and is the basis for many search engines.
 * 
 * Formula: BM25(D,Q) = Σ(IDF(qi) * (f(qi,D) * (k1 + 1)) / (f(qi,D) + k1 * (1 - b + b * |D| / avgdl)))
 * 
 * Where:
 * - D = document
 * - Q = query
 * - qi = query term i
 * - f(qi,D) = term frequency of qi in D
 * - |D| = document length
 * - avgdl = average document length
 * - k1, b = tuning parameters (typically k1=1.2, b=0.75)
 * - IDF(qi) = inverse document frequency of qi
 */
export class BM25Scorer {
  private k1: number = 1.2;
  private b: number = 0.75;
  private avgDocLength: number = 0;
  private docFrequencies: Map<string, number> = new Map();
  private totalDocs: number = 0;

  /**
   * Preprocess corpus to calculate IDF values
   */
  preprocessCorpus(documents: { id: string; content: string }[]): void {
    this.totalDocs = documents.length;
    
    // Calculate average document length
    let totalLength = 0;
    for (const doc of documents) {
      totalLength += this.tokenize(doc.content).length;
    }
    this.avgDocLength = totalLength / this.totalDocs;

    // Calculate document frequencies for each term
    this.docFrequencies.clear();
    for (const doc of documents) {
      const terms = new Set(this.tokenize(doc.content));
      for (const term of terms) {
        this.docFrequencies.set(term, (this.docFrequencies.get(term) || 0) + 1);
      }
    }
  }

  /**
   * Calculate BM25 score for a document given a query
   */
  score(queryText: string, documentText: string): number {
    const queryTerms = this.tokenize(queryText);
    const docTerms = this.tokenize(documentText);
    const docLength = docTerms.length;

    // Calculate term frequencies
    const termFreq = new Map<string, number>();
    for (const term of docTerms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    let score = 0;
    for (const queryTerm of queryTerms) {
      const tf = termFreq.get(queryTerm) || 0;
      if (tf === 0) continue;

      // Calculate IDF
      const docFreq = this.docFrequencies.get(queryTerm) || 0;
      const idf = Math.log((this.totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);

      // Calculate BM25 component for this term
      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));
      
      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2); // Filter out very short terms
  }
}

/**
 * Reciprocal Rank Fusion (RRF)
 * 
 * RRF is a technique for combining rankings from multiple search systems.
 * It's simple but effective, and doesn't require score normalization.
 * 
 * Formula: RRF(d) = Σ(1 / (k + rank(d)))
 * 
 * Where:
 * - d = document
 * - k = constant (typically 60)
 * - rank(d) = rank of document d in a particular ranking
 */
export class ReciprocalRankFusion {
  private k: number = 60;

  /**
   * Fuse multiple ranked lists into a single ranking
   * 
   * @param rankedLists - Array of ranked document IDs (ordered by relevance)
   * @returns Fused ranking with scores
   */
  fuse(rankedLists: string[][]): Map<string, number> {
    const scores = new Map<string, number>();

    for (const rankedList of rankedLists) {
      for (let rank = 0; rank < rankedList.length; rank++) {
        const docId = rankedList[rank];
        const rrfScore = 1 / (this.k + rank + 1); // rank is 0-based
        scores.set(docId, (scores.get(docId) || 0) + rrfScore);
      }
    }

    return scores;
  }
}

/**
 * Hybrid Search Service
 */
export class HybridSearchService {
  private bm25: BM25Scorer;
  private rrf: ReciprocalRankFusion;

  constructor() {
    this.bm25 = new BM25Scorer();
    this.rrf = new ReciprocalRankFusion();
  }

  /**
   * Perform hybrid search combining semantic and keyword approaches
   * 
   * @param query - User query
   * @param semanticResults - Results from vector similarity search
   * @param corpus - All available chunks for keyword search
   * @param options - Search options
   */
  search(
    query: string,
    semanticResults: { chunk: DocumentChunk; score: number }[],
    corpus: DocumentChunk[],
    options: HybridSearchOptions = {}
  ): HybridSearchResult[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Preprocess corpus for BM25
    this.bm25.preprocessCorpus(
      corpus.map(chunk => ({ id: chunk.id.toString(), content: chunk.content }))
    );

    // Perform keyword search using BM25
    const keywordResults = corpus
      .map(chunk => ({
        chunk,
        score: this.bm25.score(query, chunk.content),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.topK * 2); // Get more candidates for fusion

    // Normalize scores to 0-1 range
    const maxSemanticScore = Math.max(...semanticResults.map(r => r.score), 0.001);
    const maxKeywordScore = Math.max(...keywordResults.map(r => r.score), 0.001);

    const normalizedSemantic = semanticResults.map(r => ({
      chunk: r.chunk,
      score: r.score / maxSemanticScore,
    }));

    const normalizedKeyword = keywordResults.map(r => ({
      chunk: r.chunk,
      score: r.score / maxKeywordScore,
    }));

    // Create lookup maps
    const semanticMap = new Map(
      normalizedSemantic.map(r => [r.chunk.id.toString(), r.score])
    );
    const keywordMap = new Map(
      normalizedKeyword.map(r => [r.chunk.id.toString(), r.score])
    );

    // Combine all unique chunks
    const allChunkIds = new Set([
      ...normalizedSemantic.map(r => r.chunk.id.toString()),
      ...normalizedKeyword.map(r => r.chunk.id.toString()),
    ]);

    const chunkMap = new Map<string, DocumentChunk>();
    for (const result of [...normalizedSemantic, ...normalizedKeyword]) {
      chunkMap.set(result.chunk.id.toString(), result.chunk);
    }

    // Calculate fused scores
    const fusedResults: HybridSearchResult[] = [];
    for (const chunkId of allChunkIds) {
      const chunk = chunkMap.get(chunkId);
      if (!chunk) continue;

      const semanticScore = semanticMap.get(chunkId) || 0;
      const keywordScore = keywordMap.get(chunkId) || 0;
      
      // Skip if semantic score is below threshold
      if (semanticScore < opts.semanticThreshold && semanticScore > 0) {
        continue;
      }

      // Weighted fusion
      const fusedScore = 
        semanticScore * opts.semanticWeight + 
        keywordScore * opts.keywordWeight;

      fusedResults.push({
        chunk,
        semanticScore,
        keywordScore,
        fusedScore,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by fused score and assign ranks
    fusedResults.sort((a, b) => b.fusedScore - a.fusedScore);
    fusedResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    // Return top K results
    return fusedResults.slice(0, opts.topK);
  }

  /**
   * Alternative fusion using Reciprocal Rank Fusion
   */
  searchWithRRF(
    query: string,
    semanticResults: { chunk: DocumentChunk; score: number }[],
    corpus: DocumentChunk[],
    options: HybridSearchOptions = {}
  ): HybridSearchResult[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Preprocess corpus for BM25
    this.bm25.preprocessCorpus(
      corpus.map(chunk => ({ id: chunk.id.toString(), content: chunk.content }))
    );

    // Perform keyword search
    const keywordResults = corpus
      .map(chunk => ({
        chunk,
        score: this.bm25.score(query, chunk.content),
      }))
      .sort((a, b) => b.score - a.score);

    // Create ranked lists
    const semanticRanking = semanticResults.map(r => r.chunk.id.toString());
    const keywordRanking = keywordResults.map(r => r.chunk.id.toString());

    // Apply RRF
    const rrfScores = this.rrf.fuse([semanticRanking, keywordRanking]);

    // Create lookup maps for original scores
    const semanticMap = new Map(
      semanticResults.map(r => [r.chunk.id.toString(), r.score])
    );
    const keywordMap = new Map(
      keywordResults.map(r => [r.chunk.id.toString(), r.score])
    );
    const chunkMap = new Map<string, DocumentChunk>();
    for (const result of [...semanticResults, ...keywordResults]) {
      chunkMap.set(result.chunk.id.toString(), result.chunk);
    }

    // Build final results
    const fusedResults: HybridSearchResult[] = [];
    for (const [chunkId, fusedScore] of rrfScores.entries()) {
      const chunk = chunkMap.get(chunkId);
      if (!chunk) continue;

      const semanticScore = semanticMap.get(chunkId) || 0;
      const keywordScore = keywordMap.get(chunkId) || 0;

      fusedResults.push({
        chunk,
        semanticScore,
        keywordScore,
        fusedScore,
        rank: 0,
      });
    }

    // Sort and assign ranks
    fusedResults.sort((a, b) => b.fusedScore - a.fusedScore);
    fusedResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    return fusedResults.slice(0, opts.topK);
  }
}

export const hybridSearchService = new HybridSearchService();
