# Self-Hosted Browser Deployment Guide

This guide walks you through deploying the self-hosted Browserless infrastructure on Google Cloud Run.

## Prerequisites

Before you begin, ensure you have:

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
   - Install: https://cloud.google.com/sdk/docs/install
   - Configure: `gcloud init`
3. **Project ID** for your Google Cloud project
4. **Billing enabled** for your project

## Step 1: Verify gcloud Setup

```bash
# Check that gcloud is installed
gcloud --version

# Verify you're logged in
gcloud auth list

# Set your project (replace with your project ID)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

## Step 2: Deploy Browserless to Cloud Run

Run this command to deploy the Browserless container:

```bash
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
  --set-env-vars "TOKEN=YOUR_SECURE_TOKEN_HERE" \
  --set-env-vars "DEFAULT_BLOCK_ADS=true" \
  --set-env-vars "KEEP_ALIVE=true"
```

### Configuration Parameters Explained

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `--memory 2Gi` | 2 GB RAM | Chrome requires significant memory. 2GB supports 2-3 concurrent tabs safely |
| `--cpu 1` | 1 vCPU | Sufficient for most scraping workloads |
| `--timeout 3600` | 1 hour | Maximum time for long-running scraping sessions |
| `--concurrency 10` | 10 requests | Number of simultaneous requests per container instance |
| `--allow-unauthenticated` | Public | URL is public but secured via TOKEN env var |
| `TOKEN` | Your token | **CHANGE THIS!** Use a strong, random token |

### Generate a Secure Token

**Important**: Replace `YOUR_SECURE_TOKEN_HERE` with a secure random token.

Generate one using:
```bash
# On macOS/Linux
openssl rand -base64 32

