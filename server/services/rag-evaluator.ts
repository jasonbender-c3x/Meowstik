/**
 * =============================================================================
 * MEOWSTIK - RAG EVALUATION & SELF-CORRECTION SERVICE
 * =============================================================================
 * 
 * Implements closed-loop evaluation and automatic improvement for the RAG system.
 * 
 * CAPABILITIES:
 * 1. Retrieval quality metrics (precision, recall, MRR)
 * 2. Feedback collection from LLM responses
 * 3. Automatic threshold tuning
 * 4. Performance tracking over time
 * 5. Self-improvement suggestions
 * 
 * This is part of the Cognitive Architecture 2.0 upgrade.
 * =============================================================================
 */

import { storage } from "../storage";
import type { DocumentChunk } from "@shared/schema";

export interface RetrievalMetrics {
  /** Query that was evaluated */
  query: string;
  /** Precision: relevant results / total results */
  precision: number;
  /** Recall: relevant results / total relevant documents */
  recall: number;
  /** F1 Score: harmonic mean of precision and recall */
  f1Score: number;
  /** Mean Reciprocal Rank */
  mrr: number;
  /** Number of results returned */
  resultsCount: number;
  /** Timestamp */
  timestamp: Date;
}

export interface FeedbackSignal {
  /** Query ID */
  queryId: string;
  /** Was the LLM response useful? */
  responseUseful: boolean;
  /** Did the LLM cite retrieved sources? */
  sourcesCited: boolean;
  /** Were retrieved chunks relevant? */
  chunksRelevant: boolean;
  /** User feedback (if available) */
  userFeedback?: "positive" | "negative" | "neutral";
  /** Timestamp */
  timestamp: Date;
}

export interface PerformanceReport {
  /** Time period for this report */
  period: { start: Date; end: Date };
  /** Average metrics */
  averageMetrics: {
    precision: number;
    recall: number;
    f1Score: number;
    mrr: number;
  };
  /** Total queries evaluated */
  totalQueries: number;
  /** Positive feedback ratio */
  positiveFeedbackRatio: number;
  /** Current thresholds */
  currentThresholds: {
    semantic: number;
    keyword: number;
  };
  /** Recommended threshold adjustments */
  recommendations: string[];
}

/**
 * RAG Evaluation Service
 */
export class RAGEvaluatorService {
  private metrics: RetrievalMetrics[] = [];
  private feedbackSignals: FeedbackSignal[] = [];
  private currentSemanticThreshold: number = 0.25;
  private currentKeywordThreshold: number = 0.1;

  /**
   * Evaluate retrieval quality
   * 
   * @param query - User query
   * @param retrievedChunks - Chunks returned by retrieval
   * @param groundTruthChunks - Known relevant chunks (if available)
   */
  evaluateRetrieval(
    query: string,
    retrievedChunks: DocumentChunk[],
    groundTruthChunks?: DocumentChunk[]
  ): RetrievalMetrics {
    // If no ground truth, use heuristics
    if (!groundTruthChunks || groundTruthChunks.length === 0) {
      return this.evaluateWithHeuristics(query, retrievedChunks);
    }

    // Calculate precision
    const retrievedIds = new Set(retrievedChunks.map(c => c.id));
    const relevantIds = new Set(groundTruthChunks.map(c => c.id));
    
    const truePositives = [...retrievedIds].filter(id => relevantIds.has(id)).length;
    const precision = retrievedChunks.length > 0 ? truePositives / retrievedChunks.length : 0;
    const recall = groundTruthChunks.length > 0 ? truePositives / groundTruthChunks.length : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    // Calculate MRR (Mean Reciprocal Rank)
    let mrr = 0;
    for (let i = 0; i < retrievedChunks.length; i++) {
      if (relevantIds.has(retrievedChunks[i].id)) {
        mrr = 1 / (i + 1);
        break;
      }
    }

    const metrics: RetrievalMetrics = {
      query,
      precision,
      recall,
      f1Score,
      mrr,
      resultsCount: retrievedChunks.length,
      timestamp: new Date(),
    };

    this.metrics.push(metrics);
    return metrics;
  }

