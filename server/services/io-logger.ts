/**
 * =============================================================================
 * INPUT/OUTPUT LOGGER SERVICE
 * =============================================================================
 * 
 * Logs complete LLM inputs and outputs to separate files for debugging.
 * Creates two files per interaction:
 * - logs/debug-io/input-{timestamp}-{id}.md - Everything sent TO the LLM
 * - logs/debug-io/output-{timestamp}-{id}.md - Everything received FROM the LLM
 * 
 * This makes it easy to see exactly what the LLM receives and produces.
 * =============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * =============================================================================
 * CREDENTIAL REDACTION UTILITIES
 * =============================================================================
 * 
 * These functions ensure that sensitive credentials (API keys, tokens, passwords,
 * secrets) are NEVER exposed in logs. All credential patterns are redacted
 * before being written to disk.
 * 
 * This is a critical security feature to prevent accidental credential leakage.
 * =============================================================================
 */

/**
 * Patterns for detecting common credential formats
 * Covers: API keys, tokens, passwords, secrets, OAuth tokens, etc.
 */
const CREDENTIAL_PATTERNS = [
  // Generic API keys and tokens
  /\b[A-Za-z0-9_-]{20,}\b/g, // Long alphanumeric strings (likely keys)
  
  // Specific service patterns
  /ghp_[A-Za-z0-9]{36}/g, // GitHub Personal Access Token
  /gho_[A-Za-z0-9]{36}/g, // GitHub OAuth Token
  /github_pat_[A-Za-z0-9_]{82}/g, // GitHub Fine-grained PAT
  /sk-[A-Za-z0-9]{48}/g, // OpenAI API Key
  /sk-proj-[A-Za-z0-9_-]{48,}/g, // OpenAI Project API Key
  /AIza[A-Za-z0-9_-]{35}/g, // Google API Key
  /ya29\.[A-Za-z0-9_-]{68,}/g, // Google OAuth2 Access Token
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, // UUIDs (often used as API keys)
  /AC[a-z0-9]{32}/g, // Twilio Account SID
  /SK[a-z0-9]{32}/g, // Twilio API Key SID
  /[A-Za-z0-9]{32}/g, // Twilio Auth Token (32 chars)
  /xoxb-[A-Za-z0-9-]+/g, // Slack Bot Token
  /xoxp-[A-Za-z0-9-]+/g, // Slack User Token
  /AKIA[A-Z0-9]{16}/g, // AWS Access Key ID
  
  // Password-like patterns in JSON
  /"(password|passwd|pwd|secret|api_key|apikey|token|auth_token|access_token|private_key)"\s*:\s*"[^"]+"/gi,
  
  // Authorization headers
  /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/gi,
  /Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi,
  
  // Generic credential field patterns
  /api[_-]?key[s]?\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi,
  /token[s]?\s*[:=]\s*['"]?[A-Za-z0-9._-]{20,}['"]?/gi,
  /secret[s]?\s*[:=]\s*['"]?[A-Za-z0-9._-]{20,}['"]?/gi,
  /password[s]?\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi,
];

/**
 * Redact sensitive credentials from text
 * @param text - The text to redact
 * @returns Text with credentials replaced by [REDACTED]
 */
function redactCredentials(text: string): string {
  let redacted = text;
  
  for (const pattern of CREDENTIAL_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      // Preserve the structure for JSON keys
      if (match.includes(':')) {
        const [key, _] = match.split(':');
        return `${key}: "[REDACTED]"`;
      }
      // For authorization headers, preserve the type
      if (match.toLowerCase().includes('authorization')) {
        return match.split(' ')[0] + ' [REDACTED]';
      }
      // For everything else, just redact
      return '[REDACTED]';
    });
  }
  
  return redacted;
}

/**
 * Recursively redact credentials from objects (for JSON data)
 * @param obj - The object to redact
 * @returns Deep copy with credentials redacted
 */
function redactObjectCredentials(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return redactCredentials(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObjectCredentials(item));
  }
  
  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if the key name suggests it's a credential field
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
      } else {
        redacted[key] = redactObjectCredentials(value);
      }
    }
    return redacted;
  }
  
  return obj;
}

export interface LoggedInput {
  timestamp: string;
  messageId: string;
  chatId: string;
  systemPrompt: string;
  systemPromptBreakdown?: {
    coreDirectives: { size: number; lines: number };
    personality: { size: number; lines: number };
    tools: { size: number; lines: number };
    memory: { size: number; lines: number };
    cache: { size: number; lines: number };
  };
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  attachments: Array<{ type: string; filename: string; size: number; mimeType?: string }>;
  ragContext?: Array<{ source: string; content: string; score?: number }>;
  model: string;
  totalInputTokensEstimate: number;
}

