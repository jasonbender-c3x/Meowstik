# Self-Hosted Browserless Infrastructure: Implementation Proposal

## Executive Summary

This proposal outlines the implementation of a self-hosted browser automation infrastructure for Meowstik, designed to replace expensive SaaS scraping APIs with a cost-effective, scalable solution. The implementation will reduce per-request costs from ~$15/1k requests to ~$0.40/1k requests while maintaining full functionality and adding stealth capabilities.

---

## 1. Problem Statement

### Current State
- **Provider**: Browserbase (SaaS)
- **Cost**: ~$15 per 1,000 requests
- **Limitations**: 
  - Fixed pricing model
  - Limited control over browser configuration
  - No direct IP rotation capabilities
  - Vendor lock-in

### Desired State
- **Provider**: Self-hosted (Google Cloud Run + Browserless)
- **Target Cost**: ~$0.40 per 1,000 requests (96.7% reduction)
- **Benefits**:
  - Full control over browser configuration
  - Integrated residential proxy support
  - Scalable serverless infrastructure
  - Two-tier scraping strategy (Scout/Sniper modes)

---

## 2. Technical Architecture

### 2.1 Infrastructure Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Meowstik Application                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  server/integrations/custom-browser.ts                │  │
│  │  - Connection management                              │  │
│  │  - Proxy configuration                                │  │
│  │  - Scout/Sniper mode switching                        │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────│────────────────────────────────────────┘
                     │ WebSocket (WSS)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Google Cloud Run (Serverless)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  browserless/chromium Docker Container                │  │
│  │  - Headless Chrome instances                          │  │
│  │  - Session management                                 │  │
│  │  - Request interception                               │  │
│  │  - Resource optimization                              │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────│────────────────────────────────────────┘
                     │ HTTP(S)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Residential Proxy Network (Optional)              │
│  - BrightData / Smartproxy / Oxylabs                        │
│  - IP rotation (home user IPs)                              │
│  - Geographic targeting                                     │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
                  Target Websites
```

### 2.2 Component Details

#### **A. Custom Browser Integration Module**
- **Location**: `server/integrations/custom-browser.ts`
- **Purpose**: Adapter layer between Meowstik and self-hosted browser
- **Key Features**:
  - WebSocket connection management
  - Authentication token handling
  - Proxy configuration
  - Request interception for resource optimization
  - Error handling and retry logic

#### **B. Google Cloud Run Service**
- **Image**: `ghcr.io/browserless/chromium:latest`
- **Configuration**:
  - Memory: 2GB (minimum for stable Chrome operation)
  - CPU: 1 vCPU
  - Concurrency: 10 requests
  - Timeout: 3600 seconds (1 hour max)
  - Auto-scaling: 0 to N instances

#### **C. Residential Proxy Integration (Optional)**
- **Purpose**: IP rotation to avoid detection and rate limiting
- **Providers**: BrightData, Smartproxy, Oxylabs
- **Integration**: HTTP(S) proxy authentication

---

## 3. Implementation Strategy

### 3.1 Scout/Sniper Architecture

This dual-mode approach optimizes costs based on use case:

#### **Scout Mode** (Text Extraction)
```typescript
// Fast, lightweight scraping
await scrapePage(url, { fullRender: false })

// Blocks:
- Images
- Stylesheets
- Fonts
- Media files

// Cost: ~$0.0004 per page
// Speed: 2-3x faster
// Use cases: Research, content extraction, bulk scanning
```

#### **Sniper Mode** (Full Rendering)
```typescript
// Complete page capture
await scrapePage(url, { fullRender: true })

// Loads:
- All resources
- Full rendering
- JavaScript execution
- Screenshots capable

// Cost: ~$0.01 per page
// Use cases: Visual verification, screenshot capture, complex interactions
```

### 3.2 Cost Breakdown

| Component | Scout Mode | Sniper Mode |
|-----------|-----------|-------------|
| Compute (Cloud Run) | $0.0002 | $0.006 |
| Network Egress | $0.0001 | $0.003 |
| Proxy (Optional) | $0.0001 | $0.001 |
| **Total per page** | **$0.0004** | **$0.01** |
| **Per 1k requests** | **$0.40** | **$10** |

**Comparison with Browserbase**: Even Sniper mode at $10/1k is 33% cheaper than current $15/1k.

---

## 4. Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Google Cloud Run Deployment
```bash
# Deploy browserless container
gcloud run deploy meowstik-browser \
  --image ghcr.io/browserless/chromium:latest \
  --platform managed \
  --region us-central1 \
  --port 3000 \
  --memory 2Gi \
  --cpu 1 \
  --timeout 3600 \
  --concurrency 10 \
  --allow-unauthenticated \
  --set-env-vars "MAX_CONCURRENT_SESSIONS=10" \
  --set-env-vars "MAX_QUEUE_LENGTH=5" \
  --set-env-vars "PRE_REQUEST_HEALTH_CHECK=true" \
  --set-env-vars "TOKEN=<SECURE_TOKEN>" \
  --set-env-vars "DEFAULT_BLOCK_ADS=true" \
  --set-env-vars "KEEP_ALIVE=true"
