# Residential Proxy Setup Guide

## Overview

This guide covers setting up a residential proxy service to enable stealth web scraping with the self-hosted browser infrastructure. Residential proxies route your traffic through real home IP addresses, making your scraping activities appear as regular user traffic rather than datacenter requests.

---

## Why Residential Proxies?

### Benefits
- ✅ **Avoid Blocks**: Appear as home users, not bots
- ✅ **IP Rotation**: Automatic rotation prevents rate limiting
- ✅ **Geographic Targeting**: Access region-specific content
- ✅ **Higher Success Rates**: 95%+ success vs. 60-70% with datacenter IPs

### When to Use
- Scraping sites with aggressive bot protection
- High-volume scraping operations
- Accessing geo-restricted content
- E-commerce price monitoring
- Social media data collection

---

## Recommended Providers

### 1. Smartproxy (Recommended for Beginners)

**Why Choose**: Easy setup, transparent pricing, good documentation

**Pricing**: Starting at $12.50/GB
- Pay-as-you-go or monthly plans
- No setup fees
- 24/7 support

**Setup Time**: 5 minutes

**Best For**: Small to medium volume (<50GB/month)

### 2. BrightData (Oxylabs)

**Why Choose**: Largest network, advanced features, best reliability

**Pricing**: Starting at $15/GB (volume discounts available)
- Enterprise-grade features
- 72M+ residential IPs
- Country/city/ISP targeting

**Setup Time**: 10 minutes

**Best For**: High volume, enterprise needs (>100GB/month)

### 3. IPRoyal

**Why Choose**: Most affordable, ethically sourced IPs

**Pricing**: Starting at $7/GB
- Ethically sourced residential IPs
- No hidden fees
- Simple pricing

**Setup Time**: 5 minutes

**Best For**: Budget-conscious, ethical sourcing requirements

---

## Step-by-Step: Smartproxy Setup

### Step 1: Create Account

1. Go to https://smartproxy.com/
2. Click "Get Started" or "Start Free Trial"
3. Fill in your details:
   - Email address
   - Password
   - Company name (optional)
4. Verify your email

**Note**: Most providers offer a 3-day free trial or money-back guarantee.

### Step 2: Choose Plan

1. Log in to your dashboard
2. Navigate to "Residential Proxies"
3. Select a plan:
   - **Starter**: $12.50/GB (good for testing)
   - **Regular**: $10/GB (50GB minimum)
   - **Advanced**: $7.50/GB (100GB minimum)

**Recommendation**: Start with the Starter plan for initial testing.

### Step 3: Get Credentials

1. In the dashboard, go to "Residential Proxies" → "Endpoints"
2. You'll see:
   ```
   Host: gate.smartproxy.com
   Port: 7000 (HTTP) or 7001 (HTTPS)
   Username: Your username (usually your email or custom username)
   Password: Your account password
   ```

3. **Create a Sub-User** (Recommended):
   - Go to "Settings" → "Sub-Users"
   - Click "Create Sub-User"
   - Set username: `meowstik-browser`
   - Set password: Generate a strong password
   - Save credentials

### Step 4: Test Connection

Test your proxy credentials:

```bash
# Test with curl
curl -x http://USERNAME:PASSWORD@gate.smartproxy.com:7000 \
  https://ip.smartproxy.com/

# Expected output: Your rotating residential IP address
```

### Step 5: Configure Meowstik

Add to your `.env` file:

```bash
# Residential Proxy Configuration (Smartproxy)
RESIDENTIAL_PROXY_URL=http://gate.smartproxy.com:7000
RESIDENTIAL_PROXY_USER=meowstik-browser
RESIDENTIAL_PROXY_PASSWORD=your-secure-password-here
```

### Step 6: Validate Integration

Run the validation script:

```bash
npm run test:custom-browser
```

Expected output:
```
✅ Browser endpoint: CONFIGURED
✅ Residential proxy: CONFIGURED
```

### Step 7: Test Scraping with Proxy

```typescript
import { scrapePage } from './server/integrations/custom-browser';

// The proxy will be automatically used if configured
const result = await scrapePage('https://httpbin.org/ip', {
  fullRender: false
});

console.log(result.content); // Should show a residential IP, not your server IP
```

---

