/**
 * =============================================================================
 * NEBULA CHAT - PROMPT COMPOSER SERVICE
 * =============================================================================
 *
 * Assembles multimodal prompts from user input, attachments, and context
 * into a structured request for the RAG backend.
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
import type { Draft, Attachment, Message } from "@shared/schema";
import { ragService } from "./rag-service";
import { retrievalOrchestrator } from "./retrieval-orchestrator";
import { tavilySearch } from "../integrations/tavily";
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
    const logsDir = path.join(process.cwd(), "logs");

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

    // Process STM_APPEND.md -> append to Short_Term_Memory.md
    this.processSTMAppend(logsDir);

    // Load Short_Term_Memory.md (the main memory file)
    try {
      this.shortTermMemory = fs.readFileSync(
        path.join(logsDir, "Short_Term_Memory.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load logs/Short_Term_Memory.md. This is expected if the file hasn't been created yet.");
      this.shortTermMemory = "# Short-Term Memory\n\n*(No instructions)*";
    }

    // Load cache.md (thoughts forward from last turn)
    try {
      this.cache = fs.readFileSync(
        path.join(logsDir, "cache.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load logs/cache.md. This is expected for the first turn.");
      this.cache = "";
    }

    this.promptsLoaded = true;
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

Before you call 'send_chat' to end your turn, you MUST perform the following actions:

1.  **Append Execution Log**:
    *   **Action**: Use the \`log_append\` tool with \`name: "execution"\`
    *   **Content**: Log the tools you executed in this turn. Include tool name, parameters, and result summary.
    *   **Example**:
        \`\`\`
        log_append({ name: "execution", content: "### Turn Log\\n- **Tool**: gmail_search\\n- **Result**: Found 5 emails from Nick" })
        \`\`\`

2.  **Update Thoughts Forward Cache**:
    *   **Action**: Use the \`file_put\` tool to write \`logs/cache.md\`
    *   **Content**: Your internal monologue and plan for future turns. This file is automatically loaded into your context on the next turn.
    *   **Schema**:
        \`\`\`markdown
        ### Thought & Cache

        **Reflection**: Brief analysis of this turn's performance and user intent.
        **Next Step**: Primary goal for the next interaction.
        **Anticipated Needs**: Information or tools you might need next.
        \`\`\`

3.  **Update Short-Term Memory (Optional)**:
    *   **Action**: Use the \`file_put\` tool to write \`logs/STM_APPEND.md\` when you need to remember something important across sessions.
    *   **Content**: Important facts, user preferences, or ongoing task state that should persist.
    *   **Note**: This content will be automatically appended to \`Short_Term_Memory.md\` on the next turn.

These steps are mandatory before sending your response via send_chat.
`;
  }

  /**
   * Assembles and returns the complete system prompt.
   */
  public getSystemPrompt(): string {
    // Reload prompts every time to catch dynamic changes to memory files
    this.promptsLoaded = false;
    this.loadPrompts();

    const components: string[] = [
      this.coreDirectives,
      this.personality,
      this.tools,
      this.shortTermMemory, // Persistent user-defined memory
    ];

    // Include cache from last turn if available
    if (this.cache.trim()) {
      components.push(`# Thoughts Forward (from last turn)\n\n${this.cache}`);
    }

    // Append mandatory final instructions
    components.push(this.getFinalInstructions());

    return components.join("\n\n---\n\n");
  }


  /**
   * Fallback core directives if file is not found
   */
  private getFallbackCoreDirectives(): string {
    return `# Core Directives

You are Nebula, an advanced AI assistant. You must:
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
   * The primary composition method.
   * Composes a complete prompt with system instructions, RAG context, and conversation history.
   * 
   * @param options - Composition options including text content, attachments, history, etc.
   * @returns Complete composed prompt ready for LLM processing
   */
  public async compose(options: {
    textContent: string;
    voiceTranscript?: string;
    attachments?: Attachment[];
    history?: Message[];
    chatId: string;
    userId?: string;
  }): Promise<ComposedPrompt> {
    // Build base system prompt from modular files
    let systemPrompt = this.getSystemPrompt();

    // Enrich system prompt with RAG context if user message exists
    if (options.textContent && options.textContent.trim()) {
      try {
        // Use retrieval orchestrator to get relevant knowledge and format it
        const enrichedPrompt = await retrievalOrchestrator.enrichPrompt(
          options.textContent,
          systemPrompt
        );
        systemPrompt = enrichedPrompt;
      } catch (error) {
        console.warn("[PromptComposer] RAG enrichment failed, continuing without:", error);
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
          isBase64: att.mimeType?.startsWith("image/") || att.mimeType?.startsWith("audio/") || false,
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
