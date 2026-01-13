#!/usr/bin/env tsx
/**
 * SSH Gateway - Usage Examples
 * 
 * This script demonstrates how to use the SSH Gateway tools
 * programmatically. It shows the typical workflow for:
 * 1. Generating SSH keys
 * 2. Configuring remote hosts
 * 3. Connecting and executing commands
 * 4. Managing connections
 */

import * as sshService from './server/services/ssh-service';

/**
 * Example 1: Complete Setup Workflow
 * 
 * This demonstrates the full process of setting up SSH access
 * to a new remote server.
 */
async function exampleCompleteSetup() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Example 1: Complete Setup Workflow');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Generate SSH key pair
    console.log('Step 1: Generating SSH key...');
    const keyResult = await sshService.generateSshKey('example-server', 'meowstik-demo');
    
    console.log('✅ Key generated successfully!');
    console.log('Public Key (add to remote server):');
    console.log(keyResult.publicKey);
    console.log('\nPrivate Key Secret Name:', keyResult.privateKeySecretName);
    console.log('Fingerprint:', keyResult.fingerprint);
    console.log('\n⚠️  Store the private key as a Replit secret before continuing!\n');

    // Step 2: Add host configuration
    console.log('Step 2: Adding host configuration...');
    const host = await sshService.addSshHost({
      alias: 'example',
      hostname: '192.168.1.100',
      username: 'deploy',
      port: 22,
      keySecretName: keyResult.privateKeySecretName,
      description: 'Example production server',
      tags: ['production', 'example']
    });

    console.log('✅ Host added:', host.alias);
    console.log('   Connection:', `${host.username}@${host.hostname}:${host.port}\n`);

    // Step 3: List configured hosts
    console.log('Step 3: Listing all hosts...');
    const hosts = await sshService.listSshHosts();
    console.log(`Found ${hosts.length} configured host(s):`);
    hosts.forEach(h => {
      console.log(`  - ${h.alias} (${h.username}@${h.hostname})`);
    });

    console.log('\n✅ Setup complete! You can now connect using ssh_connect.\n');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 2: Connection Management
 * 
 * Demonstrates connecting to a host, checking status, and disconnecting.
 */
