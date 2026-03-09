
import { webSearch } from './server/integrations/web-search';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') }); // Try server/.env if exists, or root .env
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function testSearches() {
  console.log('--- Testing Google Search ---');
  try {
    const googleResult = await webSearch({ 
      query: 'github copilot',
      provider: 'google'
    });
    console.log('Google Success:', googleResult.success);
    if (!googleResult.success) console.error('Google Error:', googleResult.error);
  } catch (e) {
    console.error('Google Exception:', e);
  }

  console.log('\n--- Testing Exa Search ---');
  try {
    const exaResult = await webSearch({ 
      query: 'github copilot',
      provider: 'exa'
    });
    console.log('Exa Success:', exaResult.success);
    if (!exaResult.success) console.error('Exa Error:', exaResult.error);
  } catch (e) {
    console.error('Exa Exception:', e);
  }
}

testSearches();