```

**Deliverables**:
- Cloud Run service URL
- Authentication token
- Health check endpoint verification

#### 1.2 Create Custom Browser Integration
**File**: `server/integrations/custom-browser.ts`

**Features**:
- Connection management
- Scout/Sniper mode implementation
- Error handling
- Logging and monitoring

**Dependencies**: Already available
- `puppeteer-core` (already in package.json)
- `playwright-core` (already in package.json)

#### 1.3 Environment Configuration
**File**: `.env.example` updates

Add:
```bash
# Self-Hosted Browser Configuration
CUSTOM_BROWSER_WS_ENDPOINT=wss://meowstik-browser-xyz.run.app
CUSTOM_BROWSER_AUTH_TOKEN=meowstik-secure-token-123

# Optional: Residential Proxy
RESIDENTIAL_PROXY_URL=http://user:pass@gate.smartproxy.com:7000
RESIDENTIAL_PROXY_USER=
RESIDENTIAL_PROXY_PASSWORD=
```

### Phase 2: Integration & Testing (Week 1-2)

#### 2.1 Update Existing Integrations
**Files to modify**:
- `server/integrations/browserbase.ts` - Add custom browser fallback
- `server/routes/web-scraper.ts` - Add mode selection
- `server/integrations/notebooklm/browser-manager.ts` - Optional custom browser support

**Backward Compatibility**: Maintain existing Browserbase functionality as fallback

#### 2.2 Add Usage Examples
**File**: `server/examples/custom-browser-examples.ts`

Example workflows:
- Basic text extraction
- Screenshot capture
- Multi-page research
- Form submission

#### 2.3 Testing Strategy
- Unit tests for connection management
- Integration tests for scraping modes
- Load testing (concurrent sessions)
- Cost monitoring

### Phase 3: Proxy Integration (Week 2)

#### 3.1 Residential Proxy Setup
- Select provider (BrightData recommended)
- Configure authentication
- Test IP rotation
- Implement retry logic for proxy failures

#### 3.2 Stealth Features
- User-agent rotation
- Cookie management
- JavaScript fingerprint randomization
- Request timing variation

### Phase 4: Monitoring & Optimization (Week 3)

#### 4.1 Observability
- Request logging
- Cost tracking per mode
- Success rate metrics
- Error rate monitoring
- Performance benchmarks

#### 4.2 Cost Optimization
- Automatic mode selection based on content type
- Session pooling
- Browser instance reuse
- Smart scaling policies

---

## 5. Migration Strategy

### 5.1 Gradual Rollout

**Phase 1: Parallel Operation (Days 1-7)**
- Custom browser available for new features
- Browserbase remains default
- A/B testing for cost and reliability

**Phase 2: Selective Migration (Days 8-14)**
- Move text extraction to custom browser (Scout mode)
- Keep screenshots on Browserbase initially
- Monitor performance and costs

**Phase 3: Full Migration (Days 15-21)**
- Migrate all workloads to custom browser
- Keep Browserbase as emergency fallback
- Final cost comparison

**Phase 4: Optimization (Days 22-30)**
- Remove Browserbase dependency
- Fine-tune scaling policies
- Implement advanced features (retry, caching)

### 5.2 Rollback Plan

If issues arise:
1. **Immediate**: Feature flag to switch back to Browserbase
2. **Short-term**: Keep Browserbase credentials active for 60 days
3. **Long-term**: Maintain abstraction layer for provider switching

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cloud Run cold start delays | Medium | Low | Keep-alive requests, min instances |
| Browser crashes | Low | Medium | Auto-restart, health checks, retry logic |
| Proxy detection/blocking | Medium | Medium | Multiple providers, fallback to direct |
| Cost overruns | Low | High | Budget alerts, auto-scaling limits |
| Security vulnerabilities | Low | High | Regular updates, token rotation, network policies |

---

## 7. Success Metrics

### 7.1 Cost Metrics
- **Target**: 90%+ cost reduction vs. Browserbase
- **Measurement**: Cost per 1k requests (Scout vs. Sniper)
- **Tracking**: Monthly Cloud Run billing reports

### 7.2 Performance Metrics
- **Latency**: <5s for Scout mode, <15s for Sniper mode
- **Success Rate**: >95% for both modes
- **Uptime**: >99.5% availability

### 7.3 Usage Metrics
- **Scout/Sniper Ratio**: Track usage patterns
- **Concurrent Sessions**: Monitor peak usage
- **Resource Utilization**: Memory, CPU, network

---

## 8. Documentation Requirements

### 8.1 Technical Documentation
- [ ] Architecture diagram
- [ ] API reference for custom browser module
- [ ] Deployment runbook
- [ ] Troubleshooting guide
- [ ] Cost analysis dashboard

### 8.2 Developer Documentation
- [ ] Integration guide for new features
- [ ] Scout vs. Sniper mode selection guide
- [ ] Proxy configuration examples
- [ ] Error handling patterns

### 8.3 Operations Documentation
- [ ] Monitoring setup
- [ ] Scaling policies
- [ ] Incident response procedures
- [ ] Backup and disaster recovery

---

## 9. Alternative Architectures Considered

### 9.1 Replit-Hosted Browser
**Pros**: 
- No separate infrastructure
- Simple deployment

**Cons**: 
- Less stable (session dies when tab closes)
- RAM limitations
- No true serverless scaling
- Unpredictable performance

**Decision**: Use Google Cloud Run for production, keep Replit option for development only

### 9.2 Self-Managed Kubernetes
**Pros**: 
- Full control
- Complex orchestration capabilities

**Cons**: 
- Higher operational overhead
- No automatic scaling to zero
- More expensive at low usage
- Requires dedicated DevOps resources

**Decision**: Cloud Run offers better cost/complexity tradeoff for this use case

### 9.3 AWS Lambda + Chromium Layer
**Pros**: 
- True serverless
- Pay-per-invocation

**Cons**: 
- 15-minute execution limit
- Complex layer management
- Cold start penalties
- 50MB deployment package limit

**Decision**: Cloud Run better suited for long-running browser sessions

---

## 10. Timeline & Resource Requirements

### 10.1 Timeline
- **Week 1**: Infrastructure setup + core integration
- **Week 2**: Proxy integration + comprehensive testing
- **Week 3**: Migration + monitoring
- **Week 4**: Optimization + documentation

**Total Duration**: 4 weeks

### 10.2 Resources Required
- **Development**: 1 senior engineer (full-time)
- **DevOps**: 0.5 engineer (GCP setup, monitoring)
- **Testing**: 0.25 QA engineer (integration testing)
- **Budget**: 
  - GCP costs (estimated): $20-50/month initial
  - Proxy costs (optional): $50-200/month depending on usage

---

## 11. Conclusion

This implementation represents a strategic shift from SaaS dependency to infrastructure ownership, offering:

1. **96.7% cost reduction** for text extraction workloads
2. **Improved flexibility** through Scout/Sniper modes
3. **Enhanced stealth capabilities** via residential proxies
4. **Scalable architecture** that grows with usage

The gradual migration strategy ensures minimal disruption while the comprehensive monitoring approach enables data-driven optimization.

**Recommendation**: Proceed with implementation following the phased approach outlined above.

---

## Appendix A: Code Samples

### A.1 Basic Usage Example
```typescript
import { scrapePage, connectToBrowser } from './integrations/custom-browser';

