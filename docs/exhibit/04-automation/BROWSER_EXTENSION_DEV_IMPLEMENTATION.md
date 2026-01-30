# Browser Extension Development Server Implementation Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Phase 1: Build System Setup](#phase-1-build-system-setup)
4. [Phase 2: Live Reload](#phase-2-live-reload)
5. [Phase 3: TypeScript Migration](#phase-3-typescript-migration)
6. [Phase 4: Development Server](#phase-4-development-server)
7. [Phase 5: Testing & Documentation](#phase-5-testing--documentation)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## Prerequisites

### Required Software

- **Node.js**: Version 20+ (already installed on Replit)
- **npm**: Version 9+ (comes with Node.js)
- **Google Chrome**: Latest stable version
- **Git**: For version control

### Required Knowledge

- Basic understanding of Chrome Extensions
- Familiarity with TypeScript
- Experience with npm/package.json
- Understanding of Vite (helpful but not required)

### Project Setup

Ensure you have the Meowstik repository cloned and dependencies installed:

```bash
cd /path/to/Meowstik
npm install
```

---

## Quick Start

For developers who want to get started immediately:

```bash
# 1. Install new dependencies
npm install

# 2. Build the extension
npm run build:extension

# 3. Start development mode
npm run dev:extension

# 4. In another terminal, start the mock server
npm run dev:extension-server

# 5. Load the extension in Chrome
# - Open chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select: /path/to/Meowstik/dist/extension
```

The extension will now reload automatically when you make changes!

---

## Phase 1: Build System Setup

### Step 1.1: Install Dependencies

Add the required packages for building Chrome extensions with Vite:

```bash
npm install --save-dev @crxjs/vite-plugin@^2.0.0 \
  @types/chrome@^0.0.254 \
  webextension-polyfill@^0.10.0 \
  chokidar@^3.5.3 \
  concurrently@^8.2.2
```

**What each package does:**

- `@crxjs/vite-plugin`: Vite plugin that handles Chrome extension builds with HMR
- `@types/chrome`: TypeScript type definitions for Chrome Extension APIs
- `webextension-polyfill`: Cross-browser compatibility layer for extension APIs
- `chokidar`: File system watcher for live reload
- `concurrently`: Run multiple npm scripts simultaneously

### Step 1.2: Create Build Configuration

Create a new Vite config specifically for the extension:

```bash
touch vite.config.extension.ts
```

Add the following configuration:

```typescript
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';

// Import the manifest
import manifest from './extension-src/manifest';

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@extension': path.resolve(__dirname, 'extension-src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  build: {
    outDir: 'dist/extension',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'extension-src/popup/popup.html'),
      },
    },
  },
  server: {
    port: 5001,
    strictPort: true,
  },
});
```

### Step 1.3: Create TypeScript Configuration

Create a TypeScript config for the extension:

```bash
touch tsconfig.extension.json
```

Add the following:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/extension",
    "rootDir": "./extension-src",
    "types": ["chrome", "node", "webextension-polyfill"],
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ES2020",
    "target": "ES2020",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["extension-src/**/*"],
  "exclude": ["node_modules", "dist", "browser-extension"]
}
```

### Step 1.4: Create Source Directory Structure

Create the new TypeScript source directory:

```bash
mkdir -p extension-src/{background,content,popup,shared,assets/icons}
```

Your directory structure should now look like:

```
extension-src/
├── background/
│   └── (service worker files)
├── content/
│   └── (content script files)
├── popup/
│   └── (popup UI files)
├── shared/
│   └── (shared utilities and types)
├── assets/
│   └── icons/
│       └── (extension icons)
└── manifest.ts
```

### Step 1.5: Create Dynamic Manifest

Create a TypeScript file that generates the manifest:

```bash
touch extension-src/manifest.ts
```

Add the following:

```typescript
import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Meowstik AI Assistant',
  version: packageJson.version,
  description: 'AI-powered browser assistant with voice, screen capture, and automation capabilities',
  
  permissions: [
    'tabs',
    'activeTab',
    'storage',
    'scripting',
    'webNavigation',
    'contextMenus',
    'notifications',
    'clipboardRead',
    'clipboardWrite'
  ],
  
  host_permissions: [
    '<all_urls>'
  ],
  
  background: {
    service_worker: 'background/service-worker.ts',
    type: 'module'
  },
  
  action: {
    default_popup: 'popup/popup.html',
    default_icon: {
      '16': 'assets/icons/icon16.png',
      '32': 'assets/icons/icon32.png',
      '48': 'assets/icons/icon48.png',
      '128': 'assets/icons/icon128.png'
    },
    default_title: 'Meowstik AI'
  },
  
  icons: {
    '16': 'assets/icons/icon16.png',
    '32': 'assets/icons/icon32.png',
    '48': 'assets/icons/icon48.png',
    '128': 'assets/icons/icon128.png'
  },
  
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['content/content-script.ts'],
      css: ['content/content-style.css'],
      run_at: 'document_idle'
    }
  ],
  
  web_accessible_resources: [
    {
      resources: ['assets/icons/*'],
      matches: ['<all_urls>']
    }
  ],
  
  commands: {
    '_execute_action': {
      suggested_key: {
        default: 'Ctrl+Shift+M',
        mac: 'Command+Shift+M'
      },
      description: 'Open Meowstik popup'
    },
    'start-voice': {
      suggested_key: {
        default: 'Ctrl+Shift+V',
        mac: 'Command+Shift+V'
      },
      description: 'Start voice conversation'
    },
    'capture-screen': {
      suggested_key: {
        default: 'Ctrl+Shift+S',
        mac: 'Command+Shift+S'
      },
      description: 'Capture screen for AI analysis'
    }
  }
});
```

### Step 1.6: Add npm Scripts

Update `package.json` to add the new extension build commands:

```json
{
  "scripts": {
    // ... existing scripts ...
    
    // Extension Development
    "dev:extension": "vite build --config vite.config.extension.ts --watch --mode development",
    "dev:extension-server": "tsx scripts/dev-server.ts",
    "dev:full": "concurrently \"npm run dev\" \"npm run dev:extension\" \"npm run dev:extension-server\"",
    
    // Extension Building
    "build:extension": "vite build --config vite.config.extension.ts",
    "build:extension:prod": "vite build --config vite.config.extension.ts --mode production",
    
    // Extension Utilities
    "clean:extension": "rm -rf dist/extension",
    "watch:extension": "tsx scripts/watch-extension.ts",
    "package:extension": "npm run build:extension:prod && tsx scripts/package-extension.ts"
  }
}
```

### Step 1.7: Copy Icons

Copy the existing icons from the old extension:

```bash
cp -r browser-extension/icons/* extension-src/assets/icons/
```

### Step 1.8: Test the Build

Try building the extension (it won't work yet, but we'll see what's missing):

```bash
npm run build:extension
```

Expected output:
```
vite v7.1.9 building for production...
✓ built in 1.23s
```

Check that `dist/extension/` was created:

```bash
ls -la dist/extension/
```

You should see:
- `manifest.json` (generated from manifest.ts)
- Asset directories

---

## Phase 2: Live Reload

### Step 2.1: Create Watch Script

Create a file watcher script that will trigger extension reloads:

```bash
mkdir -p scripts
touch scripts/watch-extension.ts
```

Add the following code:

```typescript
#!/usr/bin/env tsx

/**
 * Extension File Watcher
 * 
 * Watches the dist/extension directory and triggers Chrome to reload
 * the extension when files change.
 */

