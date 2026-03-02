import { 
  users, 
  type User, 
  type InsertUser, 
  googleOAuthTokens, 
  type GoogleOAuthTokens, 
  type InsertGoogleOAuthTokens,
  userBranding,
  type InsertUserBranding,
  type UserBranding,
  DEFAULT_AGENT_NAME,
  DEFAULT_DISPLAY_NAME,
  DEFAULT_BRAND_COLOR,
  chats,
  messages,
  type Chat,
  type Message,
  type InsertChat,
  type InsertMessage,
  attachments,
  type Attachment,
  type InsertAttachment,
  toolCallLogs,
  type ToolCallLog,
  type InsertToolCallLog,
  llmUsage,
  type LlmUsage,
  type InsertLlmUsage,
  llmInteractions,
  type LlmInteraction,
  type InsertLlmInteraction,
  todoItems,
  type TodoItem,
  toolTasks,
  type ToolTask,
  type InsertToolTask,
  documentChunks,
  type DocumentChunk,
  type InsertDocumentChunk,
  ragTraces,
  type RagTrace,
  type InsertRagTrace,
  ragMetricsHourly,
  ragChunkLineage,
  type RagChunkLineage,
  triggers,
  type Trigger,
  type InsertTrigger,
  workflows,
  type Workflow,
  type InsertWorkflow,
  schedules,
  type Schedule,
  type InsertSchedule,
  agentIdentities,
  type AgentIdentity,
  type InsertAgentIdentity,
  agentActivityLog,
  type AgentActivityLog,
  type InsertAgentActivityLog,
  queuedTasks,
  type QueuedTask,
  type InsertQueuedTask,
  type InsertTodoItem,
  executionLogs,
  type ExecutionLog,
  type InsertExecutionLog,
  feedback,
  type Feedback,
  type InsertFeedback,
  callConversations,
  type CallConversation,
  type InsertCallConversation,
  voicemails,
  type Voicemail,
  type InsertVoicemail,
  userAgents,
  type UserAgent,
  type InsertUserAgent
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, ne, sql, inArray } from "drizzle-orm";
// import session from "express-session";

export class DatabaseStorage {
  // sessionStore: session.Store; // Moved to googleAuth.ts

  constructor() {
    // this.sessionStore = new session.MemoryStore(); 
  }

  // Database Access
  getDb() {
    return db;
  }

  // User Operations
  async getUser(id: number | string | undefined | null): Promise<User | undefined> {
    if (id === undefined || id === null || id === "") {
      return undefined;
    }
    
    try {
      const searchId = id.toString();
      const [user] = await db.select().from(users).where(eq(users.id, searchId));
      return user;
    } catch (e) {
      console.error(`❌ getUser Error (ID: ${id}):`, e);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (e) {
      console.error("❌ getUserByEmail Error:", e);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async upsertUser(user: any): Promise<User> {
    // First try to find by ID if provided
    if (user.id) {
        const [existingUser] = await db.select().from(users).where(eq(users.id, user.id));
        if (existingUser) {
            const [updatedUser] = await db.update(users).set(user).where(eq(users.id, user.id)).returning();
            return updatedUser;
        }
    }

    // Fallback: try to find by email (for OAuth/existing users)
    if (user.email) {
        const [existingUser] = await db.select().from(users).where(eq(users.email, user.email));
        if (existingUser) {
            // Update the existing user, preserving their original ID
            const { id, ...updateData } = user; 
            const [updatedUser] = await db.update(users).set(updateData).where(eq(users.id, existingUser.id)).returning();
            return updatedUser;
        }
    }

    // If neither found, insert as new, but handle race conditions on email unique constraint
    try {
      const [newUser] = await db.insert(users).values(user).returning();
      return newUser;
    } catch (error: any) {
      if (error.code === '23505' && error.constraint === 'users_email_unique') {
        // Race condition: user was created between check and insert
        const [existingUser] = await db.select().from(users).where(eq(users.email, user.email));
        if (existingUser) {
           const { id, ...updateData } = user;
           const [updatedUser] = await db.update(users).set(updateData).where(eq(users.id, existingUser.id)).returning();
           return updatedUser;
        }
      }
      throw error;
    }
    return newUser;
  }

  // Chat Operations
  async createChat(insertChat: InsertChat): Promise<Chat> {
    const [chat] = await db.insert(chats).values(insertChat).returning();
    return chat;
  }

  async getChat(id: string): Promise<Chat | undefined> {
    const [chat] = await db.select().from(chats).where(eq(chats.id, id));
    return chat;
  }

  async getChatById(id: string): Promise<Chat | undefined> {
    return this.getChat(id);
  }

  async updateChatTitle(id: string, title: string): Promise<Chat | undefined> {
    const [chat] = await db.update(chats)
      .set({ title, updatedAt: new Date() })
      .where(eq(chats.id, id))
      .returning();
    return chat;
  }

  async getChats(userId?: string): Promise<Chat[]> {
    if (userId) {
      return await db.select().from(chats).where(eq(chats.userId, userId)).orderBy(desc(chats.updatedAt));
    }
    return await db.select().from(chats).orderBy(desc(chats.updatedAt));
  }

  // Message Operations
  async addMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    // Update chat timestamp
    await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, insertMessage.chatId));
    return message;
  }

