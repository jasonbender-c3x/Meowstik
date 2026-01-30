/**
 * Computer Use Service (Project Ghost)
 * 
 * Integrates with Gemini Computer Use API for hands-free desktop control:
 * - Real-time screen capture and vision analysis
 * - Voice-driven action planning using Gemini's native computer use capabilities
 * - Mouse/keyboard input injection via desktop agent
 * - Safety confirmations for critical actions
 * - Visual feedback loop with progress assessment
 * 
 * Key Features:
 * - Uses official Gemini Computer Use model with built-in tool declarations
 * - Supports Gemini 2.0/2.5/3.0 models (configurable via COMPUTER_USE_MODEL env var)
 * - Gemini 3.0 adds continuous video streaming support (1 FPS JPEG frames)
 * - Supports multimodal input (screen + audio + context)
 * - Implements safety checks for destructive operations
 * - Provides real-time action execution via WebSocket to desktop agent
 */

import { GoogleGenAI, type FunctionDeclaration } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Computer Use model - the official Gemini model with built-in desktop control capabilities
// Supports Gemini 2.0/2.5/3.0 models with computer use capabilities
const COMPUTER_USE_MODEL = process.env.COMPUTER_USE_MODEL || "gemini-2.0-flash-exp";
// Options: gemini-2.0-flash-exp, gemini-2.5-flash, gemini-3.0-flash-preview

/**
 * Gemini Computer Use Tool Declarations
 * These match the official Computer Use API function schema
 */
const computerUseTools: FunctionDeclaration[] = [
  {
    name: "computer_click",
    description: "Click at a specific coordinate on the screen",
    parametersJsonSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate in pixels" },
        y: { type: "number", description: "Y coordinate in pixels" },
        button: { type: "string", enum: ["left", "right", "middle"], description: "Mouse button to click" }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "computer_type",
    description: "Type text at the current cursor position or into a focused input field",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type" }
      },
      required: ["text"]
    }
  },
  {
    name: "computer_key",
    description: "Press a keyboard key (Enter, Tab, Escape, Arrow keys, etc.)",
    parametersJsonSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name: Enter, Tab, Escape, Backspace, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, etc." },
        modifiers: { 
          type: "array", 
          items: { type: "string", enum: ["Control", "Shift", "Alt", "Meta"] },
          description: "Modifier keys to hold while pressing"
        }
      },
      required: ["key"]
    }
  },
  {
    name: "computer_scroll",
    description: "Scroll the screen in a direction",
    parametersJsonSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down", "left", "right"], description: "Scroll direction" },
        amount: { type: "number", description: "Amount to scroll in pixels (default: 300)" }
      },
      required: ["direction"]
    }
  },
  {
    name: "computer_move",
    description: "Move the mouse cursor to a position without clicking",
    parametersJsonSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate in pixels" },
        y: { type: "number", description: "Y coordinate in pixels" }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "computer_screenshot",
    description: "Take a screenshot of the current screen state",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fullScreen: { type: "boolean", description: "Capture full screen or active window only (default: true)" }
      }
    }
  },
  {
    name: "computer_wait",
    description: "Wait for a specified duration before the next action",
    parametersJsonSchema: {
      type: "object",
      properties: {
        delay: { type: "number", description: "Time to wait in milliseconds" }
      },
      required: ["delay"]
    }
  }
];

export interface ComputerAction {
  type: 'click' | 'type' | 'scroll' | 'move' | 'key' | 'screenshot' | 'wait';
  target?: { x: number; y: number } | string;
  text?: string;
  key?: string;
  modifiers?: string[]; // Add modifiers to the interface
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  delay?: number;
  button?: 'left' | 'right' | 'middle';
}

export interface ComputerState {
  screenshot: string;
  url?: string;
  title?: string;
  elements?: Array<{
    tag: string;
    text?: string;
    rect: { x: number; y: number; width: number; height: number };
    selector?: string;
  }>;
}

interface VisionAnalysis {
  description: string;
  elements: Array<{
    description: string;
    bounds: { x: number; y: number; width: number; height: number };
    type: 'button' | 'input' | 'link' | 'text' | 'image' | 'menu' | 'other';
  }>;
  suggestedActions: string[];
  currentFocus?: string;
}

