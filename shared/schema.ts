import { nanoid } from "nanoid";
/**
 * =============================================================================
 * MEOWSTIC CHAT - DATABASE SCHEMA DEFINITIONS
 * =============================================================================
 * 
 * This file defines the complete data model for the Meowstik application.
 * It uses Drizzle ORM to define PostgreSQL table schemas and generates
 * TypeScript types for type-safe database operations throughout the app.
 * 
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * The application uses a simple two-table relational model:
 * 
 *   ┌──────────────┐       ┌──────────────────┐
 *   │    chats     │       │     messages     │
 *   ├──────────────┤       ├──────────────────┤
 *   │ id (PK)      │◄──────│ chatId (FK)      │
 *   │ title        │       │ id (PK)          │
 *   │ createdAt    │       │ role             │
 *   │ updatedAt    │       │ content          │
 *   └──────────────┘       │ createdAt        │
 *                          └──────────────────┘
 * 
 * RELATIONSHIP:
 * - One Chat has many Messages (1:N relationship)
 * - Messages are cascade deleted when their parent Chat is deleted
 * 
 * EXPORTS:
 * --------
 * - chats: Drizzle table definition for chat conversations
 * - messages: Drizzle table definition for individual messages
 * - insertChatSchema: Zod validation schema for creating new chats
 * - insertMessageSchema: Zod validation schema for creating new messages
 * - InsertChat: TypeScript type for chat insert operations
 * - InsertMessage: TypeScript type for message insert operations
 * - Chat: TypeScript type for a chat record from the database
 * - Message: TypeScript type for a message record from the database
 * =============================================================================
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, varchar, timestamp, integer, jsonb, bigint, index, boolean } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Identifier for guest (unauthenticated) users
 * Used consistently across the codebase for guest data isolation
 */
export const GUEST_USER_ID = "guest";

/**
 * Default branding values
 */
export const DEFAULT_AGENT_NAME = "Meowstik";
export const DEFAULT_DISPLAY_NAME = "Meowstik AI";
export const DEFAULT_BRAND_COLOR = "#3B82F6";

// =============================================================================
// AUTH TABLES
// =============================================================================

/**
 * SESSION STORAGE TABLE
 * Stores user sessions
 */
