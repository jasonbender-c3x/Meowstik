/**
 * Meowstik Desktop Agent
 * 
 * This agent runs on the user's computer and provides:
 * 1. Screen capture - Captures desktop framebuffer and streams to relay
 * 2. Audio capture - Captures system audio and streams to relay
 * 3. Input injection - Receives mouse/keyboard events from relay and injects them
 * 4. WebSocket connection - Maintains persistent connection to Meowstik relay
 * 
 * Data Flow:
 * - Desktop → Agent → Relay → [LLM Vision + User Browser]
 * - [LLM Commands + User Commands] → Relay → Agent → Desktop Input
 */

import { WebSocket, RawData } from 'ws';
import * as os from 'os';
import { mouse, keyboard, Button, Key, Point, straightTo } from '@nut-tree-fork/nut-js';

interface AgentConfig {
  relayUrl: string;
  token?: string; // Optional for localhost development
  captureInterval: number;
  quality: number;
}

interface ScreenFrame {
  timestamp: number;
  width: number;
  height: number;
  data: string;
}

interface InputEvent {
  type: 'mouse' | 'keyboard';
  action: 'move' | 'click' | 'scroll' | 'keydown' | 'keyup' | 'type';
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  key?: string;
  text?: string;
  delta?: number;
}

interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  memory: number;
  screens: { width: number; height: number }[];
}

class DesktopAgent {
  private ws: WebSocket | null = null;
  private config: AgentConfig;
  private captureInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private frameCount = 0;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    console.log('🐱 Meowstik Desktop Agent starting...');
    console.log(`📡 Connecting to relay: ${this.config.relayUrl}`);
    
