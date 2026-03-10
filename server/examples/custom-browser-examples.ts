/**
 * Custom Browser Integration Examples
 * 
 * This file demonstrates various ways to use the self-hosted browser
 * integration for cost-effective web scraping and automation.
 */

import * as customBrowser from '../integrations/custom-browser';

/**
 * Example 1: Basic Text Extraction (Scout Mode)
 * 
 * Use case: Research, content extraction, bulk scanning
 * Cost: ~$0.0004 per page
 */
async function example1_ScoutMode() {
  console.log('\n=== Example 1: Scout Mode (Fast Text Extraction) ===\n');

  const result = await customBrowser.scrapePage(
    'https://example.com/article',
    { 
      fullRender: false // Scout mode: blocks images, CSS, fonts
    }
  );

  if (result.success) {
    console.log(`Title: ${result.title}`);
    console.log(`Content length: ${result.content.length} characters`);
    console.log(`Estimated cost: $${result.estimatedCost.toFixed(6)}`);
    console.log(`Mode: ${result.mode}`);
  } else {
    console.error(`Error: ${result.error}`);
  }
}

/**
 * Example 2: Full Rendering with Screenshot (Sniper Mode)
 * 
 * Use case: Visual verification, screenshot capture, complex interactions
 * Cost: ~$0.01 per page
 */
async function example2_SniperMode() {
  console.log('\n=== Example 2: Sniper Mode (Full Rendering + Screenshot) ===\n');

  const result = await customBrowser.scrapePage(
    'https://example.com/dashboard',
    { 
      fullRender: true,  // Sniper mode: loads everything
      screenshot: true,  // Capture screenshot
      includeHtml: true  // Also get the HTML
    }
  );

  if (result.success) {
    console.log(`Title: ${result.title}`);
    console.log(`Content length: ${result.content.length} characters`);
    console.log(`HTML length: ${result.html?.length || 0} characters`);
    console.log(`Screenshot size: ${result.screenshot?.length || 0} bytes`);
    console.log(`Estimated cost: $${result.estimatedCost.toFixed(6)}`);
    console.log(`Mode: ${result.mode}`);

    // You could save the screenshot:
    // import fs from 'fs';
    // if (result.screenshot) {
    //   fs.writeFileSync('screenshot.png', result.screenshot);
    // }
  } else {
    console.error(`Error: ${result.error}`);
  }
}

/**
 * Example 3: Batch Scraping Multiple URLs
 * 
 * Use case: Research across multiple sources, competitive analysis
 * Cost: Depends on mode and number of pages
 */
async function example3_BatchScraping() {
  console.log('\n=== Example 3: Batch Scraping ===\n');

  const urls = [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3',
    'https://example.com/page4',
    'https://example.com/page5',
  ];

  const { results, successful, failed, totalCost } = await customBrowser.batchScrape(
    urls,
    { fullRender: false }, // Scout mode for all
    3 // Concurrency: 3 pages at a time
  );

  console.log(`\nResults:`);
  console.log(`- Total pages: ${urls.length}`);
  console.log(`- Successful: ${successful}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Total estimated cost: $${totalCost.toFixed(6)}`);
  console.log(`- Average cost per page: $${(totalCost / urls.length).toFixed(6)}`);

  // Show first result
  if (results.length > 0 && results[0].success) {
    console.log(`\nFirst page preview:`);
    console.log(`- Title: ${results[0].title}`);
    console.log(`- Content preview: ${results[0].content.substring(0, 200)}...`);
  }
}

/**
 * Example 4: Custom Browser Actions
 * 
 * Use case: Form submission, navigation, interactive scraping
 */
async function example4_CustomActions() {
  console.log('\n=== Example 4: Custom Browser Actions ===\n');

  const { success, results, error } = await customBrowser.executeBrowserAction(
    'https://example.com/search',
    [
      // Type into search box
      { 
        type: 'type', 
        selector: 'input[name="q"]', 
        text: 'web scraping' 
      },
      
      // Click search button
      { 
        type: 'click', 
        selector: 'button[type="submit"]' 
      },
      
      // Wait for results to load
      { 
        type: 'wait', 
        delay: 2000 
      },
      
      // Scroll down
      { 
        type: 'scroll' 
      },
      
      // Take a screenshot
      { 
        type: 'screenshot' 
      }
    ],
    { 
      fullRender: true, 
      timeout: 30000 
    }
  );

  if (success) {
    console.log(`Actions completed successfully:`);
    results.forEach((result, i) => {
      console.log(`${i + 1}. ${JSON.stringify(result)}`);
    });
  } else {
    console.error(`Actions failed: ${error}`);
  }
}

/**
 * Example 5: Wait for Dynamic Content
 * 
 * Use case: Single-page applications, dynamic content loading
 */
async function example5_WaitForContent() {
  console.log('\n=== Example 5: Wait for Dynamic Content ===\n');

  const result = await customBrowser.scrapePage(
    'https://example.com/spa-app',
    {
      fullRender: false,
      waitForSelector: '.content-loaded', // Wait for this element
      timeout: 45000 // Longer timeout for slow SPAs
    }
  );

  if (result.success) {
    console.log(`Dynamic content loaded successfully`);
    console.log(`Title: ${result.title}`);
    console.log(`Content length: ${result.content.length} characters`);
  } else {
    console.error(`Error: ${result.error}`);
  }
}

