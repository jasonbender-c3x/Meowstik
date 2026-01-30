/**
 * Test script for environment metadata feature
 * 
 * This script verifies that environment metadata is correctly:
 * 1. Detected and formatted
 * 2. Can be used in system prompts
 * 
 * This is a standalone test that doesn't require database connection.
 */

import { getEnvironmentMetadata, formatEnvironmentMetadata } from "../server/utils/environment-metadata.js";

console.log("=".repeat(80));
console.log("ENVIRONMENT METADATA TEST");
console.log("=".repeat(80));

// Test 1: Check raw metadata detection
console.log("\n1. Raw Environment Metadata:");
const metadata = getEnvironmentMetadata();
console.log(JSON.stringify(metadata, null, 2));
console.log(`  - Environment type: ${metadata.environment}`);
console.log(`  - Server hostname: ${metadata.server_hostname}`);

// Verify metadata fields are present
const hasEnvironment = metadata.environment === "production" || metadata.environment === "local";
const hasHostname = metadata.server_hostname && metadata.server_hostname.length > 0;

console.log(`  - Valid environment field: ${hasEnvironment ? "✓" : "✗"}`);
console.log(`  - Valid hostname field: ${hasHostname ? "✓" : "✗"}`);

// Test 2: Check formatted metadata
console.log("\n2. Formatted Environment Metadata:");
const formatted = formatEnvironmentMetadata();
console.log(formatted);

// Verify formatted output contains required sections
const hasEnvironmentSection = formatted.includes("# Environment Metadata");
const hasEnvironmentField = formatted.includes("**Environment**:");
const hasHostnameField = formatted.includes("**Server Hostname**:");
const hasToolsNote = formatted.includes("Which tools are available");

console.log("\n3. Validation of Formatted Output:");
console.log(`  - Has "# Environment Metadata" section: ${hasEnvironmentSection ? "✓" : "✗"}`);
console.log(`  - Has "**Environment**:" field: ${hasEnvironmentField ? "✓" : "✗"}`);
console.log(`  - Has "**Server Hostname**:" field: ${hasHostnameField ? "✓" : "✗"}`);
console.log(`  - Has tools availability note: ${hasToolsNote ? "✓" : "✗"}`);

console.log("\n" + "=".repeat(80));
const allPassed = hasEnvironment && hasHostname && hasEnvironmentSection && 
                  hasEnvironmentField && hasHostnameField && hasToolsNote;
if (allPassed) {
  console.log("✓ ALL TESTS PASSED - Environment metadata is correctly implemented!");
  console.log("\nThis metadata will be included in the system prompt to help the AI");
  console.log("make context-aware decisions about tools, secrets, and capabilities.");
} else {
  console.log("✗ SOME TESTS FAILED - Please review the implementation");
  process.exit(1);
}
console.log("=".repeat(80));

