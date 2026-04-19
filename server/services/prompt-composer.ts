
/**
 * =============================================================================
 * MEOWSTIC CHAT - PROMPT COMPOSER SERVICE
 * =============================================================================
 *
 * Assembles multimodal prompts from user input, attachments, and context
 * into a structured request for the LLM.
 *
 * RESPONSIBILITY:
 * ---------------
 * Takes raw user input (text, files, screenshots, voice transcripts) and
 * composes a complete prompt object ready for LLM processing.
 *
 * PROMPT ARCHITECTURE:
 * -------------------
 * The system prompt is loaded from separate modular files:
 * - prompts/core-directives.md - Fundamental behavior rules
 * - prompts/personality.md - Character and communication style
 * - prompts/tools.md - Tool definitions and implementation
 * - logs/Short_Term_Memory.md - Persistent user-defined memory
 * - logs/cache.md - Thoughts forward from last turn (auto-loaded)
 * - logs/STM_APPEND.md - Append content (auto-processed and deleted)
 *
 * INPUT SOURCES:
 * - User typed text
 * - Voice-to-text transcriptions
 * - File attachments (documents, images)
 * - Screenshots captured via screen capture
 * - Conversation history for context
 *
 * OUTPUT:
 * - Structured prompt object with all content normalized
 * - System instructions based on context
 * - File content extracted and included
 * =============================================================================
 */

import { storage } from "../storage";
import { mcpService } from "./mcp-service";
import type { Draft, Attachment, Message } from "@shared/schema";
import { DEFAULT_AGENT_NAME, DEFAULT_DISPLAY_NAME } from "@shared/schema";
import { tavilySearch } from "../integrations/tavily";
import { formatEnvironmentMetadata } from "../utils/environment-metadata";
import { getFamilyContext } from "./family-recognition";
import * as fs from "fs";
import * as path from "path";

/**
 * Composed prompt structure ready for LLM processing
 */
export interface ComposedPrompt {
  systemPrompt: string;
  userMessage: string;
  attachments: ComposedAttachment[];
  conversationHistory: ConversationTurn[];
  metadata: PromptMetadata;
}

/**
 * Processed attachment for inclusion in prompt
 */
export interface ComposedAttachment {
  type: "file" | "screenshot" | "voice_transcript";
  filename: string;
  mimeType?: string;
  content: string;
  isBase64: boolean;
}

/**
 * Conversation turn for history context
 */
export interface ConversationTurn {
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

/**
 * Metadata about the composed prompt
 */
export interface PromptMetadata {
  chatId: string;
  draftId?: string;
  hasVoiceInput: boolean;
  hasFileAttachments: boolean;
  hasScreenshots: boolean;
  composedAt: Date;
}

/**
 * PromptComposer
 *
 * Service for assembling complete prompts from various input sources.
 * Handles normalization, extraction, and structuring of multimodal content.
 *
 * Loads system prompt components from modular files in the prompts/ directory.
 */
export class PromptComposer {
  private coreDirectives: string = "";
  private personality: string = "";
  private tools: string = "";
  private shortTermMemory: string = "";
  private cache: string = "";
  private todoList: string = "";
  private executionLog: string = "";
  private promptsLoaded: boolean = false;

  constructor() {
    this.loadPrompts();
  }

