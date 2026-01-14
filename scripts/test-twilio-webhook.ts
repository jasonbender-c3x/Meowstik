#!/usr/bin/env node

/**
 * Test script for Twilio SMS webhook
 * 
 * This script simulates a Twilio webhook POST request to test the SMS processing logic
 * without needing to send actual SMS messages.
 */

import http from 'http';

const WEBHOOK_URL = 'http://localhost:5000/api/twilio/webhook/sms';

// Mock Twilio webhook payload
const testPayloads = [
  {
    name: "Owner SMS",
    data: {
      From: process.env.OWNER_PHONE_NUMBER || '+15551234567',
      Body: 'What is on my calendar today?',
      MessageSid: 'SM' + Math.random().toString(36).substring(7),
    }
  },
  {
    name: "Known Contact SMS",
    data: {
      From: '+15559876543',
      Body: 'Where is Jason?',
      MessageSid: 'SM' + Math.random().toString(36).substring(7),
    }
  },
  {
    name: "Guest SMS",
    data: {
      From: '+15551111111',
      Body: 'What is the weather like?',
      MessageSid: 'SM' + Math.random().toString(36).substring(7),
    }
  }
];

/**
 * Send a mock webhook request
 */
async function testWebhook(payload: typeof testPayloads[0]) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${payload.name}`);
  console.log(`From: ${payload.data.From}`);
  console.log(`Body: ${payload.data.Body}`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(payload.data as any).toString();

    const options = {
      method: 'POST',
      hostname: 'localhost',
      port: 5000,
      path: '/api/twilio/webhook/sms',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        // Note: X-Twilio-Signature is omitted for dev testing
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response Status: ${res.statusCode}`);
        console.log(`Response Body:\n${data}\n`);
        
        if (res.statusCode === 200) {
          console.log('✓ Webhook accepted\n');
          resolve(data);
        } else {
          console.log('✗ Webhook failed\n');
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`✗ Request error: ${error.message}\n`);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Twilio SMS Webhook Test Suite');
  console.log('==============================\n');
  console.log('Prerequisites:');
  console.log('1. Server must be running (npm run dev)');
  console.log('2. OWNER_PHONE_NUMBER should be set in .env');
  console.log('3. Twilio credentials should be configured\n');

  let passed = 0;
  let failed = 0;

  for (const payload of testPayloads) {
    try {
      await testWebhook(payload);
      passed++;
    } catch (error) {
      console.error(`Error testing ${payload.name}:`, error);
      failed++;
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Results:');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log('='.repeat(60));

  console.log('\nNote: This script only tests webhook acceptance.');
  console.log('Check server logs to verify full SMS processing pipeline.');
}

// Run tests if called directly
// Check if this script is the main module being executed
if (process.argv[1]) {
  const scriptPath = process.argv[1].replace(/\\/g, '/');
  const modulePath = import.meta.url.replace('file://', '');
  if (modulePath.includes(scriptPath) || scriptPath.includes('test-twilio-webhook')) {
    runTests().catch(console.error);
  }
}

export { testWebhook, testPayloads };