export const sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess", { mode: "json" }).notNull(),
    expire: integer("expire", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

/**
 * USER STORAGE TABLE
 * Stores user profiles
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  username: text("username").unique(),
  email: text("email").unique().notNull(),
  password: text("password"),
  displayName: text("display_name"),
  role: text("role").default("user"),
  googleId: text("google_id"),
  avatarUrl: text("avatar_url"),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`),
});

export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

/**
 * USER BRANDING TABLE
 * -------------------
 * Stores per-user custom branding configuration.
 * Allows users to customize agent name, signature, avatar, and domain.
 */
export const userBranding = sqliteTable("user_branding", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Custom agent identity
  agentName: text("agent_name").default(DEFAULT_AGENT_NAME).notNull(),
  displayName: text("display_name").default(DEFAULT_DISPLAY_NAME).notNull(),
  
  // Visual branding
  avatarUrl: text("avatar_url"), // Custom avatar image URL
  brandColor: text("brand_color").default(DEFAULT_BRAND_COLOR), // Primary brand color (hex)
  
  // Signatures and metadata
  githubSignature: text("github_signature"), // Signature for GitHub commits/PRs
  emailSignature: text("email_signature"), // Signature for emails
  
  // Domain branding
  canonicalDomain: text("canonical_domain"), // e.g., "catpilot.pro"
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertUserBrandingSchema = createInsertSchema(userBranding).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserBranding = z.infer<typeof insertUserBrandingSchema>;
export type UserBranding = typeof userBranding.$inferSelect;

/**
 * USER AGENTS TABLE
 * -----------------
 * Stores multiple AI agent personas per user.
 * Allows users to create and switch between different agent identities.
 */
export const userAgents = sqliteTable("user_agents", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Agent identity
  name: text("name").notNull(), // e.g., "Catpilot", "CodeBot", "Researcher"
  displayName: text("display_name").notNull(), // e.g., "Catpilot Pro"
  description: text("description"), // Brief description of agent purpose
  
  // Agent type/category
  agentType: text("agent_type").default("assistant").notNull(), // assistant, coder, researcher, writer, etc.
  
  // Visual branding
  avatarUrl: text("avatar_url"),
  brandColor: text("brand_color").default(DEFAULT_BRAND_COLOR),
  
  // Personality and behavior
  personalityPrompt: text("personality_prompt"), // Custom personality description
  systemPromptOverrides: text("system_prompt_overrides"), // Additional system prompt instructions
  
  // Signatures
  githubSignature: text("github_signature"),
  emailSignature: text("email_signature"),
  
  // Settings
  isDefault: integer("is_default", { mode: "boolean" }).default(false).notNull(), // Default agent for this user
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(), // Can be disabled without deleting
  
  // Metadata
  canonicalDomain: text("canonical_domain"),
  tags: text("tags", { mode: "json" }).$type<string[]>(), // For categorization/search
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertUserAgentSchema = createInsertSchema(userAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserAgent = z.infer<typeof insertUserAgentSchema>;
export type UserAgent = typeof userAgents.$inferSelect;

/**
 * CHATS TABLE
 * -----------
 * Stores metadata for each chat conversation in the application.
 * 
 * A chat represents a complete conversation session between the user
 * and the AI assistant. Each chat can contain multiple messages.
 * 
 * COLUMNS:
 * - id: Unique identifier (UUID) generated automatically by PostgreSQL
 * - title: Display name for the chat, shown in the sidebar
 * - createdAt: Timestamp when the chat was first created
 * - updatedAt: Timestamp when the chat was last modified (new message added)
 * 
 * USAGE EXAMPLE:
 * ```typescript
 * const newChat = await storage.createChat({ title: "My New Chat" });
 * const allChats = await storage.getChats(); // Returns Chat[]
 * ```
 */
export const chats = sqliteTable("chats", {
  /**
   * Primary key - Auto-generated UUID using PostgreSQL's gen_random_uuid()
   * UUIDs are used instead of sequential integers for:
   * - Better security (IDs are not guessable)
   * - Easier data migration and replication
   * - No collision issues in distributed systems
   */
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  /**
   * Human-readable title for the chat conversation
   * Displayed in the sidebar navigation and chat header
   * Cannot be null - every chat must have a title
   */
  title: text("title").notNull(),
  
  /**
   * User ID - Foreign key reference to users table
   * NULL for guest (unauthenticated) conversations
   * Used for data isolation and user-specific chat history
   * 
   * CLEANUP STRATEGY:
   * Guest chats (userId = null) should be periodically cleaned up to prevent
   * database bloat. Recommended approach:
   * - Implement a cron job to delete guest chats older than 7 days
   * - Cascade delete will automatically remove associated messages and chunks
   * - No orphaned records since guest chats don't reference users table
   */
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  /**
   * Guest flag - Indicates if this is a guest conversation
   * Guest conversations:
   * - Are isolated in a separate "guest bucket"
   * - Have access to limited, safe tools only
   * - Should be periodically cleaned up (see userId documentation)
   * - Use GUEST_USER_ID constant for identification
   */
  isGuest: integer("is_guest", { mode: "boolean" }).default(false).notNull(),
  
  /**
   * Timestamp when this chat was first created
   * Automatically set by PostgreSQL using defaultNow()
   * Used for sorting chats chronologically
   */
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  
  /**
   * Timestamp when this chat was last updated
   * Updated whenever a new message is added to the chat
   * Used for sorting chats by "most recent activity"
   */
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

/**
 * MESSAGES TABLE
 * --------------
 * Stores individual messages within chat conversations.
 * 
 * Each message belongs to exactly one chat (enforced by foreign key).
 * Messages can be from either the user or the AI assistant.
 * 
 * COLUMNS:
 * - id: Unique identifier (UUID) for the message
 * - chatId: Foreign key linking to the parent chat
 * - role: Who sent the message ("user" or "ai")
 * - content: The actual text content of the message (supports markdown)
 * - createdAt: When the message was sent
 * 
 * CASCADE DELETE:
 * When a chat is deleted, all its messages are automatically deleted too.
 * This ensures no orphaned messages exist in the database.
 * 
 * USAGE EXAMPLE:
 * ```typescript
 * await storage.addMessage({
 *   chatId: "chat-uuid",
 *   role: "user",
 *   content: "Hello, AI!"
 * });
 * ```
 */
export const messages = sqliteTable("messages", {
  /**
   * Primary key - Auto-generated UUID for each message
   * Ensures globally unique identification of every message
   */
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  /**
   * Foreign key reference to the parent chat
   * - Links each message to its conversation
   * - CASCADE DELETE: Messages are deleted when their chat is deleted
   * - NOT NULL: Every message must belong to a chat
   */
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  
  /**
   * Identifies the sender of the message
   * Valid values:
   * - "user": Message sent by the human user
   * - "ai": Message generated by the AI assistant
   * Used for styling and conversation history reconstruction
   */
  role: text("role").notNull(),
  
  /**
   * The actual text content of the message
   * Supports markdown formatting for rich text display
   * Can be any length (PostgreSQL text type has no practical limit)
   */
  content: text("content").notNull(),
  
  /**
   * Timestamp when this message was created/sent
   * Used for chronological ordering of messages within a chat
   */
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  
  /**
   * Optional JSON metadata for AI messages
   * Stores tool results, file operations, autoexec results, etc.
   */
  metadata: text("metadata", { mode: "json" }),
  
  /**
   * Full Gemini API content object for model responses
   * Stores the complete Content object including thought_signature
   * This preserves the model's reasoning state for multi-turn function calling
   * See: https://cloud.google.com/vertex-ai/generative-ai/docs/thought-signatures
   */
  geminiContent: text("gemini_content", { mode: "json" }),
});

/**
 * ZOD VALIDATION SCHEMAS
 * ----------------------
 * These schemas are used to validate incoming data before database insertion.
 * They automatically derive validation rules from the Drizzle table definitions.
 * 
 * The .omit() method removes auto-generated fields that should not be
 * provided by the client (like id and timestamps).
 */

/**
 * Schema for validating new chat creation requests
 * Excludes: id (auto-generated), createdAt/updatedAt (auto-set)
 * Requires: title
 */
export const insertChatSchema = createInsertSchema(chats).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

/**
 * Schema for validating new message creation requests
 * Excludes: id (auto-generated), createdAt (auto-set)
 * Requires: chatId, role, content
 */
export const insertMessageSchema = createInsertSchema(messages).omit({ 
  id: true, 
  createdAt: true 
});

/**
 * TYPESCRIPT TYPES
 * ----------------
 * These types are derived from the schemas and used throughout the application
 * to ensure type safety when working with chat and message data.
 */

/**
 * Type for creating a new chat - only includes fields the client should provide
 * Example: { title: "New Conversation" }
 */
export type InsertChat = z.infer<typeof insertChatSchema>;

/**
 * Type for creating a new message - only includes fields the client should provide
 * Example: { chatId: "uuid", role: "user", content: "Hello" }
 */
export type InsertMessage = z.infer<typeof insertMessageSchema>;

/**
 * Complete Chat type as returned from the database
 * Includes all fields: id, title, createdAt, updatedAt
 */
export type Chat = typeof chats.$inferSelect;

/**
 * Complete Message type as returned from the database
 * Includes all fields: id, chatId, role, content, createdAt
 */
export type Message = typeof messages.$inferSelect;

// =============================================================================
// ATTACHMENT SYSTEM
// =============================================================================
/**
 * ATTACHMENTS TABLE
 * -----------------
 * Stores file attachments, screenshots, and voice transcripts associated with messages.
 * 
 * Attachment types:
 * - "file": User-uploaded files (documents, images, etc.)
 * - "screenshot": Screen captures taken via the capture button
 * - "voice_transcript": Transcribed voice input text
 * 
 * Binary data is stored as base64 for simplicity and portability.
 */
export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  messageId: text("message_id").references(() => messages.id, { onDelete: "cascade" }),
  draftId: text("draft_id").references(() => drafts.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "file" | "screenshot" | "voice_transcript"
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  size: integer("size"), // File size in bytes
  content: text("content"), // Base64 encoded content or text
  path: text("path"), // Optional file path for created files
  permissions: text("permissions"), // Unix permission string (e.g., "755")
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// =============================================================================
// DRAFT PROMPTS SYSTEM
// =============================================================================
/**
 * DRAFTS TABLE
 * ------------
 * Stores in-progress message drafts before they are submitted.
 * 
 * A draft contains:
 * - The user's typed text input
 * - References to attached files and screenshots
 * - Voice transcript accumulations
 * 
 * When submitted, the draft is assembled into a complete prompt
 * and sent to the RAG backend.
 */
export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  textContent: text("text_content").default(""),
  voiceTranscript: text("voice_transcript").default(""),
  status: text("status").default("active").notNull(), // "active" | "submitted" | "cancelled"
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertDraftSchema = createInsertSchema(drafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Draft = typeof drafts.$inferSelect;

// =============================================================================
// TOOL TASKS SYSTEM
// =============================================================================
/**
 * TOOL TASKS TABLE
 * ----------------
 * Stores individual tool operations to be executed by the system.
 * 
 * Tool types:
 * - "api_call": External API requests
 * - "file_create": Create new text file
 * - "file_replace": Replace existing file content
 * - "append": Append to existing file
 * - "binary_create": Create binary file from base64
 * - "search": Search operations
 * - "autoexec": Execute script with elevated permissions
 * 
 * Execution status tracks the lifecycle of each task.
 */
export const toolTasks = sqliteTable("tool_tasks", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  messageId: text("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull(),
  taskType: text("task_type").notNull(),
  payload: text("payload", { mode: "json" }).notNull(), // Task parameters as JSONB
  status: text("status").default("pending").notNull(), // "pending" | "running" | "completed" | "failed"
  result: text("result", { mode: "json" }), // Execution result as JSONB
  error: text("error"), // Error message if failed
  executedAt: integer("executed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertToolTaskSchema = createInsertSchema(toolTasks).omit({
  id: true,
  createdAt: true,
  executedAt: true,
});
export type InsertToolTask = z.infer<typeof insertToolTaskSchema>;
export type ToolTask = typeof toolTasks.$inferSelect;

// =============================================================================
// TOOL CALL LOGS SYSTEM - Real-time tool call tracking for UI bubbles
// =============================================================================
/**
 * TOOL CALL LOGS TABLE
 * --------------------
 * Stores recent tool call executions for display as real-time bubbles in chat.
 * Limited to 10 most recent tool calls per chat to prevent bloat.
 * 
 * Lifecycle:
 * - Created when tool call starts (status: "pending")
 * - Updated when tool completes (status: "success" or "failure")
 * - Old entries automatically pruned when new ones are added (keep last 10 per chat)
 */
export const toolCallLogs = sqliteTable("tool_call_logs", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  messageId: text("message_id").references(() => messages.id, { onDelete: "cascade" }),
  
  // Tool identification
  toolCallId: text("tool_call_id").notNull(), // Unique ID for this specific tool call
  toolType: text("tool_type").notNull(), // Type of tool (e.g., "gmail_send", "drive_read")
  
  // State tracking
  status: text("status").default("pending").notNull(), // "pending" | "success" | "failure"
  
  // Request/Response data
  request: text("request", { mode: "json" }).notNull(), // Tool call parameters
  response: text("response", { mode: "json" }), // Tool execution result (set when completed)
  errorMessage: text("error_message"), // Error details if failed
  
  // Timing
  startedAt: integer("started_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  duration: integer("duration"), // Duration in milliseconds
  
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
}, (table) => [
  index("idx_tool_call_logs_chat").on(table.chatId),
  index("idx_tool_call_logs_message").on(table.messageId),
  index("idx_tool_call_logs_status").on(table.status),
]);

export const insertToolCallLogSchema = createInsertSchema(toolCallLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type InsertToolCallLog = z.infer<typeof insertToolCallLogSchema>;
export type ToolCallLog = typeof toolCallLogs.$inferSelect;

// =============================================================================
// EXECUTION LOGS SYSTEM
// =============================================================================
/**
 * EXECUTION LOGS TABLE
 * --------------------
 * Audit trail for all tool executions, especially important for
 * security-sensitive operations like autoexec scripts.
 */
export const executionLogs = sqliteTable("execution_logs", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  taskId: text("task_id").references(() => toolTasks.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  input: text("input", { mode: "json" }), // Input parameters as JSONB
  output: text("output", { mode: "json" }), // Output/result as JSONB
  exitCode: text("exit_code"),
  duration: text("duration"), // Execution time in milliseconds
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertExecutionLogSchema = createInsertSchema(executionLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertExecutionLog = z.infer<typeof insertExecutionLogSchema>;
export type ExecutionLog = typeof executionLogs.$inferSelect;

// =============================================================================
// FEEDBACK SYSTEM - User feedback on AI responses for evolution
// =============================================================================
/**
 * FEEDBACK TABLE
 * --------------
 * Stores user feedback on AI responses. This is the backbone for the evolution
 * system - feedback is analyzed to generate improvements via GitHub PRs.
 */
export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  messageId: text("message_id").references(() => messages.id, { onDelete: "cascade" }),
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  rating: text("rating"), // "positive" | "negative" | null
  categories: text("categories", { mode: "json" }), // { accuracy, helpfulness, clarity, completeness }
  likedAspects: text("liked_aspects", { mode: "json" }).$type<string[]>(),
  dislikedAspects: text("disliked_aspects", { mode: "json" }).$type<string[]>(),
  freeformText: text("freeform_text"),
  promptSnapshot: text("prompt_snapshot"), // Full prompt at time of response
  responseSnapshot: text("response_snapshot"), // Full AI response
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  submittedAt: integer("submitted_at", { mode: "timestamp" }), // Set when feedback is submitted to GitHub PR
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

// =============================================================================
// LLM USAGE TRACKING - Token usage logging for all LLM calls
// =============================================================================
/**
 * LLM_USAGE TABLE
 * ---------------
 * Logs every LLM API call with token counts for monitoring and cost tracking.
 * Captures input tokens, output tokens, model used, and timing information.
 */
/**
 * GEMINI_CACHES TABLE
 * --------------------
 * Tracks transient context caches created in Gemini for token optimization.
 * Caches are created at the start of a turn and deleted after the agentic loop.
 */
export const geminiCaches = sqliteTable("gemini_caches", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  messageId: text("message_id").notNull(),
  cacheName: text("cache_name").notNull(), // The unique ID from Gemini API
  contentHash: text("content_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertGeminiCacheSchema = createInsertSchema(geminiCaches).omit({
  createdAt: true,
});
export type InsertGeminiCache = z.infer<typeof insertGeminiCacheSchema>;
export type GeminiCache = typeof geminiCaches.$inferSelect;

export const llmUsage = sqliteTable("llm_usage", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  messageId: text("message_id").references(() => messages.id, { onDelete: "cascade" }),
  model: text("model").notNull(), // e.g., "gemini-3-flash-preview-exp"
  promptTokens: integer("prompt_tokens").notNull(), // Input tokens
  completionTokens: integer("completion_tokens").notNull(), // Output tokens
  totalTokens: integer("total_tokens").notNull(), // Total tokens
  durationMs: integer("duration_ms"), // Request duration in milliseconds
  metadata: text("metadata", { mode: "json" }), // Additional metadata (e.g., thoughtsTokenCount for thinking models)
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertLlmUsageSchema = createInsertSchema(llmUsage).omit({
  id: true,
  createdAt: true,
});
export type InsertLlmUsage = z.infer<typeof insertLlmUsageSchema>;
export type LlmUsage = typeof llmUsage.$inferSelect;

// =============================================================================
// STRUCTURED LLM OUTPUT SCHEMAS
// =============================================================================
/**
 * These Zod schemas define the expected structure of LLM responses.
 * The LLM must return output conforming to these schemas for proper
 * processing by the RAG dispatcher.
 */

/**
 * All available tool types for the LLM to use
 */
export const ToolTypes = {
  // ==========================================================================
  // V2 CORE PRIMITIVES (7 foundational tools)
  // ==========================================================================
  TERMINAL: "terminal",       // Non-interactive shell command
  GET: "get",                 // Read file or URL
  PUT: "put",                 // Write file
  WRITE: "write",             // Output to chat window
  LOG: "log",                 // Append to log file
  SAY: "say",                 // HD voice output
  // SSH: "ssh",              // Persistent 2-way connection
  
  // ==========================================================================
  // LEGACY NAMES (maintained for backward compatibility)
  // ==========================================================================
  // Core operations
  API_CALL: "api_call",
 
  FILE_UPLOAD: "file_upload",
  SEARCH: "search",
  WEB_SEARCH: "web_search",
  GOOGLE_SEARCH: "google_search",
  DUCKDUCKGO_SEARCH: "duckduckgo_search",
  BROWSER_SCRAPE: "browser_scrape",
  CUSTOM: "custom",
  
  // Gmail operations
  GMAIL_LIST: "gmail_list",
  GMAIL_READ: "gmail_read",
  GMAIL_SEND: "gmail_send",
  GMAIL_SEARCH: "gmail_search",
  
  // Google Drive operations
  DRIVE_LIST: "drive_list",
  DRIVE_READ: "drive_read",
  DRIVE_CREATE: "drive_create",
  DRIVE_UPDATE: "drive_update",
  DRIVE_DELETE: "drive_delete",
  DRIVE_SEARCH: "drive_search",
  
  // Google Calendar operations
  CALENDAR_LIST: "calendar_list",
  CALENDAR_EVENTS: "calendar_events",
  CALENDAR_CREATE: "calendar_create",
  CALENDAR_UPDATE: "calendar_update",
  CALENDAR_DELETE: "calendar_delete",
  
  // Google Docs operations
  DOCS_READ: "docs_read",
  DOCS_CREATE: "docs_create",
  DOCS_APPEND: "docs_append",
  DOCS_REPLACE: "docs_replace",
  
  // Google Sheets operations
  SHEETS_READ: "sheets_read",
  SHEETS_WRITE: "sheets_write",
  SHEETS_APPEND: "sheets_append",
  SHEETS_CREATE: "sheets_create",
  SHEETS_CLEAR: "sheets_clear",
  
  // Google Tasks operations
  TASKS_LIST: "tasks_list",
  TASKS_GET: "tasks_get",
  TASKS_CREATE: "tasks_create",
  TASKS_UPDATE: "tasks_update",
  TASKS_COMPLETE: "tasks_complete",
  TASKS_DELETE: "tasks_delete",
  
  // Terminal operations
  TERMINAL_EXECUTE: "terminal_execute",
  
  // Tavily deep research
  TAVILY_SEARCH: "tavily_search",
  TAVILY_QNA: "tavily_qna",
  TAVILY_RESEARCH: "tavily_research",
  
  // Perplexity AI search
  PERPLEXITY_SEARCH: "perplexity_search",
  PERPLEXITY_QUICK: "perplexity_quick",
  PERPLEXITY_RESEARCH: "perplexity_research",
  PERPLEXITY_NEWS: "perplexity_news",
  
  // Browserbase operations (REMOVED)
  // BROWSERBASE_LOAD: "browserbase_load",
  // BROWSERBASE_SCREENSHOT: "browserbase_screenshot",
  // BROWSERBASE_ACTION: "browserbase_action",
  
  // GitHub operations
  GITHUB_REPOS: "github_repos",
  GITHUB_REPO_GET: "github_repo_get",
  GITHUB_REPO_SEARCH: "github_repo_search",
  GITHUB_CONTENTS: "github_contents",
  GITHUB_FILE_READ: "github_file_read",
  GITHUB_CODE_SEARCH: "github_code_search",
  GITHUB_ISSUES: "github_issues",
  GITHUB_ISSUE_GET: "github_issue_get",
  GITHUB_ISSUE_CREATE: "github_issue_create",
  GITHUB_ISSUE_UPDATE: "github_issue_update",
  GITHUB_ISSUE_COMMENT: "github_issue_comment",
  GITHUB_PULLS: "github_pulls",
  GITHUB_PULL_GET: "github_pull_get",
  GITHUB_COMMITS: "github_commits",
  GITHUB_USER: "github_user",
  
  // Queue operations (AI batch processing)
  QUEUE_CREATE: "queue_create",
  QUEUE_BATCH: "queue_batch",
  QUEUE_LIST: "queue_list",
  QUEUE_START: "queue_start",
  
  // Debug operations
  DEBUG_ECHO: "debug_echo",
  
  // Chat output - primary tool for sending content to chat window (non-terminating)
  SEND_CHAT: "write",
  
  // Turn control - terminates the interactive agentic loop (ONLY way to end turn)
  END_TURN: "end_turn",
  
  // File operations
  FILE_GET: "get",
  FILE_PUT: "put",
  
  // Twilio SMS/Voice operations
  SMS_SEND: "sms_send",
  SMS_LIST: "sms_list",
  CALL_MAKE: "call_make",
  CALL_LIST: "call_list",
  
  // Arduino/Hardware IoT
  ARDUINO_LIST_BOARDS: "arduino_list_boards",
  ARDUINO_COMPILE: "arduino_compile",
  ARDUINO_UPLOAD: "arduino_upload",
  ARDUINO_CREATE_SKETCH: "arduino_create_sketch",
  ARDUINO_INSTALL_LIBRARY: "arduino_install_library",
  ARDUINO_SEARCH_LIBRARIES: "arduino_search_libraries",
  
  // Google Contacts operations
  CONTACTS_LIST: "contacts_list",
  CONTACTS_SEARCH: "contacts_search",
  CONTACTS_GET: "contacts_get",
  CONTACTS_CREATE: "contacts_create",
  CONTACTS_UPDATE: "contacts_update",
  CONTACTS_DELETE: "contacts_delete",
} as const;

export type ToolType = typeof ToolTypes[keyof typeof ToolTypes];

/**
 * Tool Call Schema
 * Represents a single operation to be executed
 */
export const toolCallSchema = z.object({
  id: z.string(),
  type: z.enum([
    // ==========================================================================
    // V2 CORE PRIMITIVES (7 foundational tools)
    // These short names are the preferred interface; legacy names below are aliases
    // ==========================================================================
    "terminal",  // Non-interactive shell command (alias: terminal_execute)
    "get",       // Read file or URL (alias: get)
    "put",       // Write file (alias: put)
    "write",     // Output to chat window (alias: send_chat)
    "log",       // Append to log file (alias: append)
    "say",       // HD voice output (no alias needed)
    "soundboard", // Play a synthesized sound effect by name
    // ssh: persistent 2-way connection
    
    // ==========================================================================
    // LEGACY NAMES (maintained for backward compatibility)
    // ==========================================================================
    // Core

    // Chat output - primary tool for sending content to chat window
    "send_chat",
    // Turn control - terminates the agentic loop
    "end_turn",
    // Browser control - open URLs in new tabs
    "open_url",
    // File operations
    "get", "put",
    // Log operations
    "append",
    // Search & Scraping
    "google_search", "duckduckgo_search", "browser_scrape",
    // Gmail
    "gmail_list", "gmail_read", "gmail_send", "gmail_search",
    // Drive
    "drive_list", "drive_read", "drive_create", "drive_update", "drive_delete", "drive_search",
    // Calendar
    "calendar_list", "calendar_events", "calendar_create", "calendar_update", "calendar_delete",
    // Docs
    "docs_read", "docs_create", "docs_append", "docs_replace",
    // Sheets
    "sheets_read", "sheets_write", "sheets_append", "sheets_create", "sheets_clear",
    // Tasks
    "tasks_list", "tasks_get", "tasks_create", "tasks_update", "tasks_complete", "tasks_delete",
    // Terminal
    "terminal_execute",
    // Tavily deep research
    "tavily_search", "tavily_qna", "tavily_research",
    // Perplexity AI search
    "perplexity_search", "perplexity_quick", "perplexity_research", "perplexity_news",
    // Browserbase
    // "browserbase_load", "browserbase_screenshot", "browserbase_action",
    // GitHub
    "github_repos", "github_repo_get", "github_repo_search", "github_contents", 
    "github_file_read", "github_code_search", "github_issues", "github_issue_get",
    "github_issue_create", "github_issue_update", "github_issue_comment",
    "github_pulls", "github_pull_get", "github_commits", "github_user",
    // Queue (AI batch processing)
    "queue_create", "queue_batch", "queue_list", "queue_start",
    // Debug
    "debug_echo",
    // Contacts
    "contacts_list", "contacts_search", "contacts_get", "contacts_create", "contacts_update", "contacts_delete",
    "copilot_send_report",
    // Twilio SMS/Voice
    "sms_send", "sms_list", "call_make", "call_list",
    // Arduino/Hardware IoT
    "arduino_list_boards", "arduino_compile", "arduino_upload", 
    "arduino_create_sketch", "arduino_install_library", "arduino_search_libraries",
  ]),
  operation: z.string(),
  parameters: z.record(z.unknown()),
  priority: z.number().optional().default(0),
});
export type ToolCall = z.infer<typeof toolCallSchema>;

// =============================================================================
// CHAT OUTPUT PARAMETER SCHEMA
// =============================================================================

/**
 * Send Chat Parameters
 * The primary tool for sending content to the chat window
 * 
 * IMPORTANT: This is NON-TERMINATING - calling this does not end your turn.
 * You can call write multiple times within a single turn to provide
 * incremental updates as you work through multi-step operations.
 * 
 * Always explicitly call end_turn when you're ready to return control to the user.
 */
export const sendChatParamsSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
});
export type SendChatParams = z.infer<typeof sendChatParamsSchema>;

export const copilotSendReportParamsSchema = z.object({
  title: z.string().min(5),
  summary: z.string().min(20),
  details: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  files: z.array(z.string()).optional(),
});
export type CopilotSendReportParams = z.infer<typeof copilotSendReportParamsSchema>;

// =============================================================================
// BROWSER CONTROL PARAMETER SCHEMA
// =============================================================================

/**
 * Open URL Parameters
 * Tool for opening URLs in new browser tabs
 * The frontend handles this by executing window.open()
 */
export const openUrlParamsSchema = z.object({
  /** The URL to open in a new tab/window */
  url: z.string().url("Must be a valid URL"),
});
export type OpenUrlParams = z.infer<typeof openUrlParamsSchema>;

// =============================================================================
// VOICE OUTPUT PARAMETER SCHEMA
// =============================================================================

/**
 * Available voice options for expressive speech synthesis
 * Each voice has unique characteristics suitable for different use cases
 */
export const SayVoiceIds = [
  "Kore",    // Default female voice - warm and professional
  "Puck",    // Energetic and playful
  "Charon",  // Deep and authoritative
  "Fenrir",  // Bold and dramatic
  "Aoede",   // Melodic and soothing
  "Leda",    // Clear and articulate
  "Orus",    // Calm and measured
  "Zephyr",  // Light and airy
] as const;
export type SayVoiceId = typeof SayVoiceIds[number];

/**
 * Speaking style options that affect how the text is delivered
 * These modify the emotional tone and delivery of the speech
 */
export const SayStyles = [
  "natural",              // Default conversational tone
  "Say cheerfully",       // Upbeat and positive
  "Say seriously",        // Formal and grave
  "Say excitedly",        // High energy and enthusiastic
  "Say calmly",           // Relaxed and soothing
  "Say dramatically",     // Theatrical with emphasis
  "Whisper",              // Soft and quiet
  "Say like a news anchor", // Professional broadcast style
  "Say warmly",           // Friendly and inviting
  "Say professionally",   // Business-appropriate tone
] as const;
export type SayStyle = typeof SayStyles[number];

/**
 * Say Parameters
 * Voice output tool with expressive speech synthesis
 * Uses Gemini 2.5 Flash TTS for high-quality audio generation
 * 
 * IMPORTANT: This is NON-BLOCKING and NON-TERMINATING
 * - Speech generation happens asynchronously/concurrently with other operations
 * - Calling this does not end your turn
 * - You can use say alongside other tool calls in the same response
 * - Always explicitly call end_turn when ready to return control to user
 */
export const sayParamsSchema = z.object({
  /** The text content to be spoken aloud */
  utterance: z.string().min(1, "Utterance cannot be empty"),
  
  /** Voice to use for speech synthesis (default: "Kore") */
  voice: z.enum(SayVoiceIds).optional().default("Kore"),
  
  /** Speaking style that affects emotional tone and delivery (default: "natural") */
  style: z.enum(SayStyles).optional().default("natural"),
  
  /** Language/region code for pronunciation (default: "en-US") */
  locale: z.string().optional().default("en-US"),
  
  /** Turn ID for tracking multi-turn voice conversations */
  conversationalTurnId: z.string().optional(),
});
export type SayParams = z.infer<typeof sayParamsSchema>;

/**
 * File Get Parameters
 * Read a file from filesystem or editor canvas
 */
export const fileGetParamsSchema = z.object({
  path: z.string().min(1, "Path is required"),
  encoding: z.enum(["utf8", "base64"]).optional().default("utf8"),
});
export type FileGetParams = z.infer<typeof fileGetParamsSchema>;

/**
 * File Put Parameters
 * Write/create a file to filesystem or editor canvas
 */
export const filePutParamsSchema = z.object({
  path: z.string().min(1, "Path is required"),
  content: z.string(),
  mimeType: z.string().optional(),
  permissions: z.string().optional().default("644"),
  summary: z.string().optional(),
});
export type FilePutParams = z.infer<typeof filePutParamsSchema>;

// =============================================================================
// GOOGLE WORKSPACE PARAMETER SCHEMAS
// =============================================================================

/** Gmail send parameters */
export const gmailSendParamsSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
});
export type GmailSendParams = z.infer<typeof gmailSendParamsSchema>;

/** Gmail search parameters */
export const gmailSearchParamsSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(10),
});
export type GmailSearchParams = z.infer<typeof gmailSearchParamsSchema>;

/** Drive file parameters */
export const driveFileParamsSchema = z.object({
  fileId: z.string().optional(),
  name: z.string().optional(),
  content: z.string().optional(),
  mimeType: z.string().optional(),
  folderId: z.string().optional(),
});
export type DriveFileParams = z.infer<typeof driveFileParamsSchema>;

/** Drive search parameters */
export const driveSearchParamsSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(10),
});
export type DriveSearchParams = z.infer<typeof driveSearchParamsSchema>;

/** Calendar event parameters */
export const calendarEventParamsSchema = z.object({
  calendarId: z.string().optional().default("primary"),
  eventId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  start: z.string().optional(), // ISO datetime
  end: z.string().optional(), // ISO datetime
  attendees: z.array(z.string().email()).optional(),
  location: z.string().optional(),
});
export type CalendarEventParams = z.infer<typeof calendarEventParamsSchema>;

/** Docs operation parameters */
export const docsParamsSchema = z.object({
  documentId: z.string().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  findText: z.string().optional(),
  replaceText: z.string().optional(),
});
export type DocsParams = z.infer<typeof docsParamsSchema>;

/** Sheets operation parameters */
export const sheetsParamsSchema = z.object({
  spreadsheetId: z.string().optional(),
  title: z.string().optional(),
  range: z.string().optional(),
  values: z.array(z.array(z.unknown())).optional(),
});
export type SheetsParams = z.infer<typeof sheetsParamsSchema>;

/** Tasks operation parameters */
export const tasksParamsSchema = z.object({
  taskListId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  due: z.string().optional(), // ISO date
});
export type TasksParams = z.infer<typeof tasksParamsSchema>;

// =============================================================================
// WEB SEARCH PARAMETER SCHEMA
// =============================================================================

/** Web search parameters using Google Custom Search API */
export const webSearchParamsSchema = z.object({
  query: z.string(),
  maxTokens: z.number().optional().default(1024),
  searchRecency: z.enum(["day", "week", "month", "year"]).optional(),
  domains: z.array(z.string()).optional(),
});
export type WebSearchParams = z.infer<typeof webSearchParamsSchema>;

/** Google Custom Search parameters (fast, requires API key) */
export const googleSearchParamsSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(10),
  searchRecency: z.enum(["day", "week", "month", "year"]).optional(),
  domains: z.array(z.string()).optional(),
});
export type GoogleSearchParams = z.infer<typeof googleSearchParamsSchema>;

/** DuckDuckGo search parameters (free, no API key needed) */
export const duckduckgoSearchParamsSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(10),
});
export type DuckDuckGoSearchParams = z.infer<typeof duckduckgoSearchParamsSchema>;

/** Browser scrape parameters (Playwright-based for JS-heavy sites) */
export const browserScrapeParamsSchema = z.object({
  url: z.string().url(),
  timeout: z.number().optional().default(30000),
});
export type BrowserScrapeParams = z.infer<typeof browserScrapeParamsSchema>;

/** HTTP GET parameters for direct web requests */
export const httpGetParamsSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  params: z.record(z.string()).optional(),
  timeout: z.number().optional().default(30000),
});
export type HttpGetParams = z.infer<typeof httpGetParamsSchema>;