// Scout Mode: Fast text extraction
const textContent = await scrapePage(
  'https://example.com/article',
  { fullRender: false }
);

// Sniper Mode: Full rendering with screenshot
const screenshot = await scrapePage(
  'https://competitor.com/pricing',
  { fullRender: true, screenshot: true }
);
```

### A.2 Advanced Usage with Proxy
```typescript
import { scrapeWithProxy } from './integrations/custom-browser';

const result = await scrapeWithProxy({
  url: 'https://target-site.com',
  fullRender: false,
  proxy: {
    country: 'US',
    city: 'New York',
    session: 'sticky-session-123'
  }
});
```

### A.3 Batch Processing
```typescript
import { batchScrape } from './integrations/custom-browser';

const urls = [/* 100 URLs */];

const results = await batchScrape(urls, {
  mode: 'scout',
  concurrency: 5,
  retries: 3,
  timeout: 30000
});

console.log(`Processed ${results.success} of ${urls.length} pages`);
console.log(`Total cost: $${results.totalCost.toFixed(4)}`);
```

---

## Appendix B: Configuration Reference

### B.1 Cloud Run Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TOKEN` | Authentication token | - | Yes |
| `MAX_CONCURRENT_SESSIONS` | Max simultaneous browsers | 10 | No |
| `MAX_QUEUE_LENGTH` | Max queued requests | 5 | No |
| `PRE_REQUEST_HEALTH_CHECK` | Health check before requests | true | No |
| `DEFAULT_BLOCK_ADS` | Block ads by default | true | No |
| `KEEP_ALIVE` | Keep browsers warm | true | No |
| `CONNECTION_TIMEOUT` | WebSocket timeout (ms) | 30000 | No |

### B.2 Application Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `CUSTOM_BROWSER_WS_ENDPOINT` | WebSocket URL | wss://... | Yes |
| `CUSTOM_BROWSER_AUTH_TOKEN` | Auth token | token-123 | Yes |
| `RESIDENTIAL_PROXY_URL` | Proxy URL | http://... | No |
| `BROWSER_DEFAULT_MODE` | Default mode | scout | No |
| `BROWSER_TIMEOUT` | Request timeout | 30000 | No |

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-31  
**Author**: Meowstik Development Team  
**Status**: Approved for Implementation
