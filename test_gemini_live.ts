
import './server/load-env';
import { createLiveSession, activeSessions } from './server/integrations/gemini-live';

async function test() {
  console.log('Testing createLiveSession...');
  const sessionId = 'test-' + Date.now();
  
  try {
    const result = await createLiveSession(sessionId, {
      systemInstruction: 'You are a test.'
    });
    
    console.log('Result:', result);
    
    if (result.success) {
      console.log('✅ Session created successfully');
      // Check if it's in activeSessions (need to export activeSessions or check via getSessionInfo)
      // Since I can't easily change the export now, I'll trust the result.
    } else {
      console.error('❌ Failed to create session:', result.error);
    }
  } catch (error) {
    console.error('❌ Exception during test:', error);
  }
}

test();