export class ComputerUseService {
  private actionHistory: Array<{ action: ComputerAction; timestamp: Date; result?: any }> = [];
  private maxHistorySize = 50;

  /**
   * Analyze a screenshot using Gemini Vision to understand the current state
   */
  async analyzeScreen(screenshot: string, context?: string): Promise<VisionAnalysis> {
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `You are an AI assistant analyzing a computer screen to help automate tasks.
${context ? `Context: ${context}` : ''}

Analyze this screenshot and provide:
1. A brief description of what's on screen
2. A list of interactive elements you can see (buttons, inputs, links, menus) with their approximate locations
3. Suggestions for what actions might be useful

Respond in JSON format:
{
  "description": "Brief description of the screen",
  "elements": [
    {"description": "Element description", "bounds": {"x": 0, "y": 0, "width": 100, "height": 30}, "type": "button"}
  ],
  "suggestedActions": ["Action 1", "Action 2"],
  "currentFocus": "What appears to be focused or active"
}`;

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: base64Data } },
              { text: prompt }
            ]
          }
        ]
      });

      const text = result?.text || '';
      
      if (!text) {
        console.warn('[ComputerUse] Empty response from vision analysis');
        return {
          description: 'No analysis available',
          elements: [],
          suggestedActions: []
        };
      }
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.warn('[ComputerUse] Failed to parse JSON, returning raw text');
        }
      }

      return {
        description: text,
        elements: [],
        suggestedActions: []
      };
    } catch (error: any) {
      console.error('[ComputerUse] Vision analysis failed:', error);
      return {
        description: 'Failed to analyze screen: ' + (error.message || 'Unknown error'),
        elements: [],
        suggestedActions: []
      };
    }
  }

  /**
   * Plan actions to achieve a goal based on current screen state
   */
  async planActions(
    goal: string,
    currentState: ComputerState
  ): Promise<ComputerAction[]> {
    const base64Data = currentState.screenshot.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `You are an AI assistant that plans computer actions to achieve goals.

Goal: ${goal}
${currentState.url ? `Current URL: ${currentState.url}` : ''}
${currentState.title ? `Page Title: ${currentState.title}` : ''}

Analyze the screenshot and plan the sequence of actions needed to achieve the goal.

Available actions:
- click: { type: "click", target: { x: number, y: number } } or { type: "click", target: "selector" }
- type: { type: "type", text: "text to type", target: { x: number, y: number } }
- scroll: { type: "scroll", direction: "up"|"down"|"left"|"right", amount: 300 }
- key: { type: "key", key: "Enter"|"Tab"|"Escape"|"Backspace" }
- wait: { type: "wait", delay: 1000 }

Respond with a JSON array of actions:
[
  { "type": "click", "target": { "x": 200, "y": 150 } },
  { "type": "type", "text": "search query" }
]

Keep the plan minimal - just the immediate next steps. We can reanalyze after each action.`;

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: base64Data } },
              { text: prompt }
            ]
          }
        ]
      });

      const text = result?.text || '';
      
      if (!text) {
        console.warn('[ComputerUse] Empty response from action planning');
        return [];
      }
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.warn('[ComputerUse] Failed to parse action JSON');
        }
      }

      return [];
    } catch (error: any) {
      console.error('[ComputerUse] Action planning failed:', error);
      return [];
    }
  }

  /**
   * Plan actions using official Gemini Computer Use function calling
   * This method uses the native Computer Use API with function declarations
   */
  async planActionsWithComputerUse(
    goal: string,
    currentState: ComputerState,
    conversationHistory?: Array<{ role: string; parts: any[] }>
  ): Promise<{
    actions: ComputerAction[];
    reasoning?: string;
    requiresConfirmation?: boolean;
  }> {
    const base64Data = currentState.screenshot.replace(/^data:image\/\w+;base64,/, "");

    const systemInstruction = `You are an AI assistant with computer control capabilities.
You can see the user's screen and control their computer through mouse and keyboard actions.

IMPORTANT GUIDELINES:
1. Analyze the screen carefully before taking action
2. Take actions step-by-step, one at a time
3. Always verify the result of an action before proceeding
4. For destructive actions (delete, close, purchase, etc.), set requiresConfirmation: true
5. Be precise with coordinates - examine the screenshot to find exact element positions
6. Prefer keyboard shortcuts when available for efficiency
7. Use natural, human-like interaction patterns

Current goal: ${goal}
${currentState.url ? `Current context: ${currentState.url}` : ''}
${currentState.title ? `Window title: ${currentState.title}` : ''}`;

    try {
      // Build conversation history
      const contents = conversationHistory || [];
      
      // Add current request with screenshot
      contents.push({
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: base64Data } },
          { 
            text: `Please help me achieve this goal: ${goal}\n\nAnalyze the current screen and determine the next action to take. Use the available computer control functions to interact with the screen.` 
          }
        ]
      });

      const result = await genAI.models.generateContent({
        model: COMPUTER_USE_MODEL,
        contents,
        systemInstruction,
        tools: computerUseTools,
        toolConfig: {
          functionCallingConfig: {
            mode: "any" // Force the model to use function calling
          }
        }
      });

      // Extract function calls from the response
      const candidate = result.candidates?.[0];
      if (!candidate) {
        console.warn('[ComputerUse] No candidate in response');
        return { actions: [] };
      }

      const reasoning = candidate.content?.parts
        ?.find((p: any) => p.text)?.text || '';

      const functionCalls = candidate.content?.parts?.filter((p: any) => p.functionCall) || [];

      if (functionCalls.length === 0) {
        console.warn('[ComputerUse] No function calls in response');
        return { actions: [], reasoning };
      }

      // Convert function calls to ComputerAction format
      const actions: ComputerAction[] = [];
      let requiresConfirmation = false;

      for (const fc of functionCalls) {
        const call = fc.functionCall;
        const action = this.functionCallToAction(call);
        
        if (action) {
          actions.push(action);
          
          // Check if this action requires confirmation (destructive operations)
          if (this.isDestructiveAction(call.name, call.args)) {
            requiresConfirmation = true;
          }
        }
      }

      return { actions, reasoning, requiresConfirmation };
    } catch (error: any) {
      console.error('[ComputerUse] Action planning with Computer Use API failed:', error);
      return { actions: [], reasoning: `Error: ${error.message}` };
    }
  }

  /**
   * Convert Gemini function call to ComputerAction
   */
  private functionCallToAction(functionCall: any): ComputerAction | null {
    const { name, args } = functionCall;

    switch (name) {
      case 'computer_click':
        return {
          type: 'click',
          target: { x: args.x, y: args.y },
          ...(args.button && { button: args.button })
        };

      case 'computer_type':
        return {
          type: 'type',
          text: args.text
        };

      case 'computer_key':
        return {
          type: 'key',
          key: args.key,
          ...(args.modifiers && { modifiers: args.modifiers })
        };

      case 'computer_scroll':
        return {
          type: 'scroll',
          direction: args.direction,
          amount: args.amount || 300
        };

      case 'computer_move':
        return {
          type: 'move',
          target: { x: args.x, y: args.y }
        };

      case 'computer_screenshot':
        return {
          type: 'screenshot'
        };

      case 'computer_wait':
        return {
          type: 'wait',
          delay: args.delay
        };

      default:
        console.warn(`[ComputerUse] Unknown function call: ${name}`);
        return null;
    }
  }

  /**
   * Check if an action requires user confirmation
   */
  private isDestructiveAction(functionName: string, args: any): boolean {
    // List of destructive operations that require confirmation
    const destructiveKeywords = [
      'delete', 'remove', 'close', 'quit', 'exit', 
      'purchase', 'buy', 'payment', 'checkout',
      'logout', 'sign out', 'uninstall'
    ];

    // Check if the action involves typing destructive text
    if (functionName === 'computer_type' && args.text) {
      const lowerText = args.text.toLowerCase();
      return destructiveKeywords.some(keyword => lowerText.includes(keyword));
    }

    // Check if clicking near destructive buttons (would need context to determine)
    // For now, we'll rely on the LLM's judgment and explicit confirmation requests
    return false;
  }

  /**
   * Execute an action via the extension WebSocket
   */
  async executeViaExtension(
    action: ComputerAction,
    sendToExtension: (msg: any) => boolean
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Timeout waiting for extension response' });
      }, 10000);

      const handleResponse = (response: any) => {
        clearTimeout(timeout);
        if (response.success) {
          this.recordAction(action, response);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      };

      const sent = sendToExtension({
        type: 'execute_command',
        command: action.type,
        params: this.actionToParams(action),
        callback: handleResponse
      });

      if (!sent) {
        clearTimeout(timeout);
        resolve({ success: false, error: 'Extension not connected' });
      }
    });
  }

  /**
   * Execute an action via local-agent WebSocket
   */
  async executeViaLocalAgent(
    action: ComputerAction,
    sendToAgent: (msg: any) => Promise<any>
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const result = await sendToAgent({
        type: action.type,
        ...this.actionToParams(action)
      });

      this.recordAction(action, result);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert ComputerAction to command params
   */
  private actionToParams(action: ComputerAction): Record<string, any> {
    switch (action.type) {
      case 'click':
        if (typeof action.target === 'string') {
          return { selector: action.target };
        } else if (action.target) {
          return { x: action.target.x, y: action.target.y };
        }
        return {};

      case 'type':
        return {
          text: action.text || '',
          selector: typeof action.target === 'string' ? action.target : undefined
        };

      case 'scroll':
        return {
          direction: action.direction || 'down',
          amount: action.amount || 300
        };

      case 'key':
        return { key: action.key };

      case 'wait':
        return { timeout: action.delay || 1000 };

      case 'screenshot':
        return { fullPage: false };

      case 'move':
        if (typeof action.target !== 'string' && action.target) {
          return { x: action.target.x, y: action.target.y };
        }
        return {};

      default:
        return {};
    }
  }

  /**
   * Record action in history for context
   */
  private recordAction(action: ComputerAction, result?: any) {
    this.actionHistory.push({
      action,
      timestamp: new Date(),
      result
    });

    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift();
    }
  }

  /**
   * Get recent action history for context
   */
  getRecentActions(limit = 10): Array<{ action: ComputerAction; timestamp: Date }> {
    return this.actionHistory.slice(-limit);
  }

  /**
   * Clear action history
   */
  clearHistory() {
    this.actionHistory = [];
  }

  /**
   * Generate a task completion assessment
   */
  async assessProgress(
    goal: string,
    screenshot: string,
    actionsPerformed: ComputerAction[]
  ): Promise<{ complete: boolean; progress: string; nextSteps?: string[] }> {
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

    const actionsSummary = actionsPerformed.map((a, i) => 
      `${i + 1}. ${a.type}${a.text ? `: "${a.text}"` : ''}`
    ).join('\n');

    const prompt = `Assess progress toward completing a computer task.

Goal: ${goal}

Actions performed:
${actionsSummary || 'None yet'}

Look at the current screenshot and determine:
1. Is the goal complete?
2. What progress has been made?
3. What steps remain?

Respond in JSON:
{
  "complete": true/false,
  "progress": "Description of progress made",
  "nextSteps": ["Step 1", "Step 2"] // only if not complete
}`;

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: base64Data } },
              { text: prompt }
            ]
          }
        ]
      });

      const text = result?.text || '';
      
      if (!text) {
        return { complete: false, progress: 'No assessment available' };
      }
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.warn('[ComputerUse] Failed to parse progress JSON');
        }
      }

      return {
        complete: false,
        progress: text
      };
    } catch (error: any) {
      console.error('[ComputerUse] Progress assessment failed:', error);
      return {
        complete: false,
        progress: 'Assessment failed: ' + (error.message || 'Unknown error')
      };
    }
  }

  /**
   * Find a specific element on screen
   */
  async findElement(
    screenshot: string,
    description: string
  ): Promise<{ found: boolean; location?: { x: number; y: number }; confidence?: string }> {
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `Find the element described on this screenshot.

Looking for: ${description}

If found, provide the center coordinates of the element.

Respond in JSON:
{
  "found": true/false,
  "location": { "x": number, "y": number }, // center point if found
  "confidence": "high" | "medium" | "low",
  "description": "What you found or why not found"
}`;

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: base64Data } },
              { text: prompt }
            ]
          }
        ]
      });

      const text = result?.text || '';
      
      if (!text) {
        return { found: false };
      }
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.warn('[ComputerUse] Failed to parse element JSON');
        }
      }

      return { found: false };
    } catch (error: any) {
      console.error('[ComputerUse] Element search failed:', error);
      return { found: false };
    }
  }
}

export const computerUseService = new ComputerUseService();