  async getMessages(chatId: string): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.createdAt);
  }

  async getMessagesByChatId(chatId: string, options: { limit?: number; offset?: number } = {}): Promise<Message[]> {
    let query = db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(desc(messages.createdAt));
    
    if (options.limit) {
      // @ts-ignore - Drizzle types can be tricky
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      // @ts-ignore
      query = query.offset(options.offset);
    }
    
    const results = await query;
    // Return in chronological order since AI needs history in order
    return results.reverse();
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  // Attachment Operations
  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [saved] = await db.insert(attachments).values(attachment).returning();
    return saved;
  }

  async getAttachmentsByMessageId(messageId: string): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.messageId, messageId));
  }

  // Tool Call Logs
  async getRecentToolCallLogs(chatId: string, limit: number = 10): Promise<ToolCallLog[]> {
    return await db.select()
      .from(toolCallLogs)
      .where(eq(toolCallLogs.chatId, chatId))
      .orderBy(desc(toolCallLogs.createdAt))
      .limit(limit);
  }

  async getToolCallLogById(id: string): Promise<ToolCallLog | undefined> {
    const [log] = await db.select().from(toolCallLogs).where(eq(toolCallLogs.id, id));
    return log;
  }

  async addToolCallLog(log: InsertToolCallLog): Promise<ToolCallLog> {
    const [saved] = await db.insert(toolCallLogs).values(log).returning();
    return saved;
  }

  async createToolCallLog(log: InsertToolCallLog): Promise<ToolCallLog> {
    return this.addToolCallLog(log);
  }

  async updateToolCallLog(id: string, update: Partial<InsertToolCallLog>): Promise<ToolCallLog | undefined> {
    const [updated] = await db.update(toolCallLogs)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(toolCallLogs.id, id))
      .returning();
    return updated;
  }

  async pruneOldToolCallLogs(chatId: string, keepLimit: number = 50): Promise<void> {
    try {
      // Find logs to delete (those beyond the keepLimit)
      const logs = await db.select({ id: toolCallLogs.id })
        .from(toolCallLogs)
        .where(eq(toolCallLogs.chatId, chatId))
        .orderBy(desc(toolCallLogs.createdAt))
        .offset(keepLimit);

      if (logs.length > 0) {
        const idsToDelete = logs.map(l => l.id);
        await db.delete(toolCallLogs).where(inArray(toolCallLogs.id, idsToDelete));
      }
    } catch (e) {
      console.error("❌ pruneOldToolCallLogs Error:", e);
    }
  }

  // Google OAuth Tokens
  async getGoogleTokens(id: string = 'default'): Promise<GoogleOAuthTokens | undefined> {
    try {
      const [tokens] = await db.select().from(googleOAuthTokens).where(eq(googleOAuthTokens.id, id));
      return tokens;
    } catch (e) {
      console.error("❌ getGoogleTokens Error:", e);
      return undefined;
    }
  }

  // Twilio Calls & Voicemails
  async insertCallConversation(call: InsertCallConversation): Promise<CallConversation> {
    const [saved] = await db.insert(callConversations).values(call).returning();
    return saved;
  }

  async getRecentCallConversations(limit: number = 20): Promise<CallConversation[]> {
    return await db.select().from(callConversations).orderBy(desc(callConversations.createdAt)).limit(limit);
  }

  async getRecentVoicemails(limit: number = 20): Promise<Voicemail[]> {
    return await db.select().from(voicemails).orderBy(desc(voicemails.createdAt)).limit(limit);
  }

  async markVoicemailAsHeard(id: number): Promise<void> {
    await db.update(voicemails).set({ heard: true }).where(eq(voicemails.id, id));
  }

  async saveGoogleTokens(tokens: InsertGoogleOAuthTokens): Promise<void> {
    try {
      const existing = await this.getGoogleTokens(tokens.id || 'default');
      if (existing) {
        await db.update(googleOAuthTokens)
          .set({ ...tokens, updatedAt: new Date() })
          .where(eq(googleOAuthTokens.id, tokens.id || 'default'));
      } else {
        await db.insert(googleOAuthTokens).values(tokens);
      }
    } catch (e) {
      console.error("❌ saveGoogleTokens Error:", e);
    }
  }

  async deleteGoogleTokens(id: string = 'default'): Promise<void> {
    try {
      await db.delete(googleOAuthTokens).where(eq(googleOAuthTokens.id, id));
    } catch (e) {
      console.error("❌ deleteGoogleTokens Error:", e);
    }
  }

  // User Branding
  async getUserBrandingOrDefault(userId: string): Promise<UserBranding> {
    try {
      const [branding] = await db.select().from(userBranding).where(eq(userBranding.userId, userId));
      if (branding) return branding;

      // Return defaults if no custom branding found
      return {
        id: "default",
        userId,
        agentName: DEFAULT_AGENT_NAME,
        displayName: DEFAULT_DISPLAY_NAME,
        avatarUrl: null,
        brandColor: DEFAULT_BRAND_COLOR,
        githubSignature: null,
        emailSignature: null,
        canonicalDomain: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (e) {
      console.error("❌ getUserBrandingOrDefault Error:", e);
      throw e;
    }
  }

  async upsertUserBranding(branding: InsertUserBranding): Promise<UserBranding> {
    try {
      const [existing] = await db.select().from(userBranding).where(eq(userBranding.userId, branding.userId));
      if (existing) {
        const [updated] = await db.update(userBranding)
          .set({ ...branding, updatedAt: new Date() })
          .where(eq(userBranding.userId, branding.userId))
          .returning();
        return updated;
      }
      
      const [newBranding] = await db.insert(userBranding).values(branding).returning();
      return newBranding;
    } catch (e) {
      console.error("❌ upsertUserBranding Error:", e);
      throw e;
    }
  }

  async deleteUserBranding(userId: string): Promise<boolean> {
    try {
      const result = await db.delete(userBranding).where(eq(userBranding.userId, userId)).returning();
      return result.length > 0;
    } catch (e) {
      console.error("❌ deleteUserBranding Error:", e);
      return false;
    }
  }

  // Todo Items
  async getPendingTodoItems(userId: string): Promise<TodoItem[]> {
    try {
      return await db.select().from(todoItems).where(
        and(
          eq(todoItems.userId, userId),
          ne(todoItems.status, 'completed')
        )
      ).orderBy(desc(todoItems.priority));
    } catch (e) {
      console.error("❌ getPendingTodoItems Error:", e);
      return [];
    }
  }

  // LLM Usage Tracking
  async logLlmUsage(usage: InsertLlmUsage): Promise<LlmUsage> {
    const [saved] = await db.insert(llmUsage).values(usage).returning();
    return saved;
  }

  async getLlmUsageByChat(chatId: string): Promise<LlmUsage[]> {
    return await db.select().from(llmUsage).where(eq(llmUsage.chatId, chatId)).orderBy(desc(llmUsage.createdAt));
  }

  async getRecentLlmUsage(limit: number = 50): Promise<LlmUsage[]> {
    return await db.select().from(llmUsage).orderBy(desc(llmUsage.createdAt)).limit(limit);
  }

  async getLlmUsageStats() {
    // Basic stats implementation
    const usage = await db.select().from(llmUsage);
    const totalInput = usage.reduce((sum, u) => sum + u.promptTokens, 0);
    const totalOutput = usage.reduce((sum, u) => sum + u.completionTokens, 0);
    return {
      totalInteractions: usage.length,
      totalTokens: totalInput + totalOutput,
      avgTokensPerInteraction: usage.length ? Math.round((totalInput + totalOutput) / usage.length) : 0,
      modelDistribution: {} // Simplified
    };
  }

  // LLM Interaction Logs
  async getLlmInteractionById(id: string): Promise<LlmInteraction | undefined> {
    const [interaction] = await db.select().from(llmInteractions).where(eq(llmInteractions.id, id));
    return interaction;
  }

  async getLlmInteractionsByChat(chatId: string, limit: number = 50): Promise<LlmInteraction[]> {
    return await db.select()
      .from(llmInteractions)
      .where(eq(llmInteractions.chatId, chatId))
      .orderBy(desc(llmInteractions.createdAt))
      .limit(limit);
  }

  async getRecentLlmInteractions(limit: number = 50, userId?: string | null): Promise<LlmInteraction[]> {
    let query = db.select().from(llmInteractions).orderBy(desc(llmInteractions.createdAt)).limit(limit);
    if (userId !== undefined) {
      // @ts-ignore
      query = query.where(eq(llmInteractions.userId, userId));
    }
    return await query;
  }

  async getLlmInteractionStats() {
    const interactions = await db.select().from(llmInteractions);
    return {
      totalLogged: interactions.length,
      lastLogAt: interactions.length ? interactions[0].createdAt : null
    };
  }

  async saveLlmInteraction(interaction: InsertLlmInteraction): Promise<LlmInteraction> {
    const [saved] = await db.insert(llmInteractions).values(interaction).returning();
    return saved;
  }

  async deleteOldLlmInteractions(daysOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    // Drizzle delete with where clause
    const result = await db.delete(llmInteractions).where(and(eq(llmInteractions.id, llmInteractions.id))).returning(); // Simplified
    return result.length;
  }

  // Tool Tasks
  async createToolTask(task: InsertToolTask): Promise<ToolTask> {
    const [saved] = await db.insert(toolTasks).values(task).returning();
    return saved;
  }

  async updateToolTask(id: string, update: Partial<InsertToolTask>): Promise<ToolTask | undefined> {
    const [updated] = await db.update(toolTasks)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(toolTasks.id, id))
      .returning();
    return updated;
  }

  async getToolTask(id: string): Promise<ToolTask | undefined> {
    const [task] = await db.select().from(toolTasks).where(eq(toolTasks.id, id));
    return task;
  }

  // Execution Logs
  async createExecutionLog(log: InsertExecutionLog): Promise<ExecutionLog> {
    const [saved] = await db.insert(executionLogs).values(log).returning();
    return saved;
  }

  // Feedback
  async createFeedback(fb: InsertFeedback): Promise<Feedback> {
    const [saved] = await db.insert(feedback).values(fb).returning();
    return saved;
  }

  async getFeedback(limit: number = 50): Promise<Feedback[]> {
    return await db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(limit);
  }

  async getFeedbackStats() {
    const allFeedback = await db.select().from(feedback);
    return {
      total: allFeedback.length,
      positive: allFeedback.filter(f => f.sentiment === 'positive').length,
      negative: allFeedback.filter(f => f.sentiment === 'negative').length,
    };
  }

  async markFeedbackSubmitted(id: number): Promise<void> {
    await db.update(feedback).set({ submittedAt: new Date() }).where(eq(feedback.id, id));
  }

  async updateToolTaskStatus(id: string, status: string, result?: any, error?: string): Promise<ToolTask | undefined> {
    const [updated] = await db.update(toolTasks)
      .set({ 
        status, 
        result: result || null, 
        error: error || null, 
        updatedAt: new Date() 
      })
      .where(eq(toolTasks.id, id))
      .returning();
    return updated;
  }

  // Document Chunks (RAG)
  async createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const [saved] = await db.insert(documentChunks).values(chunk).returning();
    return saved;
  }

  async getDocumentChunksByFile(fileId: string): Promise<DocumentChunk[]> {
    return await db.select().from(documentChunks).where(eq(documentChunks.fileId, fileId));
  }

  async getAllDocumentChunks(limit: number = 100): Promise<DocumentChunk[]> {
    return await db.select().from(documentChunks).limit(limit);
  }

  // RAG Traceability
  async createRagTraces(trace: InsertRagTrace): Promise<RagTrace> {
    const [saved] = await db.insert(ragTraces).values(trace).returning();
    return saved;
  }

  async getRagTraces(limit: number = 50): Promise<RagTrace[]> {
    return await db.select().from(ragTraces).orderBy(desc(ragTraces.timestamp)).limit(limit);
  }

  async getRagTracesByTraceId(traceId: string): Promise<RagTrace[]> {
    return await db.select().from(ragTraces).where(eq(ragTraces.traceId, traceId));
  }

  async getRagMetrics(): Promise<any> {
    return await db.select().from(ragMetricsHourly).orderBy(desc(ragMetricsHourly.hourStart)).limit(24);
  }

  async getChunkLineage(chunkId: string): Promise<RagChunkLineage | undefined> {
    const [lineage] = await db.select().from(ragChunkLineage).where(eq(ragChunkLineage.chunkId, chunkId));
    return lineage;
  }

  // Triggers
  async createTrigger(trigger: InsertTrigger): Promise<Trigger> {
    const [saved] = await db.insert(triggers).values(trigger).returning();
    return saved;
  }

  async getTriggers(): Promise<Trigger[]> {
    return await db.select().from(triggers);
  }

  async getTriggersByType(type: string): Promise<Trigger[]> {
    return await db.select().from(triggers).where(and(eq(triggers.triggerType, type), eq(triggers.enabled, true)));
  }

  async getTriggerById(id: string): Promise<Trigger | undefined> {
    const [trigger] = await db.select().from(triggers).where(eq(triggers.id, id));
    return trigger;
  }

  async updateTrigger(id: string, update: Partial<InsertTrigger>): Promise<Trigger | undefined> {
    const [updated] = await db.update(triggers).set({ ...update, updatedAt: new Date() }).where(eq(triggers.id, id)).returning();
    return updated;
  }

  // Workflows
  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [saved] = await db.insert(workflows).values(workflow).returning();
    return saved;
  }

  async getWorkflows(): Promise<Workflow[]> {
    return await db.select().from(workflows);
  }

  async getWorkflowById(id: string): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow;
  }

  // Schedules
  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const [saved] = await db.insert(schedules).values(schedule).returning();
    return saved;
  }

  async updateSchedule(id: string, update: Partial<InsertSchedule>): Promise<Schedule | undefined> {
    const [updated] = await db.update(schedules).set(update).where(eq(schedules.id, id)).returning();
    return updated;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    const result = await db.delete(schedules).where(eq(schedules.id, id)).returning();
    return result.length > 0;
  }

  async getDueSchedules(): Promise<Schedule[]> {
    const now = new Date();
    return await db.select().from(schedules).where(and(eq(schedules.enabled, true), sql`${schedules.nextRunAt} <= ${now}`));
  }

  // Agent Identity
  async logAgentActivity(activity: InsertAgentActivityLog): Promise<AgentActivityLog> {
    const [saved] = await db.insert(agentActivityLog).values(activity).returning();
    return saved;
  }

  async getRecentAgentActivity(limit: number = 20): Promise<AgentActivityLog[]> {
    return await db.select().from(agentActivityLog).orderBy(desc(agentActivityLog.createdAt)).limit(limit);
  }

  async getAgentActivity(agentId: string, limit: number = 20): Promise<AgentActivityLog[]> {
    return await db.select().from(agentActivityLog).where(eq(agentActivityLog.agentId, agentId)).orderBy(desc(agentActivityLog.createdAt)).limit(limit);
  }

  async getAgentByName(name: string): Promise<AgentIdentity | undefined> {
    const [agent] = await db.select().from(agentIdentities).where(eq(agentIdentities.name, name));
    return agent;
  }

  async getAgentIdentities(): Promise<AgentIdentity[]> {
    return await db.select().from(agentIdentities);
  }

  async getEnabledAgents(): Promise<AgentIdentity[]> {
    return await db.select().from(agentIdentities).where(eq(agentIdentities.enabled, true));
  }

  async createAgentIdentity(agent: InsertAgentIdentity): Promise<AgentIdentity> {
    const [saved] = await db.insert(agentIdentities).values(agent).returning();
    return saved;
  }

  async updateAgentIdentity(id: string, update: Partial<InsertAgentIdentity>): Promise<AgentIdentity | undefined> {
    const [updated] = await db.update(agentIdentities).set(update).where(eq(agentIdentities.id, id)).returning();
    return updated;
  }

  // User Agents
  async createUserAgent(agent: InsertUserAgent): Promise<UserAgent> {
    const [saved] = await db.insert(userAgents).values(agent).returning();
    return saved;
  }

  async getUserAgents(userId: string): Promise<UserAgent[]> {
    return await db.select().from(userAgents).where(eq(userAgents.userId, userId));
  }

  async getUserAgent(id: string): Promise<UserAgent | undefined> {
    const [agent] = await db.select().from(userAgents).where(eq(userAgents.id, id));
    return agent;
  }

  async updateUserAgent(id: string, update: Partial<InsertUserAgent>): Promise<UserAgent | undefined> {
    const [updated] = await db.update(userAgents).set(update).where(eq(userAgents.id, id)).returning();
    return updated;
  }

  async deleteUserAgent(id: string): Promise<boolean> {
    const result = await db.delete(userAgents).where(eq(userAgents.id, id)).returning();
    return result.length > 0;
  }

  async setDefaultUserAgent(userId: string, agentId: string): Promise<void> {
    // Unset current default
    await db.update(userAgents).set({ isDefault: false }).where(eq(userAgents.userId, userId));
    // Set new default
    await db.update(userAgents).set({ isDefault: true }).where(eq(userAgents.id, agentId));
  }

  // Queued Tasks
  async createQueuedTask(task: InsertQueuedTask): Promise<QueuedTask> {
    const [saved] = await db.insert(queuedTasks).values(task).returning();
    return saved;
  }

  async createQueuedTasks(tasks: InsertQueuedTask[]): Promise<QueuedTask[]> {
    return await db.insert(queuedTasks).values(tasks).returning();
  }

  async getQueuedTasks(limit: number = 50): Promise<QueuedTask[]> {
    return await db.select().from(queuedTasks).orderBy(desc(queuedTasks.createdAt)).limit(limit);
  }

  async getQueuedTaskById(id: string): Promise<QueuedTask | undefined> {
    const [task] = await db.select().from(queuedTasks).where(eq(queuedTasks.id, id));
    return task;
  }

  async getQueuedTasksByParentId(parentId: string): Promise<QueuedTask[]> {
    return await db.select().from(queuedTasks).where(eq(queuedTasks.parentId, parentId));
  }

  async deleteQueuedTask(id: string): Promise<boolean> {
    const result = await db.delete(queuedTasks).where(eq(queuedTasks.id, id)).returning();
    return result.length > 0;
  }

  async getNextPendingTask(): Promise<QueuedTask | undefined> {
    const [task] = await db.select()
      .from(queuedTasks)
      .where(eq(queuedTasks.status, 'pending'))
      .orderBy(desc(queuedTasks.priority), queuedTasks.createdAt)
      .limit(1);
    return task;
  }

  async getTasksWaitingForInput(): Promise<QueuedTask[]> {
    return await db.select().from(queuedTasks).where(eq(queuedTasks.status, 'waiting_for_input'));
  }

  async updateQueuedTask(id: string, update: Partial<InsertQueuedTask>): Promise<QueuedTask | undefined> {
    const [updated] = await db.update(queuedTasks).set(update).where(eq(queuedTasks.id, id)).returning();
    return updated;
  }

  async getQueueStats() {
    const allTasks = await db.select().from(queuedTasks);
    return {
      pending: allTasks.filter(t => t.status === 'pending').length,
      running: allTasks.filter(t => t.status === 'running').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
    };
  }

  // Todo CRUD
  async createTodoItem(item: InsertTodoItem): Promise<TodoItem> {
    const [saved] = await db.insert(todoItems).values(item).returning();
    return saved;
  }

  async updateTodoItem(id: string, update: Partial<InsertTodoItem>): Promise<TodoItem | undefined> {
    const [updated] = await db.update(todoItems)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(todoItems.id, id))
      .returning();
    return updated;
  }

  async deleteTodoItem(id: string): Promise<boolean> {
    const result = await db.delete(todoItems).where(eq(todoItems.id, id)).returning();
    return result.length > 0;
  }

  async completeTodoItem(id: string): Promise<TodoItem | undefined> {
    const [updated] = await db.update(todoItems)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(todoItems.id, id))
      .returning();
    return updated;
  }

  async getTodoStats(userId: string) {
    const items = await db.select().from(todoItems).where(eq(todoItems.userId, userId));
    return {
      total: items.length,
      pending: items.filter(i => i.status !== 'completed').length,
      completed: items.filter(i => i.status === 'completed').length,
    };
  }

  async reorderTodoItems(userId: string, itemIds: string[]): Promise<void> {
    // Basic implementation: set priority based on index in reverse
    for (let i = 0; i < itemIds.length; i++) {
      await db.update(todoItems)
        .set({ priority: itemIds.length - i })
        .where(and(eq(todoItems.id, itemIds[i]), eq(todoItems.userId, userId)));
    }
  }

  // Debug & System
  async getDebugDatabaseInfo() {
    // Return list of tables and counts (simplified)
    return [
      { name: "users", count: (await db.select().from(users)).length },
      { name: "chats", count: (await db.select().from(chats)).length },
      { name: "messages", count: (await db.select().from(messages)).length },
      { name: "llm_usage", count: (await db.select().from(llmUsage)).length }
    ];
  }

  async getTableData(tableName: string, limit: number = 50, offset: number = 0) {
    // This is a dangerous method in production, but for debug:
    // We would need to switch based on tableName to stay type-safe with Drizzle
    if (tableName === "users") return await db.select().from(users).limit(limit).offset(offset);
    if (tableName === "chats") return await db.select().from(chats).limit(limit).offset(offset);
    if (tableName === "messages") return await db.select().from(messages).limit(limit).offset(offset);
    if (tableName === "llm_usage") return await db.select().from(llmUsage).limit(limit).offset(offset);
    return [];
  }

  async updateTableRecord(tableName: string, id: string, data: any): Promise<boolean> {
    if (tableName === "chats") {
      await db.update(chats).set(data).where(eq(chats.id, id));
      return true;
    }
    return false;
  }

  async deleteTableRecord(tableName: string, id: string): Promise<boolean> {
    if (tableName === "chats") {
      await db.delete(chats).where(eq(chats.id, id));
      return true;
    }
    if (tableName === "messages") {
      await db.delete(messages).where(eq(messages.id, id));
      return true;
    }
    return false;
  }
}

export const storage = new DatabaseStorage();
