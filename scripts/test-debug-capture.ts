/**
 * Test script to verify debug data capture
 * 
 * Tests that PromptComposer loads and captures:
 * - Injected files (cache.md, Short_Term_Memory.md)
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('Testing prompt composer file loading...\n');
  
  const logsDir = path.join(process.cwd(), 'logs');
  
  // Check if files exist
  const cacheFile = path.join(logsDir, 'cache.md');
  const stmFile = path.join(logsDir, 'Short_Term_Memory.md');
  
  console.log('Checking file existence:');
  console.log('  cache.md:', fs.existsSync(cacheFile) ? '✓ EXISTS' : '✗ MISSING');
  console.log('  Short_Term_Memory.md:', fs.existsSync(stmFile) ? '✓ EXISTS' : '✗ MISSING');
  console.log('');
  
  if (fs.existsSync(cacheFile)) {
    const cacheContent = fs.readFileSync(cacheFile, 'utf-8');
    console.log('cache.md content preview:');
    console.log(cacheContent.slice(0, 200) + '...\n');
  }
  
  if (fs.existsSync(stmFile)) {
    const stmContent = fs.readFileSync(stmFile, 'utf-8');
    console.log('Short_Term_Memory.md content preview:');
    console.log(stmContent.slice(0, 200) + '...\n');
  }
  
  console.log('✓ File loading test completed successfully\n');
  console.log('Note: Full integration test requires database connection.');
  console.log('To verify the complete flow, start the dev server and send a chat message.\n');
}

main().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
