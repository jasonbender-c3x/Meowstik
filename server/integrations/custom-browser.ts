/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  CUSTOM SELF-HOSTED BROWSER INTEGRATION                                      ║
 * ║  Cost-optimized browser infrastructure for AI agents                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides headless browser capabilities using a self-hosted
 * Browserless instance on Google Cloud Run. It enables web scraping, screenshot
 * capture, and browser automation with significant cost savings over SaaS
 * alternatives and support for residential proxy rotation.
 * 
 * FEATURES:
 * - Scout Mode: Fast text extraction (~$0.0004/page)
 * - Sniper Mode: Full rendering with screenshots (~$0.01/page)
 * - Residential proxy support for stealth
 * - Request interception for resource optimization
 * - WebSocket connection management
 * 
 * SETUP:
 * Requires CUSTOM_BROWSER_WS_ENDPOINT and CUSTOM_BROWSER_AUTH_TOKEN environment variables.
 * Optional: RESIDENTIAL_PROXY_URL, RESIDENTIAL_PROXY_USER, RESIDENTIAL_PROXY_PASSWORD
 */

import puppeteer, { Browser, Page } from 'puppeteer-core';

// Configuration from environment variables
const BROWSER_WS_ENDPOINT = process.env.CUSTOM_BROWSER_WS_ENDPOINT;
const AUTH_TOKEN = process.env.CUSTOM_BROWSER_AUTH_TOKEN;

// Optional: Residential Proxy Configuration
const RESIDENTIAL_PROXY_URL = process.env.RESIDENTIAL_PROXY_URL;
const RESIDENTIAL_PROXY_USER = process.env.RESIDENTIAL_PROXY_USER;
const RESIDENTIAL_PROXY_PASSWORD = process.env.RESIDENTIAL_PROXY_PASSWORD;

// Default timeout for operations (can be overridden)
const DEFAULT_TIMEOUT = 30000;

/**
 * Check if the custom browser is properly configured
 */
export function isConfigured(): boolean {
  return !!(BROWSER_WS_ENDPOINT && AUTH_TOKEN);
}

/**
 * Get configuration status with details
 */
export function getConfigurationStatus(): {
  configured: boolean;
  hasProxy: boolean;
  endpoint?: string;
} {
  return {
    configured: isConfigured(),
    hasProxy: !!(RESIDENTIAL_PROXY_URL && RESIDENTIAL_PROXY_USER && RESIDENTIAL_PROXY_PASSWORD),
    endpoint: BROWSER_WS_ENDPOINT ? BROWSER_WS_ENDPOINT.replace(/wss?:\/\//, '').split('?')[0] : undefined,
  };
}

/**
 * Connect to the self-hosted browser instance
 */
export async function connectToBrowser(): Promise<Browser> {
  if (!BROWSER_WS_ENDPOINT || !AUTH_TOKEN) {
    throw new Error(
      'Custom browser not configured. Set CUSTOM_BROWSER_WS_ENDPOINT and CUSTOM_BROWSER_AUTH_TOKEN environment variables.'
    );
  }

  console.log('🔌 Connecting to Self-Hosted Browser...');
  
  // Construct the secure WebSocket URL with authentication
  const endpoint = `${BROWSER_WS_ENDPOINT}?token=${AUTH_TOKEN}`;

  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: endpoint,
    });

    console.log('✅ Connected to browser successfully');
    return browser;
  } catch (error: any) {
    console.error('❌ Failed to connect to browser:', error.message);
    throw new Error(`Browser connection failed: ${error.message}`);
  }
}

/**
 * Options for scraping a page
 */
export interface ScrapeOptions {
  /**
   * Full render mode (Sniper):
   * - Loads all resources (images, CSS, fonts)
   * - Higher cost (~$0.01/page)
   * - Suitable for screenshots and visual verification
   * 
   * Scout mode (fullRender: false):
   * - Blocks heavy resources
   * - Lower cost (~$0.0004/page)
   * - Suitable for text extraction and research
   */
  fullRender?: boolean;

