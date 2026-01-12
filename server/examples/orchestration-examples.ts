/**
 * =============================================================================
 * ORCHESTRATION EXAMPLES
 * =============================================================================
 * 
 * Example scripts demonstrating how to use the orchestration layer.
 */

import { orchestrator } from "../services/orchestrator";
import { stateManager } from "../services/state-manager";
import { orchestrationLogger } from "../services/orchestration-logger";

// Example 1: Simple orchestrated task
export async function simpleTaskExample() {
  console.log("\n=== Simple Orchestrated Task ===\n");
  await orchestrator.initialize();
  
  const result = await orchestrator.orchestrate(
    "Research top JavaScript frameworks and create comparison",
    {
      userId: "example-user",
      initialContext: { format: "markdown" },
    }
  );
  
  console.log(`Session: ${result.sessionId}`);
  console.log(`Status: ${result.status}`);
  console.log(`Tasks: ${result.totalTasks}`);
  
  return result;
}

// Example 2: State management
export function stateManagementExample() {
  console.log("\n=== State Management ===\n");
  
  const sessionId = "demo-123";
  stateManager.createSession(sessionId, {
    initialState: { language: "typescript" },
  });
  
  stateManager.setState(sessionId, {
    key: "framework",
    value: "express",
    type: "shared",
  });
  
  const state = stateManager.getAllState(sessionId);
  console.log("State:", state);
  
  return state;
}

// Example 3: Logging
export function loggingExample() {
  console.log("\n=== Logging ===\n");
  
  const sessionId = "log-demo";
  
  orchestrationLogger.info("orchestrator", "Session started", {
    sessionId,
    data: { goal: "Example task" },
  });
  
  const logs = orchestrationLogger.getSessionLogs(sessionId);
  console.log(`Logs: ${logs.length} entries`);
  
  const stats = orchestrationLogger.getStatistics(sessionId);
  console.log("Stats:", stats);
  
  return stats;
}

// Run all examples
export async function runExamples() {
  console.log("=== ORCHESTRATION EXAMPLES ===\n");
  await simpleTaskExample();
  stateManagementExample();
  loggingExample();
  console.log("\n=== EXAMPLES COMPLETED ===");
}

if (require.main === module) {
  runExamples().catch(console.error);
}
