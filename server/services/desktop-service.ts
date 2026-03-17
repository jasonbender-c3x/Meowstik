import screenshot from 'screenshot-desktop';
import { mouse, keyboard, Point, Button, Key } from '@nut-tree-fork/nut-js';
import { Jimp } from 'jimp';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

// Configure nut.js defaults
mouse.config.autoDelayMs = 10;
keyboard.config.autoDelayMs = 10;

interface DesktopAction {
    type: 'click' | 'type' | 'move' | 'scroll' | 'key' | 'open';
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    app?: string;
    modifiers?: string[];
    button?: 'left' | 'right' | 'middle';
}

export class DesktopService extends EventEmitter {
    private isCapturing = false;
    private captureInterval: NodeJS.Timeout | null = null;
    private lastSnapshot: Buffer | null = null;
    private lastSnapshotTime: number = 0;
    
    // Capture settings
    private readonly FPS = 2; // Frames per second
    private readonly QUALITY = 60; // JPEG quality (0-100)
    private readonly RESIZE_WIDTH = 1024; // Resize for AI consumption

    constructor() {
        super();
        console.log('🖥️ [DesktopService] Initialized');
    }

    /**
     * Start capturing screen frames
     */
    public startCapture() {
        if (this.isCapturing) return;
        
        console.log('🖥️ [DesktopService] Starting capture...');
        this.isCapturing = true;
        
        this.captureInterval = setInterval(async () => {
            try {
                await this.captureFrame();
            } catch (err) {
                console.error('❌ [DesktopService] Capture failed:', err);
            }
        }, 1000 / this.FPS);
    }

    /**
     * Stop capturing screen frames
     */
    public stopCapture() {
        if (!this.isCapturing) return;
        
        console.log('🖥️ [DesktopService] Stopping capture...');
        this.isCapturing = false;
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
    }

    /**
     * Get the latest screen snapshot
     */
    public getSnapshot(): Buffer | null {
        return this.lastSnapshot;
    }

    /**
     * Capture a single frame, process it, and emit it
     */
    private async captureFrame() {
        try {
            // Capture full screen
            const imgBuffer = await screenshot({ format: 'jpg' });
            
            // Optimize with Jimp (resize & compress)
            const image = await Jimp.read(imgBuffer);
            
            // Only resize if significantly larger than target
            if (image.width > this.RESIZE_WIDTH) {
                image.resize({ w: this.RESIZE_WIDTH });
            }
            
            // Jimp 1.0+ uses different quality API or defaults
            // image.quality(this.QUALITY); 
            
            const processedBuffer = await image.getBuffer('image/jpeg', { quality: this.QUALITY });
            
            this.lastSnapshot = processedBuffer;
            this.lastSnapshotTime = Date.now();
            
            // Emit for WebSocket streaming (if needed)
            this.emit('frame', processedBuffer);
            
        } catch (error) {
            // Suppress errors during shutdown or display switching
            // console.error('Capture error:', error);
        }
    }

    /**
     * Map string key name to nut.js Key
     */
    private mapKey(keyName: string): Key | null {
        const k = keyName.toLowerCase();
        switch (k) {
            case 'enter': return Key.Enter;
            case 'space': return Key.Space;
            case 'backspace': return Key.Backspace;
            case 'tab': return Key.Tab;
            case 'escape': return Key.Escape;
            case 'up': case 'arrowup': return Key.Up;
            case 'down': case 'arrowdown': return Key.Down;
            case 'left': case 'arrowleft': return Key.Left;
            case 'right': case 'arrowright': return Key.Right;
            case 'home': return Key.Home;
            case 'end': return Key.End;
            case 'pageup': return Key.PageUp;
            case 'pagedown': return Key.PageDown;
            case 'delete': return Key.Delete;
            case 'insert': return Key.Insert;
            case 'f1': return Key.F1;
            case 'f2': return Key.F2;
            case 'f3': return Key.F3;
            case 'f4': return Key.F4;
            case 'f5': return Key.F5;
            case 'f6': return Key.F6;
            case 'f7': return Key.F7;
            case 'f8': return Key.F8;
            case 'f9': return Key.F9;
            case 'f10': return Key.F10;
            case 'f11': return Key.F11;
            case 'f12': return Key.F12;
            case 'cmd': case 'command': case 'meta': case 'super': return Key.LeftSuper;
            case 'alt': return Key.LeftAlt;
            case 'control': case 'ctrl': return Key.LeftControl;
            case 'shift': return Key.LeftShift;
            default: return null;
        }
    }

    /**
     * Perform an action on the desktop
     */
    public async performAction(action: DesktopAction) {
        console.log(`🤖 [DesktopService] Action: ${action.type}`, action);
        
        try {
            switch (action.type) {
                case 'move':
                    if (action.x !== undefined && action.y !== undefined) {
                        await mouse.setPosition(new Point(action.x, action.y));
                    }
                    break;
                    
                case 'click':
                    if (action.x !== undefined && action.y !== undefined) {
                        await mouse.setPosition(new Point(action.x, action.y));
                    }
                    let btn = Button.LEFT;
                    if (action.button === 'right') btn = Button.RIGHT;
                    if (action.button === 'middle') btn = Button.MIDDLE;
                    await mouse.click(btn);
                    break;
                    
                case 'type':
                    if (action.text) {
                        await keyboard.type(action.text);
                    }
                    break;

                case 'open':
                    if (action.app) {
                         const { exec } = await import('child_process');
                         console.log(`🖥️ [DesktopService] Opening app: ${action.app}`);
                         // Naive implementation: just run the command
                         exec(action.app, (err) => {
                             if (err) console.error(`❌ [DesktopService] Failed to open ${action.app}:`, err);
                         });
                    }
                    break;
                    
                case 'key':
                    if (action.key) {
                        const k = this.mapKey(action.key);
                        if (k !== null) {
                            if (action.modifiers && action.modifiers.length > 0) {
                                const mods = action.modifiers.map(m => this.mapKey(m)).filter(m => m !== null) as Key[];
                                await keyboard.pressKey(...mods);
                                await keyboard.pressKey(k);
                                await keyboard.releaseKey(k);
                                await keyboard.releaseKey(...mods.reverse());
                            } else {
                                await keyboard.pressKey(k);
                                await keyboard.releaseKey(k);
                            }
                        } else {
                            // Try typing as literal text if not a special key
                            await keyboard.type(action.key);
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('❌ [DesktopService] Action failed:', error);
            throw error;
        }
    }
}

// Singleton instance
export const desktopService = new DesktopService();
