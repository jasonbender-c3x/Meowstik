/**
 * Selector Configuration and Utilities
 */

import { Page } from 'playwright';
import { SelectorConfig, SelectorNotFoundError } from './types';

/**
 * Selector configurations for NotebookLM UI elements
 * Using multiple fallbacks for resilience against UI changes
 */
export const SELECTORS: Record<string, SelectorConfig> = {
  // Notebook Management
  CREATE_NOTEBOOK_BUTTON: {
    primary: 'button[aria-label*="Create"]',
    fallbacks: [
      'button:has-text("Create")',
      'button:has-text("New notebook")',
      '[data-testid="create-notebook"]',
    ],
    ariaLabel: 'Create new notebook',
  },

  NOTEBOOK_TITLE_INPUT: {
    primary: 'input[placeholder*="notebook"]',
    fallbacks: [
      'input[type="text"]',
      '[contenteditable="true"]',
    ],
  },

  // Source Management
  ADD_SOURCE_BUTTON: {
    primary: 'button[aria-label*="Add source"]',
    fallbacks: [
      'button:has-text("Add")',
      'button:has-text("Upload")',
      '[data-testid="add-source"]',
    ],
    ariaLabel: 'Add source',
  },

  FILE_INPUT: {
    primary: 'input[type="file"]',
    fallbacks: ['input[accept]'],
  },

  // Question & Answer
  QUESTION_INPUT: {
    primary: 'textarea[placeholder*="Ask"]',
    fallbacks: [
      'textarea[aria-label*="question"]',
      'textarea[placeholder*="Question"]',
      '[data-testid="question-input"]',
    ],
  },

  SEND_BUTTON: {
    primary: 'button[aria-label*="Send"]',
    fallbacks: [
      'button:has-text("Send")',
      'button[type="submit"]',
    ],
  },

  ANSWER_CONTAINER: {
    primary: '[data-testid="answer"]',
    fallbacks: [
      '.answer-content',
      '[role="article"]',
    ],
  },

  // Loading States
  LOADING_INDICATOR: {
    primary: '[aria-label*="Loading"]',
    fallbacks: [
      '.loading',
      '[role="progressbar"]',
      '.spinner',
    ],
  },

  // Citations
  CITATION: {
    primary: '.citation',
    fallbacks: [
      '[data-testid="citation"]',
      'sup',
    ],
  },
};

/**
 * Smart click that tries multiple selectors with fallbacks
 */
export async function smartClick(
  page: Page,
  selectorConfig: SelectorConfig,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 10000;
  const selectors = [selectorConfig.primary, ...selectorConfig.fallbacks];

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
      await page.click(selector);
      return;
    } catch (error) {
      // Try next selector
      continue;
    }
  }

  throw new SelectorNotFoundError(selectorConfig.primary);
}

/**
 * Smart fill that tries multiple selectors with fallbacks
 */
export async function smartFill(
  page: Page,
  selectorConfig: SelectorConfig,
  value: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 10000;
  const selectors = [selectorConfig.primary, ...selectorConfig.fallbacks];

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
      await page.fill(selector, value);
      return;
    } catch (error) {
      // Try next selector
      continue;
    }
  }

  throw new SelectorNotFoundError(selectorConfig.primary);
}

/**
 * Smart wait for selector with fallbacks
 */
export async function smartWaitForSelector(
  page: Page,
  selectorConfig: SelectorConfig,
  options: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' } = {}
): Promise<void> {
  const timeout = options.timeout || 30000;
  const state = options.state || 'visible';
  const selectors = [selectorConfig.primary, ...selectorConfig.fallbacks];

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000, state });
      return;
    } catch (error) {
      // Try next selector
      continue;
    }
  }

  throw new SelectorNotFoundError(selectorConfig.primary);
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 30000): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch (error) {
    console.warn('Network idle timeout, continuing anyway');
  }
}

/**
 * Wait for AI response to complete
 */
export async function waitForAIResponse(page: Page, timeout = 60000): Promise<void> {
  try {
    // Wait for loading indicator to appear
    await smartWaitForSelector(page, SELECTORS.LOADING_INDICATOR, { timeout: 5000 });
    
    // Wait for loading indicator to disappear
    await smartWaitForSelector(page, SELECTORS.LOADING_INDICATOR, { 
      timeout,
      state: 'hidden' 
    });
  } catch (error) {
    // Loading indicator might not appear for fast responses
    console.log('Loading indicator not detected, assuming response complete');
  }

  // Wait a bit for content to render
  await page.waitForTimeout(1000);
}

/**
 * Wait for upload to complete
 */
export async function waitForUploadComplete(page: Page, timeout = 300000): Promise<void> {
  console.log('Waiting for upload to complete...');
  
  // Wait for any upload progress indicators to disappear
  try {
    await page.waitForSelector('[role="progressbar"]', { state: 'hidden', timeout });
  } catch (error) {
    console.log('No progress bar detected, upload may be complete');
  }

  // Wait for processing
  await page.waitForTimeout(3000);
  console.log('Upload complete');
}

/**
 * Extract text content from element with retries
 */
export async function extractTextContent(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<string> {
  const timeout = options.timeout || 10000;
  
  await page.waitForSelector(selector, { timeout, state: 'visible' });
  const element = await page.$(selector);
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const text = await element.textContent();
  return text?.trim() || '';
}
