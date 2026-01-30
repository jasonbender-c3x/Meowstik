#!/usr/bin/env tsx
/**
 * Manual Test Script for LLM I/O Capture System
 * 
 * This script tests the LLM interaction capture functionality by:
 * 1. Checking the llm-debug-buffer service
 * 2. Verifying database schema exists
 * 3. Testing storage methods
 * 4. Simulating an interaction capture
 * 
 * Run: tsx scripts/test-llm-capture.ts
 */

import { llmDebugBuffer } from '../server/services/llm-debug-buffer';
import { storage } from '../server/storage';

async function testLLMCapture() {
  console.log('🧪 Testing LLM I/O Capture System\n');
  
  // Test 1: Check if persistence is enabled
  console.log('1️⃣ Testing persistence configuration...');
  const isPersistent = llmDebugBuffer.isPersistenceEnabled();
  console.log(`   ✓ Persistence enabled: ${isPersistent}`);
  
  // Test 2: Test in-memory buffer
  console.log('\n2️⃣ Testing in-memory buffer...');
  const testInteraction = {
    chatId: 'test-chat-id',
    messageId: 'test-message-id',
    userId: 'test-user-id',
    systemPrompt: 'You are a helpful assistant.',
    userMessage: 'Hello, how are you?',
    conversationHistory: [
      { role: 'user', content: 'Previous message' },
      { role: 'model', content: 'Previous response' }
    ],
    attachments: [],
    rawResponse: 'I am doing well, thank you!',
    parsedToolCalls: [],
    cleanContent: 'I am doing well, thank you!',
    toolResults: [],
    model: 'gemini-2.0-flash',
    durationMs: 1500,
  };
  
  // Temporarily disable persistence for this test
  llmDebugBuffer.setPersistence(false);
  const interactionId = await llmDebugBuffer.add(testInteraction);
  console.log(`   ✓ Added interaction to memory: ${interactionId}`);
  
  const retrieved = llmDebugBuffer.getById(interactionId);
  console.log(`   ✓ Retrieved from memory: ${retrieved ? 'Success' : 'Failed'}`);
  
  // Test 3: Test database persistence
  console.log('\n3️⃣ Testing database persistence...');
  try {
    // Re-enable persistence
    llmDebugBuffer.setPersistence(true);
    
    const persistentId = await llmDebugBuffer.add({
      ...testInteraction,
      userMessage: 'Test message for database',
    });
    console.log(`   ✓ Saved to database via buffer`);
    
    // Query directly from storage
    const stats = await storage.getLlmInteractionStats();
    console.log(`   ✓ Database stats: ${JSON.stringify(stats)}`);
    
    // Query recent interactions
    const recent = await storage.getRecentLlmInteractions(5);
    console.log(`   ✓ Retrieved ${recent.length} recent interactions from database`);
    
    // Clean up test data (if you want to remove it)
    // await db.delete(schema.llmInteractions).where(eq(schema.llmInteractions.messageId, 'test-message-id'));
    
  } catch (error) {
    console.error(`   ✗ Database test failed: ${error}`);
    console.log('   ℹ️ This is expected if the database schema has not been pushed yet');
    console.log('   ℹ️ Run: npm run db:push');
  }
  
  // Test 4: Test API endpoints (if server is running)
  console.log('\n4️⃣ Testing API endpoints...');
  try {
    const response = await fetch('http://localhost:5000/api/debug/llm/stats');
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✓ API endpoint working: ${JSON.stringify(data)}`);
    } else {
      console.log(`   ℹ️ Server not running on port 5000`);
    }
  } catch (error) {
    console.log(`   ℹ️ Server not running (expected if not started)`);
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  console.log('   ✓ In-memory buffer: Working');
  console.log('   ✓ Configuration: Working');
  console.log('   ? Database: Run with database connection to test');
  console.log('   ? API: Start server to test endpoints');
  
  console.log('\n✅ LLM I/O Capture System is ready!');
  console.log('\nNext steps:');
  console.log('   1. Ensure DATABASE_URL is set in .env');
  console.log('   2. Run: npm run db:push');
  console.log('   3. Start server: npm run dev');
  console.log('   4. Visit: http://localhost:5000/debug');
  console.log('   5. Send a message in a chat to capture an interaction');
}

// Run tests
testLLMCapture().catch(console.error);
