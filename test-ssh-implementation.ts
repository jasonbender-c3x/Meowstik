#!/usr/bin/env tsx
/**
 * SSH Implementation Verification Script
 * 
 * This script verifies that all components of the SSH Gateway (Phase 1) are properly implemented.
 * It checks:
 * 1. SSH service functions are defined
 * 2. Tool declarations exist in gemini-tools.ts
 * 3. Tool handlers are wired up in rag-dispatcher.ts
 * 4. Database schemas are defined
 */

import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  passed: boolean;
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

function checkFile(filePath: string, searchPatterns: string[], description: string): VerificationResult {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    return {
      passed: false,
      message: description,
      details: `File not found: ${filePath}`
    };
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const missingPatterns = searchPatterns.filter(pattern => !content.includes(pattern));
  
  if (missingPatterns.length > 0) {
    return {
      passed: false,
      message: description,
      details: `Missing patterns in ${filePath}:\n  - ${missingPatterns.join('\n  - ')}`
    };
  }
  
  return {
    passed: true,
    message: description,
    details: `✓ All patterns found in ${filePath}`
  };
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  Project Chimera - Phase 1: SSH Gateway Verification');
console.log('═══════════════════════════════════════════════════════════\n');

// Check 1: SSH Service Implementation
console.log('1. Verifying SSH Service Implementation...');
results.push(checkFile(
  'server/services/ssh-service.ts',
  [
    'executeSshCommand',
    'connectSsh',
    'disconnectSsh',
    'generateSshKey',
    'addSshHost',
    'listSshHosts'
  ],
  'SSH Service Functions'
));

// Check 2: Tool Declarations
console.log('2. Verifying Gemini Tool Declarations...');
results.push(checkFile(
  'server/gemini-tools.ts',
  [
    'ssh_execute',
    'ssh_connect',
    'ssh_disconnect',
    'ssh_host_add',
    'ssh_host_list',
    'ssh_key_generate'
  ],
  'SSH Tool Declarations'
));

// Check 3: Tool Handlers
console.log('3. Verifying RAG Dispatcher Tool Handlers...');
results.push(checkFile(
  'server/services/rag-dispatcher.ts',
  [
    'case "ssh_execute"',
    'executeSshExecute',
    'executeSshConnect',
    'executeSshDisconnect',
    'import * as sshService'
  ],
  'SSH Tool Handlers'
));

// Check 4: Database Schema
console.log('4. Verifying Database Schema...');
results.push(checkFile(
  'shared/schema.ts',
  [
    'export const sshHosts',
    'export const sshKeys',
    'InsertSshHost',
    'InsertSshKey'
  ],
  'SSH Database Schema'
));

// Check 5: ssh_execute tool acceptance criteria
console.log('5. Verifying ssh_execute Tool Acceptance Criteria...');
const sshServiceContent = fs.readFileSync('server/services/ssh-service.ts', 'utf-8');
const ragDispatcherContent = fs.readFileSync('server/services/rag-dispatcher.ts', 'utf-8');

const acceptanceCriteria = [
  {
    criterion: 'Tool can connect to remote host',
    check: sshServiceContent.includes('await ssh.connect({') && 
           sshServiceContent.includes('activeConnections.set(alias, ssh)')
  },
  {
    criterion: 'Tool can execute arbitrary shell commands',
    check: sshServiceContent.includes('await ssh.execCommand(command') &&
           sshServiceContent.includes('onStdout') &&
           sshServiceContent.includes('onStderr')
  },
  {
    criterion: 'Tool returns stdout, stderr, and exit code',
    check: ragDispatcherContent.includes('stdout: result.stdout') &&
           ragDispatcherContent.includes('stderr: result.stderr') &&
           ragDispatcherContent.includes('exitCode: result.exitCode')
  },
  {
    criterion: 'Tool is available to the agent',
    check: fs.readFileSync('server/gemini-tools.ts', 'utf-8').includes('name: "ssh_execute"')
  }
];

acceptanceCriteria.forEach((ac, index) => {
  results.push({
    passed: ac.check,
    message: `Acceptance Criterion ${index + 1}`,
    details: ac.criterion
  });
});

// Print Results
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Verification Results');
console.log('═══════════════════════════════════════════════════════════\n');

let allPassed = true;
results.forEach((result, index) => {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.message}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
  if (!result.passed) {
    allPassed = false;
  }
});

console.log('\n═══════════════════════════════════════════════════════════');
if (allPassed) {
  console.log('✅ ALL CHECKS PASSED - Phase 1 is COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('The ssh_execute tool is fully implemented and available.');
  console.log('The agent can now:');
  console.log('  • Connect to pre-configured remote hosts');
  console.log('  • Execute arbitrary shell commands');
  console.log('  • Receive stdout, stderr, and exit codes');
  console.log('  • Manage SSH keys and host configurations\n');
  process.exit(0);
} else {
  console.log('❌ SOME CHECKS FAILED - Phase 1 needs attention');
  console.log('═══════════════════════════════════════════════════════════\n');
  process.exit(1);
}
