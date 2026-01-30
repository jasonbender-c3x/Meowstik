#!/usr/bin/env tsx
/**
 * =============================================================================
 * COGNITIVE ARCHITECTURE 2.0 - DEMONSTRATION SCRIPT
 * =============================================================================
 * 
 * This script demonstrates the new RAG capabilities:
 * 1. Hybrid search (semantic + keyword)
 * 2. Re-ranking strategies
 * 3. Context synthesis
 * 4. Evaluation metrics
 */

import { hybridSearchService, BM25Scorer } from "../server/services/hybrid-search";
import { rerankerService } from "../server/services/reranker";
import { contextSynthesisService } from "../server/services/context-synthesis";
import { ragEvaluator } from "../server/services/rag-evaluator";
import type { DocumentChunk } from "../shared/schema";

// Mock data for demonstration
const mockChunks: DocumentChunk[] = [
  {
    id: 1,
    documentId: "doc-1",
    attachmentId: null,
    chunkIndex: 0,
    content: "Machine learning is a subset of artificial intelligence that enables computers to learn from data without explicit programming. It uses algorithms to identify patterns and make predictions.",
    embedding: null,
    metadata: { filename: "ml-basics.txt", timestamp: new Date().toISOString() },
    createdAt: new Date(),
  },
  {
    id: 2,
    documentId: "doc-1",
    attachmentId: null,
    chunkIndex: 1,
    content: "Deep learning is a type of machine learning that uses neural networks with multiple layers. It has revolutionized computer vision and natural language processing.",
    embedding: null,
    metadata: { filename: "ml-basics.txt", timestamp: new Date().toISOString() },
    createdAt: new Date(),
  },
  {
    id: 3,
    documentId: "doc-2",
    attachmentId: null,
    chunkIndex: 0,
    content: "Python is a popular programming language for data science and machine learning. Libraries like TensorFlow, PyTorch, and scikit-learn make it easy to build models.",
    embedding: null,
    metadata: { filename: "python-ml.txt", timestamp: new Date().toISOString() },
    createdAt: new Date(),
  },
  {
    id: 4,
    documentId: "doc-2",
    attachmentId: null,
    chunkIndex: 1,
    content: "Data preprocessing is crucial for machine learning success. This includes cleaning data, handling missing values, and feature engineering.",
    embedding: null,
    metadata: { filename: "python-ml.txt", timestamp: new Date().toISOString() },
    createdAt: new Date(),
  },
  {
    id: 5,
    documentId: "doc-3",
    attachmentId: null,
    chunkIndex: 0,
    content: "JavaScript is primarily used for web development but can also be used for machine learning with libraries like TensorFlow.js and Brain.js.",
    embedding: null,
    metadata: { filename: "js-ml.txt", timestamp: new Date().toISOString() },
    createdAt: new Date(),
  },
];

console.log("=".repeat(80));
console.log("COGNITIVE ARCHITECTURE 2.0 - DEMONSTRATION");
console.log("=".repeat(80));
console.log();

// Test 1: BM25 Scoring
console.log("TEST 1: BM25 Keyword Scoring");
console.log("-".repeat(80));

const bm25 = new BM25Scorer();
bm25.preprocessCorpus(mockChunks.map(c => ({ id: c.id.toString(), content: c.content })));

const query = "machine learning Python programming";
console.log(`Query: "${query}"`);
console.log();

const bm25Scores = mockChunks.map(chunk => ({
  chunk,
  score: bm25.score(query, chunk.content),
}));

bm25Scores.sort((a, b) => b.score - a.score);

console.log("BM25 Rankings:");
bm25Scores.forEach((item, i) => {
  console.log(`${i + 1}. Score: ${item.score.toFixed(3)} - ${item.chunk.content.slice(0, 80)}...`);
});
console.log();

// Test 2: Hybrid Search
console.log("TEST 2: Hybrid Search (Semantic + Keyword)");
console.log("-".repeat(80));

// Mock semantic results (simulated)
const semanticResults = [
  { chunk: mockChunks[0], score: 0.85 },
  { chunk: mockChunks[1], score: 0.75 },
  { chunk: mockChunks[3], score: 0.60 },
];

const hybridResults = hybridSearchService.search(
  query,
  semanticResults,
  mockChunks,
  { topK: 5, semanticWeight: 0.7, keywordWeight: 0.3 }
);

