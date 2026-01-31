# Environment Metadata Feature

## Overview

The environment metadata feature provides the AI with awareness of its execution environment. This allows the AI to make context-aware decisions about tool availability, secret management, network constraints, and system capabilities.

## Implementation

### Location

- **Utility Module**: `server/utils/environment-metadata.ts`
- **Integration Point**: `server/services/prompt-composer.ts`

### How It Works

1. **Detection**: The `getEnvironmentMetadata()` function detects:
   - **Environment Type**: Determined from `NODE_ENV` environment variable
     - `"production"` when `NODE_ENV=production`
     - `"local"` for all other cases (development, test, or unset)
   - **Server Hostname**: Retrieved using Node.js `os.hostname()`

2. **Formatting**: The `formatEnvironmentMetadata()` function formats the metadata as a markdown block suitable for inclusion in system prompts.

3. **Integration**: The metadata is automatically injected into every system prompt via the `PromptComposer.getSystemPrompt()` method, positioned right after the "Agent Identity" section and before the core directives.

## Metadata Structure

```typescript
interface EnvironmentMetadata {
  environment: "production" | "local";
  server_hostname: string;
}
```

## Example Output in System Prompts

When included in a system prompt, the metadata appears as:

```markdown
# Environment Metadata

**Environment**: `local`
**Server Hostname**: `runnervmmtnos`

*This metadata allows you to make context-aware decisions about:*
- Which tools are available (e.g., ssh-keygen may be available locally but not in production)
- Which secrets to use (production vs. development credentials)
- Network constraints and firewall rules
- Available system resources and capabilities
```

### Sample System Prompt Structure

The environment metadata is strategically placed in the system prompt:

```markdown
# Agent Identity
You are Meowstik AI, referred to as Meowstik.

---

# Environment Metadata

**Environment**: `local`
**Server Hostname**: `runnervmmtnos`

*This metadata allows you to make context-aware decisions about:*
- Which tools are available (e.g., ssh-keygen may be available locally but not in production)
- Which secrets to use (production vs. development credentials)
- Network constraints and firewall rules
- Available system resources and capabilities

---

# Core Directives

[... rest of core directives ...]

---

# Personality

[... personality instructions ...]

---

# Tools

[... tool definitions ...]

---

# Short-Term Memory

[... persistent user-defined memory ...]

---

# Thoughts Forward (from last turn)

[... cached thoughts from previous turn ...]

---

# FINAL INSTRUCTIONS (NON-NEGOTIABLE)

[... mandatory final instructions ...]
```

**Position in Prompt:**
1. **After** the Agent Identity section
2. **Before** the Core Directives

This ensures the AI is immediately aware of its environment context before reading its behavior instructions.

## Use Cases

### 1. Tool Availability Decisions

The AI can determine which tools are available based on the environment:

- **Local Environment**: Full access to system tools like `ssh-keygen`, local file system operations, development tools
- **Production Environment**: May have restricted tool access due to security policies

**Example:**

**User**: "Can you generate an SSH key for me?"

**AI (seeing environment: local)**: "Yes! Since we're in a local environment, I can use the ssh-keygen tool. Let me create an SSH key pair for you..."

**AI (seeing environment: production)**: "I'm running in a production environment where ssh-keygen may not be available due to security restrictions. Let me check what key generation tools are accessible..."

### 2. Secret Management

The AI can choose the appropriate credentials:

- **Local Environment**: Use development API keys, test credentials
- **Production Environment**: Use production secrets, enforce stricter security

**Example:**

**User**: "Connect to the database."

**AI (seeing environment: local)**: "I'll use the local development database credentials from .env file..."

**AI (seeing environment: production)**: "I'll use the production database credentials from the secure secret store..."

### 3. Network Awareness

The hostname information helps with:

- Logging and debugging (know which machine the AI is running on)
- Understanding firewall constraints
- Network topology awareness

**Example:**

**User**: "Why can't I access that external service?"

