# Environment Metadata - Example System Prompt

This document shows an example of how the environment metadata appears in the actual system prompt sent to the AI.

## Sample System Prompt Structure

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

## Position in Prompt

The environment metadata is strategically placed:
1. **After** the Agent Identity section
2. **Before** the Core Directives

This ensures the AI is immediately aware of its environment context before reading its behavior instructions.

## Example Use Cases

### Example 1: Tool Availability Decision

**User**: "Can you generate an SSH key for me?"

**AI (seeing environment: local)**: "Yes! Since we're in a local environment, I can use the ssh-keygen tool. Let me create an SSH key pair for you..."

**AI (seeing environment: production)**: "I'm running in a production environment where ssh-keygen may not be available due to security restrictions. Let me check what key generation tools are accessible..."

### Example 2: Secret Management

**User**: "Connect to the database."

**AI (seeing environment: local)**: "I'll use the local development database credentials from .env file..."

**AI (seeing environment: production)**: "I'll use the production database credentials from the secure secret store..."

### Example 3: Network Awareness

**User**: "Why can't I access that external service?"

**AI (seeing hostname: runnervmmtnos)**: "I can see we're running on 'runnervmmtnos'. Let me check the network configuration for this specific host..."

## Testing the Output

You can see the actual system prompt by running:

```bash
# View the metadata section
npx tsx scripts/demo-environment-metadata.ts

# Test with different environments
NODE_ENV=local npx tsx scripts/test-environment-metadata.ts
NODE_ENV=production npx tsx scripts/test-environment-metadata.ts
```

## Impact

This small change (just 2 lines of code in prompt-composer.ts) gives the AI powerful context awareness that enables:
- **Smarter tool selection** based on environment
- **Appropriate secret handling** for each context
- **Better debugging** with hostname information
- **Environment-specific behavior** when needed

All of this happens automatically - no additional configuration required!
