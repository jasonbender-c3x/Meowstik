#!/usr/bin/env node
/**
 * Test script for Google Cloud TTS authentication
 * 
 * This script validates that the service account is properly configured
 * and can be loaded by the TTS integration.
 * 
 * Usage:
 *   node scripts/test-tts-auth.js
 */

const fs = require('fs');
const path = require('path');

const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  'attached_assets/ai-stack-e2a5f-72c8fed5d463_1767324141242.json';

console.log('🔍 Testing Google Cloud TTS Authentication\n');
console.log('═'.repeat(60));

// Step 1: Check environment variable
console.log('\n1️⃣  Environment Configuration');
console.log('   GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || '(not set)');
console.log('   Using path:', GOOGLE_APPLICATION_CREDENTIALS);

// Step 2: Verify file exists
console.log('\n2️⃣  Service Account File');
const resolvedPath = path.resolve(GOOGLE_APPLICATION_CREDENTIALS);
console.log('   Resolved path:', resolvedPath);

if (!fs.existsSync(resolvedPath)) {
  console.error('   ❌ File not found!');
  console.error('\n   Solutions:');
  console.error('   - Verify the file exists in attached_assets/');
  console.error('   - Check GOOGLE_APPLICATION_CREDENTIALS path is correct');
  process.exit(1);
}
console.log('   ✅ File exists');

// Step 3: Load and validate credentials
console.log('\n3️⃣  Credential Validation');
try {
  const credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  
  const required = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
  const missing = required.filter(field => !credentials[field]);
  
  if (missing.length > 0) {
    console.error('   ❌ Missing required fields:', missing.join(', '));
    process.exit(1);
  }
  
  if (credentials.type !== 'service_account') {
    console.error('   ❌ Invalid credential type:', credentials.type);
    console.error('   Expected: service_account');
    process.exit(1);
  }
  
  console.log('   Type:', credentials.type);
  console.log('   Project ID:', credentials.project_id);
  console.log('   Client email:', credentials.client_email);
  console.log('   Private key ID:', credentials.private_key_id);
  console.log('   ✅ All required fields present');
  
  // Step 4: Simulate what expressive-tts.ts does
  console.log('\n4️⃣  Integration Check');
  console.log('   Simulating server/integrations/expressive-tts.ts loading...');
  
  // This mimics the getServiceAccountAuth() function
  const testAuth = {
    keyFile: resolvedPath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  };
  console.log('   Auth config:', JSON.stringify(testAuth, null, 2).split('\n').map(l => '   ' + l).join('\n').trim());
  console.log('   ✅ Configuration ready for googleapis');
  
  // Success summary
  console.log('\n' + '═'.repeat(60));
  console.log('✅ SUCCESS: TTS Authentication Configured Correctly!');
  console.log('═'.repeat(60));
  
  console.log('\n📋 Summary:');
  console.log('   • Service account file is valid');
  console.log('   • All required credentials are present');
  console.log('   • Ready for Text-to-Speech API calls');
  
  console.log('\n🚀 Next Steps:');
  console.log('   1. Verify Text-to-Speech API is enabled:');
  console.log('      https://console.cloud.google.com/apis/library/texttospeech.googleapis.com?project=' + credentials.project_id);
  console.log('   2. Verify IAM permissions for:', credentials.client_email);
  console.log('      Required role: "Cloud Text-to-Speech User" or "Editor"');
  console.log('   3. Start the server: npm run dev');
  console.log('   4. Test the endpoint:');
  console.log('      curl -X POST http://localhost:5000/api/speech/tts \\');
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"text": "Hello!", "speakers": [{"voice": "Kore"}]}\'');
  
  console.log('\n📖 Documentation:');
  console.log('   See docs/VOICE_SYNTHESIS_SETUP.md for troubleshooting');
  
} catch (error) {
  console.error('   ❌ Error reading credentials:', error.message);
  console.error('\n   Stack trace:', error.stack);
  process.exit(1);
}
