#!/usr/bin/env tsx
/**
 * Test Script for SSH Error Handling Improvements
 * 
 * This script tests the improved error classification functionality
 * in the SSH service to ensure different error types are properly
 * detected and user-friendly messages are returned.
 */

import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * Classify SSH-related errors and provide user-friendly error messages
 * (Copied from ssh-service.ts for testing)
 */
function classifyError(error: any, context: 'keygen' | 'connection' | 'execution'): string {
  const errorMsg = error.message || String(error);
  const lowerMsg = errorMsg.toLowerCase();

  // Permission denied errors (check before command not found)
  if (lowerMsg.includes('permission denied') || lowerMsg.includes('eacces')) {
    if (context === 'keygen') {
      return 'Permission denied while generating SSH key. Check file system permissions for the temporary directory or try running with appropriate permissions.';
    }
    if (context === 'connection') {
      return 'Authentication failed: Permission denied. Please verify:\n  • The SSH key or password is correct\n  • The public key is added to the server\'s ~/.ssh/authorized_keys\n  • The username is correct\n  • The server allows key-based or password authentication';
    }
    return 'Permission denied. Check that you have appropriate access rights.';
  }

  // Command not found errors
  if (lowerMsg.includes('command not found') || lowerMsg.includes('enoent')) {
    if (context === 'keygen') {
      return 'SSH tool not available on this system. The ssh-keygen command is required but was not found. Try using Replit Deployments instead, or ensure OpenSSH tools are installed.';
    }
    return 'SSH command not found. Ensure SSH tools are properly installed on the system.';
  }

  // Connection refused errors
  if (lowerMsg.includes('connection refused') || lowerMsg.includes('econnrefused')) {
    return 'Connection refused: Cannot connect to the server. Please verify:\n  • The hostname or IP address is correct\n  • The port number is correct (default: 22)\n  • The SSH server is running on the remote host\n  • Firewall rules allow connections on the SSH port';
  }

  // Timeout errors
  if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out') || lowerMsg.includes('etimedout')) {
    return 'Connection timeout: The server did not respond in time. Please check:\n  • Network connectivity to the server\n  • The hostname resolves correctly\n  • Firewall rules are not blocking the connection\n  • The server is online and responsive';
  }

  // Host not found / DNS errors
  if (lowerMsg.includes('getaddrinfo') || lowerMsg.includes('enotfound') || lowerMsg.includes('host not found')) {
    return 'Host not found: Cannot resolve the hostname. Please verify:\n  • The hostname or IP address is spelled correctly\n  • DNS is configured properly\n  • The host exists and is reachable';
  }

  // Key format errors
  if (lowerMsg.includes('key') && (lowerMsg.includes('invalid') || lowerMsg.includes('format') || lowerMsg.includes('corrupt'))) {
    return 'Invalid SSH key format. Please ensure:\n  • The private key is properly formatted\n  • The key is not corrupted\n  • The key matches the expected type (e.g., ed25519, RSA)\n  • The key is stored correctly in Replit Secrets';
  }

  // Authentication errors (general)
  if (lowerMsg.includes('auth') || lowerMsg.includes('authentication failed')) {
    return 'Authentication failed. Please verify:\n  • Your credentials (SSH key or password) are correct\n  • The authentication method is supported by the server\n  • The key is properly configured in Replit Secrets';
  }

  // Network errors
  if (lowerMsg.includes('enetunreach') || lowerMsg.includes('network unreachable')) {
    return 'Network unreachable: Cannot reach the destination network. Check your network configuration and routing.';
  }

  // Default: return a more contextualized error
  if (context === 'keygen') {
    return `Failed to generate SSH key: ${errorMsg}`;
  }
  if (context === 'connection') {
    return `SSH connection failed: ${errorMsg}\n\nIf the problem persists, verify your network connection and server configuration.`;
  }
  if (context === 'execution') {
    return `Command execution failed: ${errorMsg}`;
  }

  return errorMsg;
}

// Test cases
interface TestCase {
  name: string;
  error: { message: string };
  context: 'keygen' | 'connection' | 'execution';
  expectedIncludes: string[];
}

