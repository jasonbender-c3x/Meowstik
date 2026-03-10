/**
 * NotebookLM - Main class for NotebookLM Puppeteer integration
 */

import { EventEmitter } from 'events';
import { Page } from 'playwright';
import { BrowserManager } from './browser-manager';
import { AuthManager } from './auth-manager';
import {
  NotebookLMOptions,
  AuthOptions,
  NotebookInfo,
  Source,
  SourceInfo,
  Answer,
  Citation,
  Summary,
  StudyGuide,
  FAQ,
  NotebookLMError,
} from './types';
import {
  SELECTORS,
  smartClick,
  smartFill,
  smartWaitForSelector,
  waitForNetworkIdle,
  waitForAIResponse,
  waitForUploadComplete,
  extractTextContent,
} from './selectors';
import { withRetry, sleep } from './utils';

export class NotebookLM extends EventEmitter {
  private browserManager: BrowserManager;
  private authManager: AuthManager | null = null;
  private options: NotebookLMOptions;
  private currentNotebookId: string | null = null;

  constructor(options: NotebookLMOptions = {}) {
    super();
    this.options = {
      headless: true,
      timeout: 30000,
      debug: false,
      ...options,
    };

    this.browserManager = new BrowserManager({
      headless: this.options.headless,
      userDataDir: this.options.userDataDir,
    });
  }

  /**
   * Initialize the browser and set up authentication
   */
  async initialize(): Promise<void> {
    await this.browserManager.initialize();
    const page = await this.browserManager.getPage();
    this.authManager = new AuthManager(page, this.options.cookiePath);
  }

  /**
   * Authenticate with Google
   */
  async authenticate(options?: AuthOptions): Promise<void> {
    if (!this.authManager) {
      await this.initialize();
    }

    // Try loading existing cookies first
    const cookiesLoaded = await this.authManager!.loadCookies();
    
    if (cookiesLoaded && await this.authManager!.isAuthenticated()) {
      console.log('✓ Authenticated using saved session');
      return;
    }

    // If credentials provided, try automatic login
    if (options) {
      await this.authManager!.login(options);
    } else {
      // Otherwise, require manual login
      console.log('⚠ No credentials provided. Manual login required.');
      console.log('Set headless: false in options to see the browser window.');
      throw new NotebookLMError(
        'Authentication required. Please provide credentials or use manual login.',
        'AUTH_REQUIRED'
      );
    }
  }

  /**
   * Perform manual login (useful for 2FA scenarios)
   */
  async manualLogin(timeoutMs: number = 300000): Promise<void> {
    if (!this.authManager) {
      await this.initialize();
    }

    await this.authManager!.manualLogin(timeoutMs);
  }

  /**
   * Check if authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.authManager) {
      return false;
    }
    return this.authManager.isAuthenticated();
  }

  /**
   * Create a new notebook
   */
  async createNotebook(name: string): Promise<string> {
    const page = await this.browserManager.getPage();
    
    console.log(`Creating notebook: ${name}`);

    // Navigate to NotebookLM if not already there
    if (!page.url().includes('notebooklm.google.com')) {
      await page.goto('https://notebooklm.google.com', { waitUntil: 'networkidle' });
    }

    try {
      // Click create notebook button
      await withRetry(() => smartClick(page, SELECTORS.CREATE_NOTEBOOK_BUTTON), {
        maxAttempts: 3,
      });

      await sleep(2000);

      // The notebook might be created automatically, or we might need to enter a name
      // For now, we'll assume it's created and we can proceed
      
      // Get the notebook ID from the URL
      await page.waitForTimeout(3000);
      const url = page.url();
      const notebookId = this.extractNotebookIdFromUrl(url);

      if (notebookId) {
        this.currentNotebookId = notebookId;
        console.log(`✓ Notebook created: ${notebookId}`);
        return notebookId;
      }

      throw new NotebookLMError('Failed to create notebook', 'CREATE_FAILED');
    } catch (error) {
      console.error('Error creating notebook:', error);
      throw error;
    }
  }

  /**
   * Open an existing notebook
   */
  async openNotebook(notebookId: string): Promise<void> {
    const page = await this.browserManager.getPage();
    
    console.log(`Opening notebook: ${notebookId}`);
    
    await page.goto(`https://notebooklm.google.com/notebook/${notebookId}`, {
      waitUntil: 'networkidle',
    });

    this.currentNotebookId = notebookId;
    console.log(`✓ Notebook opened: ${notebookId}`);
  }

