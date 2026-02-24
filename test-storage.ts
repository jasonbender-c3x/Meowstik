
import { storage } from './server/storage.js';

async function test() {
  try {
    console.log('Testing storage...');
    const user = await storage.getUserByEmail('test@example.com');
    console.log('User:', user);
  } catch (e) {
    console.error('Storage error:', e);
  }
}

test();
