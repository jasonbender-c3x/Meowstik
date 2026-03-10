/**
 * LLM Debug Buffer
 * 
 * Stores recent LLM interactions (prompts and responses) for debugging purposes.
 * Keeps the last N interactions in memory for quick access from the debug console.
 * 
 * ENHANCED: Now supports optional persistence to database for historical analysis.
 */

export interface LLMInteraction {
  id: string;
  timestamp: string;
  chatId: string;
  messageId: string;
  userId?: string | null;
  
  // Input
  systemPrompt: string;
  systemPromptBreakdown?: {
    components: Array<{
      name: string;
      charCount: number;
      lineCount: number;
      tokenEstimate: number;
    }>;
    totalChars: number;
    totalLines: number;
    estimatedTokens: number;
  };
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  attachments: Array<{ type: string; filename?: string; mimeType?: string; content?: string; size?: number }>;
  
  // RAG Context
  ragContext?: Array<{ source: string; content: string; score?: number; metadata?: Record<string, unknown> }>;
  injectedFiles?: Array<{ filename: string; content: string; mimeType?: string }>;
  injectedJson?: Array<{ name: string; data: unknown }>;
  
  // Output
  rawResponse: string;
  parsedToolCalls: unknown[];
  cleanContent: string;
  toolResults: Array<{ toolId: string; type: string; success: boolean; result?: unknown; error?: string }>;
  
  // Metadata
  model: string;
  durationMs: number;
  tokenEstimate?: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
  status?: string;
  
  // IO Log Files
  ioLogFiles?: {
    inputLog: string;   // Filename of input log
    outputLog: string;  // Filename of output log
  };
}

class LLMDebugBuffer {
  private interactions: LLMInteraction[] = [];
  private maxSize = 10; // Keep latest 10 for debugging
  private counter = 0;
  private persistToDb = true; // Enable database persistence by default

  /**
   * Add a new LLM interaction to the buffer
   * 
   * @param interaction - The interaction data to store
   * @param persist - Whether to persist to database (default: true)
   * @returns The generated ID for this interaction
   */
  async add(interaction: Omit<LLMInteraction, 'id' | 'timestamp'>, persist = this.persistToDb): Promise<string> {
    this.counter++;
    const id = `llm-${Date.now()}-${this.counter}`;
    
    const entry: LLMInteraction = {
      ...interaction,
      id,
      timestamp: new Date().toISOString(),
      status: interaction.status || 'success',
    };

    // Add to in-memory buffer
    this.interactions.unshift(entry);
    if (this.interactions.length > this.maxSize) {
      this.interactions.pop();
    }

    // Optionally persist to database
    if (persist) {
      try {
        await this.persistInteraction(entry);
      } catch (error) {
        console.error('[LLMDebugBuffer] Failed to persist interaction to database:', error);
        // Don't throw - we still want the in-memory buffer to work
      }
    }

    return id;
  }

  /**
   * Persist an interaction to the database
   * @private
   */
  private async persistInteraction(interaction: LLMInteraction): Promise<void> {
    try {
      // Lazy import to avoid circular dependencies
      const { storage } = await import('../storage');
      
      // Remove content field from attachments to save space
      const sanitizedAttachments = interaction.attachments?.map(att => ({
        type: att.type,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
      }));

      await storage.saveLlmInteraction({
        chatId: interaction.chatId,
        messageId: interaction.messageId,
        userId: interaction.userId || null,
        systemPrompt: interaction.systemPrompt,
        userMessage: interaction.userMessage,
        conversationHistory: interaction.conversationHistory,
        attachments: sanitizedAttachments,
        ragContext: interaction.ragContext,
        injectedFiles: interaction.injectedFiles,
        injectedJson: interaction.injectedJson,
        rawResponse: interaction.rawResponse,
        cleanContent: interaction.cleanContent,
        parsedToolCalls: interaction.parsedToolCalls,
        toolResults: interaction.toolResults,
        model: interaction.model,
        durationMs: interaction.durationMs,
        tokenEstimate: interaction.tokenEstimate,
        error: interaction.error,
        status: interaction.status || 'success',
      });
    } catch (error) {
      console.error('[LLMDebugBuffer] Database persistence error:', error);
      throw error;
    }
  }

  /**
   * Enable or disable database persistence
   */
  setPersistence(enabled: boolean): void {
    this.persistToDb = enabled;
  }

  /**
   * Check if database persistence is enabled
   */
  isPersistenceEnabled(): boolean {
    return this.persistToDb;
  }

  /**
   * Get all interactions (most recent first)
   */
  getAll(limit = 20): LLMInteraction[] {
    return this.interactions.slice(0, limit);
  }

  /**
   * Get a single interaction by ID
   */
  getById(id: string): LLMInteraction | undefined {
    return this.interactions.find(i => i.id === id);
  }

  /**
   * Clear all interactions
   */
  clear(): void {
    this.interactions = [];
  }

  /**
   * Get count of stored interactions
   */
  getCount(): number {
    return this.interactions.length;
  }

  /**
   * Get the last system prompt/instruction sent to the LLM
   */
  getLastSystemInstruction(): string | null {
    if (this.interactions.length === 0) return null;
    return this.interactions[0].systemPrompt;
  }

  /**
   * Get the last user message (prompt) sent to the LLM
   */
  getLastPrompt(): string | null {
    if (this.interactions.length === 0) return null;
    return this.interactions[0].userMessage;
  }

  /**
   * Get the last conversation history sent to the LLM
   */
  getLastMessages(): Array<{ role: string; content: string }> | null {
    if (this.interactions.length === 0) return null;
    return this.interactions[0].conversationHistory;
  }

  /**
   * Get the most recent interaction
   */
  getLastInteraction(): LLMInteraction | null {
    if (this.interactions.length === 0) return null;
    return this.interactions[0];
  }
}

export const llmDebugBuffer = new LLMDebugBuffer();
