/**
 * Demonstration of the environment metadata feature
 * 
 * This script shows:
 * 1. How environment metadata is detected
 * 2. How it's formatted for the system prompt
 * 3. A sample of what the AI will see
 */

import { getEnvironmentMetadata, formatEnvironmentMetadata } from "../server/utils/environment-metadata.js";

console.log("\n" + "=".repeat(80));
console.log("ENVIRONMENT METADATA FEATURE DEMONSTRATION");
console.log("=".repeat(80) + "\n");

console.log("This feature ensures the AI is aware of its execution environment.\n");

// Show detected metadata
const metadata = getEnvironmentMetadata();
console.log("Detected Environment Metadata:");
console.log("-".repeat(40));
console.log(`  Environment: ${metadata.environment}`);
console.log(`  Hostname:    ${metadata.server_hostname}`);
console.log();

// Show formatted output
console.log("Formatted Output (as it appears in system prompt):");
console.log("-".repeat(40));
console.log(formatEnvironmentMetadata());
console.log();

// Show example use cases
console.log("=".repeat(80));
console.log("EXAMPLE USE CASES");
console.log("=".repeat(80) + "\n");

console.log("With this metadata, the AI can now:");
console.log();

console.log("1. TOOL AVAILABILITY DECISIONS");
console.log("   - In 'local' environment: Can use ssh-keygen, local file system tools");
console.log("   - In 'production' environment: May have restricted tool access");
console.log();

console.log("2. SECRET MANAGEMENT");
console.log("   - In 'local' environment: Use development API keys and test credentials");
console.log("   - In 'production' environment: Use production secrets securely");
console.log();

console.log("3. NETWORK AWARENESS");
console.log("   - Know which hostname it's running on for logging and debugging");
console.log("   - Understand firewall constraints based on environment");
console.log();

console.log("4. RESOURCE MANAGEMENT");
console.log("   - Adjust behavior based on available system resources");
console.log("   - Make informed decisions about caching, processing, etc.");
console.log();

console.log("=".repeat(80));
console.log("This metadata is automatically included in EVERY system prompt!");
console.log("=".repeat(80) + "\n");
