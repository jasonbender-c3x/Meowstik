// @ts-nocheck
// NOTE: This example references the NotebookLM integration which has been removed.
// It is kept for reference only and is not compiled as part of the project.

/**
 * Example: NotebookLM Integration Usage
 *
 * This example demonstrates how to use the NotebookLM Puppeteer integration
 * to automate interactions with Google's NotebookLM.
 */

import { NotebookLM } from '../server/integrations/notebooklm';
import path from 'path';

async function main() {
  console.log('='.repeat(60));
  console.log('NotebookLM Automation Example');
  console.log('='.repeat(60));
  console.log();

  const nlm = new NotebookLM({
    headless: false,
    debug: true,
    cookiePath: './.notebooklm-cookies.json',
  });

  try {
    console.log('1. Initializing browser...');
    await nlm.initialize();

    console.log('\n2. Authenticating...');
    await nlm.manualLogin(300000);

    const isAuth = await nlm.isAuthenticated();
    console.log(`Authentication status: ${isAuth ? '✓ Authenticated' : '✗ Not authenticated'}`);

    if (!isAuth) {
      throw new Error('Authentication failed');
    }

    console.log('\n3. Creating a new notebook...');
    const notebookId = await nlm.createNotebook('Test Notebook');
    console.log(`✓ Notebook created with ID: ${notebookId}`);

    console.log('\n4. Adding a source...');
    const testFilePath = path.join(process.cwd(), 'test-document.pdf');

    try {
      const sourceInfo = await nlm.addSource({ type: 'file', path: testFilePath, title: 'Test Document' });
      console.log(`✓ Source added: ${sourceInfo.title}`);
    } catch (error) {
      console.log(`⚠ Could not add source: ${(error as Error).message}`);
    }

    console.log('\n5. Asking a question...');
    nlm.on('query:start', (question) => { console.log(`  → Question: ${question}`); });
    nlm.on('query:response', (answer) => { console.log(`  ← Answer received (${answer.text.length} chars)`); });

    try {
      const answer = await nlm.ask('What is the main topic of this document?');
      console.log(answer.text);
      answer.citations.forEach((citation, i) => {
        console.log(`  ${i + 1}. ${citation.source}: "${citation.quote}"`);
      });
    } catch (error) {
      console.log(`⚠ Could not ask question: ${(error as Error).message}`);
    }

    await nlm.screenshot('./notebooklm-screenshot.png');
  } catch (error) {
    console.error('\n✗ Error:', error);
    throw error;
  } finally {
    await nlm.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
