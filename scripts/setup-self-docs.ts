#!/usr/bin/env node

/**
 * Setup script for Self-Documentation System
 * 
 * This script helps initialize the self-documentation system by:
 * 1. Checking environment variables
 * 2. Applying database schema
 * 3. Verifying the installation
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🤖 Meowstik Self-Documentation System Setup\n');
console.log('============================================\n');

// Step 1: Check environment variables
console.log('Step 1: Checking environment variables...');
const requiredEnvVars = ['DATABASE_URL', 'GEMINI_API_KEY'];
const missingVars: string[] = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
    console.log(`  ❌ ${envVar} - Missing`);
  } else {
    console.log(`  ✅ ${envVar} - Set`);
  }
}

if (missingVars.length > 0) {
  console.error('\n⚠️  Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.error('\nPlease set these variables and try again.');
  process.exit(1);
}

console.log('\n✅ All required environment variables are set.\n');

// Step 2: Apply database schema
console.log('Step 2: Applying database schema...');
try {
  console.log('  Running drizzle-kit push...');
  execSync('npx drizzle-kit push', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('\n✅ Database schema applied successfully.\n');
} catch (error) {
  console.error('\n❌ Failed to apply database schema.');
  console.error('Please run manually: npm run db:push');
  process.exit(1);
}

// Step 3: Verify installation
console.log('Step 3: Verifying installation...');

const filesToCheck = [
  'server/services/documentation-generator.ts',
  'server/routes/documentation.ts',
  'docs/SELF_DOCUMENTATION_SYSTEM.md',
];

let allFilesExist = true;
for (const file of filesToCheck) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - Missing`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.error('\n⚠️  Some files are missing. Installation may be incomplete.');
  process.exit(1);
}

console.log('\n✅ All files verified.\n');

// Success!
console.log('============================================');
console.log('✨ Setup Complete!\n');
console.log('Next steps:');
console.log('  1. Start the dev server: npm run dev');
console.log('  2. Navigate to /docs');
console.log('  3. Click "Generate Documentation"');
console.log('  4. Fill in the form and generate your first doc!\n');
console.log('For more information, see docs/SELF_DOCUMENTATION_SYSTEM.md');
console.log('============================================\n');
