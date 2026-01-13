#!/usr/bin/env node
/**
 * Diagnostic script for Google Cloud TTS IAM Permissions
 * 
 * This script helps diagnose IAM permission issues with Text-to-Speech API.
 * It checks:
 * 1. Service account configuration
 * 2. API enablement status
 * 3. IAM role assignments
 * 4. Provides actionable next steps
 * 
 * Usage:
 *   node scripts/diagnose-tts-iam.cjs
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  'attached_assets/ai-stack-e2a5f-72c8fed5d463_1767324141242.json';

console.log('🔍 Google Cloud TTS IAM Permission Diagnostics\n');
console.log('═'.repeat(70));

async function checkGcloudInstalled() {
  try {
    await execAsync('gcloud --version');
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Step 1: Check service account file
  console.log('\n1️⃣  Service Account Configuration');
  console.log('   Path:', GOOGLE_APPLICATION_CREDENTIALS);
  
  const resolvedPath = path.resolve(GOOGLE_APPLICATION_CREDENTIALS);
  if (!fs.existsSync(resolvedPath)) {
    console.error('   ❌ Service account file not found!');
    console.error('\n   This is a critical issue. The file must exist.');
    process.exit(1);
  }
  console.log('   ✅ File exists');
  
  // Step 2: Load and parse credentials
  console.log('\n2️⃣  Service Account Details');
  let credentials;
  try {
    credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    console.log('   Type:', credentials.type);
    console.log('   Project ID:', credentials.project_id);
    console.log('   Client Email:', credentials.client_email);
    console.log('   ✅ Valid service account JSON');
  } catch (error) {
    console.error('   ❌ Failed to parse service account JSON:', error.message);
    process.exit(1);
  }
  
  // Step 3: Check Text-to-Speech API enablement
  console.log('\n3️⃣  Text-to-Speech API Status');
  console.log('   API:', 'texttospeech.googleapis.com');
  console.log('   Project:', credentials.project_id);
  
  const hasGcloud = await checkGcloudInstalled();
  
  if (hasGcloud) {
    console.log('   📦 gcloud CLI detected - checking API status...');
    try {
      const { stdout } = await execAsync(
        `gcloud services list --enabled --project=${credentials.project_id} --filter="name:texttospeech.googleapis.com" --format="value(name)"`
      );
      if (stdout.trim() === 'texttospeech.googleapis.com') {
        console.log('   ✅ Text-to-Speech API is enabled');
      } else {
        console.log('   ❌ Text-to-Speech API is NOT enabled');
        console.log('\n   To enable it, run:');
        console.log(`   gcloud services enable texttospeech.googleapis.com --project=${credentials.project_id}`);
      }
    } catch (error) {
      console.log('   ⚠️  Could not verify API status (authentication may be required)');
      console.log('   Error:', error.message);
    }
  } else {
    console.log('   ℹ️  gcloud CLI not installed - cannot auto-check API status');
    console.log('\n   Manual check:');
    console.log(`   1. Visit: https://console.cloud.google.com/apis/api/texttospeech.googleapis.com/overview?project=${credentials.project_id}`);
    console.log('   2. Verify the API is enabled (you should see "API enabled" status)');
  }
  
  // Step 4: Check IAM permissions
  console.log('\n4️⃣  IAM Role Assignment Check');
  console.log('   Service Account:', credentials.client_email);
  console.log('   Required Role: roles/texttospeech.user (Cloud Text-to-Speech User)');
  
  if (hasGcloud) {
    console.log('   📦 gcloud CLI detected - checking IAM roles...');
    try {
      const { stdout } = await execAsync(
        `gcloud projects get-iam-policy ${credentials.project_id} --flatten="bindings[].members" --filter="bindings.members:serviceAccount:${credentials.client_email}" --format="table(bindings.role)"`
      );
      
      const roles = stdout.split('\n')
        .filter(line => line.startsWith('roles/'))
        .map(line => line.trim());
      
      console.log('\n   Current roles assigned:');
      if (roles.length === 0) {
        console.log('   ⚠️  No roles found!');
      } else {
        roles.forEach(role => {
          if (role === 'roles/texttospeech.user' || 
              role === 'roles/editor' || 
              role === 'roles/owner') {
            console.log(`   ✅ ${role} (sufficient)`);
          } else {
            console.log(`   ℹ️  ${role}`);
          }
        });
      }
      
      const hasTTSRole = roles.includes('roles/texttospeech.user');
      const hasEditorRole = roles.includes('roles/editor');
      const hasOwnerRole = roles.includes('roles/owner');
      
      if (hasTTSRole || hasEditorRole || hasOwnerRole) {
        console.log('\n   ✅ Service account has sufficient permissions');
      } else {
        console.log('\n   ❌ ISSUE FOUND: Service account lacks Text-to-Speech permissions!');
        console.log('\n   This is the root cause of "Insufficient Permission" errors.');
        console.log('\n   To fix, grant the required role:');
        console.log(`   gcloud projects add-iam-policy-binding ${credentials.project_id} \\`);
        console.log(`     --member="serviceAccount:${credentials.client_email}" \\`);
        console.log('     --role="roles/texttospeech.user"');
      }
      
    } catch (error) {
      console.log('   ⚠️  Could not verify IAM roles (authentication may be required)');
      console.log('   Error:', error.message);
    }
  } else {
    console.log('   ℹ️  gcloud CLI not installed - cannot auto-check IAM roles');
    console.log('\n   Manual check:');
    console.log(`   1. Visit: https://console.cloud.google.com/iam-admin/iam?project=${credentials.project_id}`);
    console.log(`   2. Find service account: ${credentials.client_email}`);
    console.log('   3. Verify it has one of these roles:');
    console.log('      - Cloud Text-to-Speech User (roles/texttospeech.user) [RECOMMENDED]');
    console.log('      - Editor (roles/editor)');
    console.log('      - Owner (roles/owner)');
  }
  
  // Step 5: Test credentials with a simple API call
  console.log('\n5️⃣  Live API Test');
  console.log('   Testing authentication with a minimal API call...');
  
  try {
    // Dynamic import for ESM compatibility
    const googleapis = await import('googleapis');
    const { google } = googleapis;
    
    const auth = new google.auth.GoogleAuth({
      keyFile: resolvedPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    
    console.log('   ✅ Authentication works');
    console.log('   Project ID from auth:', projectId);
    
    // Try to make an actual TTS API call
    const tts = google.texttospeech({ version: 'v1', auth: client });
    
    try {
      const response = await tts.text.synthesize({
        requestBody: {
          input: { text: 'Test' },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-C',
            ssmlGender: 'FEMALE'
          },
          audioConfig: {
            audioEncoding: 'MP3',
          }
        }
      });
      
      if (response.data.audioContent) {
        console.log('   ✅ TTS API call successful!');
        console.log('   🎉 All permissions are correctly configured!');
      } else {
        console.log('   ⚠️  API call returned but no audio content');
      }
    } catch (apiError) {
      console.log('   ❌ TTS API call failed:', apiError.message);
      
      if (apiError.message.includes('403') || 
          apiError.message.includes('PERMISSION_DENIED') ||
          apiError.message.includes('Insufficient Permission')) {
        console.log('\n   🔴 PERMISSION DENIED ERROR DETECTED');
        console.log('   This confirms the service account lacks IAM permissions.');
        console.log('\n   Next steps:');
        console.log('   1. Verify Text-to-Speech API is enabled (Step 3)');
        console.log('   2. Grant the required IAM role (Step 4)');
        console.log('   3. Wait 1-2 minutes for IAM changes to propagate');
        console.log('   4. Run this diagnostic again to verify');
      } else {
        console.log('\n   Error details:', apiError.stack || apiError);
      }
    }
    
  } catch (authError) {
    console.log('   ⚠️  Could not perform live API test:', authError.message);
    console.log('   This is non-critical. Please verify using manual steps below.');
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📋 Summary\n');
  console.log('If you see permission errors, follow these steps:\n');
  console.log('1. Enable Text-to-Speech API:');
  console.log(`   https://console.cloud.google.com/apis/api/texttospeech.googleapis.com/overview?project=${credentials.project_id}`);
  console.log('\n2. Grant IAM role to service account:');
  console.log(`   https://console.cloud.google.com/iam-admin/iam?project=${credentials.project_id}`);
  console.log(`   Service Account: ${credentials.client_email}`);
  console.log('   Required Role: Cloud Text-to-Speech User (roles/texttospeech.user)');
  console.log('\n3. Wait 1-2 minutes for changes to propagate');
  console.log('\n4. Restart your application');
  console.log('═'.repeat(70));
}

main().catch(console.error);
