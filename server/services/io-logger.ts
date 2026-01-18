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
   */
  logInput(data: LoggedInput): string {
    const timestamp = Date.now();
    const filename = `input-${timestamp}-${data.messageId}.md`;
    const filepath = path.join(this.logsDir, filename);

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

    const historySection = data.conversationHistory.length > 0 ? `
## Conversation History (${data.conversationHistory.length} messages)

${data.conversationHistory.map((msg, idx) => `
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

    const ragSection = data.ragContext && data.ragContext.length > 0 ? `
## RAG Context (${data.ragContext.length} chunks)

${data.ragContext.map((ctx, idx) => `
### Chunk ${idx + 1} - Score: ${ctx.score?.toFixed(3) || 'N/A'}
**Source:** ${ctx.source}

\`\`\`
${ctx.content}
\`\`\`
`).join('\n')}
` : '';

    const content = `# LLM INPUT LOG

**Timestamp:** ${data.timestamp}  
**Message ID:** ${data.messageId}  
**Chat ID:** ${data.chatId}  
**Model:** ${data.model}  
**Estimated Input Tokens:** ~${data.totalInputTokensEstimate}

---

## System Prompt (${data.systemPrompt.length} chars)

${breakdownSection}

\`\`\`
${data.systemPrompt}
\`\`\`

---

## User Message (${data.userMessage.length} chars)

\`\`\`
${data.userMessage}
\`\`\`

---

${historySection}
${attachmentsSection}
${ragSection}

---

**Total Input Size:** ${data.systemPrompt.length + data.userMessage.length} chars  
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
   */
  logOutput(data: LoggedOutput): string {
    const timestamp = Date.now();
    const filename = `output-${timestamp}-${data.messageId}.md`;
    const filepath = path.join(this.logsDir, filename);

    const toolCallsSection = data.toolCalls.length > 0 ? `
## Tool Calls (${data.toolCalls.length} calls)

${data.toolCalls.map((tc, idx) => `
### ${idx + 1}. ${tc.type}

**Parameters:**
\`\`\`json
${JSON.stringify(tc.parameters, null, 2)}
\`\`\`
`).join('\n')}
` : '';

    const toolResultsSection = data.toolResults.length > 0 ? `
## Tool Results (${data.toolResults.length} results)

${data.toolResults.map((tr, idx) => `
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

**Timestamp:** ${data.timestamp}  
**Message ID:** ${data.messageId}  
**Chat ID:** ${data.chatId}  
**Model:** ${data.model}  
**Duration:** ${data.durationMs}ms  
**Estimated Output Tokens:** ~${data.totalOutputTokensEstimate}

---

## Raw Response (${data.rawResponse.length} chars)

\`\`\`
${data.rawResponse}
\`\`\`

---

## Clean Content (${data.cleanContent.length} chars)

\`\`\`
${data.cleanContent}
\`\`\`

---

${toolCallsSection}
${toolResultsSection}

---

**Total Output Size:** ${data.rawResponse.length} chars  
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