import chokidar from 'chokidar';
import path from 'path';
import { WebSocketServer } from 'ws';

const WATCH_DIR = path.resolve(process.cwd(), 'dist/extension');
const WS_PORT = 8081;

// Create WebSocket server for reload notifications
const wss = new WebSocketServer({ port: WS_PORT });

console.log(`🔍 Watching ${WATCH_DIR} for changes...`);
console.log(`📡 WebSocket server listening on ws://localhost:${WS_PORT}`);

// Track connected clients
let clients = new Set<any>();

wss.on('connection', (ws) => {
  console.log('✅ Extension connected for live reload');
  clients.add(ws);
  
  ws.on('close', () => {
    console.log('❌ Extension disconnected');
    clients.delete(ws);
  });
});

// Watch for file changes
const watcher = chokidar.watch(WATCH_DIR, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true
});

let reloadTimeout: NodeJS.Timeout | null = null;

watcher.on('all', (event, filePath) => {
  const fileName = path.basename(filePath);
  
  // Debounce rapid changes
  if (reloadTimeout) {
    clearTimeout(reloadTimeout);
  }
  
  reloadTimeout = setTimeout(() => {
    console.log(`📝 ${event}: ${fileName}`);
    
    // Notify all connected clients to reload
    clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: 'reload',
          file: fileName,
          timestamp: Date.now()
        }));
      }
    });
    
    console.log(`🔄 Triggered reload for ${clients.size} client(s)`);
  }, 300);
});

