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
 * - w/short-term-memory.md - User-defined, dynamic instructions
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
    const workspaceDir = path.join(process.cwd()); // Assuming workspace is root

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

    try {
      this.shortTermMemory = fs.readFileSync(
        path.join(workspaceDir, "w", "short-term-memory.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load w/short-term-memory.md. This is expected if the file hasn't been created yet.");
      this.shortTermMemory = "# Short-Term Memory\n\n*(No instructions)*";
    }


    this.promptsLoaded = true;
  }
  
  private getFinalInstructions(): string {
    return `
# FINAL INSTRUCTIONS (NON-NEGOTIABLE)

Before you call 'send_chat' to end your turn, you MUST perform the following two actions in this specific order:

1.  **Create Execution Log (\`log-append.md\`)**:
    *   **Action**: Create a markdown file named \`log-append.md\` in the \`w/\` directory.
    *   **Content**: The file must contain a log of the tools you executed in this turn. Include the tool name, parameters, and a brief summary of the result. This is for auditing and recall.
    *   **Schema**:
        \`\`\`markdown
        ### Turn Execution Log

        - **Tool**: \`tool_name\`
        - **Parameters**: \`{...}\`
        - **Result**: "Summary of what happened."

        - **Tool**: \`another_tool\`
        - **Parameters**: \`{...}\`
        - **Result**: "Summary..."
        \`\`\`

2.  **Create Thoughts Forward Cache (\`cache.md\`)**:
    *   **Action**: Create a markdown file named \`cache.md\` in the \`w/\` directory.
    *   **Content**: This file is your internal monologue and plan for the future. Reflect on the user's request, your actions, and what you anticipate needing in the *next* turn. This is your "thoughts forward" file to maintain context across interactions.
    *   **Schema**:
        \`\`\`markdown
        ### Thought & Cache

        **Reflection**: A brief analysis of my performance and the user's intent in this turn.
        **Next Step**: My primary goal for the next interaction with the user.
        **Anticipated Needs**: What information or tools I might need next.
        \`\`\`

These two file creation steps are mandatory before sending your response.
`;
  }

  /**
   * Assembles and returns the complete system prompt.
   */
  public getSystemPrompt(): string {
    // Reload prompts every time to catch dynamic changes to the memory file
    this.loadPrompts();

    const finalSystemPrompt = [
      this.coreDirectives,
      this.personality,
      this.tools,
      this.shortTermMemory, // Append our dynamic short-term memory
      this.getFinalInstructions() // Append the mandatory final instructions
    ].join("\\n\\n---\\n\\n");

    return finalSystemPrompt;
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
   * (This is a placeholder for the full implementation that would use the system prompt)
   */
  public async compose(draft: Draft, history: Message[]): Promise<ComposedPrompt> {
    const systemPrompt = this.getSystemPrompt();

    // ... rest of the compose logic would go here ...
    
    return {
      systemPrompt,
      userMessage: draft.content,
      attachments: [], // Placeholder
      conversationHistory: [], // Placeholder
      metadata: {
        chatId: draft.chatId,
        hasVoiceInput: false,
        hasFileAttachments: false,
        hasScreenshots: false,
        composedAt: new Date(),
      },
    };
  }
}

export const promptComposer = new PromptComposer();
