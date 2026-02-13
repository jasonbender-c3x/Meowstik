import { mouse, keyboard, Button, Key, Point, straightTo } from "@nut-tree-fork/nut-js";

export interface InputEvent {
  type: "mouse" | "keyboard";
  action: "move" | "click" | "scroll" | "keydown" | "keyup" | "type";
  x?: number;
  y?: number;
  button?: "left" | "right" | "middle";
  key?: string;
  text?: string;
  delta?: number;
  source: "user" | "ai";
}

export class InputHandler {
  private isEnabled = true;
  private readonly buttonMap = {
    left: Button.LEFT,
    right: Button.RIGHT,
    middle: Button.MIDDLE,
  };

  constructor() {
    console.log("Input handler initialized with nut.js");
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  async handleInput(event: InputEvent): Promise<void> {
    if (!this.isEnabled) {
      console.log(`Input event (not executed):`, event);
      return;
    }

    try {
      switch (event.type) {
        case "mouse":
          await this.handleMouseEvent(event);
          break;
        case "keyboard":
          await this.handleKeyboardEvent(event);
          break;
      }
    } catch (error) {
      console.error("Input handling error:", error);
    }
  }

  private async handleMouseEvent(event: InputEvent): Promise<void> {
    switch (event.action) {
      case "move":
        if (event.x !== undefined && event.y !== undefined) {
          await mouse.move(straightTo(new Point(event.x, event.y)));
        }
        break;

      case "click":
        if (event.x !== undefined && event.y !== undefined) {
          await mouse.move(straightTo(new Point(event.x, event.y)));
        }
        const button = this.buttonMap[event.button || "left"];
        await mouse.click(button);
        break;

      case "scroll":
        if (event.delta !== undefined) {
          // Positive delta: scroll up (content moves up); negative delta: scroll down
          if (event.delta > 0) {
            await mouse.scrollUp(Math.abs(event.delta));
          } else {
            await mouse.scrollDown(Math.abs(event.delta));
          }
        }
        break;
    }
  }

  private async handleKeyboardEvent(event: InputEvent): Promise<void> {
    switch (event.action) {
      case "keydown":
        if (event.key) {
          await keyboard.pressKey(this.mapKey(event.key));
        }
        break;

      case "keyup":
        if (event.key) {
          await keyboard.releaseKey(this.mapKey(event.key));
        }
        break;

      case "type":
        if (event.text) {
          await keyboard.type(event.text);
        }
        break;
    }
  }

  private mapKey(key: string): Key {
    const keyMap: Record<string, Key> = {
      Enter: Key.Enter,
      Escape: Key.Escape,
      Backspace: Key.Backspace,
      Tab: Key.Tab,
      Space: Key.Space,
      ArrowUp: Key.Up,
      ArrowDown: Key.Down,
      ArrowLeft: Key.Left,
      ArrowRight: Key.Right,
      Control: Key.LeftControl,
      Alt: Key.LeftAlt,
      Shift: Key.LeftShift,
      Meta: Key.LeftSuper, // Command/Windows key
      Delete: Key.Delete,
      Home: Key.Home,
      End: Key.End,
      PageUp: Key.PageUp,
      PageDown: Key.PageDown,
      // Number keys
      '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3, '4': Key.Num4,
      '5': Key.Num5, '6': Key.Num6, '7': Key.Num7, '8': Key.Num8, '9': Key.Num9,
      // Function keys
      F1: Key.F1, F2: Key.F2, F3: Key.F3, F4: Key.F4, F5: Key.F5, F6: Key.F6,
      F7: Key.F7, F8: Key.F8, F9: Key.F9, F10: Key.F10, F11: Key.F11, F12: Key.F12,
    };

    // Return mapped key or handle single character
    if (keyMap[key]) {
      return keyMap[key];
    }
    
    // For single lowercase letters a-z, nut.js has Key.A through Key.Z
    if (key.length === 1) {
      const upperKey = key.toUpperCase();
      // Check if it's a valid letter key
      if (upperKey >= 'A' && upperKey <= 'Z') {
        // nut.js uses Key.A, Key.B, etc.
        return Key[upperKey as keyof typeof Key] as Key;
      }
    }
    
    // Log warning for unmapped keys to help with debugging
    console.warn(`[Input Handler] Unmapped key: "${key}". This may cause nut.js to throw an error.`);
    
    // Fallback: return the original key as-is (nut.js may handle some special keys)
    // If invalid, nut.js will throw an error which is caught by the caller
    return key as unknown as Key;
  }
}