**AI (seeing hostname: runnervmmtnos)**: "I can see we're running on 'runnervmmtnos'. Let me check the network configuration for this specific host..."

### 4. Resource Management

Environment awareness enables:

- Adjusting behavior based on available system resources
- Making informed decisions about caching strategies
- Optimizing performance based on environment constraints

## Testing

Three test scripts are provided:

1. **`scripts/test-environment-metadata.ts`**: Tests the core metadata detection and formatting functionality
2. **`scripts/test-prompt-integration.ts`**: Verifies the metadata is correctly integrated into the prompt composer
3. **`scripts/demo-environment-metadata.ts`**: Demonstrates the feature with example use cases

### Running Tests

```bash
# Test metadata detection
npx tsx scripts/test-environment-metadata.ts

# Test integration with prompt composer
npx tsx scripts/test-prompt-integration.ts

# View demonstration
npx tsx scripts/demo-environment-metadata.ts

# Test with production environment
NODE_ENV=production npx tsx scripts/test-environment-metadata.ts
```

### Viewing the System Prompt

You can see the actual system prompt by running:

```bash
# View the metadata section
npx tsx scripts/demo-environment-metadata.ts

# Test with different environments
NODE_ENV=local npx tsx scripts/test-environment-metadata.ts
NODE_ENV=production npx tsx scripts/test-environment-metadata.ts
```

## API Reference

### `getEnvironmentMetadata(): EnvironmentMetadata`

Returns the current environment metadata.

**Returns**: An object containing `environment` and `server_hostname`.

**Example**:
```typescript
import { getEnvironmentMetadata } from './server/utils/environment-metadata';

const metadata = getEnvironmentMetadata();
console.log(metadata);
// Output: { environment: 'local', server_hostname: 'my-server' }
```

### `formatEnvironmentMetadata(): string`

Formats the environment metadata as a markdown block for system prompts.

**Returns**: A formatted markdown string ready for inclusion in system prompts.

**Example**:
```typescript
import { formatEnvironmentMetadata } from './server/utils/environment-metadata';

const formatted = formatEnvironmentMetadata();
console.log(formatted);
// Output: Markdown-formatted environment metadata block
```

## Integration Points

The environment metadata is automatically included in system prompts through the `PromptComposer` class:

1. **Server Routes** (`server/routes.ts`): When composing prompts for AI responses
2. **Workflow Executor** (`server/services/workflow-executor.ts`): When executing automated workflows
3. **Any code using** `promptComposer.getSystemPrompt()`: Metadata is always included

## Configuration

### Environment Variable

Set the `NODE_ENV` environment variable to control the environment type:

```bash
# Development/Local (default)
NODE_ENV=development npm run dev

# Production
NODE_ENV=production npm start
```

### No Additional Configuration Required

The feature works out of the box with no additional configuration. The hostname is automatically detected from the system.

## Impact

This small change (just 2 lines of code in prompt-composer.ts) gives the AI powerful context awareness that enables:
- **Smarter tool selection** based on environment
- **Appropriate secret handling** for each context
- **Better debugging** with hostname information
- **Environment-specific behavior** when needed

All of this happens automatically - no additional configuration required!

## Future Enhancements

Potential future improvements could include:

1. Additional metadata fields (e.g., region, cloud provider)
2. Custom environment types beyond "production" and "local"
3. Dynamic tool availability registration based on environment
4. Environment-specific prompt variations
5. Metadata caching to reduce `os.hostname()` calls

## Related Files

- `server/utils/environment-metadata.ts` - Core implementation
- `server/services/prompt-composer.ts` - Integration point
- `scripts/test-environment-metadata.ts` - Unit tests
- `scripts/test-prompt-integration.ts` - Integration tests
- `scripts/demo-environment-metadata.ts` - Demo script

---

**Last Updated**: 2026-01-31  
**Version**: 1.0.1 (Consolidated from environment-metadata.md and environment-metadata-example.md)
