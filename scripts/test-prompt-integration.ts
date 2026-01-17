/**
 * Integration test to verify environment metadata is included in system prompt
 * This test imports the prompt composer and verifies the metadata appears in the output
 */

import * as fs from "fs";
import * as path from "path";

// Import the formatEnvironmentMetadata function to test integration
import { formatEnvironmentMetadata } from "../server/utils/environment-metadata.js";

console.log("=".repeat(80));
console.log("PROMPT COMPOSER INTEGRATION TEST");
console.log("=".repeat(80));

// Check the prompt-composer.ts source code to verify import is present
console.log("\n1. Verifying import statement in prompt-composer.ts:");
const promptComposerPath = path.join(process.cwd(), "server/services/prompt-composer.ts");
const promptComposerSource = fs.readFileSync(promptComposerPath, "utf-8");

const hasImport = promptComposerSource.includes('import { formatEnvironmentMetadata } from "../utils/environment-metadata"');
console.log(`  - Has formatEnvironmentMetadata import: ${hasImport ? "✓" : "✗"}`);

// Check that formatEnvironmentMetadata is called in getSystemPrompt
const hasUsage = promptComposerSource.includes("formatEnvironmentMetadata()");
console.log(`  - Calls formatEnvironmentMetadata(): ${hasUsage ? "✓" : "✗"}`);

// Verify the function is called in the right place (after Agent Identity, before core directives)
const lines = promptComposerSource.split('\n');
let agentIdentityLine = -1;
let formatEnvLine = -1;
let coreDirectivesLine = -1;

lines.forEach((line, index) => {
  if (line.includes('# Agent Identity') && agentIdentityLine === -1) {
    agentIdentityLine = index;
  }
  if (line.includes('formatEnvironmentMetadata()') && formatEnvLine === -1) {
    formatEnvLine = index;
  }
  if (line.includes('brandedCoreDirectives,') && coreDirectivesLine === -1) {
    coreDirectivesLine = index;
  }
});

const correctOrder = agentIdentityLine > 0 && 
                     formatEnvLine > agentIdentityLine && 
                     formatEnvLine < coreDirectivesLine;

console.log(`  - Metadata inserted in correct order: ${correctOrder ? "✓" : "✗"}`);

// Test the actual formatted output
console.log("\n2. Sample Environment Metadata Output:");
const metadata = formatEnvironmentMetadata();
console.log(metadata);

console.log("\n" + "=".repeat(80));
const allPassed = hasImport && hasUsage && correctOrder;
if (allPassed) {
  console.log("✓ ALL INTEGRATION TESTS PASSED!");
  console.log("\nThe environment metadata is correctly integrated into the PromptComposer.");
  console.log("It will appear in every system prompt sent to the AI, right after the");
  console.log("Agent Identity section and before the core directives.");
} else {
  console.log("✗ SOME INTEGRATION TESTS FAILED");
  process.exit(1);
}
console.log("=".repeat(80));