## Step-by-Step: BrightData Setup

### Step 1: Create Account

1. Go to https://brightdata.com/
2. Click "Get Started Free"
3. Fill in business details (required)
4. Verify email and phone (2FA required)

### Step 2: Add Payment Method

1. Navigate to "Billing" → "Payment Methods"
2. Add credit card (required even for trial)
3. $500 initial deposit (refundable if you cancel)

### Step 3: Create Proxy Zone

1. Go to "Proxies & Scraping Infrastructure" → "Residential Proxies"
2. Click "Add Zone"
3. Configure:
   - Zone name: `meowstik-browser`
   - IP type: Rotating
   - Country: All (or specific countries)
4. Click "Save"

### Step 4: Get Credentials

1. In your zone settings, find:
   ```
   Host: brd.superproxy.io
   Port: 22225 (HTTP) or 33335 (HTTPS)
   Username: brd-customer-[CUSTOMER_ID]-zone-meowstik-browser
   Password: Your zone password
   ```

2. **Optional - Session Control**:
   For sticky sessions, append to username:
   ```
   brd-customer-[CUSTOMER_ID]-zone-meowstik-browser-session-[SESSION_ID]
   ```

### Step 5: Configure Meowstik

Add to `.env`:

```bash
# Residential Proxy Configuration (BrightData)
RESIDENTIAL_PROXY_URL=http://brd.superproxy.io:22225
RESIDENTIAL_PROXY_USER=brd-customer-YOUR_ID-zone-meowstik-browser
RESIDENTIAL_PROXY_PASSWORD=your-zone-password
```

---

## Step-by-Step: IPRoyal Setup

### Step 1: Create Account

1. Go to https://iproyal.com/
2. Sign up with email
3. Verify email address

### Step 2: Add Funds

1. Navigate to "Billing"
2. Add payment method
3. Minimum deposit: $20
4. Choose payment method (card, PayPal, crypto)

### Step 3: Generate Credentials

1. Go to "Residential Proxies" → "Dashboard"
2. Click "Generate Proxy"
3. Select:
   - Country: All or specific
   - State/City: Optional
   - Rotation: Time-based (recommended)
4. Copy credentials:
   ```
   Host: geo.iproyal.com
   Port: 12321
   Username: Your username
   Password: Your password
   ```

### Step 4: Configure Meowstik

Add to `.env`:

```bash
# Residential Proxy Configuration (IPRoyal)
RESIDENTIAL_PROXY_URL=http://geo.iproyal.com:12321
RESIDENTIAL_PROXY_USER=your-username
RESIDENTIAL_PROXY_PASSWORD=your-password
```

---

## Advanced Configuration

### Session Management

**Sticky Sessions**: Keep the same IP for multiple requests

```bash
# Smartproxy - Add session ID to username
RESIDENTIAL_PROXY_USER=meowstik-browser-session-12345

# BrightData - Append to username
RESIDENTIAL_PROXY_USER=brd-customer-ID-zone-meowstik-browser-session-12345
```

### Geographic Targeting

**Country-Specific IPs**:

```bash
# Smartproxy - Add country code to username
RESIDENTIAL_PROXY_USER=meowstik-browser-country-us

# BrightData - Append to username
RESIDENTIAL_PROXY_USER=brd-customer-ID-zone-meowstik-browser-country-us

# IPRoyal - Use specific endpoint
RESIDENTIAL_PROXY_URL=http://us.iproyal.com:12321
```

### Bandwidth Optimization

**Tips to Reduce Proxy Costs**:

1. **Use Scout Mode**: Blocks images/CSS, uses 90% less bandwidth
   ```typescript
   await scrapePage(url, { fullRender: false }); // Saves bandwidth
   ```

2. **Direct Connection for Public APIs**: Only use proxy for protected sites
   ```typescript
   if (needsStealth) {
     // Uses proxy if configured
     await scrapePage(url, { fullRender: false });
   } else {
     // Direct connection, no proxy cost
     await fetch(url);
   }
   ```

3. **Batch Requests**: Group requests to same site for session reuse

---

## Cost Optimization

### Proxy Usage Estimates

| Scraping Mode | Bandwidth/Page | Cost (at $10/GB) |
|---------------|----------------|------------------|
| Scout Mode | ~100KB | $0.001 |
| Sniper Mode | ~2MB | $0.02 |
| Direct (no proxy) | Varies | $0 |

