
import { webSearch } from './server/integrations/web-search';
import dotenv from 'dotenv';
import path from 'path';

// Load env from the correct path
dotenv.config({ path: path.join(process.cwd(), 'Meowstik', '.env') });

async function testGoogle() {
  console.log('Testing Google Search...');
  console.log('API Key present:', !!process.env.GOOGLE_SEARCH_API_KEY);
  console.log('CSE ID present:', !!process.env.GOOGLE_SEARCH_ENGINE_ID);

  try {
    const result = await webSearch({ 
      query: 'github copilot cli',
      provider: 'google'
    });
    
    if (result.success) {
        console.log('SUCCESS: Google Search works.');
        process.exit(0);
    } else {
        console.error('FAILURE: ' + result.error);
        process.exit(1);
    }
  } catch (error) {
    console.error('EXCEPTION:', error);
    process.exit(1);
  }
}

testGoogle();