  /**
   * Take a screenshot of the page
   */
  screenshot?: boolean;

  /**
   * Wait for a specific selector before extracting content
   */
  waitForSelector?: string;

  /**
   * Maximum time to wait for page load (milliseconds)
   */
  timeout?: number;

  /**
   * Extract HTML instead of just text
   */
  includeHtml?: boolean;

  /**
   * User agent string to use
   */
  userAgent?: string;
}

/**
 * Result from scraping a page
 */
export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  html?: string;
  screenshot?: Buffer;
  success: boolean;
  error?: string;
  mode: 'scout' | 'sniper';
  estimatedCost: number; // in dollars
}

/**
 * Scrape a page with cost optimization mode
 * 
 * @param url The URL to visit
 * @param options Scraping options including fullRender mode
 * @returns Scraped content and metadata
 * 
 * @example
 * // Scout Mode: Fast text extraction
 * const result = await scrapePage('https://example.com', { fullRender: false });
 * 
 * @example
 * // Sniper Mode: Full rendering with screenshot
 * const result = await scrapePage('https://example.com', { 
 *   fullRender: true, 
 *   screenshot: true 
 * });
 */
export async function scrapePage(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const {
    fullRender = false,
    screenshot = false,
    waitForSelector,
    timeout = DEFAULT_TIMEOUT,
    includeHtml = false,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  } = options;

  const mode = fullRender ? 'sniper' : 'scout';
  const estimatedCost = fullRender ? 0.01 : 0.0004;

  console.log(`🎯 Scraping in ${mode.toUpperCase()} mode: ${url}`);

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await connectToBrowser();
    page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(userAgent);

    // Apply residential proxy if configured
    if (RESIDENTIAL_PROXY_URL && RESIDENTIAL_PROXY_USER && RESIDENTIAL_PROXY_PASSWORD) {
      console.log('🕵️‍♀️ Applying Residential Proxy...');
      await page.authenticate({
        username: RESIDENTIAL_PROXY_USER,
        password: RESIDENTIAL_PROXY_PASSWORD,
      });
    }

    // OPTIMIZATION: Request interception for Scout/Sniper modes
    await page.setRequestInterception(true);
    
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      
      // Scout Mode: Block everything except HTML/Scripts
      if (!fullRender && ['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } 
      // Sniper Mode: Load everything for full rendering
      else {
        req.continue();
      }
    });

    // Navigate to the page
    await page.goto(url, { 
      waitUntil: fullRender ? 'networkidle0' : 'domcontentloaded', 
      timeout 
    });

    // Wait for specific selector if requested
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout });
    }

    // Extract page title
    const title = await page.title();

    // Extract text content
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const removeSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 
        'aside', 'iframe', 'noscript', '.ad', '.advertisement',
        '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'
      ];
      
      removeSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove());
      });

      // Try to find main content area
      const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.post', '.article'];
      let mainContent: Element | null = null;
      
      for (const selector of mainSelectors) {
        mainContent = document.querySelector(selector);
        if (mainContent) break;
      }
      
      const source = mainContent || document.body;
      
      // Extract structured content
      const paragraphs: string[] = [];
      
      // Headings
      source.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        const text = (el as HTMLElement).innerText.trim();
        if (text.length > 5) {
          paragraphs.push(`## ${text}`);
        }
      });
      
      // Paragraphs
      source.querySelectorAll('p').forEach(el => {
        const text = (el as HTMLElement).innerText.trim();
        if (text.length > 20) {
          paragraphs.push(text);
        }
      });
      
      // List items
      source.querySelectorAll('li').forEach(el => {
        const text = (el as HTMLElement).innerText.trim();
        if (text.length > 10) {
          paragraphs.push(`• ${text}`);
        }
      });
      
      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n').slice(0, 50000);
      }
      
      return source.textContent?.replace(/\s+/g, ' ').trim().slice(0, 50000) || '';
    });

    // Extract HTML if requested
    let html: string | undefined;
    if (includeHtml) {
      html = await page.content();
    }

    // Take screenshot if requested
    let screenshotBuffer: Buffer | undefined;
    if (screenshot) {
      screenshotBuffer = await page.screenshot({
        fullPage: true,
        type: 'png',
      }) as Buffer;
      console.log(`📸 Screenshot captured (${screenshotBuffer.length} bytes)`);
    }

    console.log(`✅ Scraping completed: ${content.length} characters extracted`);

    return {
      url,
      title,
      content,
      html,
      screenshot: screenshotBuffer,
      success: true,
      mode,
      estimatedCost,
    };

  } catch (error: any) {
    console.error(`❌ Scraping failed: ${error.message}`);
    return {
      url,
      title: '',
      content: '',
      success: false,
      error: error.message,
      mode,
      estimatedCost,
    };
  } finally {
    // Cleanup
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Batch scrape multiple URLs with concurrency control
 * 
 * @param urls Array of URLs to scrape
 * @param options Scraping options
 * @param concurrency Maximum number of concurrent scrapes (default: 3)
 */
export async function batchScrape(
  urls: string[],
  options: ScrapeOptions = {},
  concurrency: number = 3
): Promise<{
  results: ScrapeResult[];
  successful: number;
  failed: number;
  totalCost: number;
}> {
  console.log(`📦 Batch scraping ${urls.length} URLs with concurrency ${concurrency}`);

  const results: ScrapeResult[] = [];
  const chunks: string[][] = [];

  // Split URLs into chunks based on concurrency
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency));
  }

  // Process each chunk
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(url => scrapePage(url, options))
    );
    results.push(...chunkResults);
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalCost = results.reduce((sum, r) => sum + r.estimatedCost, 0);

  console.log(`📊 Batch complete: ${successful} successful, ${failed} failed, $${totalCost.toFixed(4)} estimated cost`);

  return {
    results,
    successful,
    failed,
    totalCost,
  };
}

