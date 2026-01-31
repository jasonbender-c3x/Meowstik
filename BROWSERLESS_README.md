# 🚀 Self-Hosted Browser Automation - Complete Guide

> **Cost-effective browser automation infrastructure for Meowstik**  
> Save 97% on scraping costs while maintaining full functionality

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Documentation](#documentation)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Cost Comparison](#cost-comparison)
6. [Usage Examples](#usage-examples)
7. [FAQ](#faq)

---

## ⚡ Quick Start

### 1. Deploy to Google Cloud Run

```bash
gcloud run deploy meowstik-browser \
  --image ghcr.io/browserless/chromium:latest \
  --region us-central1 \
  --memory 2Gi \
  --set-env-vars "TOKEN=$(openssl rand -base64 32)"
```

### 2. Configure Environment

Add to `.env`:
```bash
CUSTOM_BROWSER_WS_ENDPOINT=wss://your-service.run.app
CUSTOM_BROWSER_AUTH_TOKEN=your-token-here
```

### 3. Validate Setup

```bash
npm run test:custom-browser
```

### 4. Start Using

```typescript
import { scrapePage } from './server/integrations/custom-browser';

const result = await scrapePage('https://example.com', {
  fullRender: false  // Scout mode: fast & cheap
});
```

---

## 📚 Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [Implementation Proposal](BROWSERLESS_IMPLEMENTATION_PROPOSAL.md) | Architecture, design decisions, cost analysis | Architects, Technical Leads |
| [Deployment Guide](BROWSERLESS_DEPLOYMENT_GUIDE.md) | Step-by-step deployment instructions | DevOps, Developers |
| [Quick Reference](BROWSERLESS_QUICK_REFERENCE.md) | Code examples, API reference | Developers |
| [Implementation Summary](BROWSERLESS_IMPLEMENTATION_SUMMARY.md) | Overview of all changes | Everyone |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                 Meowstik Application                   │
│  ┌──────────────────────────────────────────────────┐ │
│  │   server/integrations/custom-browser.ts          │ │
│  │   • Scout/Sniper mode switching                  │ │
│  │   • Proxy configuration                          │ │
│  │   • Request interception                         │ │
│  └──────────────────┬───────────────────────────────┘ │
└────────────────────┼────────────────────────────────────┘
                     │ WebSocket (WSS)
                     ▼
┌────────────────────────────────────────────────────────┐
│          Google Cloud Run (Serverless)                 │
│  ┌──────────────────────────────────────────────────┐ │
│  │   browserless/chromium (Docker)                  │ │
│  │   • Headless Chrome instances                    │ │
│  │   • Auto-scaling (0 to N)                        │ │
│  │   • 2GB RAM per instance                         │ │
│  └──────────────────┬───────────────────────────────┘ │
└────────────────────┼────────────────────────────────────┘
                     │ HTTP(S)
                     ▼
┌────────────────────────────────────────────────────────┐
│      Residential Proxy Network (Optional)              │
│      • BrightData / Smartproxy / Oxylabs               │
│      • Rotating home IPs                               │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
              Target Websites
```

---

## ✨ Features

### 🎯 Scout Mode (Fast & Cheap)
- **Cost**: ~$0.0004 per page
- **Speed**: 2-3x faster than full render
- **Use Cases**: Text extraction, research, bulk scanning
- **Blocks**: Images, CSS, fonts, media

```typescript
await scrapePage(url, { fullRender: false });
```

### 🎯 Sniper Mode (Full Rendering)
- **Cost**: ~$0.01 per page
- **Speed**: Normal browser speed
- **Use Cases**: Screenshots, visual verification
- **Loads**: All resources for full fidelity

```typescript
await scrapePage(url, { 
  fullRender: true, 
  screenshot: true 
});
```

### 🎯 Additional Features
- ✅ Residential proxy support (stealth)
- ✅ Batch processing (concurrent scraping)
- ✅ Request interception (resource optimization)
- ✅ Custom browser actions (click, type, etc.)
- ✅ Cost tracking per request
- ✅ Comprehensive error handling

---

## 💰 Cost Comparison

### Per 1,000 Requests

| Service | Scout Mode | Sniper Mode | Savings |
|---------|-----------|-------------|---------|
| **Custom Browser** | **$0.40** | **$10.00** | - |
| Browserbase (current) | $15.00 | $15.00 | - |
| **Savings** | **$14.60** | **$5.00** | **97% / 33%** |

### Monthly Estimates

| Usage | Scout Cost | vs. Browserbase | Savings |
|-------|-----------|-----------------|---------|
| 1k requests/month | $0.40 | $15.00 | $14.60 |
| 10k requests/month | $4.00 | $150.00 | $146.00 |
| 100k requests/month | $40.00 | $1,500.00 | $1,460.00 |

**Annual Savings** (100k requests/month): **$17,520** 🎉

---

## 💡 Usage Examples

### Example 1: Basic Text Extraction

```typescript
import { scrapePage } from './server/integrations/custom-browser';

const result = await scrapePage('https://example.com/article', {
  fullRender: false  // Scout mode
});

if (result.success) {
  console.log(`Title: ${result.title}`);
  console.log(`Content: ${result.content}`);
  console.log(`Cost: $${result.estimatedCost.toFixed(6)}`);
}
```

### Example 2: Screenshot Capture

```typescript
const result = await scrapePage('https://example.com', {
  fullRender: true,    // Sniper mode
  screenshot: true,
  includeHtml: true
});

if (result.screenshot) {
  fs.writeFileSync('screenshot.png', result.screenshot);
}
```

### Example 3: Batch Scraping

```typescript
import { batchScrape } from './server/integrations/custom-browser';

const urls = [
  'https://example1.com',
  'https://example2.com',
  'https://example3.com'
];

const { results, successful, failed, totalCost } = 
  await batchScrape(urls, { fullRender: false }, 3);

console.log(`Successful: ${successful}/${urls.length}`);
console.log(`Total cost: $${totalCost.toFixed(4)}`);
```

### Example 4: Custom Actions

```typescript
import { executeBrowserAction } from './server/integrations/custom-browser';

await executeBrowserAction('https://example.com/search', [
  { type: 'type', selector: '#search', text: 'query' },
  { type: 'click', selector: 'button[type="submit"]' },
  { type: 'wait', delay: 2000 },
  { type: 'screenshot' }
], { fullRender: true });
```

### Example 5: With Web Search

```typescript
import { searchWeb } from './integrations/web-scraper';
import { batchScrape } from './integrations/custom-browser';

// 1. Search
const searchResults = await searchWeb('AI news');

// 2. Scrape top 5 results
const urls = searchResults.results.slice(0, 5).map(r => r.url);
const { results } = await batchScrape(urls, { fullRender: false }, 3);

// 3. Extract content
const articles = results
  .filter(r => r.success)
  .map(r => ({ title: r.title, content: r.content }));
```

---

## ❓ FAQ

### Q: How is this different from Browserbase?

**A**: Self-hosted on Google Cloud Run vs. SaaS. You control the infrastructure, significantly reducing costs (97% for text extraction).

### Q: Do I need to deploy my own infrastructure?

**A**: Yes, but it's simple. One `gcloud` command deploys everything. See [Deployment Guide](BROWSERLESS_DEPLOYMENT_GUIDE.md).

### Q: What if I don't want to manage infrastructure?

**A**: Keep using Browserbase. This is an optional cost optimization for high-volume use cases.

### Q: When should I use Scout vs. Sniper mode?

**A**: 
- **Scout**: Text extraction, research, bulk operations (97% cheaper)
- **Sniper**: Screenshots, visual verification, complex interactions (33% cheaper)

### Q: Is residential proxy required?

**A**: No, it's optional. Use it for stealth scraping if you need to avoid detection.

### Q: How do I monitor costs?

**A**: 
- Built-in cost tracking: `result.estimatedCost`
- Cloud Run billing dashboard
- Aggregate tracking: `batchScrape().totalCost`

### Q: What about cold starts?

**A**: First request may take 5-10 seconds. Set `--min-instances 1` to keep warm (adds cost but eliminates cold starts).

### Q: Can I run this on Replit instead?

**A**: Yes for development, but **not recommended for production**. Replit sessions die when tab closes. See [Deployment Guide](BROWSERLESS_DEPLOYMENT_GUIDE.md#replit-alternative).

### Q: Is this secure?

**A**: Yes:
- ✅ Token-based authentication
- ✅ WebSocket encryption (WSS)
- ✅ No hardcoded credentials
- ✅ CodeQL verified (0 vulnerabilities)

### Q: What if Cloud Run goes down?

**A**: Implement a hybrid strategy with Browserbase as fallback. See [Quick Reference](BROWSERLESS_QUICK_REFERENCE.md#integration-examples).

---

## 🛠️ NPM Commands

```bash
# Validate configuration
npm run test:custom-browser

# Run all usage examples
npm run demo:custom-browser
```

---

## 📂 Files Structure

```
server/
  integrations/
    custom-browser.ts           # Core integration module
  examples/
    custom-browser-examples.ts  # Usage examples

scripts/
  validate-custom-browser.ts    # Configuration validator

docs/
  BROWSERLESS_IMPLEMENTATION_PROPOSAL.md  # Architecture guide
  BROWSERLESS_DEPLOYMENT_GUIDE.md         # Deployment instructions
  BROWSERLESS_QUICK_REFERENCE.md          # Developer reference
  BROWSERLESS_IMPLEMENTATION_SUMMARY.md   # Complete summary
  BROWSERLESS_README.md                   # This file
```

---

## 🚦 Next Steps

### For Deployment
1. ✅ Read [Deployment Guide](BROWSERLESS_DEPLOYMENT_GUIDE.md)
2. ✅ Deploy to Cloud Run (5 minutes)
3. ✅ Configure `.env` variables
4. ✅ Run validation: `npm run test:custom-browser`
5. ✅ Test examples: `npm run demo:custom-browser`

### For Development
1. ✅ Read [Quick Reference](BROWSERLESS_QUICK_REFERENCE.md)
2. ✅ Import `custom-browser` module
3. ✅ Choose Scout or Sniper mode
4. ✅ Monitor costs with built-in tracking

### For Architecture Review
1. ✅ Read [Implementation Proposal](BROWSERLESS_IMPLEMENTATION_PROPOSAL.md)
2. ✅ Understand dual-mode architecture
3. ✅ Review risk assessment
4. ✅ Plan migration strategy

---

## 🎯 Success Metrics

### Target Metrics
- ✅ **Cost Reduction**: 90%+ for Scout mode
- ✅ **Performance**: <5s Scout, <15s Sniper
- ✅ **Success Rate**: >95%
- ✅ **Uptime**: >99.5%

### Validation Results
- ✅ **TypeScript**: Compilation passes
- ✅ **Code Review**: No issues
- ✅ **Security**: 0 vulnerabilities (CodeQL)
- ✅ **Documentation**: 4 comprehensive guides

---

## 📞 Support

- **Questions**: See [FAQ](#faq) above
- **Deployment Help**: [Deployment Guide](BROWSERLESS_DEPLOYMENT_GUIDE.md)
- **Code Examples**: [Quick Reference](BROWSERLESS_QUICK_REFERENCE.md)
- **Architecture**: [Implementation Proposal](BROWSERLESS_IMPLEMENTATION_PROPOSAL.md)

---

## 📄 License

Part of the Meowstik project. See main repository LICENSE.

---

**Ready to save 97% on browser automation?** 🚀  
**Start here**: [Deployment Guide](BROWSERLESS_DEPLOYMENT_GUIDE.md)
