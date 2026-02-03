/**
 * =============================================================================
 * ORCHESTRATION LOGGER SERVICE
 * =============================================================================
 * 
 * Multi-level logging system for orchestration debugging and monitoring.
 * Provides:
 * - Task-level logs (individual task execution)
 * - Agent-level logs (agent activity)
 * - Orchestrator-level logs (system-wide events)
 * - Session-based log aggregation
 * - Log querying and filtering
 * 
 * Logs are structured for easy debugging and can be filtered by:
 * - Session ID
 * - Task ID
 * - Agent ID
 * - Log level
 * - Time range
 */

// =============================================================================
// TYPES
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";
export type LogSource = "orchestrator" | "agent" | "task" | "system";

/**
 * =============================================================================
 * CREDENTIAL REDACTION FOR ORCHESTRATION LOGS
 * =============================================================================
 */

/**
 * Simple credential redaction for log messages
 * Redacts common patterns to prevent credential leakage
 */
function redactLogMessage(text: string): string {
  if (typeof text !== 'string') return text;
  
  return text
    // API keys and tokens (long alphanumeric strings)
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[REDACTED]')
    // GitHub tokens
    .replace(/ghp_[A-Za-z0-9]{36}/g, '[REDACTED]')
    .replace(/gho_[A-Za-z0-9]{36}/g, '[REDACTED]')
    .replace(/github_pat_[A-Za-z0-9_]{82}/g, '[REDACTED]')
    // OpenAI keys
    .replace(/sk-[A-Za-z0-9]{48}/g, '[REDACTED]')
    .replace(/sk-proj-[A-Za-z0-9_-]{48,}/g, '[REDACTED]')
    // Google API keys
    .replace(/AIza[A-Za-z0-9_-]{35}/g, '[REDACTED]')
    .replace(/ya29\.[A-Za-z0-9_-]{68,}/g, '[REDACTED]')
    // Twilio
    .replace(/AC[a-z0-9]{32}/g, '[REDACTED]')
    .replace(/SK[a-z0-9]{32}/g, '[REDACTED]')
    // Authorization headers
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]');
}

/**
 * Redact credentials from data objects
 */