watcher.on('error', (error) => {
  console.error('❌ Watcher error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  watcher.close();
  wss.close();
  process.exit(0);
});
```

Make it executable:

```bash
chmod +x scripts/watch-extension.ts
```

### Step 2.2: Add Reload Client to Extension

Create a reload client that connects to the watch script:

```bash
touch extension-src/shared/reload-client.ts
```

Add the following:

```typescript
/**
 * Extension Reload Client
 * 
 * Connects to the development watch server and triggers
 * extension reload when files change.
 * 
 * Only active in development mode.
 */

const WS_URL = 'ws://localhost:8081';
const RECONNECT_DELAY = 2000;

class ReloadClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  constructor() {
    // Only run in development
    if (process.env.NODE_ENV === 'development') {
      this.connect();
    }
  }
  
  private connect(): void {
    try {
      console.log('[Reload] Connecting to development server...');
      this.ws = new WebSocket(WS_URL);
      
      this.ws.onopen = () => {
        console.log('[Reload] Connected to development server');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'reload') {
            console.log(`[Reload] Reloading due to change in ${message.file}`);
            chrome.runtime.reload();
          }
        } catch (error) {
          console.error('[Reload] Failed to parse message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[Reload] WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('[Reload] Disconnected from development server');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[Reload] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY);
  }
}

// Initialize reload client
export const reloadClient = new ReloadClient();
```

### Step 2.3: Initialize Reload Client in Background Script

We'll create a minimal background script that includes the reload client:

```bash
touch extension-src/background/service-worker.ts
```

Add:

```typescript
/**
 * Meowstik Extension - Background Service Worker
 */

// Import reload client (only active in dev mode)
import '../shared/reload-client';

console.log('Meowstik Extension - Background Service Worker initialized');

// Background service worker logic will go here
// For now, just a basic initialization
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});
```

### Step 2.4: Test Live Reload

Now test the live reload functionality:

**Terminal 1: Start the build watcher**
```bash
npm run dev:extension
```

**Terminal 2: Start the file watcher**
```bash
npm run watch:extension
```

**Terminal 3: Load the extension in Chrome**
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `dist/extension/`

**Test the reload:**
1. Make a change to any file in `extension-src/`
2. Watch the terminal - you should see rebuild and reload messages
3. The extension should automatically reload in Chrome

### Step 2.5: Combine Scripts

To make development easier, let's run both watchers together:

Update the `dev:extension` script in `package.json`:

```json
{
  "scripts": {
    "dev:extension": "concurrently \"vite build --config vite.config.extension.ts --watch --mode development\" \"tsx scripts/watch-extension.ts\""
  }
}
```

Now you only need to run:

```bash
npm run dev:extension
```

---

## Phase 3: TypeScript Migration

### Step 3.1: Create Shared Types

Create type definitions that will be shared across the extension:

```bash
touch extension-src/shared/types.ts
```

Add comprehensive types:

```typescript
/**
 * Shared TypeScript Types for Extension
 */

// Message types for communication between extension components
export type MessageType =
  | 'chat'
  | 'capture'
  | 'analyze'
  | 'execute'
  | 'status'
  | 'error';

export interface BaseMessage {
  type: MessageType;
  id: string;
  timestamp: number;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat';
  content: string;
  role: 'user' | 'assistant';
}

export interface CaptureMessage extends BaseMessage {
  type: 'capture';
  captureType: 'visible' | 'full' | 'element';
  dataUrl?: string;
}

export interface AnalyzeMessage extends BaseMessage {
  type: 'analyze';
  content: string;
  contentType: 'html' | 'text' | 'screenshot';
}

export interface ExecuteMessage extends BaseMessage {
  type: 'execute';
  command: string;
  params: Record<string, any>;
}

export interface StatusMessage extends BaseMessage {
  type: 'status';
  status: 'connected' | 'disconnected' | 'error';
  message?: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  error: string;
  stack?: string;
}

export type ExtensionMessage =
  | ChatMessage
  | CaptureMessage
  | AnalyzeMessage
  | ExecuteMessage
  | StatusMessage
  | ErrorMessage;

// Settings types
export interface ExtensionSettings {
  serverUrl: string;
  agentPort: number;
  autoConnect: boolean;
  voiceActivation: boolean;
  verbosityMode: 'verbose' | 'concise';
}