/** HTTP POST parameters for direct web requests */
export const httpPostParamsSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  body: z.union([z.string(), z.record(z.unknown())]),
  timeout: z.number().optional().default(30000),
});
export type HttpPostParams = z.infer<typeof httpPostParamsSchema>;

/** HTTP PUT parameters for direct web requests */
export const httpPutParamsSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  body: z.union([z.string(), z.record(z.unknown())]),
  timeout: z.number().optional().default(30000),
});
export type HttpPutParams = z.infer<typeof httpPutParamsSchema>;

/**
 * File Operation Schema
 * Defines a file to be created, replaced, or appended
 * 
 * PROTOCOL:
 * - mimeType: Indicates file type (e.g. "text/javascript", "text/plain")
 * - path: File location; if starts with "editor:" → save to Monaco editor canvas
 * - filename.ext: Full filename with extension
 * - permissions: Unix-style permissions (octal string, e.g. "644")
 * - summary: Short description of file purpose/changes
 * - content: File content
 * - encoding: How content is encoded (utf8 or base64)
 */
export const fileOperationSchema = z.object({
  action: z.enum(["create", "replace", "append"]),
  filename: z.string(),
  path: z.string(),
  mimeType: z.string().optional(),
  permissions: z.string().optional().default("644"),
  summary: z.string().optional(),
  content: z.string(),
  encoding: z.enum(["utf8", "base64"]).default("utf8"),
});
export type FileOperation = z.infer<typeof fileOperationSchema>;

