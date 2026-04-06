

import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';

interface VSCodeClient {
  ws: WebSocket;
  id: string;
  capabilities: string[];
  connectedAt: Date;
}

// Store active VS Code connection (assume single instance for now)
let activeVSCodeClient: VSCodeClient | null = null;
const pendingRequests = new Map<string, { resolve: (value: any) => void, reject: (reason: any) => void, timeout: NodeJS.Timeout }>();

export function setupVSCodeWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    
    if (url === '/api/vscode/connect') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
        handleConnection(ws);
      });
    }
  });

  console.log('[VSCode WS] WebSocket server initialized');
}

function handleConnection(ws: WebSocket): void {
  console.log('[VSCode WS] Client connected');

  // Replace existing connection
  if (activeVSCodeClient) {
    console.log('[VSCode WS] Closing previous connection');
    activeVSCodeClient.ws.close();
  }

  activeVSCodeClient = {
    ws,
    id: Math.random().toString(36).substring(7),
    capabilities: [],
    connectedAt: new Date()
  };

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(message);
    } catch (error) {
      console.error('[VSCode WS] Invalid message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[VSCode WS] Client disconnected');
    if (activeVSCodeClient?.ws === ws) {
      activeVSCodeClient = null;
    }
    // Reject pending requests
    for (const [id, req] of Array.from(pendingRequests)) {
      clearTimeout(req.timeout);
      req.reject(new Error('VSCode client disconnected'));
    }
    pendingRequests.clear();
  });

  ws.on('error', (error) => {
    console.error('[VSCode WS] WebSocket error:', error);
  });
}

function handleMessage(message: any): void {
  // Handle handshake
  if (message.type === 'vscode_connected') {
    if (activeVSCodeClient) {
      activeVSCodeClient.capabilities = message.capabilities || [];
      console.log('[VSCode WS] Capabilities:', activeVSCodeClient.capabilities);
    }
    return;
  }

  // Handle responses to requests
  if (message.id && pendingRequests.has(message.id)) {
    const req = pendingRequests.get(message.id)!;
    clearTimeout(req.timeout);
    pendingRequests.delete(message.id);

    if (message.error) {
      req.reject(new Error(message.error));
    } else {
      req.resolve(message);
    }
    return;
  }

  // Handle unsolicited messages (events from VSCode to Server)
  // e.g., 'voice_input', 'terminal_output'
  console.log('[VSCode WS] Received event:', message.type);
}

/**
 * Send a request to VSCode and wait for a response
 */
export function sendToVSCode(type: string, payload: any = {}, timeoutMs = 30000): Promise<any> {
  if (!activeVSCodeClient || activeVSCodeClient.ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('VSCode not connected'));
  }

  const id = Math.random().toString(36).substring(7);
  const message = {
    id,
    type,
    ...payload
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`VSCode request timed out (${type})`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout });
    
    try {
      activeVSCodeClient!.ws.send(JSON.stringify(message));
    } catch (error) {
      clearTimeout(timeout);
      pendingRequests.delete(id);
      reject(error);
    }
  });
}

/**
 * Check if VSCode is connected
 */
export function isVSCodeConnected(): boolean {
  return !!activeVSCodeClient && activeVSCodeClient.ws.readyState === WebSocket.OPEN;
}


