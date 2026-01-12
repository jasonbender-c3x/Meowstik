# Orchestration Examples

This directory contains example code demonstrating how to use the Meowstik orchestration layer.

## Running Examples

```bash
# Run all examples
tsx server/examples/orchestration-examples.ts

# Or import and run individually in your code
import { simpleTaskExample } from './server/examples/orchestration-examples';
await simpleTaskExample();
```

## Examples Included

### 1. Simple Orchestrated Task
Demonstrates basic orchestration of a research and documentation task.

### 2. State Management
Shows how to use the state manager for session-based state tracking.

### 3. Logging
Demonstrates the orchestration logging system for debugging and monitoring.

## See Also

- [Orchestration Layer Documentation](../../docs/orchestration-layer.md)
- [API Reference](../../docs/orchestration-layer.md#api-reference)
