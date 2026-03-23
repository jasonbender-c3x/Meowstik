

import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';

interface ExtensionClient {
  ws: WebSocket;
  id: string;
  capabilities: string[];
  connectedAt: Date;
}

// Store active extension connections
let activeExtension: ExtensionClient | null = null;
const pendingRequests = new Map<string, { resolve: (value: any) => void, reject: (reason: any) => void, timeout: NodeJS.Timeout }>();

export function setupExtensionWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    
    // Match the URL used in service-worker.js
    if (url === '/api/extension/connect') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
        handleConnection(ws);
      });
    }
  });

  console.log('[Extension WS] WebSocket server initialized');
}

function handleConnection(ws: WebSocket): void {
  console.log('[Extension WS] Extension connected');

  // Replace existing connection (we assume one active extension for now)
  if (activeExtension) {
    console.log('[Extension WS] Closing previous connection');
    activeExtension.ws.close();
  }

  activeExtension = {
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
      console.error('[Extension WS] Invalid message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[Extension WS] Extension disconnected');
    if (activeExtension?.ws === ws) {
      activeExtension = null;
    }
    // Reject any pending requests
    for (const [id, req] of Array.from(pendingRequests)) {
      clearTimeout(req.timeout);
      req.reject(new Error('Extension disconnected'));
    }
    pendingRequests.clear();
  });

  ws.on('error', (error) => {
    console.error('[Extension WS] WebSocket error:', error);
  });
}

// @ts-ignore
function handleMessage(message: any): void {
  // Handle handshake
  if (message.type === 'extension_connected') {
    if (activeExtension) {
      // @ts-ignore
      activeExtension.capabilities = message.capabilities || [];
      console.log('[Extension WS] Capabilities:', activeExtension.capabilities);
    }
    return;
  }

  // Handle responses to requests
  if (message.id && pendingRequests.has(message.id)) {
    const req = pendingRequests.get(message.id)!;
    clearTimeout(req.timeout);
    pendingRequests.delete(message.id);

    // @ts-ignore
    if (message.error) {
      // @ts-ignore
      req.reject(new Error(message.error));
    } else {
      // @ts-ignore
      req.resolve(message);
    }
    return;
  }

  // Handle unsolicited messages (events)
  console.log('[Extension WS] Received event:', message.type);
}

/**
 * Send a request to the extension and wait for a response
 */
export function sendToExtension(type: string, payload: any = {}, timeoutMs = 30000): Promise<any> {
  if (!activeExtension || activeExtension.ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('Extension not connected'));
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
      reject(new Error(`Extension request timed out (${type})`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout });
    
    try {
      activeExtension!.ws.send(JSON.stringify(message));
    } catch (error) {
      clearTimeout(timeout);
      pendingRequests.delete(id);
      reject(error);
    }
  });
}

/**
 * Check if extension is connected
 */
export function isExtensionConnected(): boolean {
  return !!activeExtension && activeExtension.ws.readyState === WebSocket.OPEN;
}

/**
 * Get extension capabilities
 */
export function getExtensionCapabilities(): string[] {
  return activeExtension?.capabilities || [];
}

/**
 * Scrape a page using the connected extension
 */
export async function scrapePage(url: string): Promise<any> {
  if (!isExtensionConnected()) {
    throw new Error('Extension not connected');
  }

  // 1. Navigate to URL (if needed)
  // Check if current tab is already on URL?
  // For now, force navigate or open new tab.
  // Actually, extension might be on a different page.
  // Let's ask extension to open a new tab and scrape it?
  // Or just use the current active tab?
  // The user might be browsing.
  // If we want to scrape a specific URL, we should open a background tab or use the current one if it matches.
  
  // Let's assume we want to scrape the *current* page if URL is not provided or matches.
  // But scrapePage(url) implies navigation.

  // Let's use 'navigate' command to current tab for now (simplest), or 'create' a tab.
  // The service worker handles 'navigate' by updating the active tab. This disrupts the user.
  // Better: Create a new tab, scrape, then close it.
  // Service worker supports 'tab_control' -> 'new'.
  
  const tab = await sendToExtension('tab_control', { action: 'new', url });
  const tabId = tab.result.id; // Wait, result structure depends on service-worker.
  
  // Wait for load? Service worker's 'new' might resolve after creation, not load.
  // We need to wait for load.
  // The 'page_content' request will wait? No, it just sends message to content script.
  // If content script isn't ready, it fails.
  
  // Let's delay a bit or poll.
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const content = await sendToExtension('page_content_request', { tabId });
    return {
        url: content.url,
        title: content.title,
        content: content.content,
        html: content.html,
        success: true
    };
  } finally {
      // Clean up tab
      await sendToExtension('tab_control', { action: 'close', tabId });
  }
}