const testCases: TestCase[] = [
  {
    name: 'Command not found (keygen)',
    error: { message: 'Command not found: ssh-keygen' },
    context: 'keygen',
    expectedIncludes: ['SSH tool not available', 'Replit Deployments']
  },
  {
    name: 'Permission denied (keygen)',
    error: { message: 'EACCES: permission denied, mkdir \'/tmp/ssh-keygen\'' },
    context: 'keygen',
    expectedIncludes: ['Permission denied', 'file system permissions']
  },
  {
    name: 'Permission denied (connection)',
    error: { message: 'Permission denied (publickey,password)' },
    context: 'connection',
    expectedIncludes: ['Authentication failed', 'SSH key or password', 'authorized_keys']
  },
  {
    name: 'Connection refused',
    error: { message: 'Error: connect ECONNREFUSED 192.168.1.100:22' },
    context: 'connection',
    expectedIncludes: ['Connection refused', 'hostname or IP address', 'SSH server is running']
  },
  {
    name: 'Connection timeout',
    error: { message: 'Error: Timed out while waiting for handshake' },
    context: 'connection',
    expectedIncludes: ['Connection timeout', 'Network connectivity', 'server is online']
  },
  {
    name: 'Host not found',
    error: { message: 'Error: getaddrinfo ENOTFOUND invalid-host.example.com' },
    context: 'connection',
    expectedIncludes: ['Host not found', 'hostname or IP address', 'DNS']
  },
  {
    name: 'Invalid key format',
    error: { message: 'Invalid key format: corrupt private key' },
    context: 'connection',
    expectedIncludes: ['Invalid SSH key format', 'properly formatted', 'Replit Secrets']
  },
  {
    name: 'Authentication failed',
    error: { message: 'Authentication failed for user@host' },
    context: 'connection',
    expectedIncludes: ['Authentication failed', 'credentials']
  },
  {
    name: 'Network unreachable',
    error: { message: 'Error: connect ENETUNREACH' },
    context: 'connection',
    expectedIncludes: ['Network unreachable', 'network configuration']
  },
  {
    name: 'Generic execution error',
    error: { message: 'Some generic error message' },
    context: 'execution',
    expectedIncludes: ['Command execution failed', 'Some generic error message']
  }
];

console.log('═══════════════════════════════════════════════════════════');
console.log('  SSH Error Handling Test Suite');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = classifyError(testCase.error, testCase.context);
  const allIncluded = testCase.expectedIncludes.every(expected => 
    result.toLowerCase().includes(expected.toLowerCase())
  );

  if (allIncluded) {
    console.log(`✅ ${testCase.name}`);
    console.log(`   Context: ${testCase.context}`);
    console.log(`   Original: "${testCase.error.message}"`);
    console.log(`   Classified: "${result.substring(0, 100)}${result.length > 100 ? '...' : ''}"`);
    passed++;
  } else {
    console.log(`❌ ${testCase.name}`);
    console.log(`   Context: ${testCase.context}`);
    console.log(`   Original: "${testCase.error.message}"`);
    console.log(`   Classified: "${result}"`);
    console.log(`   Missing expected phrases: ${testCase.expectedIncludes.filter(e => !result.toLowerCase().includes(e.toLowerCase())).join(', ')}`);
    failed++;
  }
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
console.log('═══════════════════════════════════════════════════════════\n');

// Test with a real command to verify integration
console.log('Testing real command execution (optional)...\n');

// Test 1: Try to run ssh-keygen (should work in most environments)
try {
  console.log('Test: Checking ssh-keygen availability...');
  const { stdout } = await execAsync('which ssh-keygen');
  console.log(`✅ ssh-keygen found at: ${stdout.trim()}`);
  console.log('   SSH key generation should work correctly.\n');
} catch (error: any) {
  console.log('❌ ssh-keygen not found in PATH');
  const classified = classifyError(error, 'keygen');
  console.log(`   Classified error: ${classified}\n`);
}

// Test 2: Try a non-existent command
try {
  console.log('Test: Running non-existent command...');
  await execAsync('this-command-does-not-exist-12345');
} catch (error: any) {
  console.log('✅ Caught expected error for non-existent command');
  const classified = classifyError(error, 'execution');
  console.log(`   Classified error: ${classified.substring(0, 100)}...\n`);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Test suite complete!');
console.log('═══════════════════════════════════════════════════════════\n');

if (failed === 0) {
  console.log('✅ ALL TESTS PASSED - Error classification is working correctly!');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED - Please review the error classification logic');
  process.exit(1);
}
