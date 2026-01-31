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

  // Initialize NotebookLM with options
  const nlm = new NotebookLM({
    headless: false, // Set to true for headless mode
    debug: true,
    cookiePath: './.notebooklm-cookies.json',
  });

  try {
    // Initialize browser
    console.log('1. Initializing browser...');
    await nlm.initialize();

    // Authenticate
    console.log('\n2. Authenticating...');
    console.log('Note: This will open a browser window for manual login.');
    console.log('Please log in to your Google account to continue.');
    
    // Option 1: Manual login (recommended for first time)
    await nlm.manualLogin(300000); // 5 minutes timeout for manual login

    // Option 2: Automatic login with credentials (requires 2FA handling)
    // await nlm.authenticate({
    //   email: 'your-email@gmail.com',
    //   password: 'your-password',
    // });

    // Check authentication
    const isAuth = await nlm.isAuthenticated();
    console.log(`Authentication status: ${isAuth ? '✓ Authenticated' : '✗ Not authenticated'}`);

    if (!isAuth) {
      throw new Error('Authentication failed');
    }

    // Create a new notebook
    console.log('\n3. Creating a new notebook...');
    const notebookId = await nlm.createNotebook('Test Notebook');
    console.log(`✓ Notebook created with ID: ${notebookId}`);

    // Add a source (file upload example)
    console.log('\n4. Adding a source...');
    console.log('Note: This example assumes you have a test PDF file.');
    
    // Example: Upload a file
    // Make sure to replace with an actual file path
    const testFilePath = path.join(process.cwd(), 'test-document.pdf');
    
    try {
      const sourceInfo = await nlm.addSource({
        type: 'file',
        path: testFilePath,
        title: 'Test Document',
      });
      console.log(`✓ Source added: ${sourceInfo.title}`);
    } catch (error) {
      console.log(`⚠ Could not add source (file might not exist): ${(error as Error).message}`);
      console.log('Skipping source addition for this example.');
    }

    // Ask a question
    console.log('\n5. Asking a question...');
    
    // Set up event listeners
    nlm.on('query:start', (question) => {
      console.log(`  → Question: ${question}`);
    });

    nlm.on('query:response', (answer) => {
      console.log(`  ← Answer received (${answer.text.length} characters)`);
      if (answer.citations.length > 0) {
        console.log(`  Citations: ${answer.citations.length}`);
      }
    });

    try {
      const answer = await nlm.ask('What is the main topic of this document?');
      console.log('\nAnswer:');
      console.log('-'.repeat(60));
      console.log(answer.text);
      console.log('-'.repeat(60));
      
      if (answer.citations.length > 0) {
        console.log('\nCitations:');
        answer.citations.forEach((citation, i) => {
          console.log(`  ${i + 1}. ${citation.source}: "${citation.quote}"`);
        });
      }
    } catch (error) {
      console.log(`⚠ Could not ask question: ${(error as Error).message}`);
    }

    // Take a screenshot
    console.log('\n6. Taking a screenshot...');
    const screenshotPath = './notebooklm-screenshot.png';
    await nlm.screenshot(screenshotPath);
    console.log(`✓ Screenshot saved to: ${screenshotPath}`);

    console.log('\n7. Success! All operations completed.');
    
  } catch (error) {
    console.error('\n✗ Error:', error);
    throw error;
  } finally {
    // Clean up
    console.log('\n8. Cleaning up...');
    await nlm.close();
    console.log('✓ Browser closed');
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Example completed successfully!');
  console.log('='.repeat(60));
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