/**
 * Execute custom browser actions on a page
 */
export async function executeBrowserAction(
  url: string,
  actions: Array<{
    type: 'click' | 'type' | 'scroll' | 'wait' | 'screenshot';
    selector?: string;
    text?: string;
    delay?: number;
  }>,
  options: { timeout?: number; fullRender?: boolean } = {}
): Promise<{
  success: boolean;
  results: unknown[];
  error?: string;
}> {
  const { timeout = DEFAULT_TIMEOUT, fullRender = false } = options;
  
  let browser: Browser | null = null;
  let page: Page | null = null;
  const results: unknown[] = [];

  try {
    browser = await connectToBrowser();
    page = await browser.newPage();

    // Set up request interception
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (!fullRender && ['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate to page
    await page.goto(url, { 
      waitUntil: fullRender ? 'networkidle0' : 'domcontentloaded', 
      timeout 
    });

    // Execute actions
    for (const action of actions) {
      switch (action.type) {
        case 'click':
          if (action.selector) {
            await page.click(action.selector);
            results.push({ type: 'click', selector: action.selector, success: true });
          }
          break;

        case 'type':
          if (action.selector && action.text) {
            await page.type(action.selector, action.text);
            results.push({ type: 'type', selector: action.selector, success: true });
          }
          break;

        case 'scroll':
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          results.push({ type: 'scroll', success: true });
          break;

        case 'wait':
          await page.waitForTimeout(action.delay || 1000);
          results.push({ type: 'wait', delay: action.delay || 1000, success: true });
          break;

        case 'screenshot':
          const screenshot = await page.screenshot({ type: 'png' });
          results.push({ 
            type: 'screenshot', 
            size: (screenshot as Buffer).length, 
            success: true 
          });
          break;
      }
    }

    return {
      success: true,
      results,
    };

  } catch (error: any) {
    return {
      success: false,
      results,
      error: error.message,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export default {
  isConfigured,
  getConfigurationStatus,
  connectToBrowser,
  scrapePage,
  batchScrape,
  executeBrowserAction,
};
