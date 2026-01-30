/**
 * Simple runtime test for LLM call validator
 * Run with: tsx server/utils/test-validator-runtime.ts
 */

import {
  validateMessageHistory,
  validateLLMCall,
  looksLikeSystemInstruction,
} from "./llm-call-validator";

// Configuration
const ERROR_MESSAGE_TRUNCATE_LENGTH = 100;

console.log("=".repeat(60));
console.log("LLM Call Validator Runtime Tests");
console.log("=".repeat(60));

// Test 1: Valid message history
console.log("\n✓ Test 1: Valid message history");
const validHistory = [
  { role: "user", parts: [{ text: "Hello, how are you?" }] },
  { role: "model", parts: [{ text: "I'm doing well, thanks!" }] },
];
const result1 = validateMessageHistory(validHistory);
console.log(`  Result: ${result1.valid ? "PASS ✓" : "FAIL ✗"}`);
if (!result1.valid) console.log(`  Errors:`, result1.errors);

// Test 2: Detect system instruction pattern
console.log("\n✓ Test 2: Detect system instruction in message");
const invalidHistory = [
  {
    role: "user",
    parts: [
      {
        text: "You are a helpful assistant. Answer questions concisely.",
      },
    ],
  },
];
const result2 = validateMessageHistory(invalidHistory);
console.log(`  Result: ${!result2.valid ? "PASS ✓" : "FAIL ✗"} (should be invalid)`);
if (!result2.valid) console.log(`  Detected error:`, result2.errors[0]);

// Test 3: Valid LLM call structure
console.log("\n✓ Test 3: Valid LLM call structure");
const validCall = {
  model: "gemini-2.0-flash",
  contents: [{ role: "user", parts: [{ text: "Hello!" }] }],
  config: {
    systemInstruction: "You are a helpful assistant.",
  },
};
const result3 = validateLLMCall(validCall);
console.log(`  Result: ${result3.valid ? "PASS ✓" : "FAIL ✗"}`);
if (!result3.valid) console.log(`  Errors:`, result3.errors);

// Test 4: Detect system instruction patterns
console.log("\n✓ Test 4: Detect system instruction patterns");
const tests = [
  { text: "You are a helpful assistant", expected: true },
  { text: "Hello, how are you?", expected: false },
  { text: "Act as a professional writer", expected: true },
  { text: "You are nice", expected: false }, // Too short
];

let allPassed = true;
for (const test of tests) {
  const result = looksLikeSystemInstruction(test.text);
  const passed = result === test.expected;
  if (!passed) {
    console.log(`  FAIL ✗: "${test.text}" - expected ${test.expected}, got ${result}`);
    allPassed = false;
  }
}
if (allPassed) {
  console.log(`  Result: PASS ✓`);
}

// Test 5: Real-world example from routes.ts
console.log("\n✓ Test 5: Real-world main chat endpoint structure");
const mainChatStructure = {
  model: "gemini-2.5-pro",
  contents: [
    { role: "user", parts: [{ text: "Tell me about TypeScript" }] },
    { role: "model", parts: [{ text: "TypeScript is..." }] },
    { role: "user", parts: [{ text: "What are the benefits?" }] },
  ],
  config: {
    systemInstruction: "You are a helpful programming assistant.",
  },
};
const result5 = validateLLMCall(mainChatStructure);
console.log(`  Result: ${result5.valid ? "PASS ✓" : "FAIL ✗"}`);
if (!result5.valid) console.log(`  Errors:`, result5.errors);

// Test 6: Catch the old bug from agent-worker.ts
console.log("\n✓ Test 6: Catch old agent-worker bug (system prompt as user message)");
const buggyAgentWorker = [
  {
    role: "user",
    parts: [{ text: "System: You are a specialized task executor with advanced capabilities for handling complex workflows." }],
  },
  { role: "user", parts: [{ text: "Execute the task" }] },
];
const result6 = validateMessageHistory(buggyAgentWorker);
console.log(`  Result: ${!result6.valid ? "PASS ✓" : "FAIL ✗"} (should be invalid)`);
if (!result6.valid) console.log(`  Detected error:`, result6.errors[0].substring(0, ERROR_MESSAGE_TRUNCATE_LENGTH) + "...");

// Summary
console.log("\n" + "=".repeat(60));
console.log("All runtime tests completed!");
console.log("=".repeat(60));
