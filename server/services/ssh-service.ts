/**
 * SSH Service
 * Manages SSH connections to remote servers with WebSocket streaming
 */

import { NodeSSH } from 'node-ssh';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getDb } from '../db';
import { sshHosts, sshKeys, InsertSshHost, InsertSshKey } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);

// SSH tool path - explicit path to avoid PATH resolution issues
const SSH_KEYGEN_PATH = '/usr/bin/ssh-keygen';

// Active SSH connections indexed by host alias
const activeConnections = new Map<string, NodeSSH>();

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Check if SSH tools are available in the environment
 * @returns Object with availability status and details
 */
export async function checkSSHAvailability(): Promise<{
  available: boolean;
  sshKeygen: boolean;
  message: string;
}> {
  try {
    // Check if ssh-keygen exists
    await execAsync(`command -v ssh-keygen`);
    return {
      available: true,
      sshKeygen: true,
      message: 'SSH tools are available'
    };
  } catch (error) {
    return {
      available: false,
      sshKeygen: false,
      message: `SSH tools not found. Please ensure OpenSSH is installed (e.g., via replit.nix with pkgs.openssh)`
    };
  }
}

// =============================================================================
// ERROR CLASSIFICATION HELPERS
// =============================================================================

/**
 * Classify SSH-related errors and provide user-friendly error messages
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
      return `SSH tool not available on this system. OpenSSH tools must be installed at ${SSH_KEYGEN_PATH}. Try using Replit Deployments instead, or ensure OpenSSH is properly installed.`;
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
  if ((lowerMsg.includes('ssh key') || lowerMsg.includes('private key') || lowerMsg.includes('public key')) && 
      (lowerMsg.includes('invalid') || lowerMsg.includes('format') || lowerMsg.includes('corrupt'))) {
    return 'Invalid SSH key format. Please ensure:\n  • The private key is properly formatted\n  • The key is not corrupted\n  • The key matches the expected type (e.g., ed25519, RSA)\n  • The key is stored correctly in Replit Secrets';
  }

  // Authentication errors (general)
  if (lowerMsg.includes('authentication failed') || lowerMsg.includes('auth failed') || 
      lowerMsg.includes('authentication error')) {
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

// Event listeners for terminal output (WebSocket broadcasts)
type OutputListener = (data: { type: 'stdout' | 'stderr' | 'system' | 'command'; content: string; source: string }) => void;
const outputListeners = new Set<OutputListener>();

export function addOutputListener(listener: OutputListener) {
  outputListeners.add(listener);
  return () => outputListeners.delete(listener);
}

export function broadcastOutput(type: 'stdout' | 'stderr' | 'system' | 'command', content: string, source: string) {
  for (const listener of outputListeners) {
    try {
      listener({ type, content, source });
    } catch (e) {
      console.error('[SSH] Error in output listener:', e);
    }
  }
}

/**
 * Broadcast a message to all connected terminals
 */
export function broadcastToTerminals(content: string, source: string = 'system') {
  broadcastOutput('stdout', content, source);
}

// =============================================================================
// SSH KEY GENERATION
// =============================================================================

interface KeyGenResult {
  name: string;
  publicKey: string;
  privateKeySecretName: string;
  fingerprint: string;
}

/**
 * Generate a new SSH key pair
 * Returns public key for user to add to authorized_keys
 * Private key must be stored by user as a Replit secret
 */
