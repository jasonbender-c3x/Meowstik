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
import { db } from '../db';
import { sshHosts, sshKeys, InsertSshHost, InsertSshKey } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);

// Active SSH connections indexed by host alias
const activeConnections = new Map<string, NodeSSH>();

// Event listeners for terminal output (WebSocket broadcasts)
type OutputListener = (data: { type: 'stdout' | 'stderr' | 'system' | 'command'; content: string; source: string }) => void;
const outputListeners = new Set<OutputListener>();

export function addOutputListener(listener: OutputListener) {
  outputListeners.add(listener);
  return () => outputListeners.delete(listener);
}

function broadcastOutput(type: 'stdout' | 'stderr' | 'system' | 'command', content: string, source: string) {
  for (const listener of outputListeners) {
    try {
      listener({ type, content, source });
    } catch (e) {
      console.error('[SSH] Error in output listener:', e);
    }
  }
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
    await execAsync(`ssh-keygen -t ed25519 -f "${keyPath}" -N "" -C "${commentStr}" -q`);
  } catch (error) {
    // Cleanup on error
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`Failed to generate SSH key: ${error}`);
  }
  
  // Read generated keys
  const privateKey = fs.readFileSync(keyPath, 'utf-8');
  const publicKey = fs.readFileSync(`${keyPath}.pub`, 'utf-8').trim();
  
  // Get fingerprint
  const { stdout: fingerprint } = await execAsync(`ssh-keygen -lf "${keyPath}.pub"`);
  const fpMatch = fingerprint.match(/SHA256:[^\s]+/);
  
  // SECURITY: Delete temporary files immediately
  fs.rmSync(tmpDir, { recursive: true, force: true });
  
  // Generate secret name for user to store the private key
  const privateKeySecretName = `SSH_KEY_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  
  // Save key metadata to database (public key only, not private!)
  await db.insert(sshKeys).values({
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
  return await db.select().from(sshKeys);
}

/**
 * Get a specific SSH key's public key
 */
export async function getSshKeyPublic(name: string) {
  const [key] = await db.select().from(sshKeys).where(eq(sshKeys.name, name));
  return key;
}

// =============================================================================
// SSH HOST MANAGEMENT
// =============================================================================

/**
 * Add a new SSH host profile
 */
export async function addSshHost(host: InsertSshHost) {
  const [created] = await db.insert(sshHosts).values(host).returning();
  broadcastOutput('system', `✅ Added SSH host "${host.alias}" (${host.username}@${host.hostname}:${host.port || 22})`, 'ssh');
  return created;
}

/**
 * List all configured SSH hosts
 */
export async function listSshHosts() {
  return await db.select().from(sshHosts);
}

/**
 * Get a specific SSH host by alias
 */
export async function getSshHost(alias: string) {
  const [host] = await db.select().from(sshHosts).where(eq(sshHosts.alias, alias));
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
  
  await db.delete(sshHosts).where(eq(sshHosts.alias, alias));
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
    await db.update(sshHosts)
      .set({ lastConnected: new Date(), lastError: null })
      .where(eq(sshHosts.alias, alias));
    
    broadcastOutput('system', `✅ Connected to ${alias} (${host.hostname})`, 'ssh');
    
    return { success: true, message: `Connected to ${alias}` };
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    
    // Update error in database
    await db.update(sshHosts)
      .set({ lastError: errorMsg })
      .where(eq(sshHosts.alias, alias));
    
    broadcastOutput('stderr', `❌ Failed to connect to ${alias}: ${errorMsg}`, 'ssh');
    
    throw new Error(`SSH connection failed: ${errorMsg}`);
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
    broadcastOutput('stderr', `Error: ${error.message}`, alias);
    throw error;
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
