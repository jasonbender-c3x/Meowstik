/**
 * =============================================================================
 * NEBULA CHAT - DATABASE STORAGE LAYER
 * =============================================================================
 *
 * This file implements the data access layer for the Meowstik application.
 * It provides a clean abstraction between the business logic (routes) and
 * the underlying PostgreSQL database using Drizzle ORM.
 *
 * Key Responsibilities:
 *   - Establish and manage the database connection.
 *   - Define the database schema using Drizzle's schema definition files.
 *   - Provide type-safe functions for all CRUD (Create, Read, Update, Delete)
 *     operations on each table.
 *   - Handle data validation and transformation between the application
 *     and the database.
 *
 * Why Drizzle?
 *   - Type-Safety: Queries are checked at compile time, preventing SQL injection
 *     and catching errors early.
 *   - SQL-like Syntax: Write queries in a way that is familiar to SQL users.
 *   - Performance: Drizzle is lightweight and designed for high performance.
 *   - Excellent TypeScript Support: Provides strong type inference and autocompletion.
 *
 * Usage:
 *   - The \`storage\` object is exported and should be imported into route files
 *     or other services that need to interact with the database.
 *   - Example: \`import { storage } from './storage';\`
 *   - Then, call methods like \`storage.getChats()\` or \`storage.insertMessage(newMessage)\`.
 *
 * =============================================================================
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';
import { eq, sql, or } from 'drizzle-orm';
import {
  InsertChat,
  InsertMessage,
  InsertUser,
  InsertSmsMessage,
  InsertCallConversation,
  InsertCallTurn,
  InsertVoicemail,
  InsertUserBranding,
  UserBranding,
  InsertUserAgent,
  UserAgent,
  InsertAttachment,
  InsertLlmUsage,
  InsertLlmInteraction,
  InsertGoogleOAuthTokens,
  InsertDocumentChunk,
  InsertRagTrace,
  InsertQueuedTask,
  InsertToolCallLog,
  InsertWorkflow,
  InsertTrigger,
  InsertSchedule,
  InsertAgentIdentity,
  InsertAgentActivityLog,
  InsertFeedback,
  InsertToolTask,
  InsertExecutionLog,
  InsertTodoItem,
  TodoItem
} from '@shared/schema';

// ===========================================================================
// DATABASE CONNECTION SETUP
// ===========================================================================

// Ensure the DATABASE_URL environment variable is set.
if (!process.env.DATABASE_URL) {
  console.warn('⚠️ [storage] DATABASE_URL not set. Running in Mock Mode.');
}

// Create a PostgreSQL client instance.
// The \`max: 1\` setting is important for serverless environments to prevent
// exhausting connection limits. Adjust as needed for your deployment environment.
const client = process.env.DATABASE_URL 
  ? postgres(process.env.DATABASE_URL, { max: 1 })
  : null;

// Create a Drizzle ORM instance, passing the client and schema.
// This \`db\` object is the core of our database interaction layer.
export const db = process.env.DATABASE_URL
  ? drizzle(client!, { schema })
  : drizzle({} as any, { schema });

// ===========================================================================
// STORAGE ABSTRACTION LAYER
// ===========================================================================

/**
 * The \`storage\` object encapsulates all database operations. This provides a single,
 * consistent interface for the rest of the application to use, abstracting away
 * the direct use of the Drizzle \`db\` object.
 */