export async function generateSshKey(name: string, comment?: string): Promise<KeyGenResult & { privateKey: string; instructions: string }> {
  const tmpDir = '/tmp/ssh-keygen-' + crypto.randomBytes(8).toString('hex');
  
  // Create temporary directory for key generation
  fs.mkdirSync(tmpDir, { mode: 0o700 });
  
  const keyPath = path.join(tmpDir, 'key');
  const commentStr = comment || `meowstik-${name}@replit`;
  
  // Generate ed25519 key (most secure and compact)
  try {
    await execAsync(`${SSH_KEYGEN_PATH} -t ed25519 -f "${keyPath}" -N "" -C "${commentStr}" -q`);
  } catch (error) {
    // Cleanup on error
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const userMessage = classifyError(error, 'keygen');
    throw new Error(userMessage);
  }
  
  // Read generated keys
  const privateKey = fs.readFileSync(keyPath, 'utf-8');
  const publicKey = fs.readFileSync(`${keyPath}.pub`, 'utf-8').trim();
  
  // Get fingerprint
  const { stdout: fingerprint } = await execAsync(`${SSH_KEYGEN_PATH} -lf "${keyPath}.pub"`);
  const fpMatch = fingerprint.match(/SHA256:[^\s]+/);
  
  // SECURITY: Delete temporary files immediately
  fs.rmSync(tmpDir, { recursive: true, force: true });
  
  // Generate secret name for user to store the private key
  const privateKeySecretName = `SSH_KEY_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  
  // Save key metadata to database (public key only, not private!)
  await getDb().insert(sshKeys).values({
    name,
    publicKey,
    privateKeySecretName,
    keyType: 'ed25519',
    fingerprint: fpMatch?.[0] || fingerprint.trim(),
  });
  
  const instructions = `
🔐 SSH Key Generated: "${name}"

📋 PUBLIC KEY (add to your server's ~/.ssh/authorized_keys):
${publicKey}

🔒 PRIVATE KEY (store as Replit secret "${privateKeySecretName}"):
The private key has been generated. You MUST store it as a Replit secret.

Steps:
1. Copy the private key below
2. Go to Replit Secrets tab
3. Add secret with name: ${privateKeySecretName}
4. Paste the private key as the value
5. Then use ssh_host_add to configure the connection
`;
  
  broadcastOutput('system', instructions, 'ssh');
  
  return {
    name,
    publicKey,
    privateKey, // Returned once for user to store - not persisted!
    privateKeySecretName,
    fingerprint: fpMatch?.[0] || fingerprint.trim(),
    instructions,
  };
}

/**
 * List all generated SSH keys
 */
export async function listSshKeys() {
  return await getDb().select().from(sshKeys);
}

/**
 * Get a specific SSH key's public key
 */
export async function getSshKeyPublic(name: string) {
  const [key] = await getDb().select().from(sshKeys).where(eq(sshKeys.name, name));
  return key;
}

// =============================================================================
// SSH HOST MANAGEMENT
// =============================================================================

/**
 * Add a new SSH host profile
 */
export async function addSshHost(host: InsertSshHost) {
  const [created] = await getDb().insert(sshHosts).values(host).returning();
  broadcastOutput('system', `✅ Added SSH host "${host.alias}" (${host.username}@${host.hostname}:${host.port || 22})`, 'ssh');
  return created;
}

/**
 * List all configured SSH hosts
 */
export async function listSshHosts() {
  return await getDb().select().from(sshHosts);
}

/**
 * Get a specific SSH host by alias
 */
export async function getSshHost(alias: string) {
  const [host] = await getDb().select().from(sshHosts).where(eq(sshHosts.alias, alias));
  return host;
}

/**
 * Delete an SSH host profile
 */
export async function deleteSshHost(alias: string) {
  // Disconnect if connected
  if (activeConnections.has(alias)) {
    await disconnectSsh(alias);
  }
  
  await getDb().delete(sshHosts).where(eq(sshHosts.alias, alias));
  broadcastOutput('system', `🗑️ Removed SSH host "${alias}"`, 'ssh');
  return { success: true };
}

// =============================================================================
// SSH CONNECTION MANAGEMENT
// =============================================================================

/**
 * Connect to an SSH host
 */
export async function connectSsh(alias: string): Promise<{ success: boolean; message: string }> {
  const host = await getSshHost(alias);
  if (!host) {
    throw new Error(`SSH host "${alias}" not found. Use ssh_host_add to create it.`);
  }
  
  // Already connected?
  if (activeConnections.has(alias)) {
    return { success: true, message: `Already connected to ${alias}` };
  }
  
  const ssh = new NodeSSH();
  
  try {
    broadcastOutput('system', `🔌 Connecting to ${host.username}@${host.hostname}:${host.port}...`, 'ssh');
    
    // Get private key from Replit secrets
    let privateKey: string | undefined;
    if (host.keySecretName) {
      privateKey = process.env[host.keySecretName];
      if (!privateKey) {
        throw new Error(`Private key secret "${host.keySecretName}" not found. Add it to Replit Secrets.`);
      }
    }
    
    // Get password if using password auth
    let password: string | undefined;
    if (host.passwordSecretName) {
      password = process.env[host.passwordSecretName];
    }
    
    await ssh.connect({
      host: host.hostname,
      port: host.port || 22,
      username: host.username,
      privateKey,
      password,
      readyTimeout: 30000,
    });
    
    activeConnections.set(alias, ssh);
    
    // Update last connected time
    await getDb().update(sshHosts)
      .set({ lastConnected: new Date(), lastError: null })
      .where(eq(sshHosts.alias, alias));
    
    broadcastOutput('system', `✅ Connected to ${alias} (${host.hostname})`, 'ssh');
    
    return { success: true, message: `Connected to ${alias}` };
  } catch (error: any) {
    const userMessage = classifyError(error, 'connection');
    
    // Update error in database
    await getDb().update(sshHosts)
      .set({ lastError: userMessage })
      .where(eq(sshHosts.alias, alias));
    
    broadcastOutput('stderr', `❌ Failed to connect to ${alias}: ${userMessage}`, 'ssh');
    
    throw new Error(userMessage);
  }
}

/**
 * Disconnect from an SSH host
 */
export async function disconnectSsh(alias: string): Promise<{ success: boolean }> {
  const ssh = activeConnections.get(alias);
  if (ssh) {
    ssh.dispose();
    activeConnections.delete(alias);
    broadcastOutput('system', `🔌 Disconnected from ${alias}`, 'ssh');
  }
  return { success: true };
}

/**
 * Check if connected to an SSH host
 */
export function isConnected(alias: string): boolean {
  const ssh = activeConnections.get(alias);
  return ssh?.isConnected() || false;
}

/**
 * Get list of active connections
 */
export function getActiveConnections(): string[] {
  return Array.from(activeConnections.keys()).filter(alias => isConnected(alias));
}

// =============================================================================
// SSH COMMAND EXECUTION
// =============================================================================

interface SshExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  host: string;
}

/**
 * Execute a command on a connected SSH host
 * Streams output in real-time via WebSocket
 */
export async function executeSshCommand(alias: string, command: string): Promise<SshExecResult> {
  const ssh = activeConnections.get(alias);
  if (!ssh || !ssh.isConnected()) {
    throw new Error(`Not connected to ${alias}. Use ssh_connect first.`);
  }
  
  broadcastOutput('command', `[${alias}]$ ${command}`, 'ssh');
  
  try {
    const result = await ssh.execCommand(command, {
      onStdout: (chunk) => {
        const output = chunk.toString();
        broadcastOutput('stdout', output, alias);
      },
      onStderr: (chunk) => {
        const output = chunk.toString();
        broadcastOutput('stderr', output, alias);
      },
    });
    
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code ?? 0,
      host: alias,
    };
  } catch (error: any) {
    const userMessage = classifyError(error, 'execution');
    broadcastOutput('stderr', `Error: ${userMessage}`, alias);
    throw new Error(userMessage);
  }
}

// =============================================================================
// LOCAL TERMINAL EXECUTION (with streaming)
// =============================================================================

/**
 * Execute a local command with streaming output
 */
export async function executeLocalCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    broadcastOutput('command', `$ ${command}`, 'local');
    
    const proc = spawn('bash', ['-c', command], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      broadcastOutput('stdout', output, 'local');
    });
    
    proc.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      broadcastOutput('stderr', output, 'local');
    });
    
    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });
    
    proc.on('error', (error) => {
      broadcastOutput('stderr', `Process error: ${error.message}`, 'local');
      resolve({
        stdout,
        stderr: stderr + `\nProcess error: ${error.message}`,
        exitCode: 1,
      });
    });
    
    // Timeout after 2 minutes
    setTimeout(() => {
      proc.kill('SIGTERM');
      broadcastOutput('stderr', 'Command timed out after 2 minutes', 'local');
      resolve({
        stdout,
        stderr: stderr + '\nCommand timed out',
        exitCode: 124,
      });
    }, 120000);
  });
}