/**
 * Binary File Operation Schema
 * For creating binary files from base64 encoded content
 * 
 * PROTOCOL:
 * - mimeType: Required for binary files (e.g. "image/png", "application/pdf")
 * - path: File location; if starts with "editor:" → save to Monaco editor canvas
 * - filename.ext: Full filename with extension
 * - permissions: Unix-style permissions (octal string, e.g. "644")
 * - summary: Short description of file purpose/changes
 * - base64Content: Binary content as base64 string
 */
export const binaryFileOperationSchema = z.object({
  action: z.enum(["create", "replace"]),
  filename: z.string(),
  path: z.string(),
  mimeType: z.string(),
  permissions: z.string().optional().default("644"),
  summary: z.string().optional(),
  base64Content: z.string(),
});
export type BinaryFileOperation = z.infer<typeof binaryFileOperationSchema>;

/**
 * Autoexec Script Schema
 * Special file that can be executed with elevated permissions
 */
export const autoexecSchema = z.object({
  filename: z.literal("autoexec.666"),
  content: z.string(),
  requiresSudo: z.boolean().default(false),
  sshTarget: z.string().optional(),
  timeout: z.number().optional().default(30000),
});
export type AutoexecScript = z.infer<typeof autoexecSchema>;

/**
 * Complete Structured LLM Response Schema
 * LLM returns toolCalls array - all output goes through tools (write, say, put, etc.)
 */
export const structuredLLMResponseSchema = z.object({
  toolCalls: z.array(toolCallSchema).optional().default([]),
  metadata: z.object({
    processingTime: z.number().optional(),
    modelUsed: z.string().optional(),
    tokenCount: z.number().optional(),
  }).optional(),
});
export type StructuredLLMResponse = z.infer<typeof structuredLLMResponseSchema>;

// =============================================================================
// DOCUMENT CHUNKS SYSTEM (RAG)
// =============================================================================
/**
 * DOCUMENT CHUNKS TABLE
 * ---------------------
 * Stores chunked documents with their vector embeddings for semantic search.
 * Used in the RAG (Retrieval Augmented Generation) pipeline.
 * 
 * When a document is uploaded:
 * 1. It's split into semantic chunks (paragraphs, sections)
 * 2. Each chunk is embedded using Gemini's embedding model
 * 3. Chunks are stored with their embeddings for later retrieval
 * 4. On query, relevant chunks are found via vector similarity search
 */