/**
 * Example 6: Configuration Check
 * 
 * Verify that the custom browser is properly configured
 */
async function example6_ConfigurationCheck() {
  console.log('\n=== Example 6: Configuration Check ===\n');

  const status = customBrowser.getConfigurationStatus();

  console.log(`Configuration Status:`);
  console.log(`- Browser configured: ${status.configured ? '✅' : '❌'}`);
  console.log(`- Proxy configured: ${status.hasProxy ? '✅' : '❌'}`);
  if (status.endpoint) {
    console.log(`- Endpoint: ${status.endpoint}`);
  }

  if (!status.configured) {
    console.log('\nTo configure the custom browser:');
    console.log('1. Set CUSTOM_BROWSER_WS_ENDPOINT in your .env file');
    console.log('2. Set CUSTOM_BROWSER_AUTH_TOKEN in your .env file');
    console.log('3. See BROWSERLESS_IMPLEMENTATION_PROPOSAL.md for deployment guide');
  }
}

/**
 * Example 7: Cost Comparison
 * 
 * Demonstrate cost savings compared to SaaS alternatives
 */
async function example7_CostComparison() {
  console.log('\n=== Example 7: Cost Comparison ===\n');

  // Simulate scraping 1000 pages
  const numPages = 1000;

  // Scout mode cost
  const scoutCostPerPage = 0.0004;
  const scoutTotalCost = numPages * scoutCostPerPage;

  // Sniper mode cost
  const sniperCostPerPage = 0.01;
  const sniperTotalCost = numPages * sniperCostPerPage;

  // Browserbase cost (current SaaS)
  const browserbaseCostPer1k = 15;
  const browserbaseTotalCost = (numPages / 1000) * browserbaseCostPer1k;

  console.log(`Scraping ${numPages} pages:\n`);

  console.log(`Scout Mode (Custom Browser):`);
  console.log(`- Cost per page: $${scoutCostPerPage.toFixed(6)}`);
  console.log(`- Total cost: $${scoutTotalCost.toFixed(2)}`);
  console.log(`- Savings vs Browserbase: $${(browserbaseTotalCost - scoutTotalCost).toFixed(2)} (${((1 - scoutTotalCost / browserbaseTotalCost) * 100).toFixed(1)}%)\n`);

  console.log(`Sniper Mode (Custom Browser):`);
  console.log(`- Cost per page: $${sniperCostPerPage.toFixed(6)}`);
  console.log(`- Total cost: $${sniperTotalCost.toFixed(2)}`);
  console.log(`- Savings vs Browserbase: $${(browserbaseTotalCost - sniperTotalCost).toFixed(2)} (${((1 - sniperTotalCost / browserbaseTotalCost) * 100).toFixed(1)}%)\n`);

  console.log(`Browserbase (Current SaaS):`);
  console.log(`- Cost per 1k pages: $${browserbaseCostPer1k.toFixed(2)}`);
  console.log(`- Total cost: $${browserbaseTotalCost.toFixed(2)}`);
}

/**
 * Example 8: Intelligent Mode Selection
 * 
 * Automatically choose Scout or Sniper mode based on task
 */
async function example8_IntelligentModeSelection() {
  console.log('\n=== Example 8: Intelligent Mode Selection ===\n');

  interface ScrapingTask {
    url: string;
    needsScreenshot: boolean;
    needsFullRender: boolean;
  }

  const tasks: ScrapingTask[] = [
    { url: 'https://example.com/article', needsScreenshot: false, needsFullRender: false },
    { url: 'https://example.com/pricing', needsScreenshot: true, needsFullRender: true },
    { url: 'https://example.com/blog', needsScreenshot: false, needsFullRender: false },
  ];

  for (const task of tasks) {
    // Intelligently select mode
    const fullRender = task.needsFullRender || task.needsScreenshot;
    const mode = fullRender ? 'Sniper' : 'Scout';

    console.log(`\nScraping: ${task.url}`);
    console.log(`Selected mode: ${mode}`);

    const result = await customBrowser.scrapePage(task.url, {
      fullRender,
      screenshot: task.needsScreenshot,
    });

    if (result.success) {
      console.log(`✅ Success - Cost: $${result.estimatedCost.toFixed(6)}`);
    } else {
      console.log(`❌ Failed - ${result.error}`);
    }
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Custom Browser Integration Examples                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    await example6_ConfigurationCheck();
    
    // Only run actual scraping examples if configured
    if (customBrowser.isConfigured()) {
      await example1_ScoutMode();
      await example2_SniperMode();
      await example3_BatchScraping();
      await example4_CustomActions();
      await example5_WaitForContent();
      await example8_IntelligentModeSelection();
    } else {
      console.log('\n⚠️  Custom browser not configured. Skipping scraping examples.');
      console.log('See BROWSERLESS_IMPLEMENTATION_PROPOSAL.md for setup instructions.');
    }

    await example7_CostComparison();

  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}

export default {
  example1_ScoutMode,
  example2_SniperMode,
  example3_BatchScraping,
  example4_CustomActions,
  example5_WaitForContent,
  example6_ConfigurationCheck,
  example7_CostComparison,
  example8_IntelligentModeSelection,
  runAllExamples,
};