    await this.connect();
  }

  private async connect(): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      
      // Only add Authorization header if token is provided
      if (this.config.token) {
        headers['Authorization'] = `Bearer ${this.config.token}`;
      }
      
      this.ws = new WebSocket(this.config.relayUrl, {
        headers,
      });

      this.ws.on('open', () => this.onConnected());
      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('close', () => this.onDisconnected());
      this.ws.on('error', (err) => this.onError(err));

    } catch (error) {
      console.error('Connection failed:', error);
      this.scheduleReconnect();
    }
  }

  private async onConnected(): Promise<void> {
    this.isConnected = true;
    console.log('✅ Connected to relay');

    const systemInfo = await this.getSystemInfo();
    this.send({ type: 'register', data: systemInfo });

    this.startScreenCapture();
  }

  private onDisconnected(): void {
    this.isConnected = false;
    console.log('❌ Disconnected from relay');
    this.stopScreenCapture();
    this.scheduleReconnect();
  }

  private onError(error: Error): void {
    console.error('WebSocket error:', error.message);
  }

  private onMessage(data: RawData): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'input':
          this.handleInputEvent(message.data as InputEvent);
          break;
        case 'ping':
          this.send({ type: 'pong' });
          break;
        case 'config':
          this.updateConfig(message.data);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private handleInputEvent(event: InputEvent): void {
    console.log(`🎮 Input event: ${event.type} - ${event.action}`);
    
    // Using nut.js for actual input injection
    (async () => {
      try {
        switch (event.type) {
          case 'mouse':
            if (event.action === 'move' && event.x !== undefined && event.y !== undefined) {
              await mouse.move(straightTo(new Point(event.x, event.y)));
              console.log(`  Mouse moved to (${event.x}, ${event.y})`);
            } else if (event.action === 'click') {
              if (event.x !== undefined && event.y !== undefined) {
                await mouse.move(straightTo(new Point(event.x, event.y)));
              }
              const buttonMap = {
                'left': Button.LEFT,
                'right': Button.RIGHT,
                'middle': Button.MIDDLE,
              };
              await mouse.click(buttonMap[event.button || 'left']);
              console.log(`  Mouse clicked: ${event.button || 'left'}`);
            } else if (event.action === 'scroll' && event.delta !== undefined) {
              if (event.delta > 0) {
                await mouse.scrollDown(Math.abs(event.delta));
              } else {
                await mouse.scrollUp(Math.abs(event.delta));
              }
              console.log(`  Mouse scrolled: ${event.delta}`);
            }
            break;
          case 'keyboard':
            if (event.action === 'type' && event.text) {
              await keyboard.type(event.text);
              console.log(`  Typed: "${event.text}"`);
            } else if (event.action === 'keydown' && event.key) {
              await keyboard.pressKey(this.mapKey(event.key));
              console.log(`  Key pressed: ${event.key}`);
            } else if (event.action === 'keyup' && event.key) {
              await keyboard.releaseKey(this.mapKey(event.key));
              console.log(`  Key released: ${event.key}`);
            }
            break;
        }
      } catch (error) {
        console.error(`  Input injection error:`, error);
      }
    })();
  }

  private mapKey(key: string): Key {
    const keyMap: Record<string, Key> = {
      'Enter': Key.Enter,
      'Escape': Key.Escape,
      'Backspace': Key.Backspace,
      'Tab': Key.Tab,
      'Space': Key.Space,
      'ArrowUp': Key.Up,
      'ArrowDown': Key.Down,
      'ArrowLeft': Key.Left,
      'ArrowRight': Key.Right,
      'Control': Key.LeftControl,
      'Alt': Key.LeftAlt,
      'Shift': Key.LeftShift,
      'Meta': Key.LeftSuper,
      'Delete': Key.Delete,
      'Home': Key.Home,
      'End': Key.End,
      'PageUp': Key.PageUp,
      'PageDown': Key.PageDown,
    };

    return keyMap[key] || key.toLowerCase() as unknown as Key;
  }

  private startScreenCapture(): void {
    console.log(`📸 Starting screen capture (interval: ${this.config.captureInterval}ms)`);
    
    this.captureInterval = setInterval(async () => {
      try {
        const frame = await this.captureScreen();
        this.send({ type: 'frame', data: frame });
        this.frameCount++;
        
        if (this.frameCount % 30 === 0) {
          console.log(`📊 Frames sent: ${this.frameCount}`);
        }
      } catch (error) {
        console.error('Screen capture failed:', error);
      }
    }, this.config.captureInterval);
  }

  private stopScreenCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  private async captureScreen(): Promise<ScreenFrame> {
    // NOTE: screenshot-desktop integration would go here
    // This is a placeholder that returns mock data
    return {
      timestamp: Date.now(),
      width: 1920,
      height: 1080,
      data: '', // Base64 encoded JPEG/PNG would go here
    };
  }

  private async getSystemInfo(): Promise<SystemInfo> {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      screens: [{ width: 1920, height: 1080 }], // Would use systeminformation here
    };
  }

  private updateConfig(newConfig: Partial<AgentConfig>): void {
    if (newConfig.captureInterval && newConfig.captureInterval !== this.config.captureInterval) {
      this.config.captureInterval = newConfig.captureInterval;
      this.stopScreenCapture();
      this.startScreenCapture();
    }
    if (newConfig.quality) {
      this.config.quality = newConfig.quality;
    }
    console.log('⚙️ Config updated:', newConfig);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    
    console.log('🔄 Scheduling reconnect in 5 seconds...');
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 5000);
  }

  private send(message: object): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  stop(): void {
    console.log('🛑 Stopping agent...');
    this.stopScreenCapture();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

// CLI Entry Point
if (require.main === module) {
  const args = process.argv.slice(2);
  const tokenIndex = args.indexOf('--token');
  const urlIndex = args.indexOf('--relay');
  
  const token = tokenIndex !== -1 ? args[tokenIndex + 1] : process.env.MEOWSTIK_TOKEN || '';
  const relayUrl = urlIndex !== -1 ? args[urlIndex + 1] : process.env.MEOWSTIK_RELAY || 'wss://your-meowstik-instance.replit.app/ws/desktop';
  
  // Check if connecting to localhost
  const isLocalhost = relayUrl.includes('localhost') || relayUrl.includes('127.0.0.1');
  
  if (!token && !isLocalhost) {
    console.error('❌ Error: --token is required for non-localhost connections');
    console.error('Usage: meowstik-agent --token YOUR_TOKEN [--relay wss://...]');
    console.error('');
    console.error('For local development, you can omit --token when connecting to localhost:');
    console.error('  meowstik-agent --relay ws://localhost:5000/ws/desktop');
    process.exit(1);
  }
  
  if (!token && isLocalhost) {
    console.log('🔓 Development Mode: Connecting to localhost without token');
  }

  const agent = new DesktopAgent({
    relayUrl,
    token: token || undefined,
    captureInterval: 100, // 10 FPS
    quality: 80,
  });

  process.on('SIGINT', () => {
    agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    agent.stop();
    process.exit(0);
  });

  agent.start().catch((error) => {
    console.error('Failed to start agent:', error);
    process.exit(1);
  });
}

export { DesktopAgent, AgentConfig, InputEvent, ScreenFrame };
