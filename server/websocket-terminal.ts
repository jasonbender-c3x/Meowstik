/**
 * Terminal WebSocket
 * Provides real-time interactive shell sessions using node-pty
 * Handles both local interactive shells and SSH session output
 * Includes traffic logging for debug panel
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import * as pty from 'node-pty';
import { addOutputListener, executeLocalCommand, executeSshCommand, isConnected, getActiveConnections } from './services/ssh-service';

// Traffic log for monitoring WebSocket activity
interface TrafficLogEntry {
  id: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  type: string;
  size: number;
  preview: string;
  source: string;
}

const trafficLog: TrafficLogEntry[] = [];
const MAX_TRAFFIC_LOG_SIZE = 500;

function addTrafficLog(direction: 'inbound' | 'outbound', type: string, data: string, source: string) {
  const entry: TrafficLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    direction,
    type,
    size: data.length,
    preview: data.length > 100 ? data.slice(0, 100) + '...' : data,
    source,
  };
  trafficLog.unshift(entry);
  if (trafficLog.length > MAX_TRAFFIC_LOG_SIZE) {
    trafficLog.pop();
  }
  // Broadcast traffic update to monitoring clients
  broadcastTraffic(entry);
}

export function getTrafficLog(limit = 100): TrafficLogEntry[] {
  return trafficLog.slice(0, limit);
}

interface TerminalMessage {
  type: 'output' | 'command' | 'status' | 'input' | 'resize' | 'pty_data' | 'start_shell' | 'stop_shell' | 'traffic';
  data: {
    type?: 'stdout' | 'stderr' | 'system' | 'command' | 'pty';
    content: string;
    source: string;
    timestamp?: string;
    cols?: number;
    rows?: number;
  };
}

interface ClientState {
  ws: WebSocket;
  ptyProcess: pty.IPty | null;
  mode: 'command' | 'interactive';
}

const connectedClients = new Map<WebSocket, ClientState>();
const trafficMonitors = new Set<WebSocket>();

export function setupTerminalWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    
    if (url === '/ws/terminal' || url?.startsWith('/ws/terminal?')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
        handleConnection(ws, url);
      });
    } else if (url === '/ws/terminal-traffic' || url?.startsWith('/ws/terminal-traffic?')) {
      // Traffic monitor WebSocket
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
        handleTrafficMonitor(ws);
      });
    }
  });

  addOutputListener((data) => {
    broadcast({
      type: 'output',
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      }
    });
    addTrafficLog('outbound', 'output', data.content, data.source);
  });

  console.log('[Terminal WS] WebSocket server initialized with interactive shell support');
}

function handleTrafficMonitor(ws: WebSocket): void {
  console.log('[Terminal WS] Traffic monitor connected');
  trafficMonitors.add(ws);
  
  // Send recent traffic history
  const recentTraffic = getTrafficLog(50);
  ws.send(JSON.stringify({ type: 'history', data: recentTraffic }));

  ws.on('close', () => {
    console.log('[Terminal WS] Traffic monitor disconnected');
    trafficMonitors.delete(ws);
  });

  ws.on('error', () => {
    trafficMonitors.delete(ws);
  });
}

function broadcastTraffic(entry: TrafficLogEntry): void {
  const message = JSON.stringify({ type: 'traffic', data: entry });
  for (const monitor of trafficMonitors) {
    if (monitor.readyState === WebSocket.OPEN) {
      monitor.send(message);
    }
  }
}

function handleConnection(ws: WebSocket, url: string): void {
  console.log('[Terminal WS] Client connected');
  
  const clientState: ClientState = {
    ws,
    ptyProcess: null,
    mode: 'command',
  };
  connectedClients.set(ws, clientState);

  sendToClient(ws, {
    type: 'status',
    data: {
      content: 'Connected to terminal WebSocket. Use start_shell for interactive mode.',
      source: 'system',
      timestamp: new Date().toISOString(),
    }
  });

  const connections = getActiveConnections();
  if (connections.length > 0) {
    sendToClient(ws, {
      type: 'status',
      data: {
        content: `Active SSH connections: ${connections.join(', ')}`,
        source: 'system',
        timestamp: new Date().toISOString(),
      }
    });
  }

  ws.on('message', async (message: Buffer) => {
    const messageStr = message.toString();
    addTrafficLog('inbound', 'message', messageStr, 'client');
    
    try {
      const parsed = JSON.parse(messageStr);
      
      // Start interactive shell
      if (parsed.type === 'start_shell') {
        await startInteractiveShell(clientState, parsed.data);
        return;
      }
      
      // Stop interactive shell
      if (parsed.type === 'stop_shell') {
        stopInteractiveShell(clientState);
        return;
      }
      
      // Interactive input (for PTY)
      if (parsed.type === 'input' && clientState.ptyProcess) {
        const content = parsed.data?.content || '';
        clientState.ptyProcess.write(content);
        addTrafficLog('outbound', 'pty_write', content, 'pty');
        return;
      }
      
      // Resize terminal
      if (parsed.type === 'resize' && clientState.ptyProcess) {
        const { cols, rows } = parsed.data || {};
        if (cols && rows) {
          clientState.ptyProcess.resize(cols, rows);
          addTrafficLog('outbound', 'resize', `${cols}x${rows}`, 'pty');
        }
        return;
      }
      
      // Traditional command mode
      if (parsed.type === 'command') {
        const { command, target } = parsed.data;
        
        if (!command) {
          sendToClient(ws, {
            type: 'output',
            data: {
              type: 'stderr',
              content: 'No command provided',
              source: 'system',
            }
          });
          return;
        }

        if (target && target !== 'local') {
          if (!isConnected(target)) {
            sendToClient(ws, {
              type: 'output',
              data: {
                type: 'stderr',
                content: `Not connected to SSH host "${target}"`,
                source: 'system',
              }
            });
            return;
          }
          
          try {
            await executeSshCommand(target, command);
          } catch (error: any) {
            sendToClient(ws, {
              type: 'output',
              data: {
                type: 'stderr',
                content: `SSH error: ${error.message}`,
                source: target,
              }
            });
          }
        } else {
          try {
            await executeLocalCommand(command);
          } catch (error: any) {
            sendToClient(ws, {
              type: 'output',
              data: {
                type: 'stderr',
                content: `Error: ${error.message}`,
                source: 'local',
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('[Terminal WS] Invalid message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[Terminal WS] Client disconnected');
    stopInteractiveShell(clientState);
    connectedClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[Terminal WS] WebSocket error:', error);
    stopInteractiveShell(clientState);
    connectedClients.delete(ws);
  });
}

async function startInteractiveShell(client: ClientState, options?: { shell?: string; cols?: number; rows?: number; ssh?: string }): Promise<void> {
  if (client.ptyProcess) {
    stopInteractiveShell(client);
  }

  const shell = options?.shell || process.env.SHELL || '/bin/bash';
  const cols = options?.cols || 80;
  const rows = options?.rows || 24;
  const sshTarget = options?.ssh;

  try {
    let cmd: string;
    let args: string[];

    if (sshTarget) {
      // For SSH, we need to handle it differently
      // This would start an ssh command in the pty
      cmd = 'ssh';
      args = [sshTarget];
      sendToClient(client.ws, {
        type: 'status',
        data: {
          type: 'system',
          content: `Starting SSH session to ${sshTarget}...`,
          source: 'system',
          timestamp: new Date().toISOString(),
        }
      });
    } else {
      cmd = shell;
      args = [];
    }

    const ptyProcess = pty.spawn(cmd, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as { [key: string]: string },
    });

    client.ptyProcess = ptyProcess;
    client.mode = 'interactive';

    sendToClient(client.ws, {
      type: 'status',
      data: {
        type: 'system',
        content: `Interactive shell started (${shell}, ${cols}x${rows})`,
        source: 'pty',
        timestamp: new Date().toISOString(),
      }
    });

    ptyProcess.onData((data) => {
      sendToClient(client.ws, {
        type: 'pty_data',
        data: {
          type: 'pty',
          content: data,
          source: 'pty',
          timestamp: new Date().toISOString(),
        }
      });
      addTrafficLog('outbound', 'pty_data', data, 'pty');
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      sendToClient(client.ws, {
        type: 'status',
        data: {
          type: 'system',
          content: `Shell exited (code: ${exitCode}, signal: ${signal})`,
          source: 'pty',
          timestamp: new Date().toISOString(),
        }
      });
      client.ptyProcess = null;
      client.mode = 'command';
    });

    addTrafficLog('outbound', 'shell_started', `${cmd} ${cols}x${rows}`, 'pty');

  } catch (error: any) {
    console.error('[Terminal WS] Failed to start PTY:', error);
    sendToClient(client.ws, {
      type: 'output',
      data: {
        type: 'stderr',
        content: `Failed to start interactive shell: ${error.message}`,
        source: 'system',
        timestamp: new Date().toISOString(),
      }
    });
  }
}

function stopInteractiveShell(client: ClientState): void {
  if (client.ptyProcess) {
    try {
      client.ptyProcess.kill();
    } catch (e) {
      // Ignore errors during cleanup
    }
    client.ptyProcess = null;
    client.mode = 'command';
    
    sendToClient(client.ws, {
      type: 'status',
      data: {
        type: 'system',
        content: 'Interactive shell stopped',
        source: 'system',
        timestamp: new Date().toISOString(),
      }
    });
    addTrafficLog('outbound', 'shell_stopped', '', 'pty');
  }
}

function sendToClient(ws: WebSocket, message: TerminalMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    const messageStr = JSON.stringify(message);
    ws.send(messageStr);
    // Don't log pty_data in preview to avoid noise
    if (message.type !== 'pty_data') {
      addTrafficLog('outbound', message.type, message.data.content, message.data.source);
    }
  }
}

function broadcast(message: TerminalMessage): void {
  const messageStr = JSON.stringify(message);
  for (const [ws] of connectedClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  }
}
