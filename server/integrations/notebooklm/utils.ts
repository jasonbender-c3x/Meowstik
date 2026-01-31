/**
 * Retry Utilities
 */

import { RetryOptions, NotebookLMError } from './types';

/**
 * Execute an operation with exponential backoff retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    shouldRetry: (error) => error instanceof NotebookLMError && error.recoverable,
    ...options,
  };

  let lastError: Error = new Error('Unknown error');
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === config.maxAttempts || !config.shouldRetry(error as Error)) {
        throw error;
      }

      console.log(`Attempt ${attempt}/${config.maxAttempts} failed: ${lastError.message}`);
      console.log(`Retrying in ${delay}ms...`);
      
      await sleep(delay);

      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  // This should never be reached due to the throw in the loop above
  throw lastError || new Error('Operation failed after all retry attempts');
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute operation with timeout
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    operation,
    sleep(timeoutMs).then(() => {
      throw new Error(errorMessage);
    }),
  ]);
}