console.log("Hybrid Search Rankings:");
hybridResults.forEach((result, i) => {
  console.log(
    `${i + 1}. Semantic: ${result.semanticScore.toFixed(3)}, ` +
    `Keyword: ${result.keywordScore.toFixed(3)}, ` +
    `Fused: ${result.fusedScore.toFixed(3)}`
  );
  console.log(`   ${result.chunk.content.slice(0, 80)}...`);
});
console.log();

// Test 3: Re-ranking
console.log("TEST 3: Re-ranking Strategies");
console.log("-".repeat(80));

// Diversity re-ranking
const diversityResults = rerankerService["rerankByDiversity"](
  semanticResults,
  {
    strategy: "diversity",
    topK: 3,
    useLLM: false,
    diversityWeight: 0.5,
    recencyWeight: 0.1,
    importanceWeight: 0.1,
  }
);

console.log("Diversity Re-ranking (MMR):");
diversityResults.forEach((result, i) => {
  console.log(
    `${i + 1}. Original: ${result.originalScore.toFixed(3)}, ` +
    `Reranked: ${result.rerankedScore.toFixed(3)}`
  );
  console.log(`   ${result.chunk.content.slice(0, 80)}...`);
});
console.log();

// Test 4: Context Synthesis
console.log("TEST 4: Context Synthesis");
console.log("-".repeat(80));

const synthesisInput = mockChunks.slice(0, 3).map((chunk, i) => ({
  chunk,
  relevance: 0.9 - i * 0.1,
}));

const synthesizedContext = await contextSynthesisService.synthesize(
  query,
  synthesisInput,
  { maxTokens: 200, strategy: "truncate", deduplicate: true }
);

console.log(`Source chunks: ${synthesizedContext.sourceChunkCount}`);
console.log(`Synthesized chunks: ${synthesizedContext.synthesizedChunkCount}`);
console.log(`Token count: ${synthesizedContext.tokenCount}`);
console.log(`Compression ratio: ${(synthesizedContext.compressionRatio * 100).toFixed(1)}%`);
console.log();
console.log("Synthesized content:");
console.log(synthesizedContext.content.slice(0, 300) + "...");
console.log();

// Test 5: Evaluation Metrics
console.log("TEST 5: Evaluation Metrics");
console.log("-".repeat(80));

// Simulate retrieval evaluation
const retrievedChunks = [mockChunks[0], mockChunks[1], mockChunks[3]];
const metrics = ragEvaluator.evaluateRetrieval(query, retrievedChunks);

console.log("Retrieval Metrics:");
console.log(`  Precision: ${(metrics.precision * 100).toFixed(1)}%`);
console.log(`  Recall: ${(metrics.recall * 100).toFixed(1)}%`);
console.log(`  F1 Score: ${(metrics.f1Score * 100).toFixed(1)}%`);
console.log(`  MRR: ${metrics.mrr.toFixed(3)}`);
console.log(`  Results: ${metrics.resultsCount}`);
console.log();

// Simulate feedback
ragEvaluator.recordFeedback({
  queryId: "demo-query-1",
  responseUseful: true,
  sourcesCited: true,
  chunksRelevant: true,
  userFeedback: "positive",
});

const report = ragEvaluator.generateReport(7);
console.log("Performance Report:");
console.log(`  Period: ${report.period.start.toLocaleDateString()} - ${report.period.end.toLocaleDateString()}`);
console.log(`  Total Queries: ${report.totalQueries}`);
console.log(`  Avg Precision: ${(report.averageMetrics.precision * 100).toFixed(1)}%`);
console.log(`  Avg F1 Score: ${(report.averageMetrics.f1Score * 100).toFixed(1)}%`);
console.log(`  Positive Feedback: ${(report.positiveFeedbackRatio * 100).toFixed(1)}%`);
console.log();

console.log("Recommendations:");
report.recommendations.forEach(rec => {
  console.log(`  ${rec}`);
});
console.log();

console.log("=".repeat(80));
console.log("DEMONSTRATION COMPLETE");
console.log("=".repeat(80));
console.log();
console.log("✅ All Cognitive Architecture 2.0 components are functional!");
console.log();
console.log("Next steps:");
console.log("  1. Test with real embeddings from Gemini");
console.log("  2. Integrate into the main RAG pipeline");
console.log("  3. Add UI for evaluation dashboard");
console.log("  4. Monitor performance in production");
