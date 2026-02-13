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
        const buttonMap = {
          left: Button.LEFT,
          right: Button.RIGHT,
          middle: Button.MIDDLE,
        };
        const button = buttonMap[event.button || "left"];
        await mouse.click(button);
        break;

      case "scroll":
        if (event.delta !== undefined) {
          // nut.js uses scrollDown/scrollUp with positive amounts
          if (event.delta > 0) {
            await mouse.scrollDown(Math.abs(event.delta));
          } else {
            await mouse.scrollUp(Math.abs(event.delta));
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
    };

    // Return mapped key or try to convert single character
    if (keyMap[key]) {
      return keyMap[key];
    }
    
    // For single characters, nut.js expects the Key enum value
    // Return the character as-is and let nut.js handle it
    return key.toLowerCase() as unknown as Key;
  }
}