async function exampleConnectionManagement() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Example 2: Connection Management');
  console.log('═══════════════════════════════════════════════════════════\n');

  const alias = 'example';

  try {
    // Check if host exists
    const host = await sshService.getSshHost(alias);
    if (!host) {
      console.log(`❌ Host '${alias}' not found. Run Example 1 first.`);
      return;
    }

    // Connect to host
    console.log(`Connecting to ${alias}...`);
    const connectResult = await sshService.connectSsh(alias);
    console.log('✅', connectResult.message);

    // Check connection status
    console.log('\nChecking connection status...');
    const isConnected = sshService.isConnected(alias);
    console.log(`Connection status: ${isConnected ? '🟢 Connected' : '🔴 Disconnected'}`);

    // Get all active connections
    const activeConnections = sshService.getActiveConnections();
    console.log(`Active connections: ${activeConnections.join(', ') || 'none'}`);

    // Disconnect
    console.log(`\nDisconnecting from ${alias}...`);
    await sshService.disconnectSsh(alias);
    console.log('✅ Disconnected');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 3: Command Execution
 * 
 * Demonstrates executing commands on a remote host.
 */
async function exampleCommandExecution() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Example 3: Command Execution');
  console.log('═══════════════════════════════════════════════════════════\n');

  const alias = 'example';

  try {
    // Connect first
    console.log(`Connecting to ${alias}...`);
    await sshService.connectSsh(alias);
    console.log('✅ Connected\n');

    // Execute a series of commands
    const commands = [
      'whoami',
      'pwd',
      'ls -la',
      'uname -a'
    ];

    for (const command of commands) {
      console.log(`\n$ ${command}`);
      console.log('─'.repeat(60));
      
      const result = await sshService.executeSshCommand(alias, command);
      
      if (result.stdout) {
        console.log(result.stdout);
      }
      
      if (result.stderr) {
        console.error('STDERR:', result.stderr);
      }
      
      console.log(`Exit code: ${result.exitCode}`);
    }

    // Disconnect when done
    console.log('\nDisconnecting...');
    await sshService.disconnectSsh(alias);
    console.log('✅ Done');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 4: Error Handling
 * 
 * Demonstrates proper error handling for common scenarios.
 */
async function exampleErrorHandling() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Example 4: Error Handling');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Scenario 1: Execute command without connecting
  console.log('Scenario 1: Execute without connecting');
  try {
    await sshService.executeSshCommand('nonexistent', 'ls');
  } catch (error) {
    console.log('✅ Caught expected error:', error instanceof Error ? error.message : error);
  }

  // Scenario 2: Connect to non-existent host
  console.log('\nScenario 2: Connect to non-existent host');
  try {
    await sshService.connectSsh('does-not-exist');
  } catch (error) {
    console.log('✅ Caught expected error:', error instanceof Error ? error.message : error);
  }

  // Scenario 3: Delete non-existent host
  console.log('\nScenario 3: Delete non-existent host');
  try {
    await sshService.deleteSshHost('fake-host');
    console.log('✅ Host deleted (no error for non-existent)');
  } catch (error) {
    console.log('❌ Unexpected error:', error);
  }

  console.log('\n✅ Error handling demonstration complete\n');
}

/**
 * Example 5: Deployment Workflow
 * 
 * A realistic example of deploying an application to a remote server.
 */
async function exampleDeployment() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Example 5: Application Deployment Workflow');
  console.log('═══════════════════════════════════════════════════════════\n');

  const alias = 'example';
  const appPath = '/var/www/myapp';

  try {
    // Connect
    console.log('Connecting to production server...');
    await sshService.connectSsh(alias);
    console.log('✅ Connected\n');

    // Define deployment steps
    const deploymentSteps = [
      { name: 'Navigate to app directory', cmd: `cd ${appPath}` },
      { name: 'Check current branch', cmd: `cd ${appPath} && git branch` },
      { name: 'Pull latest changes', cmd: `cd ${appPath} && git pull origin main` },
      { name: 'Install dependencies', cmd: `cd ${appPath} && npm install` },
      { name: 'Run tests', cmd: `cd ${appPath} && npm test` },
      { name: 'Build application', cmd: `cd ${appPath} && npm run build` },
      { name: 'Restart service', cmd: 'sudo systemctl restart myapp' },
      { name: 'Check service status', cmd: 'sudo systemctl status myapp --no-pager' }
    ];

    // Execute deployment
    for (let i = 0; i < deploymentSteps.length; i++) {
      const step = deploymentSteps[i];
      console.log(`\n[${i + 1}/${deploymentSteps.length}] ${step.name}`);
      console.log('─'.repeat(60));

      const result = await sshService.executeSshCommand(alias, step.cmd);

      if (result.exitCode === 0) {
        console.log('✅ Success');
        if (result.stdout) {
          console.log(result.stdout.trim());
        }
      } else {
        console.error('❌ Failed with exit code:', result.exitCode);
        if (result.stderr) {
          console.error(result.stderr);
        }
        console.log('\n⚠️  Deployment aborted due to error');
        break;
      }
    }

    // Disconnect
    console.log('\n\nDisconnecting...');
    await sshService.disconnectSsh(alias);
    console.log('✅ Deployment complete!\n');

  } catch (error) {
    console.error('❌ Deployment error:', error instanceof Error ? error.message : error);
    try {
      await sshService.disconnectSsh(alias);
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

// Main menu
async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     Project Chimera - SSH Gateway Usage Examples        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('Available examples:');
  console.log('  1. Complete Setup Workflow');
  console.log('  2. Connection Management');
  console.log('  3. Command Execution');
  console.log('  4. Error Handling');
  console.log('  5. Application Deployment');
  console.log('\n');

  const example = process.argv[2];

  switch (example) {
    case '1':
      await exampleCompleteSetup();
      break;
    case '2':
      await exampleConnectionManagement();
      break;
    case '3':
      await exampleCommandExecution();
      break;
    case '4':
      await exampleErrorHandling();
      break;
    case '5':
      await exampleDeployment();
      break;
    default:
      console.log('Usage: npx tsx ssh-examples.ts [1-5]');
      console.log('Example: npx tsx ssh-examples.ts 1');
      console.log('\n⚠️  Note: Most examples require a working database connection.');
      console.log('Set DATABASE_URL environment variable before running.\n');
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1])) {
  main().catch(console.error);
}

export {
  exampleCompleteSetup,
  exampleConnectionManagement,
  exampleCommandExecution,
  exampleErrorHandling,
  exampleDeployment
};