// Document Chunks table removed
// export const documentChunks = sqliteTable("document_chunks", { ... });

// export const insertDocumentChunkSchema = ...;
// export type InsertDocumentChunk = ...;
// export type DocumentChunk = ...;

// =============================================================================
// GOOGLE OAUTH TOKENS
// =============================================================================
/**
 * GOOGLE OAUTH TOKENS TABLE
 * -------------------------
 * Stores Google OAuth2 tokens for persistent authentication.
 * Uses a singleton pattern (id = 'default') for single-user app.
 */
export const googleOAuthTokens = sqliteTable("google_oauth_tokens", {
  id: text("id").primaryKey().default("default"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiryDate: integer("expiry_date"),
  tokenType: text("token_type"),
  scope: text("scope"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertGoogleOAuthTokensSchema = createInsertSchema(googleOAuthTokens).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertGoogleOAuthTokens = z.infer<typeof insertGoogleOAuthTokensSchema>;
export type GoogleOAuthTokens = typeof googleOAuthTokens.$inferSelect;

/**
 * Message role enum for type safety
 */
export const MessageRole = {
  USER: "user",
  AI: "ai",
} as const;
export type MessageRoleType = typeof MessageRole[keyof typeof MessageRole];

/**
 * Helper function to generate a chat filename with timestamp
 */
export function generateChatFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `Chat-${timestamp}.txt`;
}

// =============================================================================
// RESPONSE PARSING HELPERS
// =============================================================================

/**
 * Extract JSON from LLM response that may contain markdown code blocks
 */
export function extractJsonFromResponse(response: string): string | null {
  // Try to find JSON in code blocks first
  const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }
  
  // Try to find raw JSON object
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  return null;
}

/**
 * Parse structured LLM response with fallback for plain text
 */
export function parseStructuredResponse(response: string): StructuredLLMResponse | null {
  const jsonStr = extractJsonFromResponse(response);
  if (!jsonStr) {
    return null;
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    const result = structuredLLMResponseSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.error("Schema validation failed:", JSON.stringify(result.error.errors, null, 2));
    
    // Try to extract toolCalls even if full validation fails
    if (Array.isArray(parsed?.toolCalls)) {
      console.log("Extracting toolCalls from partially valid response");
      return {
        toolCalls: parsed.toolCalls,
      };
    }
    
    return null;
  } catch (e) {
    console.error("JSON parse error:", e);
    return null;
  }
}

/**
 * Create a fallback structured response when LLM returns plain text
 * Plain text is converted to a write tool call followed by implicit end_turn
 */
export function createFallbackResponse(plainText: string): StructuredLLMResponse {
  return {
    toolCalls: [{
      id: "fallback_chat",
      type: "write" as const,
      operation: "respond",
      parameters: { content: plainText },
      priority: 0,
    }],
  };
}

/**
 * Check if response appears to be structured JSON
 */
export function isStructuredResponse(response: string): boolean {
  const trimmed = response.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("```json") ||
    trimmed.includes('"toolCalls"')
  );
}

// =============================================================================
// LOG PARSER TABLES
// =============================================================================

// Conversation Sources and Ingestion Jobs tables removed
// export const conversationSources = sqliteTable("conversation_sources", { ... });
// export const insertConversationSourceSchema = ...;
// export type InsertConversationSource = ...;

// export const ingestionJobs = sqliteTable("ingestion_jobs", { ... });
// export const insertIngestionJobSchema = ...;
// export type InsertIngestionJob = ...;


// Extracted Knowledge table removed
// export const extractedKnowledge = sqliteTable("extracted_knowledge", { ... });
// export const insertExtractedKnowledgeSchema = ...;
// export type InsertExtractedKnowledge = ...;

// =============================================================================
// KNOWLEDGE PIPELINE TABLES (Multimodal Ingestion/Retrieval)
// =============================================================================



// Entities and Entity Mentions tables removed
// export const entities = sqliteTable("entities", { ... });
// export const insertEntitySchema = ...;
// export type InsertEntity = ...;

// export const entityMentions = sqliteTable("entity_mentions", { ... });
// export const insertEntityMentionSchema = ...;
// export type InsertEntityMention = ...;


// Knowledge Embeddings table removed
// export const knowledgeEmbeddings = sqliteTable("knowledge_embeddings", { ... });
// export const insertKnowledgeEmbeddingSchema = ...;
// export type InsertKnowledgeEmbedding = ...;








/**
 * KERNELS TABLE
 * -------------
 * The Kernel is a version-controlled AI configuration that stores the model's
 * personality, directives, and learned behaviors. This is the heart of the
 * self-evolving AI system described in the vision documentation.
 * 
 * Key concept: "Self-awareness is achieved by saving the state of the stateless"
 * 
 * Each kernel version captures:
 * - Core directives (what the AI should always do)
 * - Personality traits (how the AI should communicate)
 * - Learned behaviors (patterns discovered through interaction)
 * - User preferences (remembered from past sessions)
 * 
 * The kernel is injected into the system prompt at the start of each session,
 * allowing the AI to maintain continuity across conversations.
 */




// =============================================================================
// TASK QUEUE SYSTEM - AI batch processing queue
// =============================================================================
/**
 * QUEUED TASKS TABLE
 * ------------------
 * Stores tasks that the AI has prepared for batch execution.
 * 
 * When a user requests complex work (like "research topic X"), the AI
 * generates a list of subtasks that get queued here for processing.
 * 
 * Task lifecycle: pending -> running -> completed/failed/cancelled
 * 
 * Tasks can have parent-child relationships for hierarchical execution.
 */
export const queuedTasks = sqliteTable("queued_tasks", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Optional parent task for hierarchical task trees
  parentId: text("parent_id").references((): any => queuedTasks.id, { onDelete: "cascade" }),
  
  // Link to chat where task was created
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  
  // Task details
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull(), // research, action, analysis, synthesis, etc.
  
  // Priority for queue ordering (higher = more urgent)
  priority: integer("priority").default(0).notNull(),
  
  // Execution status
  status: text("status").default("pending").notNull(), // pending, running, completed, failed, cancelled
  
  // Input/output data
  input: text("input", { mode: "json" }), // Task parameters and context
  output: text("output", { mode: "json" }), // Result after execution
  error: text("error"), // Error message if failed
  
  // Execution mode and flow control
  executionMode: text("execution_mode").default("sequential").notNull(), // sequential, parallel
  condition: text("condition"), // Natural language condition for if/then logic
  conditionResult: integer("condition_result", { mode: "boolean" }), // Result of condition evaluation
  dependencies: text("dependencies", { mode: "json" }).$type<string[]>(), // Array of task IDs that must complete first
  
  // Operator interaction
  waitingForInput: integer("waiting_for_input", { mode: "boolean" }).default(false).notNull(),
  inputPrompt: text("input_prompt"), // What to ask the operator
  operatorInput: text("operator_input"), // Response from operator
  
  // Workflow reference
  workflowId: text("workflow_id"), // Links to a workflow definition
  
  // Metadata
  estimatedDuration: integer("estimated_duration"), // Estimated seconds to complete
  actualDuration: integer("actual_duration"), // Actual seconds taken
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const insertQueuedTaskSchema = createInsertSchema(queuedTasks).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});
export type InsertQueuedTask = z.infer<typeof insertQueuedTaskSchema>;
export type QueuedTask = typeof queuedTasks.$inferSelect;

/**
 * Task type constants
 */
export const TaskTypes = {
  RESEARCH: "research",      // Deep dive into a topic
  ACTION: "action",          // Execute a specific action
  ANALYSIS: "analysis",      // Analyze data or content
  SYNTHESIS: "synthesis",    // Combine information into output
  FETCH: "fetch",           // Retrieve data from a source
  TRANSFORM: "transform",    // Convert data format
  VALIDATE: "validate",      // Verify or check something
  NOTIFY: "notify",          // Send notification or message
} as const;

export type TaskType = typeof TaskTypes[keyof typeof TaskTypes];

/**
 * Task status constants
 */
export const TaskStatuses = {
  PENDING: "pending",
  RUNNING: "running",
  PAUSED: "paused",
  WAITING_INPUT: "waiting_input",
  WAITING_DEPENDENCY: "waiting_dependency",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type TaskStatus = typeof TaskStatuses[keyof typeof TaskStatuses];

/**
 * Execution mode constants
 */
export const ExecutionModes = {
  SEQUENTIAL: "sequential",
  PARALLEL: "parallel",
} as const;

export type ExecutionMode = typeof ExecutionModes[keyof typeof ExecutionModes];

// ============================================================================
// SCHEDULES - Cron jobs and scheduled task execution
// ============================================================================

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Schedule identity
  name: text("name").notNull(),
  description: text("description"),
  
  // Cron expression (e.g., "0 9 * * 1" = every Monday at 9am)
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").default("UTC").notNull(),
  
  // What to execute
  taskTemplate: text("task_template", { mode: "json" }).notNull(), // Task definition to create when triggered
  workflowId: text("workflow_id"), // Or link to a workflow
  
  // State
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  runCount: integer("run_count").default(0).notNull(),
  
  // Error handling
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  maxConsecutiveFailures: integer("max_consecutive_failures").default(3),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
  nextRunAt: true,
  runCount: true,
  consecutiveFailures: true,
  lastError: true,
});
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedules.$inferSelect;

// ============================================================================
// TRIGGERS - Event-driven task execution
// ============================================================================

export const triggers = sqliteTable("triggers", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Trigger identity
  name: text("name").notNull(),
  description: text("description"),
  
  // Trigger type and configuration
  triggerType: text("trigger_type").notNull(), // email, sms, prompt_keyword, webhook, manual
  
  // Pattern matching (depends on trigger type)
  pattern: text("pattern"), // Regex or keyword pattern
  senderFilter: text("sender_filter"), // For email/SMS: filter by sender
  subjectFilter: text("subject_filter"), // For email: filter by subject
  
  // What to execute
  taskTemplate: text("task_template", { mode: "json" }), // Task definition to create when triggered
  workflowId: text("workflow_id"), // Or link to a workflow
  priority: integer("priority").default(5).notNull(), // Priority for triggered tasks
  
  // Webhook-specific
  webhookSecret: text("webhook_secret"), // For validating webhook calls
  
  // State
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  lastTriggeredAt: integer("last_triggered_at", { mode: "timestamp" }),
  triggerCount: integer("trigger_count").default(0).notNull(),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertTriggerSchema = createInsertSchema(triggers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTriggeredAt: true,
  triggerCount: true,
});
export type InsertTrigger = z.infer<typeof insertTriggerSchema>;
export type Trigger = typeof triggers.$inferSelect;

