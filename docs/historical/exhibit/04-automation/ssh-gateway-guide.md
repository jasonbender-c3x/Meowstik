# Project Chimera Phase 1: SSH Gateway - Usage Guide

## Overview

The SSH Gateway provides Meowstik with the ability to establish secure shell connections to remote servers and execute commands. This document provides a complete guide for using the SSH capabilities.

## Features

### 🔐 Secure Authentication
- SSH key-based authentication (Ed25519)
- Password-based authentication
- Credentials stored securely as Replit secrets
- Automatic key generation with fingerprint tracking

### 🖥️ Remote Command Execution
- Execute arbitrary shell commands on remote hosts
- Real-time output streaming via WebSocket
- Capture stdout, stderr, and exit codes
- Connection state management

### 📊 Host Management
- Database-backed host configurations
- Tagging and categorization
- Connection history tracking
- Error logging

## Quick Start

### 1. Generate an SSH Key

```typescript
// Through the AI agent
"Generate a new SSH key named 'my-server'"

// Tool call
ssh_key_generate({
  name: "my-server",
  comment: "meowstik-access"
})
```

**Returns:**
- Public key (to add to remote server's `~/.ssh/authorized_keys`)
- Instructions for storing private key as Replit secret
- Fingerprint for verification

### 2. Store Private Key

After generating a key, store the private key as a Replit secret:

1. Copy the private key from the tool output
2. Go to Replit Secrets tab
3. Add secret with name `SSH_KEY_MY_SERVER`
4. Paste the private key as the value

### 3. Add a Remote Host

```typescript
// Through the AI agent
"Add SSH host 'prod' with hostname 192.168.1.100, user deploy, using key SSH_KEY_MY_SERVER"

// Tool call
ssh_host_add({
  alias: "prod",
  hostname: "192.168.1.100",
  username: "deploy",
  port: 22, // optional, defaults to 22
  keySecretName: "SSH_KEY_MY_SERVER",
  description: "Production server",
  tags: ["production", "web"]
})
```

### 4. Connect to Host

```typescript
// Through the AI agent
"Connect to prod server via SSH"

// Tool call
ssh_connect({
  alias: "prod"
})
```

### 5. Execute Commands

```typescript
// Through the AI agent
"Run 'ls -la' on prod server"

// Tool call
ssh_execute({
  alias: "prod",
  command: "ls -la"
})
```

**Returns:**
```json
{
  "type": "ssh_execute",
  "success": true,
  "host": "prod",
  "command": "ls -la",
  "stdout": "total 48\ndrwxr-xr-x 5 deploy deploy 4096 Jan 13 03:00 .\n...",
  "stderr": "",
  "exitCode": 0
}
```

## Available Tools

### ssh_key_generate
Generate a new SSH key pair.

**Parameters:**
- `name` (required): Key pair name (e.g., "server1")
- `comment` (optional): Key comment

**Example:**
```typescript
ssh_key_generate({ name: "staging-server" })
```

### ssh_key_list
List all generated SSH key pairs.

**Example:**
```typescript
ssh_key_list({})
```

### ssh_host_add
Add a new SSH host configuration.

**Parameters:**
- `alias` (required): Short name for the host
- `hostname` (required): IP address or domain
- `username` (required): SSH username
- `port` (optional): SSH port (default: 22)
- `keySecretName` (optional): Name of Replit secret with private key
- `passwordSecretName` (optional): Name of Replit secret with password
- `description` (optional): Host description
- `tags` (optional): Array of tags for categorization

**Example:**
```typescript
ssh_host_add({
  alias: "web-server",
  hostname: "example.com",
  username: "ubuntu",
  keySecretName: "SSH_KEY_WEB",
  tags: ["production", "nginx"]
})
```

### ssh_host_list
List all configured SSH hosts.

**Example:**
```typescript
ssh_host_list({})
```

### ssh_host_delete
Remove an SSH host configuration.

**Parameters:**
- `alias` (required): Host alias to delete

**Example:**
```typescript
ssh_host_delete({ alias: "old-server" })
```

### ssh_connect
Establish SSH connection to a configured host.

**Parameters:**
- `alias` (required): Host alias to connect to

**Example:**
```typescript
ssh_connect({ alias: "prod" })
```

### ssh_disconnect
Close SSH connection to a host.

**Parameters:**
- `alias` (required): Host alias to disconnect from

**Example:**
```typescript
ssh_disconnect({ alias: "prod" })
```

### ssh_execute
Execute a command on a connected SSH host.

**Parameters:**
- `alias` (required): Host alias to run command on
- `command` (required): Shell command to execute

**Example:**
```typescript
ssh_execute({
  alias: "prod",
  command: "systemctl status nginx"
})
```

### ssh_status
Check SSH connection status for all hosts.

**Example:**
```typescript
ssh_status({})
```

**Returns:**
```json
{
  "type": "ssh_status",
  "success": true,
  "activeConnections": ["prod", "staging"],
  "hosts": [
    {
      "alias": "prod",
      "connected": true,
      "lastConnected": "2024-01-13T03:45:00Z",
      "lastError": null
    }
  ]
}
```

## Common Workflows

### Setting Up a New Server

1. Generate SSH key:
   ```
   "Generate SSH key for my-app-server"
   ```

2. Copy public key to server:
   ```bash
   # On the remote server
   echo "ssh-ed25519 AAAA..." >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

3. Store private key in Replit secrets as instructed

4. Add host configuration:
   ```
   "Add SSH host 'app' at 192.168.1.50, user ubuntu, using SSH_KEY_MY_APP_SERVER"
   ```

5. Test connection:
   ```
   "Connect to app server and run 'whoami'"
   ```

### Running Multiple Commands

```typescript
// Connect once
ssh_connect({ alias: "prod" })

// Run multiple commands
ssh_execute({ alias: "prod", command: "cd /var/www && git pull" })
ssh_execute({ alias: "prod", command: "systemctl restart nginx" })
ssh_execute({ alias: "prod", command: "systemctl status nginx" })

// Disconnect when done
ssh_disconnect({ alias: "prod" })
```

### Deployment Script Example

```typescript
// Connect to server
await ssh_connect({ alias: "prod" })

// Deploy application
const steps = [
  "cd /var/www/app",
  "git pull origin main",
  "npm install",
  "npm run build",
  "systemctl restart app",
  "systemctl status app"
]

for (const command of steps) {
  const result = await ssh_execute({ alias: "prod", command })
  if (result.exitCode !== 0) {
    console.error(`Deployment failed at: ${command}`)
    console.error(result.stderr)
    break
  }
}

// Disconnect
await ssh_disconnect({ alias: "prod" })
```

## Security Best Practices

### ✅ DO:
- Use SSH keys instead of passwords
- Generate unique keys for each server
- Store private keys as Replit secrets
- Use descriptive aliases and tags
- Rotate keys periodically
- Monitor connection errors in host status

### ❌ DON'T:
- Share private keys
- Hardcode credentials in code
- Use weak passwords
- Leave unnecessary connections open
- Grant excessive permissions on remote servers

## Database Schema

### ssh_hosts Table
Stores configured remote host profiles.

```typescript
{
  id: string (UUID)
  alias: string (unique)
  hostname: string
  port: number (default: 22)
  username: string
  keySecretName?: string
  passwordSecretName?: string
  lastConnected?: Date
  lastError?: string
  description?: string
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}
```

### ssh_keys Table
Stores SSH key metadata (public keys only).

```typescript
{
  id: string (UUID)
  name: string (unique)
  publicKey: string
  privateKeySecretName: string
  keyType: string (default: "ed25519")
  fingerprint?: string
  createdAt: Date
}
```

## Troubleshooting

### Connection Refused
**Error:** "SSH connection failed: Connection refused"

**Solutions:**
- Verify hostname and port are correct
- Check if SSH service is running on remote host
- Verify firewall rules allow SSH connections

### Authentication Failed
**Error:** "SSH connection failed: Authentication failed"

**Solutions:**
- Verify private key secret name is correct
- Check if public key is added to remote `~/.ssh/authorized_keys`
- Verify username is correct
- Check key permissions (600 for authorized_keys)

### Command Timeout
**Error:** Command times out after 2 minutes

**Solutions:**
- Break long-running commands into smaller steps
- Use background processes with `nohup` or `&`
- Check server performance and network latency

### Connection Not Found
**Error:** "Not connected to {alias}. Use ssh_connect first."

**Solution:**
- Run `ssh_connect` before `ssh_execute`
- Check connection status with `ssh_status`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Meowstik Agent                           │
│                          │                                  │
│                          ▼                                  │
│              ┌──────────────────────┐                       │
│              │ gemini-tools.ts      │                       │
│              │ (Tool Declarations)  │                       │
│              └──────────────────────┘                       │
│                          │                                  │
│                          ▼                                  │
│              ┌──────────────────────┐                       │
│              │ rag-dispatcher.ts    │                       │
│              │ (Tool Handlers)      │                       │
│              └──────────────────────┘                       │
│                          │                                  │
│                          ▼                                  │
│              ┌──────────────────────┐                       │
│              │ ssh-service.ts       │                       │
│              │ (NodeSSH wrapper)    │                       │
│              └──────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │  Remote Server (via SSH)       │
         │  - Execute commands            │
         │  - Return stdout/stderr/exit   │
         └────────────────────────────────┘
```

## API Reference

All SSH functions are exported from `server/services/ssh-service.ts`:

```typescript
// Key management
export async function generateSshKey(name: string, comment?: string)
export async function listSshKeys()
export async function getSshKeyPublic(name: string)

// Host management
export async function addSshHost(host: InsertSshHost)
export async function listSshHosts()
export async function getSshHost(alias: string)
export async function deleteSshHost(alias: string)

// Connection management
export async function connectSsh(alias: string)
export async function disconnectSsh(alias: string)
export function isConnected(alias: string): boolean
export function getActiveConnections(): string[]

// Command execution
export async function executeSshCommand(alias: string, command: string)

// Local execution (bonus)
export async function executeLocalCommand(command: string)

// WebSocket streaming
export function addOutputListener(listener: OutputListener)
```

## Future Enhancements (Phases 2 & 3)

### Phase 2: VS Code Extension
- Direct IDE integration
- Visual host management
- Command history browser
- Output console integration

### Phase 3: Browser & Desktop Extensions
- Web-based terminal interface
- Desktop notification integration
- Multi-session management
- Advanced logging and debugging

## Support & Resources

- **Issue Tracker:** Project Chimera issue on GitHub
- **Source Code:** 
  - `server/services/ssh-service.ts`
  - `server/gemini-tools.ts` (lines 541-638)
  - `server/services/rag-dispatcher.ts` (lines 2764-2891)
  - `shared/schema.ts` (lines 2235-2294)
- **Dependencies:** `node-ssh` v13.2.1

---

**Status:** ✅ Phase 1 Complete  
**Last Updated:** January 13, 2026  
**Version:** 1.0.0
