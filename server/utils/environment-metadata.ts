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
 * Formats environment metadata as a markdown block for system prompts.
 * 
 * @returns {string} Formatted markdown block
 */
export function formatEnvironmentMetadata(): string {
  const metadata = getEnvironmentMetadata();
  
  return `# Environment Metadata

**Environment**: \`${metadata.environment}\`
**Server Hostname**: \`${metadata.server_hostname}\`

*This metadata allows you to make context-aware decisions about:*
- Which tools are available (e.g., ssh-keygen may be available locally but not in production)
- Which secrets to use (production vs. development credentials)
- Network constraints and firewall rules
- Available system resources and capabilities`;
}
