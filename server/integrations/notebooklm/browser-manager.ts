/**
 * Browser Manager - Manages Playwright browser lifecycle
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { LaunchOptions } from './types';
import path from 'path';
import fs from 'fs/promises';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: LaunchOptions;

  constructor(options: LaunchOptions = {}) {
    this.options = {
      headless: true,
      ...options,
    };
  }

  /**
   * Initialize the browser and create a new page
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      console.log('Browser already initialized');
      return;
    }

    console.log('Initializing browser...');
    
    const launchOptions: any = {
      headless: this.options.headless,
      args: this.options.args || [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    };

    // Use persistent context if userDataDir is specified
    if (this.options.userDataDir) {
      await fs.mkdir(this.options.userDataDir, { recursive: true });
      this.context = await chromium.launchPersistentContext(
        this.options.userDataDir,
        {
          ...launchOptions,
          viewport: { width: 1920, height: 1080 },
        }
      );
      // Get or create the first page
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
    } else {
      this.browser = await chromium.launch(launchOptions);
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      this.page = await this.context.newPage();
    }

    // Add stealth configurations
    await this.page.addInitScript(() => {
      // Overwrite the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Mock chrome property
      (window as any).chrome = {
        runtime: {},
      };

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: 'denied' } as PermissionStatus)
          : originalQuery(parameters);
    });

    console.log('Browser initialized successfully');
  }

  /**
   * Get the current page instance
   */
  async getPage(): Promise<Page> {
    if (!this.page) {
      await this.initialize();
    }
    return this.page!;
  }

  /**
   * Get the browser instance
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Get the browser context
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Take a screenshot of the current page
   */
  async takeScreenshot(filepath: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });
    
    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`Screenshot saved to: ${filepath}`);
  }

  /**
   * Navigate to a URL
   */
  async goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    const page = await this.getPage();
    await page.goto(url, {
      waitUntil: options?.waitUntil || 'networkidle',
      timeout: 60000,
    });
  }

  /**
   * Close the browser and clean up resources
   */
  async close(): Promise<void> {
    console.log('Closing browser...');
    
    if (this.page) {
      await this.page.close().catch(console.error);
      this.page = null;
    }

    if (this.context) {
      await this.context.close().catch(console.error);
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close().catch(console.error);
      this.browser = null;
    }

    console.log('Browser closed');
  }

  /**
   * Check if the browser is initialized
   */
  isInitialized(): boolean {
    return this.page !== null;
  }
}
