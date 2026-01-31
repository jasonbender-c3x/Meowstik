# Custom Browser Quick Reference

A quick reference guide for developers using the self-hosted browser integration.

## Installation Status

Check if the custom browser is configured:

```typescript
import * as customBrowser from './server/integrations/custom-browser';

const status = customBrowser.getConfigurationStatus();
console.log(status);
// { configured: true, hasProxy: true, endpoint: 'meowstik-browser.run.app' }
```

## Basic Usage

### Scout Mode (Fast & Cheap)

For **text extraction** and **research**:

```typescript
const result = await customBrowser.scrapePage('https://example.com', {
  fullRender: false  // Scout mode: ~$0.0004 per page
});

console.log(result.content); // Extracted text
```

### Sniper Mode (Full Render)

For **screenshots** and **visual verification**:

```typescript
const result = await customBrowser.scrapePage('https://example.com', {
  fullRender: true,    // Sniper mode: ~$0.01 per page
  screenshot: true,    // Capture screenshot
  includeHtml: true    // Get HTML too
});

// Save screenshot
import fs from 'fs';
if (result.screenshot) {
  fs.writeFileSync('page.png', result.screenshot);
}
```

## Mode Selection Guide

| Task | Mode | Cost/Page | Settings |
|------|------|-----------|----------|
| Read article | Scout | $0.0004 | `{ fullRender: false }` |
| Search results | Scout | $0.0004 | `{ fullRender: false }` |
| Research (bulk) | Scout | $0.0004 | `{ fullRender: false }` |
| Screenshot | Sniper | $0.01 | `{ fullRender: true, screenshot: true }` |
| Visual check | Sniper | $0.01 | `{ fullRender: true }` |
| Form interaction | Sniper | $0.01 | `{ fullRender: true }` |

## Common Patterns

### Wait for Dynamic Content

```typescript
const result = await customBrowser.scrapePage('https://spa-app.com', {
  fullRender: false,
  waitForSelector: '.content-loaded',
  timeout: 45000
});
```

### Custom User Agent

```typescript
const result = await customBrowser.scrapePage('https://example.com', {
  fullRender: false,
  userAgent: 'MyBot/1.0'
});
```

### Batch Processing

```typescript
const urls = ['https://example1.com', 'https://example2.com'];

const { results, successful, failed, totalCost } = 
  await customBrowser.batchScrape(urls, 
    { fullRender: false }, // Options for all
    3 // Concurrency
  );
```

### Browser Actions

```typescript
await customBrowser.executeBrowserAction('https://example.com', [
  { type: 'type', selector: '#search', text: 'query' },
  { type: 'click', selector: 'button[type="submit"]' },
  { type: 'wait', delay: 2000 },
  { type: 'screenshot' }
], { fullRender: true });
```

## Error Handling

```typescript
const result = await customBrowser.scrapePage('https://example.com');

if (result.success) {
  // Use result.content, result.title, etc.
  console.log(result.content);
} else {
  // Handle error
  console.error(`Scraping failed: ${result.error}`);
  
  // Fallback to alternative method
  // ...
}
```

## Integration Examples

### Use with Web Search

```typescript
import { searchWeb } from './integrations/web-scraper';
import { scrapePage } from './integrations/custom-browser';

// 1. Search for URLs
const searchResults = await searchWeb('AI news');

// 2. Scrape top results (Scout mode for speed)
const scraped = await Promise.all(
  searchResults.results.slice(0, 5).map(r => 
    scrapePage(r.url, { fullRender: false })
  )
);

// 3. Extract successful results
const content = scraped
  .filter(r => r.success)
  .map(r => ({ title: r.title, content: r.content }));
```

### Hybrid Strategy

```typescript
// Use custom browser as primary, Browserbase as fallback
import * as customBrowser from './integrations/custom-browser';
import * as browserbase from './integrations/browserbase';

async function scrapeSafe(url: string) {
  // Try custom browser first
  if (customBrowser.isConfigured()) {
    const result = await customBrowser.scrapePage(url, { fullRender: false });
    if (result.success) return result;
  }
  
  // Fallback to Browserbase
  if (browserbase.isConfigured()) {
    return await browserbase.loadPage(url, { textOnly: true });
  }
  
  throw new Error('No browser service configured');
}
```