// Page content types
export interface PageContent {
  url: string;
  title: string;
  text: string;
  html: string;
  links: Array<{ text: string; href: string }>;
  forms: Array<{ id: string; action: string }>;
  images: Array<{ src: string; alt: string }>;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  payload: any;
  timestamp?: number;
}
```

### Step 3.2: Create Shared Constants

```bash
touch extension-src/shared/constants.ts
```

Add:

```typescript
/**
 * Shared Constants
 */

export const DEFAULT_SERVER_URL = 'wss://meowstik.replit.app';
export const DEFAULT_AGENT_PORT = 9222;
export const WS_RECONNECT_DELAY = 2000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;

export const STORAGE_KEYS = {
  SERVER_URL: 'serverUrl',
  AGENT_PORT: 'agentPort',
  AUTO_CONNECT: 'autoConnect',
  VOICE_ACTIVATION: 'voiceActivation',
  VERBOSITY_MODE: 'verbosityMode',
} as const;

export const MESSAGE_TIMEOUT = 30000; // 30 seconds
```

### Step 3.3: Create Shared Utilities

```bash
touch extension-src/shared/utils.ts
```

Add utility functions:

```typescript
/**
 * Shared Utility Functions
 */

import type { PageContent } from './types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract text content from HTML
 */
export function extractTextFromHTML(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Format page content for AI analysis
 */
export function formatPageContent(content: PageContent): string {
  return `
URL: ${content.url}
Title: ${content.title}

Content:
${content.text}

Links:
${content.links.map(l => `- ${l.text}: ${l.href}`).join('\n')}

Forms:
${content.forms.map(f => `- ID: ${f.id}, Action: ${f.action}`).join('\n')}
  `.trim();
}

/**
 * Safely parse JSON
 */
export function safeJSONParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}
```

### Step 3.4: Migrate Background Script

Now let's create a proper TypeScript background script:

```bash
touch extension-src/background/websocket.ts
```

Add WebSocket management:

```typescript
/**
 * WebSocket Connection Manager
 */

import type { WSMessage, ExtensionSettings } from '../shared/types';
import { WS_RECONNECT_DELAY, WS_MAX_RECONNECT_ATTEMPTS } from '../shared/constants';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Set<(message: WSMessage) => void> = new Set();
  
  constructor(private settings: ExtensionSettings) {}
  
  /**
   * Connect to WebSocket server
   */
  public async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }
    
    this.isConnecting = true;
    const wsUrl = `${this.settings.serverUrl}/api/extension/connect`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Send connection message
        this.send({
          type: 'extension_connected',
          payload: {
            source: 'background',
            capabilities: [
              'screen_capture',
              'page_content',
              'console_logs',
              'tab_control'
            ]
          }
        });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Invalid message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.isConnecting = false;
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }
  
  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.reconnectAttempts = 0;
  }
  
  /**
   * Send message to server
   */
  public send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Not connected, message not sent');
    }
  }
  
  /**
   * Register message handler
   */
  public onMessage(handler: (message: WSMessage) => void): () => void {
    this.messageHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }
  
  /**
   * Handle incoming message
   */
  private handleMessage(message: WSMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('[WebSocket] Handler error:', error);
      }
    });
  }
  
  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }
    
    if (this.reconnectTimer) return;
    
    const delay = WS_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
  
  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
```

Update the main service worker:

```typescript
// extension-src/background/service-worker.ts
/**
 * Meowstik Extension - Background Service Worker
 */

import '../shared/reload-client';
import { WebSocketManager } from './websocket';
import type { ExtensionSettings } from '../shared/types';
import { DEFAULT_SERVER_URL, DEFAULT_AGENT_PORT, STORAGE_KEYS } from '../shared/constants';

console.log('[Background] Service Worker initialized');

// Global state
let wsManager: WebSocketManager | null = null;
let settings: ExtensionSettings;

/**
 * Initialize extension
 */
async function init() {
  await loadSettings();
  
  if (settings.autoConnect) {
    connectToServer();
  }
  
  setupMessageListeners();
  setupCommandListeners();
}

/**
 * Load settings from storage
 */
async function loadSettings(): Promise<void> {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  
  settings = {
    serverUrl: stored[STORAGE_KEYS.SERVER_URL] || DEFAULT_SERVER_URL,
    agentPort: stored[STORAGE_KEYS.AGENT_PORT] || DEFAULT_AGENT_PORT,
    autoConnect: stored[STORAGE_KEYS.AUTO_CONNECT] ?? true,
    voiceActivation: stored[STORAGE_KEYS.VOICE_ACTIVATION] ?? false,
    verbosityMode: stored[STORAGE_KEYS.VERBOSITY_MODE] || 'verbose',
  };
}