  /**
   * Add a source to the current notebook
   */
  async addSource(source: Source): Promise<SourceInfo> {
    if (!this.currentNotebookId) {
      throw new NotebookLMError('No notebook is currently open', 'NO_NOTEBOOK');
    }

    const page = await this.browserManager.getPage();

    console.log(`Adding source: ${source.title || source.path || source.url}`);
    this.emit('upload:start', source.title || source.path || source.url || 'Unknown');

    try {
      if (source.type === 'file' && source.path) {
        await this.uploadFile(page, source.path);
      } else if (source.type === 'url' && source.url) {
        await this.addUrlSource(page, source.url);
      } else if (source.type === 'text' && source.text) {
        await this.addTextSource(page, source.text, source.title);
      } else {
        throw new NotebookLMError('Invalid source type or missing required fields', 'INVALID_SOURCE');
      }

      const sourceInfo: SourceInfo = {
        id: Date.now().toString(), // Simplified - in production, extract from UI
        type: source.type,
        title: source.title || source.path || source.url || 'Untitled',
        status: 'ready',
        uploadedAt: new Date(),
      };

      this.emit('upload:complete', sourceInfo);
      console.log(`✓ Source added successfully`);
      
      return sourceInfo;
    } catch (error) {
      this.emit('upload:error', error as Error);
      throw error;
    }
  }

  /**
   * Ask a question to the notebook
   */
  async ask(question: string): Promise<Answer> {
    if (!this.currentNotebookId) {
      throw new NotebookLMError('No notebook is currently open', 'NO_NOTEBOOK');
    }

    const page = await this.browserManager.getPage();

    console.log(`Asking: ${question}`);
    this.emit('query:start', question);

    try {
      // Type the question
      await smartFill(page, SELECTORS.QUESTION_INPUT, question);
      
      // Submit the question
      await page.keyboard.press('Enter');
      
      // Wait for AI response
      await waitForAIResponse(page);

      // Extract answer
      const answerText = await this.extractAnswer(page);
      const citations = await this.extractCitations(page);

      const answer: Answer = {
        text: answerText,
        citations,
      };

      this.emit('query:response', answer);
      console.log(`✓ Answer received (${answerText.length} characters)`);

      return answer;
    } catch (error) {
      this.emit('query:error', error as Error);
      throw error;
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(filepath: string): Promise<void> {
    await this.browserManager.takeScreenshot(filepath);
  }

  /**
   * Close the browser and clean up
   */
  async close(): Promise<void> {
    await this.browserManager.close();
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private extractNotebookIdFromUrl(url: string): string | null {
    const match = url.match(/\/notebook\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  private async uploadFile(page: Page, filePath: string): Promise<void> {
    // Click add source button
    await smartClick(page, SELECTORS.ADD_SOURCE_BUTTON);
    await sleep(1000);

    // Find and upload file
    const fileInput = await page.$(SELECTORS.FILE_INPUT.primary);
    if (!fileInput) {
      throw new NotebookLMError('File input not found', 'UPLOAD_FAILED');
    }

    await fileInput.setInputFiles(filePath);
    
    // Wait for upload to complete
    await waitForUploadComplete(page);
  }

  private async addUrlSource(page: Page, url: string): Promise<void> {
    // Click add source button
    await smartClick(page, SELECTORS.ADD_SOURCE_BUTTON);
    await sleep(1000);

    // This would need to be implemented based on actual UI
    // For now, throw not implemented
    throw new NotebookLMError('URL source addition not yet implemented', 'NOT_IMPLEMENTED');
  }

  private async addTextSource(page: Page, text: string, title?: string): Promise<void> {
    // Click add source button
    await smartClick(page, SELECTORS.ADD_SOURCE_BUTTON);
    await sleep(1000);

    // This would need to be implemented based on actual UI
    throw new NotebookLMError('Text source addition not yet implemented', 'NOT_IMPLEMENTED');
  }

  private async extractAnswer(page: Page): Promise<string> {
    try {
      // Wait for answer container
      await smartWaitForSelector(page, SELECTORS.ANSWER_CONTAINER, { timeout: 10000 });
      
      // Extract text from answer
      const answers = await page.$$(SELECTORS.ANSWER_CONTAINER.primary);
      if (answers.length === 0) {
        // Try fallbacks
        for (const fallback of SELECTORS.ANSWER_CONTAINER.fallbacks) {
          const fallbackAnswers = await page.$$(fallback);
          if (fallbackAnswers.length > 0) {
            const lastAnswer = fallbackAnswers[fallbackAnswers.length - 1];
            const text = await lastAnswer.textContent();
            return text?.trim() || '';
          }
        }
        throw new Error('No answer found');
      }

      // Get the last answer (most recent)
      const lastAnswer = answers[answers.length - 1];
      const text = await lastAnswer.textContent();
      return text?.trim() || '';
    } catch (error) {
      console.error('Error extracting answer:', error);
      return '';
    }
  }

  private async extractCitations(page: Page): Promise<Citation[]> {
    try {
      const citationElements = await page.$$(SELECTORS.CITATION.primary);
      const citations: Citation[] = [];

      for (const element of citationElements) {
        const text = await element.textContent();
        if (text) {
          citations.push({
            source: 'Unknown', // Would need to extract from UI
            quote: text.trim(),
          });
        }
      }

      return citations;
    } catch (error) {
      console.error('Error extracting citations:', error);
      return [];
    }
  }
}