  /**
   * Evaluate using heuristics when ground truth is not available
   */
  private evaluateWithHeuristics(query: string, retrievedChunks: DocumentChunk[]): RetrievalMetrics {
    // Extract query keywords
    const queryWords = new Set(
      query.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    // Calculate relevance for each chunk
    let totalRelevance = 0;
    for (const chunk of retrievedChunks) {
      const chunkWords = new Set(
        chunk.content.toLowerCase().split(/\s+/)
      );
      
      let matches = 0;
      for (const word of queryWords) {
        if (chunkWords.has(word)) {
          matches++;
        }
      }
      
      const relevance = queryWords.size > 0 ? matches / queryWords.size : 0;
      totalRelevance += relevance;
    }

    const avgRelevance = retrievedChunks.length > 0 ? totalRelevance / retrievedChunks.length : 0;

    // Estimate precision based on average relevance
    const precision = avgRelevance;
    
    // Estimate recall (assume we got about 50% of relevant docs)
    const recall = avgRelevance * 0.5;
    
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    // Estimate MRR (first result relevance)
    const mrr = retrievedChunks.length > 0 ? avgRelevance : 0;

    const metrics: RetrievalMetrics = {
      query,
      precision,
      recall,
      f1Score,
      mrr,
      resultsCount: retrievedChunks.length,
      timestamp: new Date(),
    };

    this.metrics.push(metrics);
    return metrics;
  }

  /**
   * Record feedback signal
   */
  recordFeedback(feedback: Omit<FeedbackSignal, "timestamp">): void {
    this.feedbackSignals.push({
      ...feedback,
      timestamp: new Date(),
    });
  }

  /**
   * Analyze LLM response to infer quality
   */
  async analyzeLLMResponse(
    query: string,
    retrievedChunks: DocumentChunk[],
    llmResponse: string
  ): Promise<FeedbackSignal> {
    const queryId = `query-${Date.now()}`;
    
    // Check if response cites sources
    const sourcesCited = this.detectSourceCitations(llmResponse);
    
    // Check if response is substantive (not "I don't know")
    const responseUseful = this.isResponseSubstantive(llmResponse);
    
    // Check if retrieved chunks appear to be used
    const chunksRelevant = this.detectChunkUsage(retrievedChunks, llmResponse);

    const feedback: FeedbackSignal = {
      queryId,
      responseUseful,
      sourcesCited,
      chunksRelevant,
      timestamp: new Date(),
    };

    this.recordFeedback(feedback);
    return feedback;
  }

  /**
   * Detect if LLM response cites sources
   */
  private detectSourceCitations(response: string): boolean {
    const citationPatterns = [
      /\[Source:/i,
      /\[.*?\]/,
      /according to/i,
      /based on/i,
      /as mentioned in/i,
    ];

    return citationPatterns.some(pattern => pattern.test(response));
  }

  /**
   * Check if response is substantive
   */
  private isResponseSubstantive(response: string): boolean {
    const unhelpfulPatterns = [
      /i don't know/i,
      /i don't have/i,
      /no information/i,
      /cannot find/i,
      /unable to/i,
    ];

    return !unhelpfulPatterns.some(pattern => pattern.test(response)) && response.length > 50;
  }

  /**
   * Detect if chunks were used in response
   */
  private detectChunkUsage(chunks: DocumentChunk[], response: string): boolean {
    if (chunks.length === 0) return false;

    // Extract unique phrases from chunks (3+ words)
    const chunkPhrases = new Set<string>();
    for (const chunk of chunks) {
      const words = chunk.content.toLowerCase().split(/\s+/);
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = `${words[i]} ${words[i+1]} ${words[i+2]}`;
        if (phrase.length > 15) {
          chunkPhrases.add(phrase);
        }
      }
    }

    // Check if any phrases appear in response
    const responseLower = response.toLowerCase();
    for (const phrase of chunkPhrases) {
      if (responseLower.includes(phrase)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate performance report
   */
  generateReport(periodDays: number = 7): PerformanceReport {
    const now = new Date();
    const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // Filter metrics and feedback to period
    const periodMetrics = this.metrics.filter(m => m.timestamp >= startDate);
    const periodFeedback = this.feedbackSignals.filter(f => f.timestamp >= startDate);

    // Calculate averages
    const avgPrecision = periodMetrics.length > 0
      ? periodMetrics.reduce((sum, m) => sum + m.precision, 0) / periodMetrics.length
      : 0;
    
    const avgRecall = periodMetrics.length > 0
      ? periodMetrics.reduce((sum, m) => sum + m.recall, 0) / periodMetrics.length
      : 0;
    
    const avgF1 = periodMetrics.length > 0
      ? periodMetrics.reduce((sum, m) => sum + m.f1Score, 0) / periodMetrics.length
      : 0;
    
    const avgMRR = periodMetrics.length > 0
      ? periodMetrics.reduce((sum, m) => sum + m.mrr, 0) / periodMetrics.length
      : 0;

    // Calculate positive feedback ratio
    const positiveFeedback = periodFeedback.filter(f => 
      f.responseUseful && f.chunksRelevant
    ).length;
    const positiveFeedbackRatio = periodFeedback.length > 0
      ? positiveFeedback / periodFeedback.length
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      { avgPrecision, avgRecall, avgF1, avgMRR },
      positiveFeedbackRatio
    );

    return {
      period: { start: startDate, end: now },
      averageMetrics: {
        precision: avgPrecision,
        recall: avgRecall,
        f1Score: avgF1,
        mrr: avgMRR,
      },
      totalQueries: periodMetrics.length,
      positiveFeedbackRatio,
      currentThresholds: {
        semantic: this.currentSemanticThreshold,
        keyword: this.currentKeywordThreshold,
      },
      recommendations,
    };
  }

  /**
   * Generate recommendations for improvement
   */
  private generateRecommendations(
    metrics: { avgPrecision: number; avgRecall: number; avgF1: number; avgMRR: number },
    positiveFeedbackRatio: number
  ): string[] {
    const recommendations: string[] = [];

    // Low precision - too many irrelevant results
    if (metrics.avgPrecision < 0.5) {
      recommendations.push("⚠️ Increase semantic threshold to improve precision (reduce noise)");
      recommendations.push("Consider enabling more aggressive re-ranking");
    }

    // Low recall - missing relevant results
    if (metrics.avgRecall < 0.5) {
      recommendations.push("⚠️ Decrease semantic threshold to improve recall (capture more results)");
      recommendations.push("Consider using query expansion or synonyms");
    }

    // Low MRR - relevant results not ranked highly
    if (metrics.avgMRR < 0.3) {
      recommendations.push("⚠️ Enable or improve re-ranking to surface relevant results");
      recommendations.push("Consider adjusting hybrid search weights");
    }

    // Low positive feedback
    if (positiveFeedbackRatio < 0.6) {
      recommendations.push("⚠️ Overall retrieval quality is low - consider re-indexing with better chunking");
      recommendations.push("Review chunking strategy and chunk sizes");
    }

    // Good performance
    if (metrics.avgF1 > 0.7 && positiveFeedbackRatio > 0.8) {
      recommendations.push("✅ Retrieval performance is good - maintain current settings");
    }

    return recommendations;
  }

  /**
   * Auto-tune thresholds based on performance
   */
  autoTuneThresholds(): { semantic: number; keyword: number } {
    const report = this.generateReport(7);
    
    // Adjust semantic threshold based on precision/recall balance
    if (report.averageMetrics.precision < 0.5) {
      // Low precision - increase threshold
      this.currentSemanticThreshold = Math.min(this.currentSemanticThreshold + 0.05, 0.5);
    } else if (report.averageMetrics.recall < 0.5 && report.averageMetrics.precision > 0.7) {
      // Low recall but good precision - decrease threshold
      this.currentSemanticThreshold = Math.max(this.currentSemanticThreshold - 0.05, 0.15);
    }

    console.log(`[RAG Evaluator] Auto-tuned semantic threshold to ${this.currentSemanticThreshold}`);

    return {
      semantic: this.currentSemanticThreshold,
      keyword: this.currentKeywordThreshold,
    };
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary(): {
    totalQueries: number;
    recentMetrics: RetrievalMetrics[];
    recentFeedback: FeedbackSignal[];
  } {
    return {
      totalQueries: this.metrics.length,
      recentMetrics: this.metrics.slice(-10),
      recentFeedback: this.feedbackSignals.slice(-10),
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = [];
    this.feedbackSignals = [];
  }
}

export const ragEvaluator = new RAGEvaluatorService();