/**
 * Connect to Meowstik server
 */
function connectToServer(): void {
  if (wsManager?.isConnected()) {
    console.log('[Background] Already connected');
    return;
  }
  
  wsManager = new WebSocketManager(settings);
  wsManager.connect();
  
  // Handle incoming messages
  wsManager.onMessage((message) => {
    console.log('[Background] Received message:', message.type);
    // Handle different message types here
  });
}

/**
 * Setup message listeners from popup and content scripts
 */
function setupMessageListeners(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Message received:', message.type);
    
    // Handle messages from popup/content scripts
    switch (message.type) {
      case 'connect':
        connectToServer();
        sendResponse({ success: true });
        break;
        
      case 'disconnect':
        wsManager?.disconnect();
        sendResponse({ success: true });
        break;
        
      case 'send':
        wsManager?.send(message.payload);
        sendResponse({ success: true });
        break;
        
      case 'status':
        sendResponse({
          connected: wsManager?.isConnected() ?? false,
          settings
        });
        break;
    }
    
    return true; // Keep channel open for async response
  });
}

/**
 * Setup keyboard command listeners
 */
function setupCommandListeners(): void {
  chrome.commands.onCommand.addListener((command) => {
    console.log('[Background] Command received:', command);
    
    switch (command) {
      case 'start-voice':
        // Handle voice activation
        break;
        
      case 'capture-screen':
        // Handle screen capture
        break;
    }
  });
}

/**
 * Handle extension install/update
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // First time install
    chrome.tabs.create({
      url: 'https://meowstik.replit.app/welcome'
    });
  }
});

// Initialize
init();
```

### Step 3.5: Migrate Content Script

Create the TypeScript content script:

```bash
touch extension-src/content/content-script.ts
touch extension-src/content/page-analyzer.ts
```

**page-analyzer.ts:**

```typescript
/**
 * Page Content Analyzer
 */

import type { PageContent } from '../shared/types';

export class PageAnalyzer {
  /**
   * Extract all relevant content from the page
   */
  public static extractPageContent(): PageContent {
    return {
      url: window.location.href,
      title: document.title,
      text: this.extractText(),
      html: document.documentElement.outerHTML,
      links: this.extractLinks(),
      forms: this.extractForms(),
      images: this.extractImages(),
    };
  }
  
  /**
   * Extract visible text from page
   */
  private static extractText(): string {
    const body = document.body;
    if (!body) return '';
    
    // Remove scripts and styles
    const clone = body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }
  
  /**
   * Extract all links
   */
  private static extractLinks(): Array<{ text: string; href: string }> {
    const links: Array<{ text: string; href: string }> = [];
    
    document.querySelectorAll('a[href]').forEach((anchor) => {
      const a = anchor as HTMLAnchorElement;
      if (a.href && !a.href.startsWith('javascript:')) {
        links.push({
          text: a.textContent?.trim() || '',
          href: a.href
        });
      }
    });
    
    return links;
  }
  
  /**
   * Extract all forms
   */
  private static extractForms(): Array<{ id: string; action: string }> {
    const forms: Array<{ id: string; action: string }> = [];
    
    document.querySelectorAll('form').forEach((form) => {
      forms.push({
        id: form.id || form.name || 'unnamed',
        action: form.action || ''
      });
    });
    
    return forms;
  }
  
  /**
   * Extract all images
   */
  private static extractImages(): Array<{ src: string; alt: string }> {
    const images: Array<{ src: string; alt: string }> = [];
    
    document.querySelectorAll('img[src]').forEach((img) => {
      const image = img as HTMLImageElement;
      images.push({
        src: image.src,
        alt: image.alt || ''
      });
    });
    
    return images;
  }
}
```

**content-script.ts:**

```typescript
/**
 * Meowstik Extension - Content Script
 */

import { PageAnalyzer } from './page-analyzer';
import type { PageContent } from '../shared/types';

console.log('[Content] Content script injected');

/**
 * Setup message listener
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] Message received:', message.type);
  
  switch (message.type) {
    case 'get_page_content':
      const content = PageAnalyzer.extractPageContent();
      sendResponse({ content });
      break;
      
    case 'highlight_element':
      highlightElement(message.selector);
      sendResponse({ success: true });
      break;
      
    case 'click_element':
      clickElement(message.selector);
      sendResponse({ success: true });
      break;
      
    case 'type_text':
      typeText(message.selector, message.text);
      sendResponse({ success: true });
      break;
  }
  
  return true;
});

/**
 * Highlight an element on the page
 */
