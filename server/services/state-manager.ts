/**
 * =============================================================================
 * STATE MANAGER SERVICE
 * =============================================================================
 * 
 * Manages execution state and context for multi-agent orchestration.
 * Provides:
 * - Session-based state management
 * - Context sharing between agents
 * - State persistence and recovery
 * - Transaction-like state updates
 * 
 * This service acts as the "memory" in our CPU analogy, storing the current
 * state of all running tasks and allowing agents to share context.
 */

import { getDb } from "../db";
import { queuedTasks, agentJobs } from "@shared/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

/**
 * State entry in the context
 */
export interface StateEntry {
  key: string;
  value: unknown;
  type: "shared" | "private" | "temporary";
  ttl?: number; // Time to live in seconds
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Session state
 */
export interface SessionState {
  sessionId: string;
  userId?: string;
  chatId?: string;
  entries: Map<string, StateEntry>;
  locks: Map<string, string>; // key -> agentId that holds the lock
  createdAt: Date;
  lastAccessedAt: Date;
}

/**
 * State update operation
 */
export interface StateUpdate {
  key: string;
  value: unknown;
  type?: StateEntry["type"];
  ttl?: number;
  metadata?: Record<string, unknown>;
}

/**
 * State transaction
 */
export interface StateTransaction {
  sessionId: string;
  operations: StateUpdate[];
  rollbackData?: Map<string, StateEntry>;
}

// =============================================================================
// STATE MANAGER SERVICE
// =============================================================================

class StateManagerService {
  private sessions: Map<string, SessionState> = new Map();
  private transactions: Map<string, StateTransaction> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the state manager
   */
  initialize(): void {
    // Start periodic cleanup of expired state
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredState();
    }, 60000); // Run every minute