export interface LoggedOutput {
  timestamp: string;
  messageId: string;
  chatId: string;
  rawResponse: string;
  cleanContent: string;
  toolCalls: Array<{ type: string; parameters: any }>;
  toolResults: Array<{ type: string; success: boolean; result?: any; error?: string }>;
  model: string;
  durationMs: number;
  totalOutputTokensEstimate: number;
}

class IOLogger {
  private logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs', 'debug-io');
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
      console.log(`[IOLogger] Created logs directory: ${this.logsDir}`);
    }
  }

  /**
   * Log input (everything sent TO the LLM)
   * SECURITY: All credentials are redacted before logging
   */
  logInput(data: LoggedInput): string {
    const timestamp = Date.now();
    const filename = `input-${timestamp}-${data.messageId}.md`;
    const filepath = path.join(this.logsDir, filename);

    // Redact credentials from all text content
    const redactedSystemPrompt = redactCredentials(data.systemPrompt);
    const redactedUserMessage = redactCredentials(data.userMessage);
    const redactedHistory = data.conversationHistory.map(msg => ({
      role: msg.role,
      content: redactCredentials(msg.content)
    }));
    const redactedRagContext = data.ragContext?.map(ctx => ({
      source: ctx.source,
      content: redactCredentials(ctx.content),
      score: ctx.score
    }));

    const breakdown = data.systemPromptBreakdown;
    const breakdownSection = breakdown ? `
## System Prompt Breakdown

| Component | Size | Lines | Tokens |
|-----------|------|-------|--------|
| Core Directives | ${breakdown.coreDirectives.size} chars | ${breakdown.coreDirectives.lines} | ~${Math.ceil(breakdown.coreDirectives.size / 4)} |
| Personality | ${breakdown.personality.size} chars | ${breakdown.personality.lines} | ~${Math.ceil(breakdown.personality.size / 4)} |
| Tools | ${breakdown.tools.size} chars | ${breakdown.tools.lines} | ~${Math.ceil(breakdown.tools.size / 4)} |
| Memory | ${breakdown.memory.size} chars | ${breakdown.memory.lines} | ~${Math.ceil(breakdown.memory.size / 4)} |
| Cache | ${breakdown.cache.size} chars | ${breakdown.cache.lines} | ~${Math.ceil(breakdown.cache.size / 4)} |

` : '';

    const historySection = redactedHistory.length > 0 ? `
## Conversation History (${redactedHistory.length} messages)

${redactedHistory.map((msg, idx) => `
### Message ${idx + 1} - ${msg.role.toUpperCase()}
\`\`\`
${msg.content}
\`\`\`
`).join('\n')}
` : '';

    const attachmentsSection = data.attachments.length > 0 ? `
## Attachments (${data.attachments.length} files)

${data.attachments.map((att, idx) => `
### ${idx + 1}. ${att.filename}
- Type: ${att.type}
- Size: ${att.size} bytes
- MIME: ${att.mimeType || 'N/A'}
`).join('\n')}
` : '';

    const ragSection = redactedRagContext && redactedRagContext.length > 0 ? `
## RAG Context (${redactedRagContext.length} chunks)

${redactedRagContext.map((ctx, idx) => `
### Chunk ${idx + 1} - Score: ${ctx.score?.toFixed(3) || 'N/A'}
**Source:** ${ctx.source}

\`\`\`
${ctx.content}
\`\`\`
`).join('\n')}
` : '';

    const content = `# LLM INPUT LOG
**⚠️ SECURITY NOTE: All credentials have been redacted for security ⚠️**

**Timestamp:** ${data.timestamp}  
**Message ID:** ${data.messageId}  
**Chat ID:** ${data.chatId}  
**Model:** ${data.model}  
**Estimated Input Tokens:** ~${data.totalInputTokensEstimate}

---

## System Prompt (${redactedSystemPrompt.length} chars)

${breakdownSection}

