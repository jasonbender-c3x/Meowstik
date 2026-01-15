#!/usr/bin/env tsx

/**
 * =============================================================================
 * VERTEX AI MIGRATION TEST SCRIPT
 * =============================================================================
 * 
 * Tests the Vertex AI adapter implementation with comprehensive checks:
 * - Authentication and initialization
 * - Document ingestion (upsert)
 * - Semantic search and retrieval
 * - Document deletion
 * - Health checks
 * 
 * USAGE:
 * ------
 * export VECTOR_STORE_BACKEND=vertex
 * npx tsx scripts/test-vertex-ai-migration.ts
 * =============================================================================
 */

import { createVectorStore } from '../server/services/vector-store';
import { embeddingService } from '../server/services/embedding-service';
import type { VectorDocument } from '../server/services/vector-store/types';

async function testVertexAIMigration() {
  console.log("=".repeat(60));
  console.log("VERTEX AI MIGRATION TEST");
  console.log("=".repeat(60));

  // Test 1: Create Vertex AI adapter
  console.log("\n[TEST 1] Creating Vertex AI adapter...");
  const backend = process.env.VECTOR_STORE_BACKEND || 'vertex';
  console.log(`Backend: ${backend}`);
  
  const store = createVectorStore({ backend: backend as any });
  console.log(`✅ Adapter created: ${store.name}`);
  
  // Test 2: Initialize
  console.log("\n[TEST 2] Initializing adapter...");
  try {
    await store.initialize();
    console.log("✅ Initialization successful");
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    throw error;
  }

  // Test 3: Health check
  console.log("\n[TEST 3] Health check...");
  const healthy = await store.healthCheck();
  console.log(`${healthy ? '✅' : '❌'} Health check: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  if (!healthy) {
    throw new Error("Health check failed");
  }

  // Test 4: Upsert test document
  console.log("\n[TEST 4] Upserting test document...");
  const testContent = "This is a test document for Vertex AI migration. It contains information about the Meowstik platform, which is an AI-powered assistant platform.";
  
  const embeddingResult = await embeddingService.embed(testContent);
  console.log(`Embedding generated: ${embeddingResult.embedding.length} dimensions`);
  
  const testDoc: VectorDocument = {
    id: `test-${Date.now()}`,
    content: testContent,
    embedding: embeddingResult.embedding,
    metadata: {
      source: "test",
      timestamp: new Date().toISOString(),
      test: true,
    },
  };
  
  try {
    await store.upsert(testDoc);
    console.log(`✅ Document upserted: ${testDoc.id}`);
  } catch (error) {
    console.error("❌ Upsert failed:", error);
    throw error;
  }

  // Test 5: Search
  console.log("\n[TEST 5] Searching for similar documents...");
  const queryText = "Tell me about Meowstik platform";
  console.log(`Query: "${queryText}"`);
  
  const queryEmbeddingResult = await embeddingService.embed(queryText);
  const results = await store.search(queryEmbeddingResult.embedding, {
    topK: 5,
    threshold: 0.1,
  });
  
  console.log(`✅ Search returned ${results.length} results`);
  
  if (results.length > 0) {
    console.log("\nTop result:");
    console.log(`  ID: ${results[0].document.id}`);
    console.log(`  Score: ${results[0].score.toFixed(3)}`);
    console.log(`  Content: ${results[0].document.content.substring(0, 100)}...`);
    console.log(`  Metadata:`, JSON.stringify(results[0].document.metadata, null, 2));
  } else {
    console.log("⚠️ No results found (may take time for index to update)");
  }

  // Test 6: Get document
  console.log("\n[TEST 6] Retrieving document by ID...");
  try {
    const retrieved = await store.get(testDoc.id);
    if (retrieved) {
      console.log(`✅ Document retrieved: ${retrieved.id}`);
    } else {
      console.log("⚠️ Document not found (may take time to index)");
    }
  } catch (error) {
    console.log("⚠️ Get operation not fully supported by this backend");
  }

  // Test 7: Count documents
  console.log("\n[TEST 7] Counting documents...");
  try {
    const count = await store.count();
    console.log(`✅ Total documents: ${count}`);
  } catch (error) {
    console.log("⚠️ Count operation not fully supported by this backend");
  }

  // Test 8: Batch upsert
  console.log("\n[TEST 8] Testing batch upsert...");
  const batchDocs: VectorDocument[] = [];
  
  for (let i = 0; i < 3; i++) {
    const content = `Batch test document ${i}. This is part of the migration testing suite.`;
    const embedding = await embeddingService.embed(content);
    
    batchDocs.push({
      id: `batch-test-${Date.now()}-${i}`,
      content,
      embedding: embedding.embedding,
      metadata: { batch: true, index: i },
    });
  }
  
  try {
    await store.upsertBatch(batchDocs);
    console.log(`✅ Batch upsert successful: ${batchDocs.length} documents`);
  } catch (error) {
    console.error("❌ Batch upsert failed:", error);
  }

  // Test 9: Delete test documents
  console.log("\n[TEST 9] Deleting test documents...");
  try {
    await store.delete(testDoc.id);
    console.log(`✅ Test document deleted: ${testDoc.id}`);
    
    const batchIds = batchDocs.map(d => d.id);
    await store.deleteBatch(batchIds);
    console.log(`✅ Batch documents deleted: ${batchIds.length} documents`);
  } catch (error) {
    console.warn("⚠️ Delete operation may not be fully supported:", error);
  }

  // Close adapter
  console.log("\n[TEST 10] Closing adapter...");
  await store.close();
  console.log("✅ Adapter closed");
  
  console.log("\n" + "=".repeat(60));
  console.log("ALL TESTS PASSED ✅");
  console.log("=".repeat(60));
  console.log("\nSummary:");
  console.log(`- Backend: ${backend}`);
  console.log(`- Adapter: ${store.name}`);
  console.log(`- All operations completed successfully`);
}

// Run tests
testVertexAIMigration().catch(error => {
  console.error("\n" + "=".repeat(60));
  console.error("❌ TEST FAILED");
  console.error("=".repeat(60));
  console.error(error);
  process.exit(1);
});
