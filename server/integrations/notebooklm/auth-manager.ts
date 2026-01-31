/**
 * Authentication Manager - Handles Google authentication for NotebookLM
 */

import { Page } from 'playwright';
import { AuthOptions, AuthenticationError } from './types';
import fs from 'fs/promises';
import path from 'path';

export class AuthManager {
  private page: Page;
  private cookiePath: string;

  constructor(page: Page, cookiePath?: string) {
    this.page = page;
    this.cookiePath = cookiePath || path.join(process.cwd(), '.notebooklm-cookies.json');
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.page.goto('https://notebooklm.google.com', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Wait a bit for any redirects
      await this.page.waitForTimeout(2000);

      const url = this.page.url();
      
      // If we're not redirected to accounts.google.com, we're likely authenticated
      const authenticated = !url.includes('accounts.google.com');
      
      if (authenticated) {
        console.log('✓ Already authenticated');
      } else {
        console.log('✗ Not authenticated - login required');
      }

      return authenticated;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Perform login with credentials (requires manual intervention for 2FA)
   * This method will launch in non-headless mode for manual login
   */
  async login(options: AuthOptions): Promise<void> {
    console.log('Starting authentication process...');
    console.log('Note: This requires manual intervention for 2FA/CAPTCHA');

    try {
      await this.page.goto('https://accounts.google.com', {
        waitUntil: 'networkidle',
        timeout: 60000,
      });

      // Email input
      const emailSelector = 'input[type="email"]';
      await this.page.waitForSelector(emailSelector, { timeout: 10000 });
      await this.page.fill(emailSelector, options.email);
      await this.page.click('#identifierNext');

      // Wait for password field
      await this.page.waitForTimeout(2000);
      const passwordSelector = 'input[type="password"]';
      await this.page.waitForSelector(passwordSelector, { visible: true, timeout: 10000 });
      await this.page.fill(passwordSelector, options.password);
      await this.page.click('#passwordNext');

      // Wait for potential 2FA or success
      await this.page.waitForTimeout(5000);

      console.log('⚠ Manual intervention may be required for 2FA/CAPTCHA');
      console.log('Please complete authentication in the browser window...');
      
      // Wait for navigation to complete (manual intervention)
      // This is a simplified approach - in production, you'd want better detection
      await this.page.waitForURL('**/notebooklm.google.com/**', { 
        timeout: 300000, // 5 minutes for manual intervention
      });

      console.log('✓ Authentication successful');

      // Save cookies for future use
      await this.saveCookies();
    } catch (error) {
      throw new AuthenticationError(`Login failed: ${(error as Error).message}`);
    }
  }

  /**
   * Perform manual login (opens browser for user to log in)
   */
  async manualLogin(timeoutMs: number = 300000): Promise<void> {
    console.log('Starting manual login process...');
    console.log('Please log in manually in the browser window...');

    await this.page.goto('https://notebooklm.google.com', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait for user to complete login
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      await this.page.waitForTimeout(2000);
      
      if (await this.isAuthenticated()) {
        console.log('✓ Manual login successful');
        await this.saveCookies();
        return;
      }
    }

    throw new AuthenticationError('Manual login timed out');
  }

  /**
   * Save cookies to disk for session persistence
   */
  async saveCookies(): Promise<void> {
    try {
      const cookies = await this.page.context().cookies();
      const cookieData = {
        cookies,
        timestamp: Date.now(),
      };

      await fs.mkdir(path.dirname(this.cookiePath), { recursive: true });
      await fs.writeFile(this.cookiePath, JSON.stringify(cookieData, null, 2));
      
      console.log(`✓ Cookies saved to: ${this.cookiePath}`);
    } catch (error) {
      console.error('Error saving cookies:', error);
    }
  }

  /**
   * Load cookies from disk to restore session
   */
  async loadCookies(): Promise<boolean> {
    try {
      const data = await fs.readFile(this.cookiePath, 'utf-8');
      const cookieData = JSON.parse(data);

      // Check if cookies are too old (e.g., > 7 days)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (Date.now() - cookieData.timestamp > maxAge) {
        console.log('✗ Cookies expired (> 7 days old)');
        return false;
      }

      await this.page.context().addCookies(cookieData.cookies);
      console.log('✓ Cookies loaded successfully');
      return true;
    } catch (error) {
      console.log('✗ Could not load cookies:', (error as Error).message);
      return false;
    }
  }

  /**
   * Refresh session by navigating to NotebookLM
   */
  async refreshSession(): Promise<void> {
    await this.page.goto('https://notebooklm.google.com', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    if (!await this.isAuthenticated()) {
      throw new AuthenticationError('Session expired, please re-authenticate');
    }
  }

  /**
   * Logout from NotebookLM
   */
  async logout(): Promise<void> {
    try {
      // Clear cookies
      await this.page.context().clearCookies();
      
      // Delete saved cookies file
      await fs.unlink(this.cookiePath).catch(() => {});
      
      console.log('✓ Logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }
}