export const storage = {
  // ------------------------------------------------------------------------
  // User Operations
  // ------------------------------------------------------------------------

  /**
   * Retrieves a user by their unique ID.
   * @param userId - The ID of the user to retrieve.
   * @returns The user object or undefined if not found.
   */
  getUserById: async (userId: string) => {
    return db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
  },

  /**
   * Retrieves a user by their unique ID.
   * This is an alias for getUserById with a shorter name.
   * @param userId - The ID of the user to retrieve.
   * @returns The user object or undefined if not found.
   */
  getUser: async (userId: string) => {
    return db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
  },

  /**
   * Inserts a new user into the database.
   * @param user - The user data to insert, conforming to the InsertUser type.
   * @returns The newly created user object.
   */
  insertUser: async (user: InsertUser) => {
    return db.insert(schema.users).values(user).returning();
  },

  // ------------------------------------------------------------------------
  // Chat Operations
  // ------------------------------------------------------------------------

  /**
   * Retrieves all chat sessions for a given user.
   * @param userId - The ID of the user whose chats to retrieve.
   * @returns An array of chat objects.
   */
  getChats: async (userId: string) => {
    return db.query.chats.findMany({
      where: eq(schema.chats.userId, userId),
    });
  },

  /**
   * Inserts a new chat session into the database.
   * @param chat - The chat data to insert.
   * @returns The newly created chat object.
   */
  insertChat: async (chat: InsertChat) => {
    return db.insert(schema.chats).values(chat).returning();
  },

  // ------------------------------------------------------------------------
  // Message Operations
  // ------------------------------------------------------------------------

  /**
   * Retrieves all messages for a specific chat session.
   * @param chatId - The ID of the chat whose messages to retrieve.
   * @returns An array of message objects.
   */
  getMessages: async (chatId: string) => {
    return db.query.messages.findMany({
      where: eq(schema.messages.chatId, chatId),
    });
  },

  /**
   * Inserts a new message into the database.
   * @param message - The message data to insert.
   * @returns The newly created message object.
   */
  insertMessage: async (message: InsertMessage) => {
    return db.insert(schema.messages).values(message).returning();
  },

  /**
   * Retrieves a specific chat by ID.
   * @param chatId - The ID of the chat to retrieve.
   * @returns The chat object or undefined if not found.
   */
  getChatById: async (chatId: string) => {
    return db.query.chats.findFirst({
      where: eq(schema.chats.id, chatId),
    });
  },

  /**
   * Retrieves paginated messages for a specific chat session.
   * Messages are ordered by creation time (newest first for limit queries).
   * 
   * @param chatId - The ID of the chat whose messages to retrieve.
   * @param options - Pagination options
   * @param options.limit - Maximum number of messages to return
   * @param options.before - Message ID cursor for loading older messages
   * @returns An array of message objects ordered chronologically (oldest first in result)
   */
  getMessagesByChatId: async (
    chatId: string,
    options?: { limit?: number; before?: string }
  ) => {
    const limit = options?.limit || 30;
    const before = options?.before;

    // Build query with ordering by createdAt DESC to get most recent first
    let query = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.chatId, chatId))
      .orderBy(sql`${schema.messages.createdAt} DESC`)
      .limit(limit);

    // If 'before' cursor provided, only get messages older than that message
    if (before) {
      const beforeMessage = await db.query.messages.findFirst({
        where: eq(schema.messages.id, before),
      });
      
      if (beforeMessage) {
        query = db
          .select()
          .from(schema.messages)
          .where(
            sql`${schema.messages.chatId} = ${chatId} AND ${schema.messages.createdAt} < ${beforeMessage.createdAt}`
          )
          .orderBy(sql`${schema.messages.createdAt} DESC`)
          .limit(limit);
      }
    }

    const messages = await query;
    
    // Reverse to return in chronological order (oldest to newest)
    return messages.reverse();
  },

  /**
   * Retrieves a specific message by ID.
   * @param messageId - The ID of the message to retrieve.
   * @returns The message object or undefined if not found.
   */
  getMessageById: async (messageId: string) => {
    return db.query.messages.findFirst({
      where: eq(schema.messages.id, messageId),
    });
  },

  /**
   * Adds a new message to the database.
   * This is an alias for insertMessage with a more intuitive name.
   * @param message - The message data to insert.
   * @returns The newly created message object (first element of array).
   */
  addMessage: async (message: InsertMessage) => {
    const result = await db.insert(schema.messages).values(message).returning();
    return result[0];
  },

  /**
   * Updates a chat's title.
   * @param chatId - The ID of the chat to update.
   * @param title - The new title for the chat.
   * @returns The updated chat object.
   */
  updateChatTitle: async (chatId: string, title: string) => {
    const [updated] = await db
      .update(schema.chats)
      .set({ title, updatedAt: new Date() })
      .where(eq(schema.chats.id, chatId))
      .returning();
    return updated;
  },

  /**
   * Creates a new chat session.
   * This is an alias for insertChat with a more intuitive name.
   * @param chat - The chat data to insert.
   * @returns The newly created chat object (first element of array).
   */
  createChat: async (chat: InsertChat) => {
    const result = await db.insert(schema.chats).values(chat).returning();
    return result[0];
  },

  // ------------------------------------------------------------------------
  // Attachment Operations
  // ------------------------------------------------------------------------

  /**
   * Retrieves all attachments for a specific message.
   * @param messageId - The ID of the message whose attachments to retrieve.
   * @returns An array of attachment objects.
   */
  getAttachmentsByMessageId: async (messageId: string) => {
    return db.query.attachments.findMany({
      where: eq(schema.attachments.messageId, messageId),
    });
  },

  /**
   * Creates a new attachment for a message.
   * @param attachment - The attachment data to insert.
   * @returns The newly created attachment object (first element of array).
   */
  createAttachment: async (attachment: InsertAttachment) => {
    const result = await db.insert(schema.attachments).values(attachment).returning();
    return result[0];
  },

  // ------------------------------------------------------------------------
  // Twilio SMS Message Operations
  // ------------------------------------------------------------------------

  /**
   * Inserts a new SMS message into the database.
   * This is used for logging messages sent or received via Twilio.
   * @param smsMessage - The SMS data to insert.
   * @returns The newly created SMS message object.
   */
  insertSmsMessage: async (smsMessage: InsertSmsMessage) => {
    return db.insert(schema.smsMessages).values(smsMessage).returning();
  },

  // ------------------------------------------------------------------------
  // Twilio Call Operations
  // ------------------------------------------------------------------------

  /**
   * Inserts a new conversation turn from a call into the database.
   * @param conversation - The conversation turn data.
   * @returns The newly created conversation turn object.
   */
  insertCallConversation: async (conversation: InsertCallConversation) => {
    return db.insert(schema.callConversations).values(conversation).returning();
  },

  /**
   * Get recent call conversations
   * @param limit - Maximum number of conversations to return
   * @returns Array of call conversations ordered by most recent first
   */
  getRecentCallConversations: async (limit: number = 20) => {
    return db.query.callConversations.findMany({
      limit,
      orderBy: (conversations, { desc }) => [desc(conversations.startedAt)],
    });
  },

  /**
   * Get call conversation by Twilio call SID
   * @param callSid - The Twilio call SID
   * @returns The call conversation or null
   */
  getCallConversationBySid: async (callSid: string) => {
    return db.query.callConversations.findFirst({
      where: eq(schema.callConversations.callSid, callSid),
    });
  },

  /**
   * Get call conversation by ID
   * @param id - The conversation ID
   * @returns The call conversation or null
   */
  getCallConversationById: async (id: string) => {
    return db.query.callConversations.findFirst({
      where: eq(schema.callConversations.id, id),
    });
  },

  /**
   * Update call conversation
   * @param id - The conversation ID
   * @param updates - Fields to update
   * @returns The updated conversation
   */
  updateCallConversation: async (id: string, updates: Partial<InsertCallConversation>) => {
    const [updated] = await db
      .update(schema.callConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.callConversations.id, id))
      .returning();
    return updated;
  },

  /**
   * Update call conversation by call SID
   * @param callSid - The Twilio call SID
   * @param updates - Fields to update
   * @returns The updated conversation
   */
  updateCallConversationBySid: async (callSid: string, updates: Partial<InsertCallConversation>) => {
    const [updated] = await db
      .update(schema.callConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.callConversations.callSid, callSid))
      .returning();
    return updated;
  },

  /**
   * Get call conversation by recording SID
   * @param recordingSid - The Twilio recording SID
   * @returns The call conversation or null
   */
  getCallConversationByRecordingSid: async (recordingSid: string) => {
    return db.query.callConversations.findFirst({
      where: eq(schema.callConversations.recordingSid, recordingSid),
    });
  },

  /**
   * Get call turns for a conversation
   * @param conversationId - The conversation ID
   * @returns Array of call turns ordered by turn number
   */
  getCallTurns: async (conversationId: string) => {
    return db.query.callTurns.findMany({
      where: eq(schema.callTurns.conversationId, conversationId),
      orderBy: (turns, { asc }) => [asc(turns.turnNumber)],
    });
  },

  /**
   * Create a call turn
   * @param turn - The call turn data
   * @returns The created call turn
   */
  createCallTurn: async (turn: InsertCallTurn) => {
    const [created] = await db
      .insert(schema.callTurns)
      .values(turn)
      .returning();
    return created;
  },

  // ------------------------------------------------------------------------
  // Voicemail Operations
  // ------------------------------------------------------------------------

  /**
   * Create a voicemail record
   * @param voicemail - The voicemail data
   * @returns The created voicemail
   */
  createVoicemail: async (voicemail: InsertVoicemail) => {
    const [created] = await db
      .insert(schema.voicemails)
      .values(voicemail)
      .returning();
    return created;
  },

  /**
   * Get recent voicemails
   * @param limit - Maximum number of voicemails to return
   * @returns Array of voicemails ordered by most recent first
   */
  getRecentVoicemails: async (limit: number = 20) => {
    return db.query.voicemails.findMany({
      limit,
      orderBy: (voicemails, { desc }) => [desc(voicemails.createdAt)],
    });
  },

  /**
   * Get voicemail by recording SID
   * @param recordingSid - The Twilio recording SID
   * @returns The voicemail or null
   */
  getVoicemailByRecordingSid: async (recordingSid: string) => {
    return db.query.voicemails.findFirst({
      where: eq(schema.voicemails.recordingSid, recordingSid),
    });
  },

  /**
   * Get voicemail by ID
   * @param id - The voicemail ID
   * @returns The voicemail or null
   */
  getVoicemailById: async (id: string) => {
    return db.query.voicemails.findFirst({
      where: eq(schema.voicemails.id, id),
    });
  },

  /**
   * Mark voicemail as heard
   * @param id - The voicemail ID
   * @returns The updated voicemail
   */
  markVoicemailAsHeard: async (id: string) => {
    const [updated] = await db
      .update(schema.voicemails)
      .set({ 
        heard: true, 
        heardAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(schema.voicemails.id, id))
      .returning();
    return updated;
  },

  /**
   * Update voicemail transcription
   * @param id - The voicemail ID
   * @param transcription - The transcription text
   * @param status - The transcription status
   * @returns The updated voicemail
   */
  updateVoicemailTranscription: async (id: string, transcription: string, status: string = 'completed') => {
    const [updated] = await db
      .update(schema.voicemails)
      .set({ 
        transcription,
        transcriptionStatus: status,
        updatedAt: new Date() 
      })
      .where(eq(schema.voicemails.id, id))
      .returning();
    return updated;
  },

  // ------------------------------------------------------------------------
  // User Branding Operations
  // ------------------------------------------------------------------------

  /**
   * Get user branding configuration
   * @param userId - The user ID
   * @returns User branding configuration or null if not set
   */
  getUserBranding: async (userId: string): Promise<UserBranding | null> => {
    const result = await db.query.userBranding.findFirst({
      where: eq(schema.userBranding.userId, userId),
    });
    return result || null;
  },

  /**
   * Create or update user branding configuration
   * @param branding - The branding data (must include userId)
   * @returns The created/updated branding configuration
   */
  upsertUserBranding: async (branding: InsertUserBranding): Promise<UserBranding> => {
    // Try to find existing branding
    const existing = await db.query.userBranding.findFirst({
      where: eq(schema.userBranding.userId, branding.userId),
    });

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(schema.userBranding)
        .set({ ...branding, updatedAt: new Date() })
        .where(eq(schema.userBranding.userId, branding.userId))
        .returning();
      return updated;
    } else {
      // Insert new
      const [created] = await db
        .insert(schema.userBranding)
        .values(branding)
        .returning();
      return created;
    }
  },

  /**
   * Delete user branding configuration
   * @param userId - The user ID
   * @returns True if deleted, false if not found
   */
  deleteUserBranding: async (userId: string): Promise<boolean> => {
    const result = await db
      .delete(schema.userBranding)
      .where(eq(schema.userBranding.userId, userId));
    return (result.rowCount ?? 0) > 0;
  },

  // Helper to get branding with fallback to defaults
  getUserBrandingOrDefault: async (userId: string): Promise<UserBranding> => {
    const branding = await storage.getUserBranding(userId);
    if (branding) return branding;

    // Return default branding using constants from schema
    return {
      id: 'default',
      userId,
      agentName: schema.DEFAULT_AGENT_NAME,
      displayName: schema.DEFAULT_DISPLAY_NAME,
      avatarUrl: null,
      brandColor: schema.DEFAULT_BRAND_COLOR,
      githubSignature: null,
      emailSignature: null,
      canonicalDomain: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  // ------------------------------------------------------------------------
  // User Agents Operations (Multi-Agent Support)
  // ------------------------------------------------------------------------

  /**
   * Get all agents for a user
   * @param userId - The user ID
   * @param activeOnly - Only return active agents
   * @returns Array of user agents
   */
  getUserAgents: async (userId: string, activeOnly: boolean = true): Promise<UserAgent[]> => {
    if (activeOnly) {
      return db.query.userAgents.findMany({
        where: (agents, { eq, and }) => and(
          eq(agents.userId, userId),
          eq(agents.isActive, true)
        ),
        orderBy: (agents, { desc }) => [desc(agents.isDefault), desc(agents.createdAt)],
      });
    }
    return db.query.userAgents.findMany({
      where: eq(schema.userAgents.userId, userId),
      orderBy: (agents, { desc }) => [desc(agents.isDefault), desc(agents.createdAt)],
    });
  },

  /**
   * Get a specific agent by ID
   * @param agentId - The agent ID
   * @returns The agent or null
   */
  getUserAgent: async (agentId: string): Promise<UserAgent | null> => {
    const result = await db.query.userAgents.findFirst({
      where: eq(schema.userAgents.id, agentId),
    });
    return result || null;
  },

  /**
   * Get the default agent for a user
   * @param userId - The user ID
   * @returns The default agent or null
   */
  getDefaultUserAgent: async (userId: string): Promise<UserAgent | null> => {
    const result = await db.query.userAgents.findFirst({
      where: (agents, { eq, and }) => and(
        eq(agents.userId, userId),
        eq(agents.isDefault, true),
        eq(agents.isActive, true)
      ),
    });
    return result || null;
  },

  /**
   * Create a new agent
   * @param agent - The agent data
   * @returns The created agent
   */
  createUserAgent: async (agent: InsertUserAgent): Promise<UserAgent> => {
    // If this is set as default, unset other defaults for this user
    if (agent.isDefault) {
      await db
        .update(schema.userAgents)
        .set({ isDefault: false })
        .where(eq(schema.userAgents.userId, agent.userId));
    }

    const [created] = await db
      .insert(schema.userAgents)
      .values(agent)
      .returning();
    return created;
  },

  /**
   * Update an agent
   * @param agentId - The agent ID
   * @param updates - The fields to update
   * @returns The updated agent
   */
  updateUserAgent: async (agentId: string, updates: Partial<InsertUserAgent>): Promise<UserAgent | null> => {
    // If setting as default, unset other defaults for this user
    if (updates.isDefault) {
      const agent = await storage.getUserAgent(agentId);
      if (agent) {
        await db
          .update(schema.userAgents)
          .set({ isDefault: false })
          .where(eq(schema.userAgents.userId, agent.userId));
      }
    }

    const [updated] = await db
      .update(schema.userAgents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userAgents.id, agentId))
      .returning();
    return updated || null;
  },

  /**
   * Delete an agent
   * @param agentId - The agent ID
   * @returns True if deleted
   */
  deleteUserAgent: async (agentId: string): Promise<boolean> => {
    const result = await db
      .delete(schema.userAgents)
      .where(eq(schema.userAgents.id, agentId));
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Set an agent as default for a user
   * @param agentId - The agent ID
   * @returns The updated agent
   */
  setDefaultUserAgent: async (agentId: string): Promise<UserAgent | null> => {
    return storage.updateUserAgent(agentId, { isDefault: true });
  },

  // ------------------------------------------------------------------------
  // Tool Call Log Operations (Real-time UI Bubbles)
  // ------------------------------------------------------------------------

  /**
   * Creates a new tool call log entry (status: "pending")
   * @param log - Tool call log data
   * @returns The created tool call log
   */
  createToolCallLog: async (log: schema.InsertToolCallLog) => {
    const [created] = await db
      .insert(schema.toolCallLogs)
      .values(log)
      .returning();
    return created;
  },

  /**
   * Updates an existing tool call log (e.g., mark as success/failure)
   * @param toolCallId - The tool call ID
   * @param updates - Fields to update
   * @returns The updated tool call log
   */
  updateToolCallLog: async (
    toolCallId: string,
    updates: Partial<{
      status: string;
      response: any;
      errorMessage: string;
      completedAt: Date;
      duration: number;
    }>
  ) => {
    const [updated] = await db
      .update(schema.toolCallLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.toolCallLogs.toolCallId, toolCallId))
      .returning();
    return updated;
  },

  /**
   * Get recent tool call logs for a chat (last 10)
   * @param chatId - The chat ID
   * @returns Array of tool call logs ordered by creation time (newest first)
   */
  getRecentToolCallLogs: async (chatId: string) => {
    return db.query.toolCallLogs.findMany({
      where: eq(schema.toolCallLogs.chatId, chatId),
      orderBy: (logs, { desc }) => [desc(logs.createdAt)],
      limit: 10,
    });
  },

  /**
   * Get a single tool call log by ID
   * @param id - The tool call log ID
   * @returns The tool call log or undefined
   */
  getToolCallLogById: async (id: string) => {
    return db.query.toolCallLogs.findFirst({
      where: eq(schema.toolCallLogs.id, id),
    });
  },

  /**
   * Prune old tool call logs for a chat, keeping only the 10 most recent
   * @param chatId - The chat ID
   * @returns Number of deleted rows
   */
  pruneOldToolCallLogs: async (chatId: string): Promise<number> => {
    // Get the 10 most recent IDs
    const recentLogs = await db.query.toolCallLogs.findMany({
      where: eq(schema.toolCallLogs.chatId, chatId),
      orderBy: (logs, { desc }) => [desc(logs.createdAt)],
      limit: 10,
      columns: { id: true },
    });

    if (recentLogs.length === 0) {
      return 0;
    }

    const recentIds = recentLogs.map((log) => log.id);

    // Delete all logs for this chat that are NOT in the recent 10
    const result = await db
      .delete(schema.toolCallLogs)
      .where(
        sql`${schema.toolCallLogs.chatId} = ${chatId} AND ${schema.toolCallLogs.id} NOT IN (${sql.raw(recentIds.map((id) => `'${id}'`).join(','))})`
      );

    return result.rowCount ?? 0;
  },

  // ------------------------------------------------------------------------
  // LLM Usage Tracking Operations
  // ------------------------------------------------------------------------

  /**
   * Log LLM token usage for analytics
   * @param usage - Usage data including tokens and model info
   * @returns The created usage log
   */
  logLlmUsage: async (usage: schema.InsertLlmUsage) => {
    const [created] = await db
      .insert(schema.llmUsage)
      .values(usage)
      .returning();
    return created;
  },

  /**
   * Get LLM usage for a specific chat
   * @param chatId - The chat ID
   * @returns Array of usage logs
   */
  getLlmUsageByChat: async (chatId: string) => {
    return db.query.llmUsage.findMany({
      where: eq(schema.llmUsage.chatId, chatId),
      orderBy: (usage, { desc }) => [desc(usage.createdAt)],
    });
  },

  /**
   * Get recent LLM usage logs
   * @param limit - Number of logs to return (default: 100)
   * @returns Array of recent usage logs
   */
  getRecentLlmUsage: async (limit: number = 100) => {
    return db.query.llmUsage.findMany({
      orderBy: (usage, { desc }) => [desc(usage.createdAt)],
      limit,
    });
  },

  /**
   * Get aggregated LLM usage statistics
   * @returns Usage statistics
   */
  getLlmUsageStats: async () => {
    const result = await db
      .select({
        totalPromptTokens: sql<number>`SUM(${schema.llmUsage.promptTokens})`,
        totalCompletionTokens: sql<number>`SUM(${schema.llmUsage.completionTokens})`,
        totalTokens: sql<number>`SUM(${schema.llmUsage.totalTokens})`,
        totalCalls: sql<number>`COUNT(*)`,
        avgDuration: sql<number>`AVG(${schema.llmUsage.durationMs})`,
      })
      .from(schema.llmUsage);
    return result[0] || {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalCalls: 0,
      avgDuration: 0,
    };
  },

  // ------------------------------------------------------------------------
  // LLM Debug Interactions Operations
  // ------------------------------------------------------------------------

  /**
   * Save an LLM interaction for debugging
   * @param interaction - Interaction data
   * @returns The created interaction log
   */
  saveLlmInteraction: async (interaction: schema.InsertLlmInteraction) => {
    const [created] = await db
      .insert(schema.llmInteractions)
      .values(interaction)
      .returning();
    return created;
  },

  /**
   * Get LLM interactions for a chat
   * @param chatId - The chat ID
   * @param limit - Number of interactions to return
   * @returns Array of interaction logs
   */
  getLlmInteractionsByChat: async (chatId: string, limit: number = 50) => {
    return db.query.llmInteractions.findMany({
      where: eq(schema.llmInteractions.chatId, chatId),
      orderBy: (interactions, { desc }) => [desc(interactions.createdAt)],
      limit,
    });
  },

  /**
   * Get a specific LLM interaction by ID
   * @param id - The interaction ID
   * @returns The interaction log or null
   */
  getLlmInteractionById: async (id: string) => {
    const result = await db.query.llmInteractions.findFirst({
      where: eq(schema.llmInteractions.id, id),
    });
    return result || null;
  },

  /**
   * Get recent LLM interactions
   * @param limit - Number of interactions to return (default: 100)
   * @param userId - Optional user ID to filter by
   * @returns Array of recent interaction logs
   */
  getRecentLlmInteractions: async (limit: number = 100, userId?: string | null) => {
    if (userId !== undefined) {
      return db.query.llmInteractions.findMany({
        where: (interactions, { eq }) => eq(interactions.userId, userId),
        orderBy: (interactions, { desc }) => [desc(interactions.createdAt)],
        limit,
      });
    }
    return db.query.llmInteractions.findMany({
      orderBy: (interactions, { desc }) => [desc(interactions.createdAt)],
      limit,
    });
  },

  /**
   * Get LLM interaction statistics
   * @returns Interaction statistics
   */
  getLlmInteractionStats: async () => {
    const result = await db
      .select({
        totalInteractions: sql<number>`COUNT(*)`,
        avgDuration: sql<number>`AVG(${schema.llmInteractions.durationMs})`,
        totalErrors: sql<number>`COUNT(CASE WHEN ${schema.llmInteractions.error} IS NOT NULL THEN 1 END)`,
      })
      .from(schema.llmInteractions);
    return result[0] || {
      totalInteractions: 0,
      avgDuration: 0,
      totalErrors: 0,
    };
  },

  /**
   * Delete old LLM interactions (for cleanup)
   * @param daysOld - Delete interactions older than this many days
   * @returns Number of deleted rows
   */
  deleteOldLlmInteractions: async (daysOld: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await db
      .delete(schema.llmInteractions)
      .where(sql`${schema.llmInteractions.createdAt} < ${cutoffDate}`);
    
    return result.rowCount ?? 0;
  },

  // ------------------------------------------------------------------------
  // Google OAuth Token Operations
  // ------------------------------------------------------------------------

  /**
   * Save Google OAuth tokens for a user
   * @param tokens - Token data
   * @returns The created/updated token record
   */
  saveGoogleTokens: async (tokens: InsertGoogleOAuthTokens) => {
    // Upsert: update if exists, insert if not
    const existing = await db.query.googleOAuthTokens.findFirst({
      where: eq(schema.googleOAuthTokens.id, tokens.id || 'default'),
    });

    if (existing) {
      const [updated] = await db
        .update(schema.googleOAuthTokens)
        .set({ ...tokens, updatedAt: new Date() })
        .where(eq(schema.googleOAuthTokens.id, tokens.id || 'default'))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(schema.googleOAuthTokens)
        .values(tokens)
        .returning();
      return created;
    }
  },

  /**
   * Get Google OAuth tokens by ID
   * @param id - The token ID (defaults to 'default' for system tokens)
   * @returns The token record or null
   */
  getGoogleTokens: async (id: string = 'default') => {
    const result = await db.query.googleOAuthTokens.findFirst({
      where: eq(schema.googleOAuthTokens.id, id),
    });
    return result || null;
  },

  /**
   * Delete Google OAuth tokens by ID
   * @param id - The token ID
   * @returns True if deleted
   */
  deleteGoogleTokens: async (id: string): Promise<boolean> => {
    const result = await db
      .delete(schema.googleOAuthTokens)
      .where(eq(schema.googleOAuthTokens.id, id));
    return (result.rowCount ?? 0) > 0;
  },

  // ------------------------------------------------------------------------
  // User Operations (Additional)
  // ------------------------------------------------------------------------

  /**
   * Upsert a user (create or update)
   * @param user - User data
   * @returns The created/updated user
   */
  upsertUser: async (user: InsertUser) => {
    // Check by ID OR Email since both must be unique
    const existing = await db.query.users.findFirst({
      where: or(
        eq(schema.users.id, user.id),
        eq(schema.users.email, user.email)
      ),
    });

    if (existing) {
      // If found, update it (using the found ID to handle ID drifts or email matches)
      const [updated] = await db
        .update(schema.users)
        .set({ ...user, updatedAt: new Date() })
        // Use the EXISTING record's ID, not necessarily the one passed in
        .where(eq(schema.users.id, existing.id))
        .returning();
      return updated;
    } else {
      // Before inserting, check one more time if email exists (race condition protection)
      try {
        const result = await db.insert(schema.users).values(user).returning();
        return result[0];
      } catch (error: any) {
        // If we get a unique constraint violation on email, fetch and return existing user
        if (error?.code === '23505' && error?.constraint === 'users_email_unique') {
          console.log(`[storage] User with email ${user.email} already exists, fetching existing user`);
          const existingByEmail = await db.query.users.findFirst({
            where: eq(schema.users.email, user.email)
          });
          if (existingByEmail) {
            return existingByEmail;
          }
        }
        // If it's a different error or we couldn't find the user, re-throw
        throw error;
      }
    }
  },

  /**
   * Get recent user messages across all chats
   * @param userId - The user ID
   * @param limit - Number of messages to return
   * @returns Array of recent user messages
   */
  getRecentUserMessages: async (userId: string, limit: number = 50) => {
    return db
      .select({
        message: schema.messages,
        chat: schema.chats,
      })
      .from(schema.messages)
      .innerJoin(schema.chats, eq(schema.messages.chatId, schema.chats.id))
      .where(
        sql`${schema.chats.userId} = ${userId} AND ${schema.messages.role} = 'user'`
      )
      .orderBy(sql`${schema.messages.createdAt} DESC`)
      .limit(limit);
  },

  // ------------------------------------------------------------------------
  // RAG (Retrieval Augmented Generation) Operations
  // ------------------------------------------------------------------------

  /**
   * Create a document chunk for RAG
   * @param chunk - Chunk data
   * @returns The created chunk
   */
  createDocumentChunk: async (chunk: schema.InsertDocumentChunk) => {
    const [created] = await db
      .insert(schema.documentChunks)
      .values(chunk)
      .returning();
    return created;
  },

  /**
   * Get all document chunks (with optional filters)
   * @param filters - Optional filters
   * @returns Array of chunks
   */
  getAllDocumentChunks: async (filters?: { chatId?: string; sourceType?: string; limit?: number }) => {
    let query = db.query.documentChunks.findMany({
      orderBy: (chunks, { desc }) => [desc(chunks.createdAt)],
    });

    if (filters?.limit) {
      query = db.query.documentChunks.findMany({
        orderBy: (chunks, { desc }) => [desc(chunks.createdAt)],
        limit: filters.limit,
      });
    }

    return query;
  },

  /**
   * Create RAG trace logs
   * @param traces - Array of trace data
   * @returns The created traces
   */
  createRagTraces: async (traces: schema.InsertRagTrace[]) => {
    return db.insert(schema.ragTraces).values(traces).returning();
  },

  /**
   * Get RAG traces by trace ID
   * @param traceId - The trace ID
   * @returns Array of traces
   */
  getRagTracesByTraceId: async (traceId: string) => {
    return db.query.ragTraces.findMany({
      where: eq(schema.ragTraces.traceId, traceId),
      orderBy: (traces, { desc }) => [desc(traces.timestamp)],
    });
  },

  /**
   * Get RAG traces (recent)
   * @param limit - Number of traces to return
   * @returns Array of traces
   */
  getRagTraces: async (limit: number = 100) => {
    return db.query.ragTraces.findMany({
      orderBy: (traces, { desc }) => [desc(traces.timestamp)],
      limit,
    });
  },

  /**
   * Get RAG metrics
   * @returns RAG performance metrics
   */
  getRagMetrics: async () => {
    const result = await db
      .select({
        totalQueries: sql<number>`COUNT(DISTINCT ${schema.ragTraces.traceId})`,
        avgLatency: sql<number>`AVG(${schema.ragTraces.latencyMs})`,
        totalChunksRetrieved: sql<number>`COUNT(*)`,
      })
      .from(schema.ragTraces)
      .where(eq(schema.ragTraces.operation, 'retrieve'));
    
    return result[0] || {
      totalQueries: 0,
      avgLatency: 0,
      totalChunksRetrieved: 0,
    };
  },

  /**
   * Get chunk lineage for a chunk
   * @param chunkId - The chunk ID
   * @returns Lineage record or null
   */
  getChunkLineage: async (chunkId: string) => {
    const result = await db.query.ragChunkLineage.findFirst({
      where: eq(schema.ragChunkLineage.chunkId, chunkId),
    });
    return result || null;
  },

  /**
   * Get retrieval results for a chunk
   * @param chunkId - The chunk ID
   * @returns Array of retrieval results
   */
  getRetrievalResultsByChunk: async (chunkId: string) => {
    return db.query.ragRetrievalResults.findMany({
      where: eq(schema.ragRetrievalResults.chunkId, chunkId),
      orderBy: (results, { desc }) => [desc(results.retrievedAt)],
    });
  },

  // ------------------------------------------------------------------------
  // Task Queue Operations
  // ------------------------------------------------------------------------

  /**
   * Create a queued task
   * @param task - Task data
   * @returns The created task
   */
  createQueuedTask: async (task: schema.InsertQueuedTask) => {
    const [created] = await db
      .insert(schema.queuedTasks)
      .values(task)
      .returning();
    return created;
  },

  /**
   * Create multiple queued tasks
   * @param tasks - Array of task data
   * @returns The created tasks
   */
  createQueuedTasks: async (tasks: schema.InsertQueuedTask[]) => {
    return db.insert(schema.queuedTasks).values(tasks).returning();
  },

  /**
   * Get a queued task by ID
   * @param taskId - The task ID
   * @returns The task or null
   */
  getQueuedTaskById: async (taskId: string) => {
    const result = await db.query.queuedTasks.findFirst({
      where: eq(schema.queuedTasks.id, taskId),
    });
    return result || null;
  },

  /**
   * Get queued tasks (with optional filters)
   * @param filters - Optional filters
   * @returns Array of tasks
   */
  getQueuedTasks: async (filters?: { status?: string; limit?: number }) => {
    if (filters?.status) {
      return db.query.queuedTasks.findMany({
        where: eq(schema.queuedTasks.status, filters.status),
        orderBy: (tasks, { asc }) => [asc(tasks.priority), asc(tasks.createdAt)],
        limit: filters?.limit,
      });
    }
    
    return db.query.queuedTasks.findMany({
      orderBy: (tasks, { asc }) => [asc(tasks.priority), asc(tasks.createdAt)],
      limit: filters?.limit,
    });
  },

  /**
   * Get queued tasks by parent ID
   * @param parentId - The parent task ID
   * @returns Array of child tasks
   */
  getQueuedTasksByParentId: async (parentId: string) => {
    return db.query.queuedTasks.findMany({
      where: eq(schema.queuedTasks.parentId, parentId),
      orderBy: (tasks, { asc }) => [asc(tasks.priority), asc(tasks.createdAt)],
    });
  },

  /**
   * Get the next pending task from the queue
   * @returns The next task or null
   */
  getNextPendingTask: async () => {
    const result = await db.query.queuedTasks.findFirst({
      where: eq(schema.queuedTasks.status, 'pending'),
      orderBy: (tasks, { asc }) => [asc(tasks.priority), asc(tasks.createdAt)],
    });
    return result || null;
  },

  /**
   * Get tasks waiting for input
   * @returns Array of tasks
   */
  getTasksWaitingForInput: async () => {
    return db.query.queuedTasks.findMany({
      where: eq(schema.queuedTasks.status, 'waiting_input'),
      orderBy: (tasks, { asc }) => [asc(tasks.createdAt)],
    });
  },

  /**
   * Update a queued task
   * @param taskId - The task ID
   * @param updates - Fields to update
   * @returns The updated task
   */
  updateQueuedTask: async (taskId: string, updates: Partial<schema.InsertQueuedTask>) => {
    const [updated] = await db
      .update(schema.queuedTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.queuedTasks.id, taskId))
      .returning();
    return updated || null;
  },

  /**
   * Delete a queued task
   * @param taskId - The task ID
   * @returns True if deleted
   */
  deleteQueuedTask: async (taskId: string): Promise<boolean> => {
    const result = await db
      .delete(schema.queuedTasks)
      .where(eq(schema.queuedTasks.id, taskId));
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Get queue statistics
   * @returns Queue stats
   */
  getQueueStats: async () => {
    const result = await db
      .select({
        totalTasks: sql<number>`COUNT(*)`,
        pendingTasks: sql<number>`COUNT(CASE WHEN ${schema.queuedTasks.status} = 'pending' THEN 1 END)`,
        runningTasks: sql<number>`COUNT(CASE WHEN ${schema.queuedTasks.status} = 'running' THEN 1 END)`,
        completedTasks: sql<number>`COUNT(CASE WHEN ${schema.queuedTasks.status} = 'completed' THEN 1 END)`,
        failedTasks: sql<number>`COUNT(CASE WHEN ${schema.queuedTasks.status} = 'failed' THEN 1 END)`,
      })
      .from(schema.queuedTasks);
    
    return result[0] || {
      totalTasks: 0,
      pendingTasks: 0,
      runningTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
    };
  },

  // ------------------------------------------------------------------------
  // Workflows & Triggers Operations
  // ------------------------------------------------------------------------

  /**
   * Create a workflow
   * @param workflow - Workflow data
   * @returns The created workflow
   */
  createWorkflow: async (workflow: schema.InsertWorkflow) => {
    const [created] = await db
      .insert(schema.workflows)
      .values(workflow)
      .returning();
    return created;
  },

  /**
   * Get a workflow by ID
   * @param workflowId - The workflow ID
   * @returns The workflow or null
   */
  getWorkflowById: async (workflowId: string) => {
    const result = await db.query.workflows.findFirst({
      where: eq(schema.workflows.id, workflowId),
    });
    return result || null;
  },

  /**
   * Get all workflows for a user
   * @param userId - The user ID
   * @returns Array of workflows
   */
  getWorkflows: async (userId: string) => {
    return db.query.workflows.findMany({
      where: eq(schema.workflows.userId, userId),
      orderBy: (workflows, { desc }) => [desc(workflows.createdAt)],
    });
  },

  /**
   * Update a workflow
   * @param workflowId - The workflow ID
   * @param updates - Fields to update
   * @returns The updated workflow
   */
  updateWorkflow: async (workflowId: string, updates: Partial<schema.InsertWorkflow>) => {
    const [updated] = await db
      .update(schema.workflows)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.workflows.id, workflowId))
      .returning();
    return updated || null;
  },

  /**
   * Delete a workflow
   * @param workflowId - The workflow ID
   * @returns True if deleted
   */
  deleteWorkflow: async (workflowId: string): Promise<boolean> => {
    const result = await db
      .delete(schema.workflows)
      .where(eq(schema.workflows.id, workflowId));
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Create a trigger
   * @param trigger - Trigger data
   * @returns The created trigger
   */
  createTrigger: async (trigger: schema.InsertTrigger) => {
    const [created] = await db
      .insert(schema.triggers)
      .values(trigger)
      .returning();
    return created;
  },

  /**
   * Get a trigger by ID
   * @param triggerId - The trigger ID
   * @returns The trigger or null
   */
  getTriggerById: async (triggerId: string) => {
    const result = await db.query.triggers.findFirst({
      where: eq(schema.triggers.id, triggerId),
    });
    return result || null;
  },

  /**
   * Get all triggers
   * @returns Array of triggers
   */
  getTriggers: async () => {
    return db.query.triggers.findMany({
      orderBy: (triggers, { desc }) => [desc(triggers.createdAt)],
    });
  },

  /**
   * Get triggers by type
   * @param type - The trigger type
   * @returns Array of triggers
   */
  getTriggersByType: async (type: string) => {
    return db.query.triggers.findMany({
      where: eq(schema.triggers.type, type),
      orderBy: (triggers, { desc }) => [desc(triggers.createdAt)],
    });
  },

  /**
   * Update a trigger
   * @param triggerId - The trigger ID
   * @param updates - Fields to update
   * @returns The updated trigger
   */
  updateTrigger: async (triggerId: string, updates: Partial<schema.InsertTrigger>) => {
    const [updated] = await db
      .update(schema.triggers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.triggers.id, triggerId))
      .returning();
    return updated || null;
  },

  /**
   * Delete a trigger
   * @param triggerId - The trigger ID
   * @returns True if deleted
   */
  deleteTrigger: async (triggerId: string): Promise<boolean> => {
    const result = await db
      .delete(schema.triggers)
      .where(eq(schema.triggers.id, triggerId));
    return (result.rowCount ?? 0) > 0;
  },

  // ------------------------------------------------------------------------
  // Schedules Operations
  // ------------------------------------------------------------------------

  /**
   * Create a schedule
   * @param schedule - Schedule data
   * @returns The created schedule
   */
  createSchedule: async (schedule: schema.InsertSchedule) => {
    const [created] = await db
      .insert(schema.schedules)
      .values(schedule)
      .returning();
    return created;
  },

  /**
   * Get a schedule by ID
   * @param scheduleId - The schedule ID
   * @returns The schedule or null
   */
  getScheduleById: async (scheduleId: string) => {
    const result = await db.query.schedules.findFirst({
      where: eq(schema.schedules.id, scheduleId),
    });
    return result || null;
  },

  /**
   * Get all schedules for a user
   * @param userId - The user ID
   * @returns Array of schedules
   */
  getSchedules: async (userId: string) => {
    return db.query.schedules.findMany({
      where: eq(schema.schedules.userId, userId),
      orderBy: (schedules, { asc }) => [asc(schedules.nextRun)],
    });
  },

  /**
   * Get due schedules
   * @returns Array of schedules that should run now
   */
  getDueSchedules: async () => {
    const now = new Date();
    return db.query.schedules.findMany({
      where: (schedules, { and, eq, lte }) => and(
        eq(schedules.enabled, true),
        lte(schedules.nextRun, now)
      ),
      orderBy: (schedules, { asc }) => [asc(schedules.nextRun)],
    });
  },

  /**
   * Update a schedule
   * @param scheduleId - The schedule ID
   * @param updates - Fields to update
   * @returns The updated schedule
   */
  updateSchedule: async (scheduleId: string, updates: Partial<schema.InsertSchedule>) => {
    const [updated] = await db
      .update(schema.schedules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.schedules.id, scheduleId))
      .returning();
    return updated || null;
  },

  /**
   * Delete a schedule
   * @param scheduleId - The schedule ID
   * @returns True if deleted
   */
  deleteSchedule: async (scheduleId: string): Promise<boolean> => {
    const result = await db
      .delete(schema.schedules)
      .where(eq(schema.schedules.id, scheduleId));
    return (result.rowCount ?? 0) > 0;
  },

  // ------------------------------------------------------------------------
  // Agent Identity & Activity Operations
  // ------------------------------------------------------------------------

  /**
   * Create an agent identity
   * @param identity - Identity data
   * @returns The created identity
   */
  createAgentIdentity: async (identity: schema.InsertAgentIdentity) => {
    const [created] = await db
      .insert(schema.agentIdentities)
      .values(identity)
      .returning();
    return created;
  },

  /**
   * Get agent identities for a user
   * @param userId - The user ID
   * @returns Array of identities
   */
  getAgentIdentities: async (userId: string) => {
    return db.query.agentIdentities.findMany({
      where: eq(schema.agentIdentities.userId, userId),
      orderBy: (identities, { desc }) => [desc(identities.createdAt)],
    });
  },

  /**
   * Get an agent by ID
   * @param agentId - The agent ID
   * @returns The agent identity or null
   */
  getAgentById: async (agentId: string) => {
    const result = await db.query.agentIdentities.findFirst({
      where: eq(schema.agentIdentities.id, agentId),
    });
    return result || null;
  },

  /**
   * Get an agent by name
   * @param userId - The user ID
   * @param name - The agent name
   * @returns The agent identity or null
   */
  getAgentByName: async (userId: string, name: string) => {
    const result = await db.query.agentIdentities.findFirst({
      where: (identities, { and, eq }) => and(
        eq(identities.userId, userId),
        eq(identities.name, name)
      ),
    });
    return result || null;
  },

  /**
   * Get enabled agents for a user
   * @param userId - The user ID
   * @returns Array of enabled agents
   */
  getEnabledAgents: async (userId: string) => {
    return db.query.agentIdentities.findMany({
      where: (identities, { and, eq }) => and(
        eq(identities.userId, userId),
        eq(identities.enabled, true)
      ),
      orderBy: (identities, { desc }) => [desc(identities.createdAt)],
    });
  },

  /**
   * Update an agent identity
   * @param agentId - The agent ID
   * @param updates - Fields to update
   * @returns The updated identity
   */
  updateAgentIdentity: async (agentId: string, updates: Partial<schema.InsertAgentIdentity>) => {
    const [updated] = await db
      .update(schema.agentIdentities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.agentIdentities.id, agentId))
      .returning();
    return updated || null;
  },

  /**
   * Log agent activity
   * @param activity - Activity data
   * @returns The created activity log
   */
  logAgentActivity: async (activity: InsertAgentActivityLog) => {
    const [created] = await db
      .insert(schema.agentActivityLog)
      .values(activity)
      .returning();
    return created;
  },

  /**
   * Get agent activity logs
   * @param agentId - The agent ID
   * @param limit - Number of logs to return
   * @returns Array of activity logs
   */
  getAgentActivity: async (agentId: string, limit: number = 50) => {
    return db.query.agentActivityLog.findMany({
      where: eq(schema.agentActivityLog.agentId, agentId),
      orderBy: (logs, { desc }) => [desc(logs.timestamp)],
      limit,
    });
  },

  /**
   * Get recent agent activity across all agents
   * @param limit - Number of logs to return
   * @returns Array of activity logs
   */
  getRecentAgentActivity: async (limit: number = 100) => {
    return db.query.agentActivityLog.findMany({
      orderBy: (logs, { desc }) => [desc(logs.timestamp)],
      limit,
    });
  },

  // ------------------------------------------------------------------------
  // Feedback Operations
  // ------------------------------------------------------------------------

  /**
   * Create feedback
   * @param feedback - Feedback data
   * @returns The created feedback
   */
  createFeedback: async (feedback: schema.InsertFeedback) => {
    const [created] = await db
      .insert(schema.feedback)
      .values(feedback)
      .returning();
    return created;
  },

  /**
   * Get feedback by ID
   * @param feedbackId - The feedback ID
   * @returns The feedback or null
   */
  getFeedback: async (feedbackId: string) => {
    const result = await db.query.feedback.findFirst({
      where: eq(schema.feedback.id, feedbackId),
    });
    return result || null;
  },

  /**
   * Mark feedback as submitted
   * @param feedbackId - The feedback ID
   * @returns The updated feedback
   */
  markFeedbackSubmitted: async (feedbackId: string) => {
    const [updated] = await db
      .update(schema.feedback)
      .set({ submittedAt: new Date() })
      .where(eq(schema.feedback.id, feedbackId))
      .returning();
    return updated || null;
  },

  /**
   * Get feedback statistics
   * @returns Feedback stats
   */
  getFeedbackStats: async () => {
    const result = await db
      .select({
        totalFeedback: sql<number>`COUNT(*)`,
        submittedFeedback: sql<number>`COUNT(CASE WHEN ${schema.feedback.submittedAt} IS NOT NULL THEN 1 END)`,
        avgRating: sql<number>`AVG(${schema.feedback.rating})`,
      })
      .from(schema.feedback);
    
    return result[0] || {
      totalFeedback: 0,
      submittedFeedback: 0,
      avgRating: 0,
    };
  },

  // ------------------------------------------------------------------------
  // Tool Tasks & Execution Logs Operations
  // ------------------------------------------------------------------------

  /**
   * Create a tool task
   * @param task - Tool task data
   * @returns The created task
   */
  createToolTask: async (task: schema.InsertToolTask) => {
    const [created] = await db
      .insert(schema.toolTasks)
      .values(task)
      .returning();
    return created;
  },

  /**
   * Update tool task status
   * @param taskId - The task ID
   * @param status - New status
   * @param result - Optional result data
   * @returns The updated task
   */
  updateToolTaskStatus: async (taskId: string, status: string, result?: any) => {
    const updates: any = { status, updatedAt: new Date() };
    if (result !== undefined) {
      updates.result = result;
    }
    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }
    
    const [updated] = await db
      .update(schema.toolTasks)
      .set(updates)
      .where(eq(schema.toolTasks.id, taskId))
      .returning();
    return updated || null;
  },

  /**
   * Create an execution log
   * @param log - Execution log data
   * @returns The created log
   */
  createExecutionLog: async (log: schema.InsertExecutionLog) => {
    const [created] = await db
      .insert(schema.executionLogs)
      .values(log)
      .returning();
    return created;
  },

  // ------------------------------------------------------------------------
  // Debug & Admin Operations
  // ------------------------------------------------------------------------

  /**
   * Get the database connection for raw queries
   * @returns The Drizzle db instance
   */
  getDb: () => {
    return db;
  },

  /**
   * Get debug database information
   * @returns Database connection and table info
   */
  getDebugDatabaseInfo: async () => {
    try {
      // Get table counts
      const chatCount = await db.select({ count: sql<number>`count(*)` }).from(schema.chats);
      const messageCount = await db.select({ count: sql<number>`count(*)` }).from(schema.messages);
      const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
      
      return {
        connected: true,
        tables: {
          chats: chatCount[0]?.count || 0,
          messages: messageCount[0]?.count || 0,
          users: userCount[0]?.count || 0,
        },
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Get data from any table (for debugging/admin)
   * WARNING: Use with caution - bypasses normal access controls
   * @param tableName - The table name
   * @param limit - Number of rows to return
   * @returns Array of rows
   */
  getTableData: async (tableName: string, limit: number = 100) => {
    // This is intentionally generic and should be restricted to admin users
    const table = (schema as any)[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }
    
    return db.select().from(table).limit(limit);
  },

  /**
   * Update a record in any table (for debugging/admin)
   * WARNING: Use with caution - bypasses normal access controls
   * @param tableName - The table name
   * @param id - The record ID
   * @param updates - Fields to update
   * @returns The updated record
   */
  updateTableRecord: async (tableName: string, id: string, updates: any) => {
    const table = (schema as any)[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }
    
    const [updated] = await db
      .update(table)
      .set(updates)
      .where(eq(table.id, id))
      .returning();
    return updated || null;
  },

  /**
   * Delete a record from any table (for debugging/admin)
   * WARNING: Use with caution - bypasses normal access controls
   * @param tableName - The table name
   * @param id - The record ID
   * @returns True if deleted
   */
  deleteTableRecord: async (tableName: string, id: string): Promise<boolean> => {
    const table = (schema as any)[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }
    
    const result = await db
      .delete(table)
      .where(eq(table.id, id));
    return (result.rowCount ?? 0) > 0;
  },

  // ------------------------------------------------------------------------
  // To-Do List Operations
  // ------------------------------------------------------------------------

  /**
   * Get all to-do items for a user
   * @param userId - The user ID
   * @param includeCompleted - Include completed items (default: false)
   * @returns Array of to-do items ordered by priority (highest first) then creation date
   */
  getTodoItems: async (userId: string, includeCompleted: boolean = false): Promise<TodoItem[]> => {
    if (includeCompleted) {
      return db.query.todoItems.findMany({
        where: eq(schema.todoItems.userId, userId),
        orderBy: (items, { desc }) => [desc(items.priority), desc(items.createdAt)],
      });
    }
    
    return db.query.todoItems.findMany({
      where: (items, { eq, and, or }) => and(
        eq(items.userId, userId),
        or(
          eq(items.status, 'pending'),
          eq(items.status, 'in_progress'),
          eq(items.status, 'blocked')
        )
      ),
      orderBy: (items, { desc }) => [desc(items.priority), desc(items.createdAt)],
    });
  },

  /**
   * Get pending to-do items (not completed or cancelled)
   * @param userId - The user ID
   * @returns Array of active to-do items
   */
  getPendingTodoItems: async (userId: string): Promise<TodoItem[]> => {
    return db.query.todoItems.findMany({
      where: (items, { eq, and, or }) => and(
        eq(items.userId, userId),
        or(
          eq(items.status, 'pending'),
          eq(items.status, 'in_progress'),
          eq(items.status, 'blocked')
        )
      ),
      orderBy: (items, { desc }) => [desc(items.priority), desc(items.createdAt)],
    });
  },

  /**
   * Get a specific to-do item by ID
   * @param todoId - The to-do item ID
   * @returns The to-do item or null
   */
  getTodoItem: async (todoId: string): Promise<TodoItem | null> => {
    const result = await db.query.todoItems.findFirst({
      where: eq(schema.todoItems.id, todoId),
    });
    return result || null;
  },

  /**
   * Create a new to-do item
   * @param todoItem - The to-do item data
   * @returns The created to-do item
   */
  createTodoItem: async (todoItem: InsertTodoItem): Promise<TodoItem> => {
    const [created] = await db
      .insert(schema.todoItems)
      .values(todoItem)
      .returning();
    return created;
  },

  /**
   * Update a to-do item
   * @param todoId - The to-do item ID
   * @param updates - Fields to update
   * @returns The updated to-do item or null
   */
  updateTodoItem: async (todoId: string, updates: Partial<InsertTodoItem>): Promise<TodoItem | null> => {
    // If marking as completed, set completedAt timestamp
    if (updates.status === 'completed' && !updates.completedAt) {
      updates.completedAt = new Date();
    }
    
    const [updated] = await db
      .update(schema.todoItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.todoItems.id, todoId))
      .returning();
    return updated || null;
  },

  /**
   * Mark a to-do item as completed
   * @param todoId - The to-do item ID
   * @returns The updated to-do item or null
   */
  completeTodoItem: async (todoId: string): Promise<TodoItem | null> => {
    return storage.updateTodoItem(todoId, {
      status: 'completed',
      completedAt: new Date(),
    });
  },

  /**
   * Delete a to-do item
   * @param todoId - The to-do item ID
   * @returns True if deleted
   */
  deleteTodoItem: async (todoId: string): Promise<boolean> => {
    const result = await db
      .delete(schema.todoItems)
      .where(eq(schema.todoItems.id, todoId));
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Reorder to-do items by updating their priorities
   * @param updates - Array of {id, priority} objects
   * @returns Array of updated to-do items
   */
  reorderTodoItems: async (updates: Array<{ id: string; priority: number }>): Promise<TodoItem[]> => {
    const results: TodoItem[] = [];
    
    for (const update of updates) {
      const [updated] = await db
        .update(schema.todoItems)
        .set({ priority: update.priority, updatedAt: new Date() })
        .where(eq(schema.todoItems.id, update.id))
        .returning();
      if (updated) {
        results.push(updated);
      }
    }
    
    return results;
  },

  /**
   * Get to-do list statistics
   * @param userId - The user ID
   * @returns Statistics about the to-do list
   */
  getTodoStats: async (userId: string) => {
    const result = await db
      .select({
        total: sql<number>`COUNT(*)`,
        pending: sql<number>`COUNT(CASE WHEN ${schema.todoItems.status} = 'pending' THEN 1 END)`,
        inProgress: sql<number>`COUNT(CASE WHEN ${schema.todoItems.status} = 'in_progress' THEN 1 END)`,
        completed: sql<number>`COUNT(CASE WHEN ${schema.todoItems.status} = 'completed' THEN 1 END)`,
        blocked: sql<number>`COUNT(CASE WHEN ${schema.todoItems.status} = 'blocked' THEN 1 END)`,
      })
      .from(schema.todoItems)
      .where(eq(schema.todoItems.userId, userId));
    
    return result[0] || {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      blocked: 0,
    };
  },
};