/**
 * Trigger type constants
 */
export const TriggerTypes = {
  EMAIL: "email",           // Triggered by incoming email
  SMS: "sms",               // Triggered by incoming SMS (Twilio)
  PROMPT_KEYWORD: "prompt_keyword", // Triggered by keyword in user prompt
  WEBHOOK: "webhook",       // Triggered by external HTTP request
  MANUAL: "manual",         // Triggered manually by user
} as const;

export type TriggerType = typeof TriggerTypes[keyof typeof TriggerTypes];

// ============================================================================
// WORKFLOWS - Reusable workflow definitions
// ============================================================================

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Workflow identity
  name: text("name").notNull(),
  description: text("description"),
  
  // Workflow definition
  steps: text("steps", { mode: "json" }).notNull(), // Array of step definitions
  
  // Execution settings
  defaultExecutionMode: text("default_execution_mode").default("sequential").notNull(),
  maxParallelTasks: integer("max_parallel_tasks").default(3),
  timeoutSeconds: integer("timeout_seconds").default(3600), // 1 hour default
  
  // State
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  version: integer("version").default(1).notNull(),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

// ============================================================================
// EXECUTOR STATE - Track executor status
// ============================================================================

export const executorState = sqliteTable("executor_state", {
  id: text("id").primaryKey().default("singleton"), // Only one row
  
  // Executor status
  status: text("status").default("stopped").notNull(), // running, stopped, paused
  
  // Current execution
  currentTaskId: text("current_task_id"),
  runningTaskIds: text("running_task_ids", { mode: "json" }).$type<string[]>(), // For parallel execution
  
  // Statistics
  tasksProcessed: integer("tasks_processed").default(0).notNull(),
  tasksFailed: integer("tasks_failed").default(0).notNull(),
  lastActivityAt: integer("last_activity_at", { mode: "timestamp" }),
  
  // Settings
  maxParallelTasks: integer("max_parallel_tasks").default(3),
  pollIntervalMs: integer("poll_interval_ms").default(5000),
  
  // Timestamps
  startedAt: integer("started_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export type ExecutorState = typeof executorState.$inferSelect;

// ============================================================================
// COLLABORATIVE EDITING - Real-time collaborative sessions
// ============================================================================

/**
 * COLLABORATIVE SESSIONS TABLE
 * ----------------------------
 * Stores active collaborative editing sessions where multiple participants
 * (users and AI) can edit files together in real-time.
 */
export const collaborativeSessions = sqliteTable("collaborative_sessions", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Session identity
  name: text("name").notNull(),
  description: text("description"),
  
  // Owner/host of the session
  hostUserId: text("host_user_id").references(() => users.id),
  
  // Files being edited in this session
  files: text("files", { mode: "json" }).notNull().default([]), // Array of {path, content, language}
  
  // Session settings
  isVoiceEnabled: integer("is_voice_enabled", { mode: "boolean" }).default(true).notNull(),
  isPublic: integer("is_public", { mode: "boolean" }).default(false).notNull(),
  maxParticipants: integer("max_participants").default(5),
  
  // State
  status: text("status").default("active").notNull(), // active, paused, ended
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
});

export const insertCollaborativeSessionSchema = createInsertSchema(collaborativeSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  endedAt: true,
});
export type InsertCollaborativeSession = z.infer<typeof insertCollaborativeSessionSchema>;
export type CollaborativeSession = typeof collaborativeSessions.$inferSelect;

/**
 * SESSION PARTICIPANTS TABLE
 * --------------------------
 * Tracks who is currently participating in a collaborative session.
 */
export const sessionParticipants = sqliteTable("session_participants", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // References
  sessionId: text("session_id").references(() => collaborativeSessions.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id),
  
  // Participant identity (for AI or anonymous users)
  participantType: text("participant_type").default("user").notNull(), // user, ai, guest
  displayName: text("display_name").notNull(),
  avatarColor: text("avatar_color").default("#4285f4"),
  
  // Permissions
  canEdit: integer("can_edit", { mode: "boolean" }).default(true).notNull(),
  canVoice: integer("can_voice", { mode: "boolean" }).default(true).notNull(),
  
  // Current state
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  
  // Timestamps
  joinedAt: integer("joined_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  leftAt: integer("left_at", { mode: "timestamp" }),
});

export const insertSessionParticipantSchema = createInsertSchema(sessionParticipants).omit({
  id: true,
  joinedAt: true,
  leftAt: true,
});
export type InsertSessionParticipant = z.infer<typeof insertSessionParticipantSchema>;
export type SessionParticipant = typeof sessionParticipants.$inferSelect;

/**
 * CURSOR POSITIONS TABLE
 * ----------------------
 * Stores real-time cursor positions for each participant in a session.
 * Updated frequently via WebSocket, periodically persisted.
 */
export const cursorPositions = sqliteTable("cursor_positions", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // References
  sessionId: text("session_id").references(() => collaborativeSessions.id, { onDelete: "cascade" }).notNull(),
  participantId: text("participant_id").references(() => sessionParticipants.id, { onDelete: "cascade" }).notNull(),
  
  // File context
  filePath: text("file_path").notNull(),
  
  // Cursor position
  line: integer("line").notNull(),
  column: integer("column").notNull(),
  
  // Selection (if any)
  selectionStartLine: integer("selection_start_line"),
  selectionStartColumn: integer("selection_start_column"),
  selectionEndLine: integer("selection_end_line"),
  selectionEndColumn: integer("selection_end_column"),
  
  // Timestamps
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export type CursorPosition = typeof cursorPositions.$inferSelect;

/**
 * EDIT OPERATIONS TABLE
 * ---------------------
 * Stores edit operations for conflict resolution (OT/CRDT).
 * Each operation represents a change to the document.
 */
export const editOperations = sqliteTable("edit_operations", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // References
  sessionId: text("session_id").references(() => collaborativeSessions.id, { onDelete: "cascade" }).notNull(),
  participantId: text("participant_id").references(() => sessionParticipants.id).notNull(),
  
  // File context
  filePath: text("file_path").notNull(),
  
  // Operation details
  operationType: text("operation_type").notNull(), // insert, delete, replace
  position: integer("position").notNull(), // Character position in document
  length: integer("length"), // For delete/replace: number of chars affected
  text: text("text"), // For insert/replace: the text to insert
  
  // Versioning for OT
  baseVersion: integer("base_version").notNull(),
  resultVersion: integer("result_version").notNull(),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
}, (table) => [
  index("idx_edit_ops_session").on(table.sessionId),
  index("idx_edit_ops_version").on(table.sessionId, table.baseVersion),
]);

export type EditOperation = typeof editOperations.$inferSelect;

// =============================================================================
// JOB ORCHESTRATION TABLES
// For multi-worker agent job processing with DAG dependencies
// =============================================================================

/**
 * AGENT JOBS TABLE
 * -----------------
 * Tracks jobs submitted to the orchestration system.
 * Supports DAG-based dependencies, priority queues, and parallel execution.
 */
export const agentJobs = sqliteTable("agent_jobs", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Job identification
  name: text("name").notNull(),
  type: text("type").notNull(), // 'prompt', 'tool', 'composite', 'workflow'
  
  // Priority (0 = highest, 10 = lowest)
  priority: integer("priority").default(5).notNull(),
  
  // Parent job (for hierarchical/composite jobs)
  parentJobId: text("parent_job_id").references((): any => agentJobs.id, { onDelete: "cascade" }),
  
  // Dependencies (array of job IDs that must complete before this job runs)
  dependencies: text("dependencies", { mode: "json" }).$type<string[]>().default([]),
  
  // Execution mode
  executionMode: text("execution_mode").default("sequential").notNull(), // 'sequential', 'parallel', 'batch'
  
  // Job payload (prompt, tool args, etc.)
  payload: text("payload", { mode: "json" }).notNull(),
  
  // Status tracking
  status: text("status").default("pending").notNull(), // 'pending', 'queued', 'running', 'completed', 'failed', 'cancelled'
  
  // Assignment
  workerId: text("worker_id"),
  
  // Retry configuration
  maxRetries: integer("max_retries").default(3),
  retryCount: integer("retry_count").default(0),
  
  // Timeout (milliseconds)
  timeout: integer("timeout").default(300000), // 5 minutes default
  
  // Scheduling
  scheduledFor: integer("scheduled_for", { mode: "timestamp" }),
  cronExpression: text("cron_expression"),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  
  // User association
  userId: text("user_id"),
}, (table) => [
  index("idx_agent_jobs_status").on(table.status),
  index("idx_agent_jobs_priority").on(table.priority),
  index("idx_agent_jobs_parent").on(table.parentJobId),
  index("idx_agent_jobs_scheduled").on(table.scheduledFor),
]);

export const insertAgentJobSchema = createInsertSchema(agentJobs).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});
export type InsertAgentJob = z.infer<typeof insertAgentJobSchema>;
export type AgentJob = typeof agentJobs.$inferSelect;

/**
 * JOB RESULTS TABLE
 * ------------------
 * Stores outputs from completed jobs.
 * Supports structured results, streaming data, and aggregation.
 */
export const jobResults = sqliteTable("job_results", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Job reference
  jobId: text("job_id").references(() => agentJobs.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Result data
  success: integer("success", { mode: "boolean" }).notNull(),
  output: text("output", { mode: "json" }), // Structured result data
  error: text("error"), // Error message if failed
  
  // Token usage tracking
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  
  // Execution metrics
  durationMs: integer("duration_ms"),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
}, (table) => [
  index("idx_job_results_job").on(table.jobId),
]);

export const insertJobResultSchema = createInsertSchema(jobResults).omit({
  id: true,
  createdAt: true,
});
export type InsertJobResult = z.infer<typeof insertJobResultSchema>;
export type JobResult = typeof jobResults.$inferSelect;

/**
 * AGENT WORKERS TABLE
 * --------------------
 * Tracks active workers in the pool.
 * Used for health checks, load balancing, and auto-restart.
 */
