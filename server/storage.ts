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
import { eq } from 'drizzle-orm';
import {
  InsertChat,
  InsertMessage,
  InsertUser,
  InsertSmsMessage,
  InsertCall,
  InsertCallConversation,
  InsertUserBranding,
  UserBranding,
  InsertUserAgent,
  UserAgent
} from '@shared/schema';

// ===========================================================================
// DATABASE CONNECTION SETUP
// ===========================================================================

// Ensure the DATABASE_URL environment variable is set.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

// Create a PostgreSQL client instance.
// The \`max: 1\` setting is important for serverless environments to prevent
// exhausting connection limits. Adjust as needed for your deployment environment.
const client = postgres(process.env.DATABASE_URL, { max: 1 });

// Create a Drizzle ORM instance, passing the client and schema.
// This \`db\` object is the core of our database interaction layer.
export const db = drizzle(client, { schema });

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
   * Inserts a new call record into the database.
   * @param call - The call data to insert.
   * @returns The newly created call object.
   */
  insertCall: async (call: InsertCall) => {
    return db.insert(schema.calls).values(call).returning();
  },

  /**
   * Inserts a new conversation turn from a call into the database.
   * @param conversation - The conversation turn data.
   * @returns The newly created conversation turn object.
   */
  insertCallConversation: async (conversation: InsertCallConversation) => {
    return db.insert(schema.callConversations).values(conversation).returning();
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
};