### Total Cost Breakdown

**Example: 10,000 pages/month (Scout Mode)**

| Component | Cost |
|-----------|------|
| Cloud Run compute | $4.00 |
| Proxy bandwidth (10K × 100KB) | $10.00 |
| **Total** | **$14.00** |

**vs. Browserbase**: $150 (91% savings)

### Budget Alerts

Set up alerts in your proxy dashboard:
1. Navigate to "Billing" → "Alerts"
2. Set monthly limit (e.g., $50)
3. Add email notification
4. Enable auto-pause at limit

---

## Testing & Validation

### 1. Test Proxy Connection

```bash
# Test proxy directly
curl -x http://USERNAME:PASSWORD@PROXY_HOST:PORT \
  https://httpbin.org/ip

# Should return a residential IP address
```

### 2. Test with Meowstik

```bash
# Run demo examples
npm run demo:custom-browser
```

### 3. Verify IP Rotation

```typescript
// Test IP rotation
for (let i = 0; i < 5; i++) {
  const result = await scrapePage('https://httpbin.org/ip', { fullRender: false });
  console.log(`Request ${i + 1}: ${result.content}`);
}

// Should show different IPs for each request (with rotating proxy)
```

---

## Troubleshooting

### Issue: "Proxy authentication failed"

**Solution**:
- Verify username/password are correct
- Check for extra spaces in .env file
- Ensure account has sufficient balance
- Try resetting proxy password in dashboard

### Issue: "Connection timeout"

**Solution**:
- Check proxy host and port are correct
- Verify proxy service is not down (check status page)
- Test direct connection: `curl http://PROXY_HOST:PORT`
- Try different port (HTTP vs HTTPS)

### Issue: "High bandwidth usage"

**Solution**:
- Switch to Scout mode (blocks images/CSS)
- Review which sites are being scraped
- Check for retry loops in your code
- Consider direct connection for simple APIs

### Issue: "Blocked even with proxy"

**Solution**:
- Enable session rotation (don't stick to same IP)
- Add delays between requests (respect rate limits)
- Rotate user agents
- Check if site blocks entire proxy provider

---

## Security Best Practices

1. **Never commit credentials**: Use environment variables
2. **Rotate credentials**: Change passwords monthly
3. **Monitor usage**: Set up billing alerts
4. **Use sub-accounts**: Create separate credentials for each project
5. **Limit access**: Use firewall rules to restrict proxy usage

---

## Provider Comparison

| Feature | Smartproxy | BrightData | IPRoyal |
|---------|-----------|------------|---------|
| **Price/GB** | $12.50 | $15.00 | $7.00 |
| **Trial** | 3 days | 7 days | Pay-as-you-go |
| **Min. Purchase** | 1GB | 20GB | $20 credit |
| **Setup Time** | 5 min | 10 min | 5 min |
| **IP Pool** | 10M+ | 72M+ | 2M+ |
| **Support** | 24/7 chat | Phone + email | Email |
| **Best For** | Beginners | Enterprise | Budget |

---

## Next Steps

1. ✅ Choose a provider based on your needs and budget
2. ✅ Create account and verify email
3. ✅ Add payment method and load initial credits
4. ✅ Get proxy credentials
5. ✅ Add credentials to `.env` file
6. ✅ Run validation: `npm run test:custom-browser`
7. ✅ Test with example scraping task
8. ✅ Monitor usage and costs in provider dashboard

---

## Support & Resources

### Documentation
- **Smartproxy**: https://help.smartproxy.com/
- **BrightData**: https://docs.brightdata.com/
- **IPRoyal**: https://iproyal.com/documentation/

### Integration Help
- See `BROWSERLESS_QUICK_REFERENCE.md` for code examples
- Run `npm run demo:custom-browser` for working examples
- Check `server/examples/custom-browser-examples.ts` for proxy usage patterns

### Cost Tracking
- Monitor proxy usage in provider dashboard
- Track compute costs in Google Cloud Console
- Use built-in cost estimation: `result.estimatedCost`

---

**Ready to enable stealth scraping?** Choose a provider and follow the setup steps above! 🕵️‍♀️
