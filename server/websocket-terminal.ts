/**
 * Terminal WebSocket
 * Provides real-time streaming of terminal output to connected clients
 * Handles both local commands and SSH session output
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { addOutputListener, executeLocalCommand, executeSshCommand, isConnected, getActiveConnections } from './services/ssh-service';

interface TerminalMessage {
  type: 'output' | 'command' | 'status' | 'input';
  data: {
    type?: 'stdout' | 'stderr' | 'system' | 'command';
    content: string;
    source: string;
    timestamp?: string;
  };
}

const connectedClients = new Set<WebSocket>();

export function setupTerminalWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    
    if (url === '/ws/terminal' || url?.startsWith('/ws/terminal?')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
        handleConnection(ws);
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
  });

  console.log('[Terminal WS] WebSocket server initialized');
}

function handleConnection(ws: WebSocket): void {
  console.log('[Terminal WS] Client connected');
  connectedClients.add(ws);

  sendToClient(ws, {
    type: 'status',
    data: {
      content: 'Connected to terminal WebSocket',
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
    try {
      const parsed = JSON.parse(message.toString());
      
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
    connectedClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[Terminal WS] WebSocket error:', error);
    connectedClients.delete(ws);
  });
}

function sendToClient(ws: WebSocket, message: TerminalMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(message: TerminalMessage): void {
  const messageStr = JSON.stringify(message);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}