function redactLogData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return data;
  
  const redacted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    const isCredentialKey = 
      keyLower.includes('password') ||
      keyLower.includes('secret') ||
      keyLower.includes('token') ||
      keyLower.includes('key') && keyLower.includes('api') ||
      keyLower.includes('credential') ||
      keyLower === 'auth' ||
      keyLower === 'authorization';
    
    if (isCredentialKey && typeof value === 'string') {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      redacted[key] = redactLogMessage(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactLogData(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: LogSource;
  sessionId?: string;
  taskId?: string;
  agentId?: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LogQuery {
  sessionId?: string;
  taskId?: string;
  agentId?: string;
  source?: LogSource;
  level?: LogLevel;
  minLevel?: LogLevel;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface LogStatistics {
  totalLogs: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<LogSource, number>;
  bySession: Record<string, number>;
  errorRate: number;
}

// =============================================================================
// ORCHESTRATION LOGGER SERVICE
// =============================================================================

class OrchestrationLoggerService {
  private logs: LogEntry[] = [];
  private maxLogs: number = 10000; // Keep last 10k logs in memory
  private logIdCounter: number = 0;

  // Log level hierarchy for filtering
  private levelHierarchy: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    critical: 4,
  };

  /**
   * Log a debug message
   */
  debug(
    source: LogSource,
    message: string,
    context?: {
      sessionId?: string;
      taskId?: string;
      agentId?: string;
      data?: Record<string, unknown>;
    }
  ): void {
    this.log("debug", source, message, context);
  }

  /**
   * Log an info message
   */
  info(
    source: LogSource,
    message: string,
    context?: {
      sessionId?: string;
      taskId?: string;
      agentId?: string;
      data?: Record<string, unknown>;
    }
  ): void {
    this.log("info", source, message, context);
  }

  /**
   * Log a warning
   */
  warn(
    source: LogSource,
    message: string,
    context?: {
      sessionId?: string;
      taskId?: string;
      agentId?: string;
      data?: Record<string, unknown>;
    }
  ): void {
    this.log("warn", source, message, context);
  }

  /**
   * Log an error
   */
  error(
    source: LogSource,
    message: string,
    error?: Error,
    context?: {
      sessionId?: string;
      taskId?: string;
      agentId?: string;
      data?: Record<string, unknown>;
    }
  ): void {
    this.log("error", source, message, {
      ...context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  }

  /**
   * Log a critical error
   */
  critical(
    source: LogSource,
    message: string,
    error?: Error,
    context?: {
      sessionId?: string;
      taskId?: string;
      agentId?: string;
      data?: Record<string, unknown>;
    }
  ): void {
    this.log("critical", source, message, {
      ...context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  }

  /**
   * Core logging method
   * SECURITY: Redacts credentials before storing and displaying logs
   */
  private log(
    level: LogLevel,
    source: LogSource,
    message: string,
    context?: {
      sessionId?: string;
      taskId?: string;
      agentId?: string;
      data?: Record<string, unknown>;
      error?: {
        name: string;
        message: string;
        stack?: string;
      };
    }
  ): void {
    // Redact credentials from message and data
    const redactedMessage = redactLogMessage(message);
    const redactedData = context?.data ? redactLogData(context.data) : undefined;
    const redactedError = context?.error ? {
      name: context.error.name,
      message: redactLogMessage(context.error.message),
      stack: context.error.stack ? redactLogMessage(context.error.stack) : undefined
    } : undefined;
    
    const entry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      source,
      sessionId: context?.sessionId,
      taskId: context?.taskId,
      agentId: context?.agentId,
      message: redactedMessage,
      data: redactedData,
      error: redactedError,
    };

    this.logs.push(entry);

    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output (already redacted)
    this.logToConsole(entry);
  }

  /**
   * Query logs
   */
  query(query: LogQuery = {}): LogEntry[] {
    let results = this.logs;

    // Filter by session ID
    if (query.sessionId) {
      results = results.filter((log) => log.sessionId === query.sessionId);
    }

    // Filter by task ID
    if (query.taskId) {
      results = results.filter((log) => log.taskId === query.taskId);
    }

    // Filter by agent ID
    if (query.agentId) {
      results = results.filter((log) => log.agentId === query.agentId);
    }

    // Filter by source
    if (query.source) {
      results = results.filter((log) => log.source === query.source);
    }

    // Filter by exact level
    if (query.level) {
      results = results.filter((log) => log.level === query.level);
    }

    // Filter by minimum level
    if (query.minLevel) {
      const minLevelValue = this.levelHierarchy[query.minLevel];
      results = results.filter(
        (log) => this.levelHierarchy[log.level] >= minLevelValue
      );
    }

    // Filter by time range
    if (query.startTime) {
      results = results.filter(
        (log) => log.timestamp >= query.startTime!
      );
    }

    if (query.endTime) {
      results = results.filter((log) => log.timestamp <= query.endTime!);
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get logs for a session
   */
  getSessionLogs(sessionId: string, limit?: number): LogEntry[] {
    return this.query({ sessionId, limit });
  }

  /**
   * Get logs for a task
   */
  getTaskLogs(taskId: string, limit?: number): LogEntry[] {
    return this.query({ taskId, limit });
  }

  /**
   * Get logs for an agent
   */
  getAgentLogs(agentId: string, limit?: number): LogEntry[] {
    return this.query({ agentId, limit });
  }

  /**
   * Get error logs
   */
  getErrors(
    sessionId?: string,
    minLevel: LogLevel = "error"
  ): LogEntry[] {
    return this.query({ sessionId, minLevel });
  }

  /**
   * Get recent logs
   */
  getRecent(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Clear logs
   */
  clear(filter?: {
    sessionId?: string;
    taskId?: string;
    agentId?: string;
    olderThan?: Date;
  }): number {
    if (!filter) {
      const count = this.logs.length;
      this.logs = [];
      console.log(`[OrchestrationLogger] Cleared all logs (${count} entries)`);
      return count;
    }

    let toRemove: LogEntry[] = [];

    if (filter.sessionId) {
      toRemove = this.logs.filter((log) => log.sessionId === filter.sessionId);
    } else if (filter.taskId) {
      toRemove = this.logs.filter((log) => log.taskId === filter.taskId);
    } else if (filter.agentId) {
      toRemove = this.logs.filter((log) => log.agentId === filter.agentId);
    } else if (filter.olderThan) {
      toRemove = this.logs.filter((log) => log.timestamp < filter.olderThan!);
    }

    const toRemoveIds = new Set(toRemove.map((log) => log.id));
    this.logs = this.logs.filter((log) => !toRemoveIds.has(log.id));

    console.log(
      `[OrchestrationLogger] Cleared ${toRemove.length} logs matching filter`
    );

    return toRemove.length;
  }

  /**
   * Get statistics
   */
  getStatistics(sessionId?: string): LogStatistics {
    let logs = sessionId
      ? this.logs.filter((log) => log.sessionId === sessionId)
      : this.logs;

    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    };

    const bySource: Record<LogSource, number> = {
      orchestrator: 0,
      agent: 0,
      task: 0,
      system: 0,
    };

    const bySession: Record<string, number> = {};

    for (const log of logs) {
      byLevel[log.level]++;
      bySource[log.source]++;

      if (log.sessionId) {
        bySession[log.sessionId] = (bySession[log.sessionId] || 0) + 1;
      }
    }

    const errorCount = byLevel.error + byLevel.critical;
    const errorRate = logs.length > 0 ? errorCount / logs.length : 0;

    return {
      totalLogs: logs.length,
      byLevel,
      bySource,
      bySession,
      errorRate,
    };
  }

  /**
   * Export logs as JSON
   */
  exportLogs(query: LogQuery = {}): string {
    const logs = this.query(query);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = this.formatPrefix(entry);
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case "critical":
      case "error":
        console.error(message, entry.data || "", entry.error || "");
        break;
      case "warn":
        console.warn(message, entry.data || "");
        break;
      case "debug":
        console.debug(message, entry.data || "");
        break;
      default:
        console.log(message, entry.data || "");
    }
  }

  /**
   * Format log prefix
   */
  private formatPrefix(entry: LogEntry): string {
    const time = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(8);
    const source = entry.source.padEnd(12);

    let context = "";
    if (entry.sessionId) {
      context += `[Session:${entry.sessionId.slice(0, 8)}]`;
    }
    if (entry.taskId) {
      context += `[Task:${entry.taskId.slice(0, 8)}]`;
    }
    if (entry.agentId) {
      context += `[Agent:${entry.agentId.slice(0, 8)}]`;
    }

    return `[${time}] [${level}] [${source}]${context}`;
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `log-${Date.now()}-${this.logIdCounter++}`;
  }

  /**
   * Set maximum log retention
   */
  setMaxLogs(max: number): void {
    this.maxLogs = max;
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    console.log(`[OrchestrationLogger] Max logs set to ${max}`);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const orchestrationLogger = new OrchestrationLoggerService();
export default orchestrationLogger;