## Cost Optimization Tips

### 1. Always use Scout mode for text
```typescript
// ❌ Expensive: $0.01/page
await scrapePage(url, { fullRender: true });

// ✅ Cheap: $0.0004/page
await scrapePage(url, { fullRender: false });
```

### 2. Batch requests
```typescript
// ❌ Sequential: Slow
for (const url of urls) {
  await scrapePage(url);
}

// ✅ Parallel: Fast + cheap
await batchScrape(urls, {}, 5);
```

### 3. Use appropriate timeouts
```typescript
// ❌ Long timeout = more cost if page is slow
await scrapePage(url, { timeout: 60000 });

// ✅ Reasonable timeout
await scrapePage(url, { timeout: 15000 });
```

## Environment Variables

Required:
```bash
CUSTOM_BROWSER_WS_ENDPOINT=wss://your-browser.run.app
CUSTOM_BROWSER_AUTH_TOKEN=your-secure-token
```

Optional (for stealth):
```bash
RESIDENTIAL_PROXY_URL=http://proxy-host:port
RESIDENTIAL_PROXY_USER=username
RESIDENTIAL_PROXY_PASSWORD=password
```

## Testing

```bash
# Run all examples
npx tsx server/examples/custom-browser-examples.ts

# Test configuration only
node -e "import('./server/integrations/custom-browser.js').then(m => console.log(m.getConfigurationStatus()))"
```

## Monitoring

Track costs in your code:

```typescript
const result = await scrapePage(url);
console.log(`Cost: $${result.estimatedCost.toFixed(6)}`);
console.log(`Mode: ${result.mode}`);
```

Aggregate for reports:

```typescript
const { totalCost } = await batchScrape(urls, { fullRender: false });
console.log(`Total: $${totalCost.toFixed(4)}`);
```

## Debugging

Enable verbose logging:

```typescript
// The integration already logs to console
// Check output for:
// 🔌 Connecting to Self-Hosted Browser...
// ✅ Connected to browser successfully
// 🎯 Scraping in SCOUT mode: ...
// ✅ Scraping completed: X characters extracted
```

Check deployment:

```bash
# Via gcloud
gcloud run services describe meowstik-browser --region us-central1

# Test WebSocket directly
wscat -c "wss://your-browser.run.app?token=YOUR_TOKEN"
```

## Performance

Expected timings:

| Operation | Scout Mode | Sniper Mode |
|-----------|-----------|-------------|
| Simple page | 2-3s | 5-8s |
| Complex page | 3-5s | 10-15s |
| SPA | 5-8s | 15-25s |

## Limits

Cloud Run defaults:
- **Timeout**: 3600s (1 hour max)
- **Memory**: 2GB (configurable)
- **Concurrency**: 10 requests per instance
- **Instances**: Auto-scales 0-N

To change:
```bash
gcloud run services update meowstik-browser \
  --memory 4Gi \
  --concurrency 20
```

## When NOT to Use Custom Browser

Use Browserbase or simple HTTP instead when:

- ✅ Already have Browserbase credits
- ✅ Need guaranteed SLA
- ✅ Page is simple HTML (no JS)
- ✅ Don't want to manage infrastructure

Use Custom Browser when:

- 🎯 High volume scraping
- 🎯 Cost is a concern
- 🎯 Need proxy rotation
- 🎯 Want full control

## Migration from Browserbase

Minimal changes needed:

```typescript
// Before (Browserbase)
import { loadPage } from './integrations/browserbase';
const result = await loadPage(url, { textOnly: true });

// After (Custom Browser)
import { scrapePage } from './integrations/custom-browser';
const result = await scrapePage(url, { fullRender: false });

// Access the same data
console.log(result.content); // Both have 'content'
console.log(result.title);   // Both have 'title'
```

## Support

- **Implementation Guide**: `BROWSERLESS_IMPLEMENTATION_PROPOSAL.md`
- **Deployment Guide**: `BROWSERLESS_DEPLOYMENT_GUIDE.md`
- **Code Examples**: `server/examples/custom-browser-examples.ts`
- **Integration Code**: `server/integrations/custom-browser.ts`

---

**Quick tip**: Start with Scout mode for everything, then switch to Sniper mode only for pages that actually need full rendering. This maximizes cost savings while maintaining functionality.
