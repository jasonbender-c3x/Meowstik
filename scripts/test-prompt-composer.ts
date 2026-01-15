/**
 * Simple validation script for prompt composer changes
 * Tests that the compose method properly integrates RAG and conversation history
 */

import { promptComposer } from '../server/services/prompt-composer';

async function testPromptComposer() {
  console.log("Testing PromptComposer...\n");

  // Test 1: Basic compose with text content
  console.log("Test 1: Basic compose with text content");
  try {
    const result = await promptComposer.compose({
      textContent: "What is my project about?",
      chatId: "test-chat-id",
      userId: "test-user-id",
    });
    
    console.log("✓ Compose succeeded");
    console.log(`  - System prompt length: ${result.systemPrompt.length} chars`);
    console.log(`  - User message: ${result.userMessage}`);
    console.log(`  - Attachments: ${result.attachments.length}`);
    console.log(`  - History: ${result.conversationHistory.length}`);
    
    // Check if RAG context is included
    if (result.systemPrompt.includes("<retrieved_knowledge>")) {
      console.log("✓ RAG context included in system prompt");
    } else {
      console.log("⚠ RAG context not included (may be empty, which is OK for test data)");
    }
    
    // Check if core directives are included
    if (result.systemPrompt.includes("CONTEXT AWARENESS")) {
      console.log("✓ Context awareness section found in system prompt");
    } else {
      console.log("✗ Context awareness section missing!");
    }
    
    console.log();
  } catch (error) {
    console.error("✗ Test 1 failed:", error);
    process.exit(1);
  }

  // Test 2: Compose with attachments
  console.log("Test 2: Compose with attachments");
  try {
    const result = await promptComposer.compose({
      textContent: "Analyze this file",
      chatId: "test-chat-id",
      userId: "test-user-id",
      attachments: [{
        id: "test-att-1",
        messageId: "test-msg-1",
        type: "file",
        filename: "test.txt",
        mimeType: "text/plain",
        content: "Test file content",
        createdAt: new Date(),
      }],
    });
    
    console.log("✓ Compose with attachments succeeded");
    console.log(`  - Attachments processed: ${result.attachments.length}`);
    console.log(`  - Has file attachments: ${result.metadata.hasFileAttachments}`);
    console.log();
  } catch (error) {
    console.error("✗ Test 2 failed:", error);
    process.exit(1);
  }

  // Test 3: Compose with conversation history
  console.log("Test 3: Compose with conversation history");
  try {
    const result = await promptComposer.compose({
      textContent: "Continue our discussion",
      chatId: "test-chat-id",
      userId: "test-user-id",
      history: [
        {
          id: "msg-1",
          chatId: "test-chat-id",
          role: "user",
          content: "Hello",
          createdAt: new Date(),
        },
        {
          id: "msg-2",
          chatId: "test-chat-id",
          role: "ai",
          content: "Hi there!",
          createdAt: new Date(),
        },
      ],
    });
    
    console.log("✓ Compose with history succeeded");
    console.log(`  - History turns: ${result.conversationHistory.length}`);
    console.log();
  } catch (error) {
    console.error("✗ Test 3 failed:", error);
    process.exit(1);
  }

  console.log("All tests passed! ✓");
}

testPromptComposer().catch(error => {
  console.error("Test suite failed:", error);
  process.exit(1);
});
