/**
 * =============================================================================
 * PERSONAL LOG INGESTION SERVICE
 * =============================================================================
 * 
 * Automatically ingests the personal log (logs/personal.md) into the RAG
 * system for contextual understanding and personal growth tracking.
 * 
 * FEATURES:
 * - Parses timestamp-delimited log entries
 * - Ingests into PERSONAL_LIFE knowledge bucket
 * - File watching for real-time updates
 * - Deduplication based on timestamps
 * - Manual re-ingestion support
 * 
 * LOG FORMAT:
 * -----------
 * The personal log uses the following format:
 * 
 * ---
 * **YYYY-MM-DDTHH:mm:ss.sssZ**
 * Content of the log entry...
 * 
 * ---
 * **YYYY-MM-DDTHH:mm:ss.sssZ**
 * Next log entry...
 * 
 * =============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { ingestionPipeline } from './ingestion-pipeline';
import type { Evidence } from '@shared/schema';

const PERSONAL_LOG_PATH = path.join(process.cwd(), 'logs', 'personal.md');
const LOG_SOURCE_TYPE = 'personal_log';
const CHECK_INTERVAL_MS = 60000; // Check every minute

interface LogEntry {
  timestamp: Date;
  content: string;
}

export class PersonalLogIngestionService {
  private watcher: fs.FSWatcher | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastProcessedTimestamp: Date | null = null;
  private isProcessing = false;

  /**
   * Parse the personal log file into individual timestamped entries
   */
  private parseLogEntries(content: string): LogEntry[] {
    const entries: LogEntry[] = [];
    
    // Split by the "---" delimiter
    const sections = content.split(/\n---\n/);
    
    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;
      
      // Extract timestamp from markdown bold format: **YYYY-MM-DDTHH:mm:ss.sssZ**
      const timestampMatch = trimmed.match(/^\*\*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z)\*\*/);
      
      if (timestampMatch) {
        const timestamp = new Date(timestampMatch[1]);
        
        // Extract content after the timestamp line
        const contentStartIndex = trimmed.indexOf('\n', timestampMatch[0].length);
        const entryContent = contentStartIndex !== -1 
          ? trimmed.substring(contentStartIndex + 1).trim() 
          : '';
        
        if (entryContent.length > 0) {
          entries.push({
            timestamp,
            content: entryContent,
          });
        }
      }
    }
    
    return entries;
  }

  /**
   * Ingest new log entries that haven't been processed yet
   */
  private async ingestNewEntries(): Promise<void> {
    if (this.isProcessing) {
      console.log('[Personal Log] Already processing, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      // Check if file exists
      if (!fs.existsSync(PERSONAL_LOG_PATH)) {
        console.log('[Personal Log] File does not exist yet:', PERSONAL_LOG_PATH);
        return;
      }

      // Read the log file
      const content = fs.readFileSync(PERSONAL_LOG_PATH, 'utf-8');
      
      // Parse entries
      const entries = this.parseLogEntries(content);
      
      if (entries.length === 0) {
        console.log('[Personal Log] No entries found');
        return;
      }

      // Filter to only new entries (after last processed timestamp)
      const newEntries = this.lastProcessedTimestamp
        ? entries.filter(e => e.timestamp > this.lastProcessedTimestamp!)
        : entries;

      if (newEntries.length === 0) {
        console.log('[Personal Log] No new entries to ingest');
        return;
      }

      console.log(`[Personal Log] Found ${newEntries.length} new entries to ingest`);

      // Ingest each entry
      let ingestedCount = 0;
      for (const entry of newEntries) {
        try {
          const evidence = await ingestionPipeline.ingestText({
            sourceType: 'personal_log',
            sourceId: `personal-log-${entry.timestamp.toISOString()}`,
            modality: 'text',
            mimeType: 'text/markdown',
            title: `Personal Reflection - ${entry.timestamp.toLocaleDateString()}`,
            rawContent: entry.content,
            extractedText: entry.content,
            author: 'Meowstik',
            contentDate: entry.timestamp,
            userId: null, // Personal log belongs to the AI itself, not a specific user
          });

          // Process the evidence to extract entities and classify to bucket
          await ingestionPipeline.processEvidence(evidence.id);
          
          ingestedCount++;
          
          // Update last processed timestamp
          if (!this.lastProcessedTimestamp || entry.timestamp > this.lastProcessedTimestamp) {
            this.lastProcessedTimestamp = entry.timestamp;
          }
        } catch (error) {
          console.error(`[Personal Log] Failed to ingest entry from ${entry.timestamp}:`, error);
        }
      }

      console.log(`[Personal Log] Successfully ingested ${ingestedCount}/${newEntries.length} entries`);
    } catch (error) {
      console.error('[Personal Log] Error during ingestion:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Force re-ingestion of all log entries (useful after schema changes)
   */
  async reingestAll(): Promise<{ success: boolean; entriesIngested: number; error?: string }> {
    try {
      console.log('[Personal Log] Starting full re-ingestion...');
      
      // Reset last processed timestamp to force re-ingestion
      const originalTimestamp = this.lastProcessedTimestamp;
      this.lastProcessedTimestamp = null;
      
      const content = fs.readFileSync(PERSONAL_LOG_PATH, 'utf-8');
      const entries = this.parseLogEntries(content);
      
      await this.ingestNewEntries();
      
      return {
        success: true,
        entriesIngested: entries.length,
      };
    } catch (error) {
      console.error('[Personal Log] Re-ingestion failed:', error);
      return {
        success: false,
        entriesIngested: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get statistics about the personal log
   */
  getStats(): {
    lastProcessedTimestamp: string | null;
    isWatching: boolean;
    isProcessing: boolean;
  } {
    return {
      lastProcessedTimestamp: this.lastProcessedTimestamp?.toISOString() || null,
      isWatching: this.watcher !== null || this.checkInterval !== null,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Start watching the personal log file for changes
   */
  async start(): Promise<void> {
    console.log('[Personal Log] Starting ingestion service...');

    // Initial ingestion
    await this.ingestNewEntries();

    // Set up file watcher (if supported)
    try {
      this.watcher = fs.watch(PERSONAL_LOG_PATH, (eventType) => {
        if (eventType === 'change') {
          console.log('[Personal Log] File changed, triggering ingestion...');
          this.ingestNewEntries().catch(error => {
            console.error('[Personal Log] Error during file change ingestion:', error);
          });
        }
      });
      console.log('[Personal Log] File watcher started');
    } catch (error) {
      console.warn('[Personal Log] File watcher not available, using polling instead:', error);
      
      // Fall back to periodic polling
      this.checkInterval = setInterval(() => {
        this.ingestNewEntries().catch(error => {
          console.error('[Personal Log] Error during periodic check:', error);
        });
      }, CHECK_INTERVAL_MS);
      console.log(`[Personal Log] Polling started (checking every ${CHECK_INTERVAL_MS / 1000}s)`);
    }
  }

  /**
   * Stop watching the personal log file
   */
  stop(): void {
    console.log('[Personal Log] Stopping ingestion service...');
    
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    console.log('[Personal Log] Ingestion service stopped');
  }
}

// Singleton instance
export const personalLogIngestion = new PersonalLogIngestionService();
