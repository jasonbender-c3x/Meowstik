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

## Example Output

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

## Use Cases

### 1. Tool Availability Decisions

The AI can determine which tools are available based on the environment:

- **Local Environment**: Full access to system tools like `ssh-keygen`, local file system operations, development tools
- **Production Environment**: May have restricted tool access due to security policies

### 2. Secret Management

The AI can choose the appropriate credentials:

- **Local Environment**: Use development API keys, test credentials
- **Production Environment**: Use production secrets, enforce stricter security

### 3. Network Awareness

The hostname information helps with:

- Logging and debugging (know which machine the AI is running on)
- Understanding firewall constraints
- Network topology awareness

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