function highlightElement(selector: string): void {
  const element = document.querySelector(selector);
  if (!element) return;
  
  const htmlElement = element as HTMLElement;
  htmlElement.style.outline = '2px solid red';
  htmlElement.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
  
  setTimeout(() => {
    htmlElement.style.outline = '';
    htmlElement.style.backgroundColor = '';
  }, 2000);
}

/**
 * Click an element
 */
function clickElement(selector: string): void {
  const element = document.querySelector(selector);
  if (element) {
    (element as HTMLElement).click();
  }
}

/**
 * Type text into an input
 */
function typeText(selector: string, text: string): void {
  const element = document.querySelector(selector);
  if (element && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
```

### Step 3.6: Create Popup UI

```bash
touch extension-src/popup/popup.html
touch extension-src/popup/popup.ts
touch extension-src/popup/popup.css
```

**popup.html:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meowstik AI</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>🐱 Meowstik AI</h1>
      <div class="status" id="status">
        <span class="status-dot"></span>
        <span class="status-text">Disconnected</span>
      </div>
    </header>
    
    <main>
      <div class="chat-container" id="chat">
        <div class="welcome">
          <p>Ask me anything about this page!</p>
        </div>
      </div>
    </main>
    
    <footer>
      <div class="input-area">
        <input
          type="text"
          id="input"
          placeholder="Type a message..."
          autocomplete="off"
        />
        <button id="send" class="btn btn-primary">Send</button>
      </div>
      <div class="actions">
        <button id="capture" class="btn btn-secondary">📸 Capture</button>
        <button id="analyze" class="btn btn-secondary">🔍 Analyze</button>
        <button id="settings" class="btn btn-secondary">⚙️ Settings</button>
      </div>
    </footer>
  </div>
  
  <script type="module" src="popup.ts"></script>
</body>
</html>
```

**popup.css:**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 400px;
  height: 600px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}

.container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

header {
  padding: 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1 {
  font-size: 18px;
  font-weight: 600;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
}

.status.connected .status-dot {
  background: #4caf50;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

main {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.chat-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.welcome {
  text-align: center;
  color: #666;
  padding: 40px 20px;
}

.message {
  padding: 12px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background: #2196f3;
  color: white;
  align-self: flex-end;
  margin-left: auto;
}

.message.assistant {
  background: white;
  color: #333;
  align-self: flex-start;
}

footer {
  padding: 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
}

.input-area {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

input:focus {
  outline: none;
  border-color: #2196f3;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover {
  background: #1976d2;
}

.btn-secondary {
  flex: 1;
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**popup.ts:**

```typescript
/**
 * Meowstik Extension - Popup Script
 */

import type { ChatMessage } from '../shared/types';
import { generateId } from '../shared/utils';

// DOM elements
const chatContainer = document.getElementById('chat')!;
const inputElement = document.getElementById('input') as HTMLInputElement;
const sendButton = document.getElementById('send')!;
const captureButton = document.getElementById('capture')!;
const analyzeButton = document.getElementById('analyze')!;
const settingsButton = document.getElementById('settings')!;
const statusElement = document.getElementById('status')!;

// State
let messages: ChatMessage[] = [];

/**
 * Initialize popup
 */
async function init() {
  setupEventListeners();
  await checkConnectionStatus();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  sendButton.addEventListener('click', handleSend);
  inputElement.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
  });
  
  captureButton.addEventListener('click', handleCapture);
  analyzeButton.addEventListener('click', handleAnalyze);
  settingsButton.addEventListener('click', handleSettings);
}

/**
 * Check connection status
 */
async function checkConnectionStatus() {
  const response = await chrome.runtime.sendMessage({ type: 'status' });
  updateStatus(response.connected);
}

/**
 * Update connection status UI
 */
function updateStatus(connected: boolean) {
  if (connected) {
    statusElement.classList.add('connected');
    statusElement.querySelector('.status-text')!.textContent = 'Connected';
  } else {
    statusElement.classList.remove('connected');
    statusElement.querySelector('.status-text')!.textContent = 'Disconnected';
  }
}

/**
 * Handle send message
 */
async function handleSend() {
  const text = inputElement.value.trim();
  if (!text) return;
  
  // Add user message
  addMessage({
    type: 'chat',
    id: generateId(),
    timestamp: Date.now(),
    content: text,
    role: 'user'
  });
  
  // Clear input
  inputElement.value = '';
  
  // Send to background
  await chrome.runtime.sendMessage({
    type: 'send',
    payload: {
      type: 'chat',
      content: text
    }
  });
}

/**
 * Handle capture
 */
async function handleCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;
  
  const dataUrl = await chrome.tabs.captureVisibleTab();
  
  await chrome.runtime.sendMessage({
    type: 'send',
    payload: {
      type: 'capture',
      dataUrl
    }
  });
  
  addMessage({
    type: 'chat',
    id: generateId(),
    timestamp: Date.now(),
    content: '📸 Screenshot captured',
    role: 'assistant'
  });
}

/**
 * Handle analyze page
 */
async function handleAnalyze() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;
  
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: 'get_page_content'
  });
  
  await chrome.runtime.sendMessage({
    type: 'send',
    payload: {
      type: 'analyze',
      content: response.content
    }
  });
  
  addMessage({
    type: 'chat',
    id: generateId(),
    timestamp: Date.now(),
    content: '🔍 Analyzing page...',
    role: 'assistant'
  });
}

/**
 * Handle settings
 */
function handleSettings() {
  // Open settings page
  chrome.runtime.openOptionsPage();
}

/**
 * Add message to chat
 */
function addMessage(message: ChatMessage) {
  messages.push(message);
  
  const messageEl = document.createElement('div');
  messageEl.className = `message ${message.role}`;
  messageEl.textContent = message.content;
  
  // Remove welcome message if present
  const welcome = chatContainer.querySelector('.welcome');
  if (welcome) welcome.remove();
  
  chatContainer.appendChild(messageEl);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Initialize
init();
```

### Step 3.7: Build and Test

Build the extension:

```bash
npm run build:extension
```

Load it in Chrome and test:
1. All UI elements should appear
2. Connection status should show
3. Messages should be added when you type and send
4. Capture and analyze buttons should work

---

## Phase 4: Development Server

### Step 4.1: Create Mock Server

```bash
touch scripts/dev-server.ts
```

Add:

```typescript
#!/usr/bin/env tsx

/**
 * Extension Development Server
 * 
 * Provides a mock WebSocket server for testing the extension
 * without a real backend.
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';

const HTTP_PORT = 3001;
const WS_PORT = 8080;

// Create Express app
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start HTTP server
app.listen(HTTP_PORT, () => {
  console.log(`📡 HTTP server running on http://localhost:${HTTP_PORT}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ port: WS_PORT });

console.log(`🔌 WebSocket server running on ws://localhost:${WS_PORT}`);

wss.on('connection', (ws, req: IncomingMessage) => {
  console.log('✅ Extension connected');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    payload: {
      message: 'Connected to development server',
      timestamp: Date.now()
    }
  }));
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Received: ${message.type}`);
      
      // Handle different message types
      handleMessage(ws, message);
    } catch (error) {
      console.error('❌ Invalid message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('❌ Extension disconnected');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

/**
 * Handle incoming messages
 */
function handleMessage(ws: any, message: any) {
  switch (message.type) {
    case 'extension_connected':
      console.log('🎉 Extension initialized with capabilities:', message.payload.capabilities);
      break;
      
    case 'chat':
      // Simulate AI response
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'response',
          payload: {
            content: `Mock AI response to: "${message.payload.content}"`,
            timestamp: Date.now()
          }
        }));
      }, 500);
      break;
      
    case 'capture':
      console.log('📸 Screenshot received');
      ws.send(JSON.stringify({
        type: 'response',
        payload: {
          content: 'Screenshot received and processed',
          timestamp: Date.now()
        }
      }));
      break;
      
    case 'analyze':
      console.log('🔍 Page content received for analysis');
      ws.send(JSON.stringify({
        type: 'response',
        payload: {
          content: 'Page analysis complete: This page contains...',
          timestamp: Date.now()
        }
      }));
      break;
      
    default:
      console.log(`❓ Unknown message type: ${message.type}`);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down development server...');
  wss.close();
  process.exit(0);
});
```

### Step 4.2: Update Development Workflow

Now you can run the complete development environment:

```bash
# Terminal 1: Main app
npm run dev

# Terminal 2: Extension with live reload
npm run dev:extension

# Terminal 3: Mock server
npm run dev:extension-server
```

Or run everything together:

```bash
npm run dev:full
```

---

## Phase 5: Testing & Documentation

### Step 5.1: Add Testing Framework

Install Vitest:

```bash
npm install --save-dev vitest @vitest/ui
```

Create test configuration:

```bash
touch vitest.config.extension.ts
```

Add:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./extension-src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@extension': path.resolve(__dirname, 'extension-src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
```

### Step 5.2: Create Test Setup

```bash
mkdir -p extension-src/__tests__
touch extension-src/__tests__/setup.ts
```

Add:

```typescript
/**
 * Test Setup
 */

import { vi } from 'vitest';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    captureVisibleTab: vi.fn(),
  },
} as any;
```

### Step 5.3: Write Sample Tests

```bash
touch extension-src/shared/__tests__/utils.test.ts
```

Add:

```typescript
import { describe, it, expect } from 'vitest';
import { generateId, formatBytes, safeJSONParse } from '../utils';

describe('utils', () => {
  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });
  
  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
    });
  });
  
  describe('safeJSONParse', () => {
    it('parses valid JSON', () => {
      const result = safeJSONParse('{"test": true}', {});
      expect(result).toEqual({ test: true });
    });
    
    it('returns fallback for invalid JSON', () => {
      const fallback = { error: true };
      const result = safeJSONParse('invalid', fallback);
      expect(result).toBe(fallback);
    });
  });
});
```

### Step 5.4: Add Test Script

Update `package.json`:

```json
{
  "scripts": {
    "test:extension": "vitest --config vitest.config.extension.ts",
    "test:extension:ui": "vitest --ui --config vitest.config.extension.ts"
  }
}
```

Run tests:

```bash
npm run test:extension
```

### Step 5.5: Create Developer Documentation

```bash
touch docs/EXTENSION_DEVELOPMENT.md
```

Add comprehensive developer guide (see next section for content).

---

## Troubleshooting

### Issue: Extension Won't Load

**Symptoms**: Chrome shows "Manifest file is missing or unreadable"

**Solutions**:
1. Check that `dist/extension/manifest.json` exists
2. Run `npm run build:extension` to rebuild
3. Verify no TypeScript compilation errors
4. Check file permissions

### Issue: Live Reload Not Working

**Symptoms**: Changes don't trigger extension reload

**Solutions**:
1. Ensure watch script is running: `npm run watch:extension`
2. Check WebSocket connection in extension console
3. Verify `dist/extension/` is being updated
4. Try manual reload as fallback

### Issue: TypeScript Errors

**Symptoms**: Build fails with type errors

**Solutions**:
1. Install Chrome types: `npm install --save-dev @types/chrome`
2. Check `tsconfig.extension.json` is correct
3. Run `npm run check` to see all errors
4. Update import paths

### Issue: WebSocket Connection Fails

**Symptoms**: Extension shows "Disconnected" status

**Solutions**:
1. Check dev server is running: `npm run dev:extension-server`
2. Verify port 8080 is not in use
3. Check browser console for connection errors
4. Ensure WebSocket URL is correct in settings

### Issue: Content Script Not Injecting

**Symptoms**: Page analysis doesn't work

**Solutions**:
1. Check manifest.json includes content_scripts
2. Verify permissions include `<all_urls>`
3. Reload the target page after loading extension
4. Check content script console for errors

---

## Maintenance

### Updating Dependencies

```bash
# Update all dependencies
npm update