export const agentWorkers = sqliteTable("agent_workers", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Worker identification
  name: text("name").notNull(),
  type: text("type").default("gemini").notNull(), // 'gemini', 'custom'
  
  // Status
  status: text("status").default("idle").notNull(), // 'idle', 'busy', 'offline', 'error'
  
  // Current job
  currentJobId: text("current_job_id").references(() => agentJobs.id),
  
  // Capacity
  maxConcurrency: integer("max_concurrency").default(1),
  activeJobs: integer("active_jobs").default(0),
  
  // Health tracking
  lastHeartbeat: integer("last_heartbeat", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  // Metrics
  totalJobsProcessed: integer("total_jobs_processed").default(0),
  totalTokensUsed: integer("total_tokens_used").default(0),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
}, (table) => [
  index("idx_agent_workers_status").on(table.status),
  index("idx_agent_workers_heartbeat").on(table.lastHeartbeat),
]);

export const insertAgentWorkerSchema = createInsertSchema(agentWorkers).omit({
  id: true,
  createdAt: true,
  lastHeartbeat: true,
});
export type InsertAgentWorker = z.infer<typeof insertAgentWorkerSchema>;
export type AgentWorker = typeof agentWorkers.$inferSelect;

// =============================================================================
// AGENT IDENTITY SYSTEM
// For per-agent attribution of GitHub/Google Workspace actions
// =============================================================================

/**
 * AGENT IDENTITIES TABLE
 * ----------------------
 * Stores distinct agent identities for attribution of automated actions.
 * Each agent has its own identity that can be used to sign commits, PRs,
 * issues, and other automated operations.
 * 
 * While actions are authenticated using the primary user's API key,
 * the author/creator is attributed to the specific agent.
 */
export const agentIdentities = sqliteTable("agent_identities", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Agent identification
  name: text("name").notNull().unique(), // e.g., "Agentia Compiler"
  email: text("email").notNull(), // Git commit email, e.g., "compiler@agentia.dev"
  username: text("username"), // Optional GitHub username if dedicated account exists
  
  // Agent type and permissions
  agentType: text("agent_type").notNull(), // 'compiler', 'guest', 'specialized'
  permissionLevel: text("permission_level").default("full").notNull(), // 'full', 'limited', 'readonly'
  
  // Display information
  displayName: text("display_name").notNull(), // Human-readable name
  avatarUrl: text("avatar_url"), // Optional avatar image URL
  description: text("description"), // Agent's purpose/role
  
  // Configuration
  githubSignature: text("github_signature"), // Signature added to commits/PRs
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertAgentIdentitySchema = createInsertSchema(agentIdentities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentIdentity = z.infer<typeof insertAgentIdentitySchema>;
export type AgentIdentity = typeof agentIdentities.$inferSelect;

/**
 * AGENT ACTIVITY LOG TABLE
 * -------------------------
 * Audit trail of all actions performed by agents.
 * Tracks GitHub commits, PRs, issues, and Google Workspace operations.
 */
export const agentActivityLog = sqliteTable("agent_activity_log", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Agent reference
  agentId: text("agent_id").references(() => agentIdentities.id, { onDelete: "cascade" }).notNull(),
  
  // Activity details
  activityType: text("activity_type").notNull(), // 'commit', 'pr', 'issue', 'email', 'doc_edit', etc.
  platform: text("platform").notNull(), // 'github', 'gmail', 'drive', 'calendar', etc.
  
  // Resource identification
  resourceType: text("resource_type"), // 'repository', 'issue', 'pull_request', 'email', 'document'
  resourceId: text("resource_id"), // External ID (PR number, commit SHA, email ID, etc.)
  resourceUrl: text("resource_url"), // Direct link to the resource
  
  // Action details
  action: text("action").notNull(), // 'create', 'update', 'delete', 'comment'
  title: text("title"), // Brief description of the action
  metadata: text("metadata", { mode: "json" }), // Additional context (commit message, PR body, etc.)
  
  // Result
  success: integer("success", { mode: "boolean" }).default(true).notNull(),
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
}, (table) => [
  index("idx_agent_activity_agent").on(table.agentId),
  index("idx_agent_activity_type").on(table.activityType),
  index("idx_agent_activity_platform").on(table.platform),
]);

export const insertAgentActivityLogSchema = createInsertSchema(agentActivityLog).omit({
  id: true,
  createdAt: true,
});
export type InsertAgentActivityLog = z.infer<typeof insertAgentActivityLogSchema>;
export type AgentActivityLog = typeof agentActivityLog.$inferSelect;

/**
 * Agent type constants
 */
export const AgentTypes = {
  COMPILER: "compiler",     // Main AI agent with full permissions
  GUEST: "guest",           // Guest user agent with limited permissions
  SPECIALIZED: "specialized" // Specialized agents for specific tasks
} as const;

export type AgentType = typeof AgentTypes[keyof typeof AgentTypes];

/**
 * Permission level constants
 */
export const PermissionLevels = {
  FULL: "full",       // Full access to all operations
  LIMITED: "limited", // Limited access (read + basic write)
  READONLY: "readonly" // Read-only access
} as const;

export type PermissionLevel = typeof PermissionLevels[keyof typeof PermissionLevels];

// =============================================================================
// SSH HOST MANAGEMENT
// For AI-driven remote server connections
// =============================================================================

/**
 * SSH HOSTS TABLE
 * ---------------
 * Stores SSH connection profiles for remote servers.
 * The AI can generate keys, add hosts, and establish connections.
 */
export const sshHosts = sqliteTable("ssh_hosts", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Connection details
  alias: text("alias").notNull().unique(), // User-friendly name (e.g., "my-server")
  hostname: text("hostname").notNull(), // IP or domain
  port: integer("port").default(22).notNull(),
  username: text("username").notNull(),
  
  // Authentication - references a secret or env var by name
  keySecretName: text("key_secret_name"), // Name of secret storing private key
  passwordSecretName: text("password_secret_name"), // Alternative: password auth
  
  // Connection state
  lastConnected: integer("last_connected", { mode: "timestamp" }),
  lastError: text("last_error"),
  
  // Metadata
  description: text("description"),
  tags: text("tags", { mode: "json" }).$type<string[]>(), // For categorization
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertSshHostSchema = createInsertSchema(sshHosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastConnected: true,
  lastError: true,
});
export type InsertSshHost = z.infer<typeof insertSshHostSchema>;
export type SshHost = typeof sshHosts.$inferSelect;

/**
 * SSH KEYS TABLE
 * --------------
 * Stores SSH key pair metadata (public keys only - private keys go to secrets).
 */
export const sshKeys = sqliteTable("ssh_keys", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  name: text("name").notNull().unique(), // Key pair name
  publicKey: text("public_key").notNull(), // The public key content
  privateKeySecretName: text("private_key_secret_name").notNull(), // Reference to secret/env var
  
  keyType: text("key_type").default("ed25519").notNull(), // ed25519, rsa, etc.
  fingerprint: text("fingerprint"), // SSH key fingerprint
  
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertSshKeySchema = createInsertSchema(sshKeys).omit({
  id: true,
  createdAt: true,
});
export type InsertSshKey = z.infer<typeof insertSshKeySchema>;
export type SshKey = typeof sshKeys.$inferSelect;

// ============================================================================
// SMS MESSAGES - Twilio Inbound SMS Storage
// ============================================================================

/**
 * SMS MESSAGES TABLE
 * ------------------
 * Stores inbound and outbound SMS messages from Twilio integration.
 * Used for tracking conversations via SMS and enabling AI responses.
 */
export const smsMessages = sqliteTable("sms_messages", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Twilio identifiers
  messageSid: text("message_sid").unique().notNull(), // Twilio's unique message ID
  accountSid: text("account_sid").notNull(), // Twilio account SID
  
  // Message content
  from: text("from").notNull(), // Sender phone number
  to: text("to").notNull(), // Recipient phone number
  body: text("body").notNull(), // Message content
  
  // Message metadata - using varchar with specific constraints for type safety
  direction: text("direction").notNull(), // "inbound" or "outbound"
  status: text("status").notNull(), // Twilio message status (received, sent, failed, etc.)
  numMedia: integer("num_media").default(0), // Number of media attachments
  mediaUrls: text("media_urls", { mode: "json" }), // Array of media URLs if present
  
  // Processing state
  processed: integer("processed", { mode: "boolean" }).default(false).notNull(), // Whether AI has processed this message
  chatId: text("chat_id").references(() => chats.id, { onDelete: "set null" }), // Link to chat if AI responded
  responseMessageSid: text("response_message_sid"), // SID of the response message we sent
  
  // Error tracking
  errorCode: integer("error_code"), // Twilio error code if any
  errorMessage: text("error_message"), // Error details
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  processedAt: integer("processed_at", { mode: "timestamp" }), // When AI processed the message
});

export const insertSmsMessageSchema = createInsertSchema(smsMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type SmsMessage = typeof smsMessages.$inferSelect;
// =============================================================================
// TWILIO CONVERSATIONAL CALLING SYSTEM
// =============================================================================

/**
 * CALL CONVERSATIONS TABLE
 * -------------------------
 * Stores metadata and state for Twilio voice call conversations.
 * Enables multi-turn, AI-powered phone conversations with context preservation.
 * 
 * Each call conversation:
 * - Tracks caller info and call SID
 * - Maintains conversation state (active, completed, failed)
 * - Links to associated chat for full conversation history
 * - Records call duration and outcome
 */
export const callConversations = sqliteTable("call_conversations", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Twilio call identification
  callSid: text("call_sid").notNull().unique(), // Twilio call identifier
  fromNumber: text("from_number").notNull(), // Caller's phone number
  toNumber: text("to_number").notNull(), // Receiving number (our Twilio number)
  
  // Associated chat for conversation history
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  
  // Call state
  status: text("status").default("in_progress").notNull(), // in_progress, completed, failed, no_input
  
  // Conversation metadata
  turnCount: integer("turn_count").default(0).notNull(), // Number of speech turns
  currentContext: text("current_context"), // Last question asked or context
  
  // Recording and transcription
  recordingUrl: text("recording_url"), // URL to the full call recording
  recordingSid: text("recording_sid"), // Twilio recording identifier
  transcription: text("transcription"), // Full call transcription
  transcriptionStatus: text("transcription_status"), // pending, completed, failed
  
  // Timing
  startedAt: integer("started_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  duration: integer("duration"), // Call duration in seconds
  
  // Error tracking
  errorMessage: text("error_message"),
  
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
}, (table) => [
  index("idx_call_conversations_sid").on(table.callSid),
  index("idx_call_conversations_status").on(table.status),
  index("idx_call_conversations_recording_sid").on(table.recordingSid),
]);

export const insertCallConversationSchema = createInsertSchema(callConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  endedAt: true,
});
export type InsertCallConversation = z.infer<typeof insertCallConversationSchema>;
export type CallConversation = typeof callConversations.$inferSelect;

/**
 * CALL TURNS TABLE
 * ----------------
 * Stores individual speech turns within a call conversation.
 * Each turn represents one user speech input and the AI's response.
 */
export const callTurns = sqliteTable("call_turns", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Link to parent conversation
  conversationId: text("conversation_id").references(() => callConversations.id, { onDelete: "cascade" }).notNull(),
  
  // Turn sequence
  turnNumber: integer("turn_number").notNull(), // Sequential turn number
  
  // User speech input
  userSpeech: text("user_speech"), // Transcribed user speech from Twilio
  speechConfidence: text("speech_confidence"), // Twilio confidence score (0.0-1.0) stored as text from webhook
  
  // AI response
  aiResponse: text("ai_response").notNull(), // AI-generated response text
  aiResponseAudio: text("ai_response_audio"), // TwiML or audio URL if custom TTS
  
  // Timing
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  duration: integer("duration"), // Turn duration in seconds
}, (table) => [
  index("idx_call_turns_conversation").on(table.conversationId),
  index("idx_call_turns_number").on(table.conversationId, table.turnNumber),
]);