  /**
   * Load prompt components from files
   * Called lazily on first compose() call
   */
  private loadPrompts(): void {
    if (this.promptsLoaded) return;

    const promptsDir = path.join(process.cwd(), "prompts");

    try {
      this.coreDirectives = fs.readFileSync(
        path.join(promptsDir, "core-directives.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load core-directives.md, using fallback");
      this.coreDirectives = this.getFallbackCoreDirectives();
    }

    try {
      this.personality = fs.readFileSync(
        path.join(promptsDir, "personality.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load personality.md, using fallback");
      this.personality = this.getFallbackPersonality();
    }

    try {
      this.tools = fs.readFileSync(
        path.join(promptsDir, "tools.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load tools.md, using fallback");
      this.tools = this.getFallbackTools();
    }

    this.promptsLoaded = true;
  }

  private refreshDynamicContext(): void {
    const logsDir = path.join(process.cwd(), "logs");

    this.processSTMAppend(logsDir);

    try {
      this.shortTermMemory = fs.readFileSync(
        path.join(logsDir, "Short_Term_Memory.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load logs/Short_Term_Memory.md. This is expected if the file hasn't been created yet.");
      this.shortTermMemory = "# Short-Term Memory\n\n*(No instructions)*";
    }

    try {
      this.cache = fs.readFileSync(
        path.join(logsDir, "cache.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load logs/cache.md. This is expected for the first turn.");
      this.cache = "";
    }

    try {
      this.todoList = fs.readFileSync(
        path.join(logsDir, "todo.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load logs/todo.md. This is expected if no to-dos exist yet.");
      this.todoList = "";
    }

    try {
      const logPath = path.join(logsDir, "execution_log.md");
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, "utf-8");
        const lines = content.split("\n").filter(l => l.trim());
        const lastLines = lines.slice(-20);
        this.executionLog = lastLines.join("\n");
      } else {
        this.executionLog = "";
      }
    } catch (error) {
      console.warn("Could not load execution_log.md", error);
      this.executionLog = "";
    }
  }

  /**
   * Load to-do list from database for a specific user
   * This is called dynamically when composing prompts
   * @param userId - The user ID to load todos for
   */
  private async loadTodoList(userId: string): Promise<string> {
    try {
      const todos = await storage.getPendingTodoItems(userId);
      
      if (todos.length === 0) {
        return "";
      }

      let content = "# 📋 Master To-Do List\n\n";
      content += "*These are your active tasks. Consider them when planning your actions.*\n\n";
      
      // Group by status
      const pending = todos.filter(t => t.status === 'pending');
      const inProgress = todos.filter(t => t.status === 'in_progress');
      const blocked = todos.filter(t => t.status === 'blocked');
      
      if (inProgress.length > 0) {
        content += "## 🚧 In Progress\n\n";
        for (const todo of inProgress) {
          content += this.formatTodoItem(todo);
        }
        content += "\n";
      }
      
      if (pending.length > 0) {
        content += "## ⏳ Pending\n\n";
        for (const todo of pending) {
          content += this.formatTodoItem(todo);
        }
        content += "\n";
      }
      
      if (blocked.length > 0) {
        content += "## 🚫 Blocked\n\n";
        for (const todo of blocked) {
          content += this.formatTodoItem(todo);
        }
      }
      
      return content;
    } catch (error) {
      console.error("[PromptComposer] Error loading to-do list:", error);
      return "";
    }
  }

  /**
   * Format a single to-do item for the prompt
   */
  private formatTodoItem(todo: any): string {
    let line = `- **${todo.title}**`;
    
    if (todo.priority > 0) {
      line += ` *(Priority: ${todo.priority})*`;
    }
    
    if (todo.category) {
      line += ` [${todo.category}]`;
    }
    
    line += "\n";
    
    if (todo.description) {
      line += `  > ${todo.description}\n`;
    }
    
    return line + "\n";
  }

  /**
   * Process STM_APPEND.md - append its contents to Short_Term_Memory.md and delete it
   */
  private processSTMAppend(logsDir: string): void {
    const stmAppendPath = path.join(logsDir, "STM_APPEND.md");
    const stmPath = path.join(logsDir, "Short_Term_Memory.md");
    
    try {
      // Check if STM_APPEND.md exists
      if (!fs.existsSync(stmAppendPath)) {
        return; // Nothing to process
      }

      const appendContent = fs.readFileSync(stmAppendPath, "utf-8");
      
      if (appendContent.trim()) {
        // Read existing Short_Term_Memory.md or create default
        let existingContent = "# Short-Term Memory\n";
        try {
          existingContent = fs.readFileSync(stmPath, "utf-8");
        } catch (e) {
          // File doesn't exist, use default
        }

        // Append content with timestamp
        const timestamp = new Date().toISOString();
        const newContent = `${existingContent}\n\n---\n**${timestamp}**\n${appendContent}`;
        
        // Write back to Short_Term_Memory.md
        fs.writeFileSync(stmPath, newContent, "utf-8");
        console.log("[PromptComposer] Appended STM_APPEND.md to Short_Term_Memory.md");
      }

      // Delete STM_APPEND.md after processing
      fs.unlinkSync(stmAppendPath);
      console.log("[PromptComposer] Deleted STM_APPEND.md after processing");

    } catch (error) {
      console.warn("[PromptComposer] Error processing STM_APPEND.md:", error);
    }
  }
  
  private getFinalInstructions(): string {
    return `
# FINAL INSTRUCTIONS (NON-NEGOTIABLE)

Before you call 'end_turn' to end your turn, you MUST perform the following actions:

1.  **Update Thoughts Forward Cache (<thoughts_forward>)**:
    *   **Action**: Use the \`put\` tool to write \`logs/cache.md\`
    *   **Content**: Your internal monologue, analysis of the current situation, and plan for future turns. This file is automatically loaded into your context on the next turn.
    *   **Schema**:
        \`\`\`markdown
        ### Thought & Cache
        **Reflection**: Brief analysis of this turn's performance and user intent.
        **Next Step**: Primary goal for the next interaction.
        **Anticipated Needs**: Information or tools you might need next.
        **Speak While Thinking**:
        - 1 to 3 very short, context-aware lines to speak at the start of the next turn while the new response is still generating
        - keep them natural, playful, and interruptible
        - do not reveal private reasoning or hidden chain-of-thought
        \`\`\`

2.  **Append Execution Log & Personal Log (Optional)**:
    *   **Action**: Use the \`append\` tool with \`name: "personal"\` to log personal reflections or user preferences to your permanent diary.
    *   **Note**: Your tool executions are now *automatically* logged to \`execution_log.md\`. You do NOT need to manually log tool calls anymore.

3.  **Update Short-Term Memory (Optional)**:
    *   **Action**: Use the \`put\` tool to write \`logs/STM_APPEND.md\` when you need to remember something important across sessions.
    *   **Content**: Important facts, user preferences, or ongoing task state that should persist.
    *   **Note**: This content will be automatically appended to \`Short_Term_Memory.md\` on the next turn.

These steps are mandatory before sending your response via end_turn.
`;
  }

  /**
   * Assembles and returns the complete system prompt.
   */
  /**
   * Apply custom branding to text by replacing default agent names
   * @param text - Text to apply branding to
   * @param agentName - Custom agent name
   * @returns Text with branding applied
   */
  private applyBrandingToText(text: string, agentName: string): string {
    return text
      .replace(/Meowstic/g, agentName)
      .replace(/Meowstik/gi, agentName);
  }

  /**
   * Generate system prompt with custom branding
   * @param agentName - Custom agent name (defaults to "Meowstik")
   * @param displayName - Custom display name (defaults to "Meowstik AI")
   * @param options - Optional configuration for memory and content inclusion
   * @param options.userId - User ID to load to-do list for
   * @param options.includeMemory - Include Short_Term_Memory.md (default: true)
   * @param options.includeCache - Include cache.md from last turn (default: true)
   * @param options.includeTodos - Include to-do list (default: true)
   * @param options.memoryMaxLines - Maximum lines from memory to include (default: 100)
   * @param options.forceReload - Force reload of memory files from disk (default: false)
   */
  public async getSystemPrompt(
    agentName: string = DEFAULT_AGENT_NAME, 
    displayName: string = DEFAULT_DISPLAY_NAME,
    options?: {
      userId?: string;
      includeMemory?: boolean;
      includeCache?: boolean;
      includeTodos?: boolean;
      memoryMaxLines?: number;
      forceReload?: boolean;
    }
  ): Promise<string> {
    // Default options
    const userId = options?.userId;
    const includeMemory = options?.includeMemory !== false; // Default true
    const includeCache = options?.includeCache !== false; // Default true
    const includeTodos = options?.includeTodos !== false; // Default true
    const memoryMaxLines = options?.memoryMaxLines || 100; // Default 100 lines
    const forceReload = options?.forceReload || false;

    // Only reload prompts if forced or not loaded yet
    // This prevents disk I/O on every request
    if (forceReload || !this.promptsLoaded) {
      this.promptsLoaded = false;
      this.loadPrompts();
    }

    this.refreshDynamicContext();

    // Inject branding into core directives and personality
    const brandedCoreDirectives = this.applyBrandingToText(this.coreDirectives, agentName);
    const brandedPersonality = this.applyBrandingToText(this.personality, agentName);

    const components: string[] = [
      `# Agent Identity\nYou are ${displayName}, referred to as ${agentName}.\n`,
      formatEnvironmentMetadata(), // Add environment metadata
      brandedCoreDirectives,
      brandedPersonality,
      this.tools,
    ];

    // Conditionally include Short_Term_Memory with truncation
    if (includeMemory && this.shortTermMemory.trim()) {
      const memoryLines = this.shortTermMemory.split('\n');
      let truncatedMemory = this.shortTermMemory;
      
      if (memoryLines.length > memoryMaxLines) {
        // Keep header and last N lines
        const header = memoryLines.slice(0, 2).join('\n'); // Keep "# Short-Term Memory" header
        const recentLines = memoryLines.slice(-memoryMaxLines).join('\n');
        truncatedMemory = `${header}\n\n[... truncated ${memoryLines.length - memoryMaxLines} older lines ...]\n\n${recentLines}`;
        console.log(`[PromptComposer] Truncated Short_Term_Memory from ${memoryLines.length} to ${memoryMaxLines} lines`);
      }
      
      components.push(truncatedMemory);
    }

    // Conditionally include Execution Log (Objective Truth)
    if (this.executionLog && this.executionLog.trim()) {
      components.push(`# Recent Execution History (Objective Truth)\n| Timestamp | Tool | Args | Result |\n|---|---|---|---|\n${this.executionLog}`);
    }

    // Conditionally include to-do list
    if (includeTodos && userId) {
      const todoContent = await this.loadTodoList(userId);
      if (todoContent.trim()) {
        components.push(todoContent);
      }
    }

    // Include family member context if recognized
    const familyContext = getFamilyContext();
    if (familyContext.trim()) {
      components.push(familyContext);
    }

    // Conditionally include cache from last turn
    if (includeCache && this.cache.trim()) {
      components.push(`# Thoughts Forward (from last turn)\n\n${this.cache}`);
    }

    // Append mandatory final instructions
    components.push(this.getFinalInstructions());

    return components.join("\n\n---\n\n");
  }

  public getForwardThoughtSpeechPlan(options?: { forceReload?: boolean }): {
    lines: string[];
    rawCache: string;
  } {
    if (options?.forceReload || !this.promptsLoaded) {
      this.promptsLoaded = false;
      this.loadPrompts();
    }

    this.refreshDynamicContext();

    return {
      lines: this.extractSpeakWhileThinkingLines(this.cache),
      rawCache: this.cache,
    };
  }

  private extractSpeakWhileThinkingLines(cacheContent: string): string[] {
    if (!cacheContent.trim()) {
      return [];
    }

    const sectionMatch = cacheContent.match(
      /\*\*Speak While Thinking\*\*:\s*([\s\S]*?)(?:\n\*\*|$)/
    );

    if (!sectionMatch) {
      return [];
    }

    return sectionMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.replace(/^- /, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  /**
   * Alias for getSystemPrompt to support the usage in routes.ts
   * @param options - Configuration for content inclusion
   */
  public async buildSystemPrompt(options?: {
    userId?: string;
    includeMemory?: boolean;
    includeCache?: boolean;
    includeTodos?: boolean;
  }): Promise<string> {
    return this.getSystemPrompt(DEFAULT_AGENT_NAME, DEFAULT_DISPLAY_NAME, options);
  }

  /**
   * Get breakdown of system prompt components with sizes
   * Useful for debugging and token analysis
   * @param agentName - Custom agent name
   * @param displayName - Custom display name
   * @returns Object with each component and its size
   */
  public getSystemPromptBreakdown(
    agentName: string = DEFAULT_AGENT_NAME,
    displayName: string = DEFAULT_DISPLAY_NAME
  ): {
    components: Array<{ name: string; content: string; charCount: number; lineCount: number }>;
    totalChars: number;
    totalLines: number;
    estimatedTokens: number;
  } {
    // Force reload to get latest state
    this.promptsLoaded = false;
    this.loadPrompts();

    const brandedCoreDirectives = this.applyBrandingToText(this.coreDirectives, agentName);
    const brandedPersonality = this.applyBrandingToText(this.personality, agentName);
    
    const identity = `# Agent Identity\nYou are ${displayName}, referred to as ${agentName}.\n`;
    const envMetadata = formatEnvironmentMetadata();
    const finalInstructions = this.getFinalInstructions();

    const components = [
      { name: "Agent Identity", content: identity },
      { name: "Environment Metadata", content: envMetadata },
      { name: "Core Directives", content: brandedCoreDirectives },
      { name: "Personality", content: brandedPersonality },
      { name: "Tools", content: this.tools },
      { name: "Short-Term Memory", content: this.shortTermMemory || "(empty)" },
      { name: "Cache (Last Turn)", content: this.cache || "(empty)" },
      { name: "Final Instructions", content: finalInstructions },
    ];

    const breakdown = components.map(comp => ({
      name: comp.name,
      content: comp.content,
      charCount: comp.content.length,
      lineCount: comp.content.split('\n').length,
    }));

    const totalChars = breakdown.reduce((sum, c) => sum + c.charCount, 0);
    const totalLines = breakdown.reduce((sum, c) => sum + c.lineCount, 0);
    
    // Rough token estimation: ~4 characters per token for English text
    const estimatedTokens = Math.ceil(totalChars / 4);

    return {
      components: breakdown,
      totalChars,
      totalLines,
      estimatedTokens,
    };
  }


  /**
   * Fallback core directives if file is not found
   */
  private getFallbackCoreDirectives(): string {
    return `# Core Directives

You are Meowstic, an advanced AI assistant. You must:
1. Provide accurate, helpful responses
2. Process multimodal inputs (text, images, documents)
3. Communicate clearly and naturally

Always respond in natural conversational language. Be helpful, concise, and informative.`;
  }

  /**
   * Fallback personality if file is not found
   */
  private getFallbackPersonality(): string {
    return `# Personality

Be professional, helpful, and precise. Communicate clearly and provide actionable responses.`;
  }

  /**
   * Fallback tools if file is not found
   */
  private getFallbackTools(): string {
    return `# Capabilities

You can analyze data, read and write files, search the web, and interact with Google Workspace.`;
  }

  /**
   * Determines if attachment content should be treated as base64-encoded.
   * Binary content types (images, audio, video, PDFs) are base64-encoded.
   * 
   * @param mimeType - MIME type of the attachment
   * @returns true if content is base64-encoded, false otherwise
   * 
   * @note This covers common binary types. Text-based types (text/*, application/json, etc.)
   *       are assumed to be plain text. Extend as needed for other binary types.
   */
  private isBase64Content(mimeType: string | undefined | null): boolean {
    if (!mimeType) return false;
    return (
      mimeType.startsWith("image/") ||
      mimeType.startsWith("audio/") ||
      mimeType.startsWith("video/") ||
      mimeType === "application/pdf" ||
      mimeType === "application/octet-stream"
    );
  }

  /**
   * The primary composition method.
   * Composes a complete prompt with system instructions and conversation history.
   * 
   * @param options - Composition options
   * @param options.textContent - User's text input
   * @param options.voiceTranscript - Optional voice transcript
   * @param options.attachments - Optional array of file/screenshot attachments
   * @param options.history - Optional array of previous messages for context
   * @param options.chatId - Chat identifier
   * @param options.userId - User identifier for data isolation
   * @returns Complete composed prompt ready for LLM processing
   * 
   * @note This method signature replaces the previous `compose(draft: Draft, history: Message[])`.
   *       The new signature better matches the actual usage in routes.ts.
   */
  public async compose(options: {
    textContent: string;
    voiceTranscript?: string;
    attachments?: Attachment[];
    history?: Message[];
    chatId: string;
    userId?: string;
  }): Promise<ComposedPrompt> {
    // Fetch user branding if userId is provided
    let agentName = DEFAULT_AGENT_NAME;
    let displayName = DEFAULT_DISPLAY_NAME;
    
    if (options.userId) {
      try {
        const branding = await storage.getUserBrandingOrDefault(options.userId);
        agentName = branding.agentName;
        displayName = branding.displayName;
      } catch (error) {
        console.warn("Failed to fetch user branding, using defaults:", error);
      }
    }

    // Build base system prompt from modular files with custom branding
    let systemPrompt = await this.getSystemPrompt(agentName, displayName, { userId: options.userId });

    if (options.userId) {
      try {
        const mcpSummary = await mcpService.buildPromptSummary(options.userId);
        if (mcpSummary) {
          systemPrompt += `\n\n${mcpSummary}`;
        }
      } catch (error) {
        console.warn("Failed to build MCP prompt summary:", error);
      }
    }

    // Process attachments into composed format
    const composedAttachments: ComposedAttachment[] = [];
    let hasScreenshots = false;
    let hasFileAttachments = false;

    if (options.attachments && options.attachments.length > 0) {
      for (const att of options.attachments) {
        if (att.type === "screenshot") {
          hasScreenshots = true;
        } else if (att.type === "file") {
          hasFileAttachments = true;
        }

        composedAttachments.push({
          type: att.type as "file" | "screenshot" | "voice_transcript",
          filename: att.filename,
          mimeType: att.mimeType || undefined,
          content: att.content || "",
          isBase64: this.isBase64Content(att.mimeType),
        });
      }
    }

    // Build conversation history in the expected format
    const conversationHistory: ConversationTurn[] = [];
    if (options.history && options.history.length > 0) {
      for (const msg of options.history) {
        conversationHistory.push({
          role: msg.role === "user" ? "user" : "ai",
          content: msg.content,
          timestamp: msg.createdAt,
        });
      }
    }

    // Determine user message (text or voice transcript)
    const userMessage = options.textContent || options.voiceTranscript || "";
    const hasVoiceInput = !!options.voiceTranscript;

    return {
      systemPrompt,
      userMessage,
      attachments: composedAttachments,
      conversationHistory,
      metadata: {
        chatId: options.chatId,
        hasVoiceInput,
        hasFileAttachments,
        hasScreenshots,
        composedAt: new Date(),
      },
    };
  }
}

export const promptComposer = new PromptComposer();

