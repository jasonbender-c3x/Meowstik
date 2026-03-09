
import { exec } from 'child_process';
import { promisify } from 'util';
import screenshot from 'screenshot-desktop';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export class LocalComputerControl {
  private _xdotoolChecked: boolean = false;
  private _xdotoolAvailable: boolean = false;

  async isXdotoolAvailable(): Promise<boolean> {
    if (this._xdotoolChecked) return this._xdotoolAvailable;
    
    try {
      await execAsync('which xdotool');
      this._xdotoolAvailable = true;
    } catch {
      this._xdotoolAvailable = false;
      console.warn('xdotool not found on system. Mouse/Keyboard control will be disabled.');
    }
    
    this._xdotoolChecked = true;
    return this._xdotoolAvailable;
  }
  
  /**
   * Take a screenshot and return as base64 string
   */
  async takeScreenshot(): Promise<string> {
    // strict timeout for the entire operation
    return new Promise(async (resolve, reject) => {
        const timer = setTimeout(() => {
            console.warn("Screenshot operation timed out, returning placeholder");
            resolve("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        }, 3000); // 3s timeout

        try {
            // 1. Try Wayland (grim) if env var set
            if (process.env.WAYLAND_DISPLAY) {
                try {
                    const b64 = await this.takeScreenshotWayland();
                    clearTimeout(timer);
                    return resolve(b64);
                } catch (e) {
                    console.warn('Wayland screenshot failed:', e.message);
                }
            }

            // 2. Try X11 (screenshot-desktop)
            // Verify X11 connection first to avoid hangs
            try {
                await execAsync('timeout 1 xset q'); 
            } catch {
                console.warn('X11 display not accessible (xset q failed). Skipping real screenshot.');
                clearTimeout(timer);
                return resolve("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
            }

            const imgBuffer = await screenshot({ format: 'png' });
            clearTimeout(timer);
            resolve(imgBuffer.toString('base64'));
        } catch (error) {
            console.error('Screenshot failed:', error);
            clearTimeout(timer);
            // Return placeholder on error
            resolve("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        }
    });
  }

  async takeScreenshotWayland(): Promise<string> {
    // Use grim for Wayland screenshots
    const tmpFile = path.join('/tmp', `screenshot-${Date.now()}.png`);
    try {
        await execAsync(`grim "${tmpFile}"`);
        const buffer = await fs.promises.readFile(tmpFile);
        await fs.promises.unlink(tmpFile);
        return buffer.toString('base64');
    } catch (e) {
        throw new Error(`Grim failed: ${e.message}`);
    }
  }

  /**
   * Move mouse to coordinates
   */
  async moveMouse(x: number, y: number): Promise<void> {
    try {
      if (!(await this.isXdotoolAvailable())) {
        console.warn('xdotool not available, skipping mouse move');
        return;
      }
      // Check for display
      if (!process.env.DISPLAY) {
        console.warn('No DISPLAY environment variable, skipping mouse move');
        return;
      }
      
      await execAsync(`xdotool mousemove ${x} ${y}`);
    } catch (error) {
      console.error('Failed to move mouse:', error);
      // Non-critical, log but don't crash
    }
  }

  /**
   * Click at current position or specific coordinates
   */
  async click(x?: number, y?: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    try {
      if (!(await this.isXdotoolAvailable())) return;

      if (x !== undefined && y !== undefined) {
        await this.moveMouse(x, y);
      }
      
      const buttonMap = { left: 1, middle: 2, right: 3 };
      const btn = buttonMap[button] || 1;
      
      await execAsync(`xdotool click ${btn}`);
    } catch (error) {
      console.error('Failed to click:', error);
    }
  }

  /**
   * Type text
   */
  async type(text: string): Promise<void> {
    try {
      if (!(await this.isXdotoolAvailable())) return;
      
      // Escape text for shell
      const escapedText = text.replace(/"/g, '\\"');
      await execAsync(`xdotool type "${escapedText}"`);
    } catch (error) {
      console.error('Failed to type:', error);
    }
  }

  /**
   * Press a key combination
   */
  async pressKey(key: string, modifiers: string[] = []): Promise<void> {
    try {
      if (!(await this.isXdotoolAvailable())) return;

      // Map keys to xdotool format
      const keyMap: Record<string, string> = {
        'Enter': 'Return',
        'Backspace': 'BackSpace',
        'Tab': 'Tab',
        'Escape': 'Escape',
        'ArrowUp': 'Up',
        'ArrowDown': 'Down',
        'ArrowLeft': 'Left',
        'ArrowRight': 'Right',
        ' ': 'space',
        'PageUp': 'Prior',
        'PageDown': 'Next',
        'Home': 'Home',
        'End': 'End',
        'Delete': 'Delete',
        'Insert': 'Insert',
        'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5', 'F6': 'F6', 
        'F7': 'F7', 'F8': 'F8', 'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12'
      };

      const xKey = keyMap[key] || key;
      
      // Combine modifiers
      const modMap: Record<string, string> = {
        'Control': 'ctrl',
        'Shift': 'shift',
        'Alt': 'alt',
        'Meta': 'super',
        'Command': 'super'
      };
      
      const mods = modifiers.map(m => modMap[m] || '').filter(Boolean);
      const combo = [...mods, xKey].join('+');
      
      await execAsync(`xdotool key ${combo}`);
    } catch (error) {
      console.error('Failed to press key:', error);
    }
  }

  /**
   * Scroll
   */
  async scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number = 300): Promise<void> {
    try {
      if (!(await this.isXdotoolAvailable())) return;

      // xdotool click 4 (up), 5 (down), 6 (left), 7 (right)
      // Amount is approximated by number of clicks (assuming ~50px per click)
      const clicks = Math.ceil(amount / 50);
      let btn = 4;
      
      switch (direction) {
        case 'up': btn = 4; break;
        case 'down': btn = 5; break;
        case 'left': btn = 6; break;
        case 'right': btn = 7; break;
      }
      
      await execAsync(`xdotool click --repeat ${clicks} --delay 10 ${btn}`);
    } catch (error) {
      console.error('Failed to scroll:', error);
    }
  }
}

export const localComputerControl = new LocalComputerControl();