export const insertCallTurnSchema = createInsertSchema(callTurns).omit({
  id: true,
  createdAt: true,
});
export type InsertCallTurn = z.infer<typeof insertCallTurnSchema>;
export type CallTurn = typeof callTurns.$inferSelect;

/**
 * VOICEMAILS TABLE
 * ----------------
 * Stores voicemail recordings and transcriptions from Twilio.
 * Each voicemail represents a recorded message left by a caller.
 */
export const voicemails = sqliteTable("voicemails", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Twilio identification
  recordingSid: text("recording_sid").notNull().unique(), // Twilio recording identifier
  callSid: text("call_sid"), // Associated call SID if available
  
  // Caller information
  fromNumber: text("from_number").notNull(), // Caller's phone number
  toNumber: text("to_number").notNull(), // Receiving number (our Twilio number)
  
  // Recording details
  recordingUrl: text("recording_url").notNull(), // URL to access the recording
  duration: integer("duration"), // Duration in seconds
  
  // Transcription
  transcription: text("transcription"), // Transcribed voicemail text
  transcriptionStatus: text("transcription_status"), // pending, completed, failed
  
  // Status
  heard: integer("heard", { mode: "boolean" }).default(false).notNull(), // Whether voicemail has been listened to
  heardAt: integer("heard_at", { mode: "timestamp" }), // When it was marked as heard
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
}, (table) => [
  index("idx_voicemails_recording_sid").on(table.recordingSid),
  index("idx_voicemails_from_number").on(table.fromNumber),
  index("idx_voicemails_heard").on(table.heard),
]);

export const insertVoicemailSchema = createInsertSchema(voicemails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVoicemail = z.infer<typeof insertVoicemailSchema>;
export type Voicemail = typeof voicemails.$inferSelect;









// =============================================================================
// LLM INTERACTION CAPTURE TABLE
// =============================================================================

/**
 * LLM_INTERACTIONS TABLE
 * ----------------------
 * Stores complete LLM input/output data for debugging and visualization.
 * Captures all prompts, tool calls, results, and responses for analysis.
 * 
 * PURPOSE:
 * - Debugging: Inspect what the LLM sees and generates
 * - Visualization: Show agent thought process and tool usage
 * - Analysis: Track patterns, errors, and performance
 * - Audit: Historical record of all LLM interactions
 * 
 * DATA RETENTION:
 * Consider implementing retention policies to manage database size:
 * - Archive/delete interactions older than 30 days
 * - Keep only error cases or flagged interactions long-term
 * - Compress large payloads (systemPrompt, rawResponse) if needed
 */
export const llmInteractions = sqliteTable("llm_interactions", {
  /**
   * Primary key - Auto-generated UUID
   */
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  /**
   * Reference to the chat this interaction belongs to
   * Nullable because some LLM interactions may not be tied to a chat
   */
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  
  /**
   * Reference to the specific message that triggered this interaction
   * Links to the user message that initiated the LLM call
   */
  messageId: text("message_id").references(() => messages.id, { onDelete: "cascade" }),
  
  /**
   * User ID - for data isolation and filtering
   * NULL for guest users
   */
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INPUT DATA - What went into the LLM
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * The complete system prompt/instruction sent to the LLM
   * Includes core directives, personality, tools, and RAG context
   */
  systemPrompt: text("system_prompt"),
  
  /**
   * The user's message/query
   */
  userMessage: text("user_message"),
  
  /**
   * Conversation history sent as context
   * Stored as JSONB for efficient querying and indexing
   */
  conversationHistory: text("conversation_history", { mode: "json" }).$type<Array<{ role: string; content: string }>>(),
  
  /**
   * Attachments included with the message
   * File metadata only (not full content to save space)
   */
  attachments: text("attachments", { mode: "json" }).$type<Array<{ type: string; filename?: string; mimeType?: string; size?: number }>>(),
  

  /**
   * Files injected into the prompt
   */
  injectedFiles: text("injected_files", { mode: "json" }).$type<Array<{ filename: string; content: string; mimeType?: string }>>(),
  
  /**
   * JSON data injected into the prompt
   */
  injectedJson: text("injected_json", { mode: "json" }).$type<Array<{ name: string; data: unknown }>>(),
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OUTPUT DATA - What the LLM generated
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Raw response from the LLM (includes function calls, thinking, etc.)
   */
  rawResponse: text("raw_response"),
  
  /**
   * Clean content extracted from response (prose only, no tool JSON)
   */
  cleanContent: text("clean_content"),
  
  /**
   * Parsed tool calls from the response
   */
  parsedToolCalls: text("parsed_tool_calls", { mode: "json" }).$type<unknown[]>(),
  
  /**
   * Results from executing tool calls
   */
  toolResults: text("tool_results", { mode: "json" }).$type<Array<{ 
    toolId: string; 
    type: string; 
    success: boolean; 
    result?: unknown; 
    error?: string 
  }>>(),
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // METADATA - Performance and model info
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Model used for this interaction (e.g., "gemini-3-flash-preview", "gemini-3.1-pro-preview")
   */
  model: text("model"),
  
  /**
   * Duration of the LLM call in milliseconds
   */
  durationMs: integer("duration_ms"),
  
  /**
   * Token usage estimate or actual count
   */
  tokenEstimate: text("token_estimate", { mode: "json" }).$type<{
    inputTokens: number;
    outputTokens: number;
  }>(),
  
  /**
   * Error information if the interaction failed
   */
  error: text("error"),
  
  /**
   * Status of the interaction
   */
  status: text("status").notNull().default("success"),
  
  /**
   * Timestamp when this interaction occurred
   */
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

// Create insert schema for LLM interactions
export const insertLlmInteractionSchema = createInsertSchema(llmInteractions).omit({
  id: true,
  createdAt: true,
});

export type InsertLlmInteraction = z.infer<typeof insertLlmInteractionSchema>;
export type LlmInteraction = typeof llmInteractions.$inferSelect;

// =============================================================================
// TO-DO LIST SYSTEM
// =============================================================================

/**
 * TODO_ITEMS TABLE
 * ----------------
 * Stores persistent to-do list items for users.
 * This master to-do list is included in every prompt to inform the AI's
 * decision-making and help it prioritize tasks.
 * 
 * The to-do list is:
 * - Stored in the database for persistence across resets
 * - Cached to logs/todo.md for introspection
 * - Included in every system prompt as a header message
 * 
 * PRIORITY SYSTEM:
 * - Higher numbers = higher priority
 * - Used for sorting and AI decision-making
 * 
 * STATUS VALUES:
 * - "pending": Not started
 * - "in_progress": Currently being worked on
 * - "completed": Finished
 * - "blocked": Waiting on something
 * - "cancelled": No longer relevant
 */
export const todoItems = sqliteTable("todo_items", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  
  // User association
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Content
  title: text("title").notNull(),
  description: text("description"),
  
  // Status tracking
  status: text("status").default("pending").notNull(), // pending, in_progress, completed, blocked, cancelled
  
  // Priority (higher = more important)
  priority: integer("priority").default(0).notNull(),
  
  // Context & metadata
  category: text("category"), // e.g., "bug", "feature", "research", "maintenance"
  tags: text("tags", { mode: "json" }).$type<string[]>(), // Flexible categorization
  relatedChatId: text("related_chat_id").references(() => chats.id, { onDelete: "set null" }),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
}, (table) => [
  index("idx_todo_items_user").on(table.userId),
  index("idx_todo_items_status").on(table.status),
  index("idx_todo_items_priority").on(table.priority),
]);

export const insertTodoItemSchema = createInsertSchema(todoItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type InsertTodoItem = z.infer<typeof insertTodoItemSchema>;
export type TodoItem = typeof todoItems.$inferSelect;

// =============================================================================
// CONVERSATION SUMMARIES - Compressed summaries for pattern analysis
// =============================================================================
/**
 * CONVERSATION_SUMMARIES TABLE
 * ----------------------------
 * Stores AI-generated summaries of conversations produced by the Summarization
 * Engine. These summaries feed into the Evolution Engine's pattern analysis
 * to generate self-improvement suggestions.
 */
export const conversationSummaries = sqliteTable("conversation_summaries", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  keyTopics: text("key_topics", { mode: "json" }).$type<string[]>(),
  sentiment: text("sentiment"), // "positive" | "neutral" | "negative"
  modelUsed: text("model_used"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch() * 1000)`).notNull(),
});

export const insertConversationSummarySchema = createInsertSchema(conversationSummaries).omit({
  id: true,
  createdAt: true,
});
export type InsertConversationSummary = z.infer<typeof insertConversationSummarySchema>;
export type ConversationSummaryRecord = typeof conversationSummaries.$inferSelect;