\`\`\`
${redactedSystemPrompt}
\`\`\`

---

## User Message (${redactedUserMessage.length} chars)

\`\`\`
${redactedUserMessage}
\`\`\`

---

${historySection}
${attachmentsSection}
${ragSection}

---

**Total Input Size:** ${redactedSystemPrompt.length + redactedUserMessage.length} chars  
**Estimated Tokens:** ~${data.totalInputTokensEstimate}
`;

    try {
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log(`[IOLogger] ✓ Input logged: ${filename}`);
      return filename;
    } catch (error) {
      console.error(`[IOLogger] Failed to log input:`, error);
      return '';
    }
  }

  /**
   * Log output (everything received FROM the LLM)
   * SECURITY: All credentials are redacted before logging
   */
  logOutput(data: LoggedOutput): string {
    const timestamp = Date.now();
    const filename = `output-${timestamp}-${data.messageId}.md`;
    const filepath = path.join(this.logsDir, filename);

    // Redact credentials from all output content
    const redactedRawResponse = redactCredentials(data.rawResponse);
    const redactedCleanContent = redactCredentials(data.cleanContent);
    
    // Redact credentials from tool calls and results
    const redactedToolCalls = data.toolCalls.map(tc => ({
      type: tc.type,
      parameters: redactObjectCredentials(tc.parameters)
    }));
    
    const redactedToolResults = data.toolResults.map(tr => ({
      type: tr.type,
      success: tr.success,
      result: tr.result ? redactObjectCredentials(tr.result) : undefined,
      error: tr.error ? redactCredentials(tr.error) : undefined
    }));

    const toolCallsSection = redactedToolCalls.length > 0 ? `
## Tool Calls (${redactedToolCalls.length} calls)

${redactedToolCalls.map((tc, idx) => `
### ${idx + 1}. ${tc.type}

**Parameters:**
\`\`\`json
${JSON.stringify(tc.parameters, null, 2)}
\`\`\`
`).join('\n')}
` : '';

    const toolResultsSection = redactedToolResults.length > 0 ? `
## Tool Results (${redactedToolResults.length} results)

${redactedToolResults.map((tr, idx) => `
### ${idx + 1}. ${tr.type}

**Status:** ${tr.success ? '✓ SUCCESS' : '✗ FAILED'}

${tr.success && tr.result ? `
**Result:**
\`\`\`json
${JSON.stringify(tr.result, null, 2)}
\`\`\`
` : ''}

${!tr.success && tr.error ? `
**Error:**
\`\`\`
${tr.error}
\`\`\`
` : ''}
`).join('\n')}
` : '';

    const content = `# LLM OUTPUT LOG
**⚠️ SECURITY NOTE: All credentials have been redacted for security ⚠️**

**Timestamp:** ${data.timestamp}  
**Message ID:** ${data.messageId}  
**Chat ID:** ${data.chatId}  
**Model:** ${data.model}  
**Duration:** ${data.durationMs}ms  
**Estimated Output Tokens:** ~${data.totalOutputTokensEstimate}

---

## Raw Response (${redactedRawResponse.length} chars)

\`\`\`
${redactedRawResponse}
\`\`\`

---

## Clean Content (${redactedCleanContent.length} chars)

\`\`\`
${redactedCleanContent}
\`\`\`

---

${toolCallsSection}
${toolResultsSection}

---

**Total Output Size:** ${redactedRawResponse.length} chars  
**Estimated Tokens:** ~${data.totalOutputTokensEstimate}  
**Processing Time:** ${data.durationMs}ms
`;

    try {
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log(`[IOLogger] ✓ Output logged: ${filename}`);
      return filename;
    } catch (error) {
      console.error(`[IOLogger] Failed to log output:`, error);
      return '';
    }
  }

  /**
   * List all logged files
   */
  listLogs(): { inputs: string[]; outputs: string[] } {
    try {
      const files = fs.readdirSync(this.logsDir);
      const inputs = files.filter(f => f.startsWith('input-')).sort().reverse();
      const outputs = files.filter(f => f.startsWith('output-')).sort().reverse();
      return { inputs, outputs };
    } catch (error) {
      console.error(`[IOLogger] Failed to list logs:`, error);
      return { inputs: [], outputs: [] };
    }
  }

  /**
   * Get content of a log file
   */
  getLog(filename: string): string | null {
    try {
      const filepath = path.join(this.logsDir, filename);
      return fs.readFileSync(filepath, 'utf-8');
    } catch (error) {
      console.error(`[IOLogger] Failed to read log ${filename}:`, error);
      return null;
    }
  }

  /**
   * Delete old logs (keep last N)
   */
  cleanup(keepLast: number = 50): void {
    try {
      const { inputs, outputs } = this.listLogs();
      
      // Delete old input logs
      if (inputs.length > keepLast) {
        const toDelete = inputs.slice(keepLast);
        toDelete.forEach(file => {
          fs.unlinkSync(path.join(this.logsDir, file));
        });
        console.log(`[IOLogger] Deleted ${toDelete.length} old input logs`);
      }

      // Delete old output logs
      if (outputs.length > keepLast) {
        const toDelete = outputs.slice(keepLast);
        toDelete.forEach(file => {
          fs.unlinkSync(path.join(this.logsDir, file));
        });
        console.log(`[IOLogger] Deleted ${toDelete.length} old output logs`);
      }
    } catch (error) {
      console.error(`[IOLogger] Failed to cleanup logs:`, error);
    }
  }
}

export const ioLogger = new IOLogger();
