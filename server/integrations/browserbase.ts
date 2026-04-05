/**
 * Browserbase integration stub.
 * The Browserbase integration has been removed. This stub prevents import errors.
 * Use Puppeteer (server/integrations/puppeteer.ts) for browser automation instead.
 */

export async function takeScreenshot(_url: string, _opts?: { fullPage?: boolean }): Promise<{ screenshot: Buffer }> {
  throw new Error("Browserbase is not available. Use Puppeteer for browser automation.");
}

export async function loadPage(_url: string, _opts?: { textOnly?: boolean }): Promise<{ content: string; url: string }> {
  throw new Error("Browserbase is not available. Use Puppeteer for browser automation.");
}