    console.log("[StateManager] Initialized");
  }

  /**
   * Shutdown the state manager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    console.log("[StateManager] Shutdown");
  }

  /**
   * Create a new session
   */
  createSession(
    sessionId: string,
    options: {
      userId?: string;
      chatId?: string;
      initialState?: Record<string, unknown>;
    } = {}
  ): SessionState {
    const session: SessionState = {
      sessionId,
      userId: options.userId,
      chatId: options.chatId,
      entries: new Map(),
      locks: new Map(),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    // Add initial state if provided
    if (options.initialState) {
      for (const [key, value] of Object.entries(options.initialState)) {
        this.setState(sessionId, {
          key,
          value,
          type: "shared",
        });
      }
    }

    this.sessions.set(sessionId, session);
    console.log(`[StateManager] Created session: ${sessionId}`);

    return session;
  }

  /**
   * Get session state
   */
  getSession(sessionId: string): SessionState | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
    }
    return session || null;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`[StateManager] Deleted session: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * Set state value
   */
  setState(sessionId: string, update: StateUpdate): void {
    let session = this.sessions.get(sessionId);
    
    // Auto-create session if it doesn't exist
    if (!session) {
      session = this.createSession(sessionId);
    }

    const now = new Date();
    const entry: StateEntry = {
      key: update.key,
      value: update.value,
      type: update.type || "shared",
      ttl: update.ttl,
      createdAt:
        session.entries.get(update.key)?.createdAt || now,
      updatedAt: now,
      metadata: update.metadata,
    };

    session.entries.set(update.key, entry);
    session.lastAccessedAt = now;

    console.log(
      `[StateManager] Set state ${update.key} in session ${sessionId}`
    );
  }

  /**
   * Get state value
   */
  getState(sessionId: string, key: string): unknown | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.lastAccessedAt = new Date();
    const entry = session.entries.get(key);

    if (!entry) return null;

    // Check if entry has expired
    if (entry.ttl) {
      const expiresAt = new Date(
        entry.createdAt.getTime() + entry.ttl * 1000
      );
      if (new Date() > expiresAt) {
        // Entry expired, remove it
        session.entries.delete(key);
        return null;
      }
    }

    return entry.value;
  }

  /**
   * Get all state entries
   */
  getAllState(sessionId: string): Record<string, unknown> {
    const session = this.sessions.get(sessionId);
    if (!session) return {};

    session.lastAccessedAt = new Date();
    const state: Record<string, unknown> = {};

    for (const [key, entry] of session.entries) {
      // Check expiration
      if (entry.ttl) {
        const expiresAt = new Date(
          entry.createdAt.getTime() + entry.ttl * 1000
        );
        if (new Date() > expiresAt) {
          session.entries.delete(key);
          continue;
        }
      }

      state[key] = entry.value;
    }

    return state;
  }

  /**
   * Delete state value
   */
  deleteState(sessionId: string, key: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const deleted = session.entries.delete(key);
    if (deleted) {
      console.log(
        `[StateManager] Deleted state ${key} from session ${sessionId}`
      );
    }

    return deleted;
  }

  /**
   * Begin a state transaction
   */
  beginTransaction(sessionId: string): string {
    const transactionId = `tx-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    const transaction: StateTransaction = {
      sessionId,
      operations: [],
      rollbackData: new Map(),
    };

    this.transactions.set(transactionId, transaction);
    console.log(
      `[StateManager] Started transaction ${transactionId} for session ${sessionId}`
    );

    return transactionId;
  }

  /**
   * Add operation to transaction
   */
  addToTransaction(transactionId: string, update: StateUpdate): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Save current value for rollback
    const session = this.sessions.get(transaction.sessionId);
    if (session && !transaction.rollbackData?.has(update.key)) {
      const currentEntry = session.entries.get(update.key);
      if (currentEntry) {
        transaction.rollbackData?.set(update.key, currentEntry);
      }
    }

    transaction.operations.push(update);
  }

  /**
   * Commit transaction
   */
  commitTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Apply all operations
    for (const operation of transaction.operations) {
      this.setState(transaction.sessionId, operation);
    }

    this.transactions.delete(transactionId);
    console.log(
      `[StateManager] Committed transaction ${transactionId} with ${transaction.operations.length} operations`
    );
  }

  /**
   * Rollback transaction
   */
  rollbackTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Restore original values
    const session = this.sessions.get(transaction.sessionId);
    if (session && transaction.rollbackData) {
      for (const [key, entry] of transaction.rollbackData) {
        session.entries.set(key, entry);
      }
    }

    this.transactions.delete(transactionId);
    console.log(`[StateManager] Rolled back transaction ${transactionId}`);
  }

  /**
   * Lock a state key for exclusive access
   */
  lock(sessionId: string, key: string, agentId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if already locked
    if (session.locks.has(key)) {
      return false;
    }

    session.locks.set(key, agentId);
    console.log(
      `[StateManager] Locked ${key} in session ${sessionId} by agent ${agentId}`
    );

    return true;
  }

  /**
   * Release a lock
   */
  unlock(sessionId: string, key: string, agentId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const lockHolder = session.locks.get(key);
    if (lockHolder !== agentId) {
      return false; // Can't unlock if you don't hold the lock
    }

    session.locks.delete(key);
    console.log(
      `[StateManager] Unlocked ${key} in session ${sessionId} by agent ${agentId}`
    );

    return true;
  }

  /**
   * Check if a key is locked
   */
  isLocked(sessionId: string, key: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    return session.locks.has(key);
  }

  /**
   * Get lock holder
   */
  getLockHolder(sessionId: string, key: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return session.locks.get(key) || null;
  }

  /**
   * Cleanup expired state entries
   */
  private cleanupExpiredState(): void {
    let expiredCount = 0;

    for (const [sessionId, session] of this.sessions) {
      for (const [key, entry] of session.entries) {
        if (entry.ttl) {
          const expiresAt = new Date(
            entry.createdAt.getTime() + entry.ttl * 1000
          );
          if (new Date() > expiresAt) {
            session.entries.delete(key);
            expiredCount++;
          }
        }
      }
    }

    if (expiredCount > 0) {
      console.log(
        `[StateManager] Cleaned up ${expiredCount} expired state entries`
      );
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    activeSessions: number;
    totalStateEntries: number;
    totalLocks: number;
    activeTransactions: number;
  } {
    let totalStateEntries = 0;
    let totalLocks = 0;

    for (const session of this.sessions.values()) {
      totalStateEntries += session.entries.size;
      totalLocks += session.locks.size;
    }

    return {
      activeSessions: this.sessions.size,
      totalStateEntries,
      totalLocks,
      activeTransactions: this.transactions.size,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const stateManager = new StateManagerService();
export default stateManager;
