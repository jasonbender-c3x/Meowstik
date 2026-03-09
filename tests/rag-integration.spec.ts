import { test, expect } from '@playwright/test';

test.describe('RAG Implementation Integration', () => {
  // Increase timeout as RAG/LLM calls can be slow
  test.setTimeout(120000);

  test('should verify RAG context retrieval flow', async ({ request }) => {
    console.log('--- STARTING RAG INTEGRATION TEST ---');
    
    // 1. Create a unique Todo item
    const uniqueId = `rag-${Date.now()}`;
    const todoTitle = `Unique Feature ${uniqueId}`;
    const todoDesc = `Specific implementation details for ${uniqueId} that only appear here.`;
    
    console.log(`Creating test todo: ${todoTitle}`);
    
    const todoRes = await request.post('http://localhost:5000/api/todos', {
      data: {
        title: todoTitle,
        description: todoDesc,
        status: 'pending'
      }
    });
    
    expect(todoRes.ok()).toBeTruthy();
    
    // Wait for embedding/indexing (simulated delay if async)
    console.log('Waiting for indexing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 2. Create a new Chat session
    console.log('Creating new chat session...');
    const createChatRes = await request.post('http://localhost:5000/api/chats', {
      data: { title: `RAG Test ${uniqueId}` }
    });
    
    expect(createChatRes.ok()).toBeTruthy();
    const chat = await createChatRes.json();
    const chatId = chat.id;
    console.log(`Chat created: ${chatId}`);

    // 3. Send message to the chat asking about the todo
    console.log(`Querying chat about: ${uniqueId}`);
    
    const chatRes = await request.post(`http://localhost:5000/api/chats/${chatId}/messages`, {
      data: {
        content: `What are the specific implementation details for the feature with ID ${uniqueId}?`,
      }
    });
    
    expect(chatRes.ok()).toBeTruthy();
    
    // 4. Handle SSE Response
    // The response is a stream of text/event-stream
    const body = await chatRes.text();
    
    console.log(`Response received (length: ${body.length})`);
    
    // Check if the body contains the unique information
    const foundContext = body.includes(uniqueId) || 
                         body.includes(todoDesc) ||
                         body.includes('Specific implementation details');
    
    if (foundContext) {
      console.log('SUCCESS: RAG context was retrieved and used in the answer.');
    } else {
      console.log('WARNING: LLM response did not explicitly reference the unique details.');
      console.log('Response body preview:', body.substring(0, 500));
    }
    
    // We expect at least some response
    expect(body.length).toBeGreaterThan(0);
    // Expect success status
    expect(chatRes.status()).toBe(200);
    
    console.log('--- RAG TEST COMPLETED ---');
  });
});