# Or use a password generator
# Example: meowstik-browser-4f8k2n9x-2p3q-9r8s-1a2b-3c4d5e6f7g8h
```

## Step 3: Get Your Deployment URL

After deployment completes, you'll see output like:

```
Service [meowstik-browser] revision [meowstik-browser-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://meowstik-browser-xyz123-uc.a.run.app
```

Copy this URL. You'll need it for the next step.

## Step 4: Test the Deployment

Test that the browser is accessible:

```bash
# Replace with your actual URL and token
curl -i "https://meowstik-browser-xyz123-uc.a.run.app?token=YOUR_SECURE_TOKEN_HERE"
```

You should see a successful response (HTTP 200 or 204).

## Step 5: Configure Meowstik

### 5.1 Update Environment Variables

Add these to your `.env` file:

```bash
# Self-Hosted Browser Configuration
CUSTOM_BROWSER_WS_ENDPOINT=wss://meowstik-browser-xyz123-uc.a.run.app
CUSTOM_BROWSER_AUTH_TOKEN=YOUR_SECURE_TOKEN_HERE
```

**Important**: 
- Change `https://` to `wss://` (WebSocket Secure)
- Use the exact same token you set in the deployment command

### 5.2 Verify Configuration

Run the configuration check example:

```bash
cd /home/runner/work/Meowstik/Meowstik
npm run dev

# In another terminal, test the integration
npx tsx server/examples/custom-browser-examples.ts
```

You should see:
```
Configuration Status:
- Browser configured: ✅
- Endpoint: meowstik-browser-xyz123-uc.a.run.app
```

## Step 6: Optional - Configure Residential Proxy

For stealth scraping with residential IPs:

### 6.1 Choose a Provider

Recommended providers:
- **BrightData**: https://brightdata.com/
- **Smartproxy**: https://smartproxy.com/
- **Oxylabs**: https://oxylabs.io/

### 6.2 Add Proxy Credentials

Add to your `.env` file:

```bash
# Residential Proxy Configuration
RESIDENTIAL_PROXY_URL=http://gate.smartproxy.com:7000
RESIDENTIAL_PROXY_USER=your_proxy_username
RESIDENTIAL_PROXY_PASSWORD=your_proxy_password
```

## Cost Estimation

### Cloud Run Costs (us-central1)

**Compute:**
- CPU: $0.00002400 per vCPU-second
- Memory: $0.00000250 per GiB-second

**Example Calculation** (Scout Mode):
- Average request time: 3 seconds
- Memory: 2 GiB
- CPU: 1 vCPU

Cost per request:
```
CPU:    3s × 1 vCPU × $0.000024 = $0.000072
Memory: 3s × 2 GiB × $0.0000025 = $0.000015
Network: ~$0.0001 (varies by bandwidth)
────────────────────────────────────────────
Total: ~$0.0002 per request
```

**Network Egress:**
- First 1 GB/month: Free
- 1-10 TB: $0.12/GB

### Monthly Cost Estimates

| Usage | Scout Mode | Sniper Mode |
|-------|-----------|-------------|
| 1,000 requests | $0.40 | $10.00 |
| 10,000 requests | $4.00 | $100.00 |
| 100,000 requests | $40.00 | $1,000.00 |

**vs. Browserbase** (at $15/1k requests):
- 1,000 requests: **Save $14.60** (97% savings)
- 10,000 requests: **Save $146.00** (97% savings)
- 100,000 requests: **Save $1,460.00** (97% savings)

## Monitoring & Maintenance

### View Logs

```bash
# View recent logs
gcloud run services logs read meowstik-browser --limit 50

# Tail logs in real-time
gcloud run services logs tail meowstik-browser
```

### Check Resource Usage

```bash
# View service details
gcloud run services describe meowstik-browser --region us-central1
```

### Update the Service

To update environment variables or configuration:

```bash
gcloud run services update meowstik-browser \
  --region us-central1 \
  --set-env-vars "NEW_VAR=value"
```

### Scale Configuration

**Auto-scaling** (default):
- Scales to zero when idle (no cost!)
- Scales up based on demand

**Set minimum instances** (keeps warm):
```bash
gcloud run services update meowstik-browser \
  --region us-central1 \
  --min-instances 1
```

**Set maximum instances** (cost control):
```bash
gcloud run services update meowstik-browser \
  --region us-central1 \
  --max-instances 10
```

## Troubleshooting

### Issue: "Connection timeout"

**Cause**: Browser instance may be cold starting.

**Solution**: 
- Wait 10-15 seconds and retry
- Consider setting `--min-instances 1` for instant availability

### Issue: "Out of memory" errors

**Cause**: Too many concurrent tabs or complex pages.

**Solution**:
```bash
# Increase memory to 4GB
gcloud run services update meowstik-browser \
  --region us-central1 \
  --memory 4Gi
```

### Issue: "Token authentication failed"

**Cause**: Token mismatch between deployment and .env file.

**Solution**: 
- Verify tokens match exactly
- Check for extra spaces or quotes
- Regenerate token and redeploy if needed

### Issue: High costs

**Cause**: Overuse of Sniper mode or memory/CPU set too high.

**Solution**:
- Use Scout mode for text extraction
- Set `--max-instances` limit
- Review Cloud Run billing dashboard

## Security Best Practices

1. **Token Rotation**: Change the TOKEN periodically
2. **Network Policies**: Use VPC if handling sensitive data
3. **Logging**: Enable and monitor access logs
4. **Budget Alerts**: Set up billing alerts in Google Cloud Console
5. **Rate Limiting**: Implement application-level rate limiting

## Replit Alternative (Development Only)

For local development or testing, you can run Browserless on Replit:

### 1. Install Chromium in Replit

Add to `replit.nix`:
```nix
{ pkgs }: {
  deps = [
    pkgs.chromium
    pkgs.dumb-init
  ];
}
```

### 2. Install Browserless

```bash
npm install @browserless/core
```

### 3. Create startup script

**Warning**: Replit-hosted browser is **not recommended for production** because:
- Sessions die when browser tab closes
- Less stable than Cloud Run
- No auto-scaling
- Unpredictable performance

## Next Steps

1. ✅ Deploy to Cloud Run
2. ✅ Configure environment variables
3. ✅ Test with example scripts
4. 📖 Read `BROWSERLESS_IMPLEMENTATION_PROPOSAL.md` for architecture details
5. 🧪 Run `server/examples/custom-browser-examples.ts` to see usage examples
6. 🚀 Integrate into your agents using Scout/Sniper modes

## Support

- **Documentation**: See `BROWSERLESS_IMPLEMENTATION_PROPOSAL.md`
- **Examples**: See `server/examples/custom-browser-examples.ts`
- **Google Cloud Run Docs**: https://cloud.google.com/run/docs
- **Browserless Docs**: https://docs.browserless.io/

---

**Ready to save 97% on browser automation costs? Deploy now!** 🚀
