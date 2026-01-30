#!/usr/bin/env tsx
/**
 * Test Script: RAG Hybrid Search Enhancement
 * 
 * This script tests the hybrid search and re-ranking functionality
 * to validate that the enhancement is working correctly.
 * 
 * Usage:
 *   npm run test:hybrid-search
 *   OR
 *   tsx scripts/test-hybrid-search.ts
 */

import { retrievalOrchestrator } from '../server/services/retrieval-orchestrator';
import { ragService } from '../server/services/rag-service';

async function testHybridSearch() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   RAG Hybrid Search & Re-ranking Enhancement Test            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const testQuery = "How do I implement user authentication?";
  
  console.log(`Test Query: "${testQuery}"\n`);
  console.log('─'.repeat(60));

  // Test 1: Hybrid Search Enabled (Default)
  console.log('\n📊 Test 1: Hybrid Search + Re-ranking (ENABLED)');
  console.log('─'.repeat(60));
  
  try {
    const startTime = Date.now();
    const hybridResult = await retrievalOrchestrator.retrieve({
      query: testQuery,
      maxTokens: 2000,
      topK: 10,
      useHybridSearch: true,
      useReranking: true,
      userId: null, // Guest user
    });
    const hybridTime = Date.now() - startTime;

    console.log(`✓ Results: ${hybridResult.items.length} items`);
    console.log(`✓ Tokens Used: ${hybridResult.totalTokensUsed}`);
    console.log(`✓ Search Time: ${hybridResult.searchTime}ms (Total: ${hybridTime}ms)`);
    console.log(`✓ Embedding Time: ${hybridResult.queryEmbeddingTime}ms`);
    
    if (hybridResult.items.length > 0) {
      console.log('\nTop 3 Results:');
      hybridResult.items.slice(0, 3).forEach((item, i) => {
        console.log(`\n  ${i + 1}. [${item.type}] Score: ${item.score.toFixed(3)}`);
        console.log(`     ${item.content.substring(0, 100)}...`);
      });
    }
  } catch (error) {
    console.error('✗ Hybrid search test failed:', error);
  }

  // Test 2: Basic Search (Hybrid Disabled)
  console.log('\n\n📊 Test 2: Basic Search (Hybrid DISABLED)');
  console.log('─'.repeat(60));
  
  try {
    const startTime = Date.now();
    const basicResult = await retrievalOrchestrator.retrieve({
      query: testQuery,
      maxTokens: 2000,
      topK: 10,
      useHybridSearch: false,
      useReranking: false,
      userId: null,
    });
    const basicTime = Date.now() - startTime;

    console.log(`✓ Results: ${basicResult.items.length} items`);
    console.log(`✓ Tokens Used: ${basicResult.totalTokensUsed}`);
    console.log(`✓ Search Time: ${basicResult.searchTime}ms (Total: ${basicTime}ms)`);
    console.log(`✓ Embedding Time: ${basicResult.queryEmbeddingTime}ms`);
    
    if (basicResult.items.length > 0) {
      console.log('\nTop 3 Results:');
      basicResult.items.slice(0, 3).forEach((item, i) => {
        console.log(`\n  ${i + 1}. [${item.type}] Score: ${item.score.toFixed(3)}`);
        console.log(`     ${item.content.substring(0, 100)}...`);
      });
    }
  } catch (error) {
    console.error('✗ Basic search test failed:', error);
  }

  // Test 3: RAG Service Advanced Retrieval
  console.log('\n\n📊 Test 3: RAG Service Advanced Retrieval');
  console.log('─'.repeat(60));
  
  try {
    const startTime = Date.now();
    const ragResult = await ragService.retrieveAdvanced(testQuery, null, {
      topK: 10,
      useHybridSearch: true,
      useReranking: true,
      useContextSynthesis: false,
      maxTokens: 2000,
    });
    const ragTime = Date.now() - startTime;

    console.log(`✓ Results: ${ragResult.chunks.length} chunks`);
    console.log(`✓ Time: ${ragTime}ms`);
    
    if (ragResult.chunks.length > 0) {
      console.log('\nTop 3 Chunks:');
      ragResult.chunks.slice(0, 3).forEach((chunk, i) => {
        console.log(`\n  ${i + 1}. Score: ${ragResult.scores[i].toFixed(3)}`);
        console.log(`     ${chunk.content.substring(0, 100)}...`);
      });
    }
  } catch (error) {
    console.error('✗ RAG advanced retrieval test failed:', error);
  }

  // Summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('\n✅ Test suite completed!');
  console.log('\n📝 Notes:');
  console.log('   • Hybrid search combines BM25 (keyword) + semantic (vector)');
  console.log('   • Re-ranking applies diversity filtering (Jaccard similarity)');
  console.log('   • Performance may vary based on corpus size');
  console.log('   • For production testing, use real user data\n');
}

// Run the test
testHybridSearch()
  .then(() => {
    console.log('✓ Test execution complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test execution failed:', error);
    process.exit(1);
  });
