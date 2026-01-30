# Tool Logging Standard v1.0

This document outlines the JSONL (JSON Lines) standard for logging tool executions to ensure accuracy, verifiability, and rapid diagnostics.

## Principle: Trust, but Verify

The core principle is to never trust a tools reported outcome without verifying it against the systems ground truth.

## Format: JSON Lines (.jsonl)

Each log entry is a single, self-contained JSON object on a new line. This format is append-only, resilient to corruption, and easy to parse.

## Schema Definition

- `timestamp` (string, ISO 8601): The UTC timestamp of the log entry.
- `transactionId` (string): A unique ID linking all tool calls within a single user request.
- `actor` (enum): "agent_manual" | "agent_auto" - Indicates if the call was a direct conscious action or an automated background task.
- `tool` (string): The name of the tool being called (e.g., "file_put").
- `intent` (object): The parameters sent to the tool.
- `pre_verification` (object, optional): A check of the system state *before* the tool is executed.
  - `command` (string): The verification command run (e.g., "ls ...").
  - `result` (string): The stdout/stderr from the command.
  - `conclusion` (string): A human-readable interpretation of the state.
- `tool_response` (object): The direct, verbatim JSON response from the tool.
- `post_verification` (object, optional): A check of the system state *after* the tool is executed.
  - `command` (string): The verification command run.
  - `result` (string): The stdout/stderr from the command.
  - `conclusion` (string): A human-readable interpretation of the state.
- `outcome` (object): The final conclusion of the operation.
  - `status` (enum): "SUCCESS" | "FAILURE" | "UNKNOWN"
  - `reason` (string): A detailed explanation, especially in case of failure (e.g., "Discrepancy detected...").

**Test Edit Timestamp:** 2026-01-11T02:53:46Z