# Update specific package
npm update @crxjs/vite-plugin

# Check for outdated packages
npm outdated
```

### Adding New Features

1. Create feature branch:
   ```bash
   git checkout -b feature/new-feature
   ```

2. Add code in `extension-src/`

3. Add tests in `__tests__/`

4. Run tests:
   ```bash
   npm run test:extension
   ```

5. Build and test in Chrome:
   ```bash
   npm run build:extension
   ```

6. Commit and push:
   ```bash
   git add .
   git commit -m "Add new feature"
   git push
   ```

### Releasing New Version

1. Update version in `package.json`

2. Build production version:
   ```bash
   npm run build:extension:prod
   ```

3. Package extension:
   ```bash
   npm run package:extension
   ```

4. Test packaged extension thoroughly

5. Upload to Chrome Web Store or distribute

---

## Additional Resources

### Documentation
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Vite Documentation](https://vitejs.dev/)
- [CRXJS Plugin Docs](https://crxjs.dev/vite-plugin)

### Tools
- [Extension Reloader](https://chromewebstore.google.com/detail/extensions-reloader)
- [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools)
- [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools)

### Community
- [Chrome Extension Discord](https://discord.gg/chrome-extensions)
- [r/browserextensions](https://reddit.com/r/browserextensions)
- [Stack Overflow Tag](https://stackoverflow.com/questions/tagged/google-chrome-extension)

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-14  
**Status**: Implementation Guide - Ready for Use
