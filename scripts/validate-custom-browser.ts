#!/usr/bin/env node

/**
 * Simple validation script for custom browser configuration
 * This can be run without actually deploying the browser
 */

import * as customBrowser from '../integrations/custom-browser.js';

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Custom Browser Configuration Validator                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const status = customBrowser.getConfigurationStatus();

console.log('Configuration Status:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (status.configured) {
  console.log('✅ Browser endpoint: CONFIGURED');
  console.log(`   Endpoint: ${status.endpoint}`);
} else {
  console.log('❌ Browser endpoint: NOT CONFIGURED');
  console.log('   Missing: CUSTOM_BROWSER_WS_ENDPOINT and/or CUSTOM_BROWSER_AUTH_TOKEN');
}

console.log('');

if (status.hasProxy) {
  console.log('✅ Residential proxy: CONFIGURED');
} else {
  console.log('⚪ Residential proxy: NOT CONFIGURED (optional)');
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (!status.configured) {
  console.log('\n📖 Setup Instructions:\n');
  console.log('1. Deploy the browser to Google Cloud Run');
  console.log('   See: BROWSERLESS_DEPLOYMENT_GUIDE.md');
  console.log('');
  console.log('2. Add these to your .env file:');
  console.log('   CUSTOM_BROWSER_WS_ENDPOINT=wss://your-service.run.app');
  console.log('   CUSTOM_BROWSER_AUTH_TOKEN=your-secure-token');
  console.log('');
  console.log('3. Optionally add proxy configuration:');
  console.log('   RESIDENTIAL_PROXY_URL=http://proxy-host:port');
  console.log('   RESIDENTIAL_PROXY_USER=username');
  console.log('   RESIDENTIAL_PROXY_PASSWORD=password');
  console.log('');
  console.log('For detailed instructions, see:');
  console.log('- BROWSERLESS_DEPLOYMENT_GUIDE.md (deployment)');
  console.log('- BROWSERLESS_IMPLEMENTATION_PROPOSAL.md (architecture)');
  console.log('- BROWSERLESS_QUICK_REFERENCE.md (usage examples)');
  process.exit(1);
} else {
  console.log('\n✅ Configuration is valid!\n');
  console.log('Next steps:');
  console.log('- Run examples: npx tsx server/examples/custom-browser-examples.ts');
  console.log('- Read quick reference: BROWSERLESS_QUICK_REFERENCE.md');
  console.log('- Start using in your code: import { scrapePage } from "./integrations/custom-browser"');
  process.exit(0);
}
