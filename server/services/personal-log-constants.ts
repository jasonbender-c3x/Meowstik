/**
 * Shared constants for personal log ingestion
 */

/**
 * Source type identifier for personal log entries
 * Used in both ingestion service and pipeline for consistent classification
 */
export const PERSONAL_LOG_SOURCE_TYPE = 'personal_log' as const;

/**
 * Regular expression to match timestamp format in personal log
 * Format: **YYYY-MM-DDTHH:mm:ss.sssZ**
 * 
 * Example: **2026-01-15T12:30:00.000Z**
 */
export const PERSONAL_LOG_TIMESTAMP_REGEX = /^\*\*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z)\*\*/;
