
/**
 * =============================================================================
 * ENVIRONMENT METADATA UTILITY
 * =============================================================================
 *
 * Provides environment awareness information for the AI system prompt.
 * This allows the AI to make context-aware decisions based on:
 * - Execution environment (production vs. local development)
 * - Server hostname (for tool availability and networking constraints)
 *
 * USAGE:
 * ------
 * import { getEnvironmentMetadata } from './utils/environment-metadata';
 * 
 * const metadata = getEnvironmentMetadata();
 * // Returns: { environment: 'production', server_hostname: 'my-server' }
 * =============================================================================
 */

import { hostname } from "os";

/**
 * Environment metadata structure
 */
export interface EnvironmentMetadata {
  /**
   * Environment type: "production" or "local"
   * Determined by NODE_ENV environment variable
   */
  environment: "production" | "local";
  
  /**
   * Server hostname
   * The name of the machine the application is running on
   */
  server_hostname: string;
}

/**
 * Timestamp metadata structure
 */
export interface TimestampMetadata {
  /**
   * ISO 8601 date string (YYYY-MM-DD) in the server's local timezone
   */
  date: string;

  /**
   * Local time string (HH:MM:SS, 24-hour) in the server's local timezone
   */
  time: string;

  /**
   * IANA timezone name (e.g. "America/New_York" or "UTC")
   */
  timezone: string;

  /**
   * Full ISO 8601 timestamp in UTC (e.g. "2026-05-20T12:45:07.786Z")
   */
  iso: string;
}

/**
 * Cached hostname value to avoid repeated system calls
 */
let cachedHostname: string | null = null;

/**
 * Get the server hostname with caching
 * @returns The server hostname
 */
function getHostname(): string {
  if (cachedHostname === null) {
    cachedHostname = hostname();
  }
  return cachedHostname;
}

/**
 * Detects and returns current environment metadata.
 * 
 * Environment Detection:
 * - "production": When NODE_ENV is set to "production"
 * - "local": All other cases (development, test, or unset)
 * 
 * Hostname Detection:
 * - Uses os.hostname() to get the system hostname (cached after first call)
 * 
 * @returns {EnvironmentMetadata} Environment metadata object
 */
export function getEnvironmentMetadata(): EnvironmentMetadata {
  const nodeEnv = process.env.NODE_ENV;
  const environment = nodeEnv === "production" ? "production" : "local";
  const server_hostname = getHostname();

  return {
    environment,
    server_hostname,
  };
}

/**
 * Returns the current date, time, and timezone.
 * Computed fresh on every call (intentionally not cached).
 *
 * @returns {TimestampMetadata} Current timestamp metadata
 */
export function getCurrentTimestamp(): TimestampMetadata {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const date = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
  const time = now.toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }); // HH:MM:SS

  return {
    date,
    time,
    timezone,
    iso: now.toISOString(),
  };
}

/**
 * Formats environment metadata as a markdown block for system prompts.
 * Includes the current date, time, and timezone so the AI always has
 * accurate temporal context at the start of every session or turn.
 *
 * @returns {string} Formatted markdown block
 */
export function formatEnvironmentMetadata(): string {
  const metadata = getEnvironmentMetadata();
  const ts = getCurrentTimestamp();

  return `# Environment Metadata

**Environment**: \`${metadata.environment}\`
**Server Hostname**: \`${metadata.server_hostname}\`
**Current Date**: \`${ts.date}\`
**Current Time**: \`${ts.time}\`
**Timezone**: \`${ts.timezone}\`

*This metadata allows you to make context-aware decisions about:*
- Which tools are available (e.g., ssh-keygen may be available locally but not in production)
- Which secrets to use (production vs. development credentials)
- Network constraints and firewall rules
- Available system resources and capabilities`;
}



