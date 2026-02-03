# Secure Credential Protocol Implementation

## Overview

This document describes the secure credential handling protocol implemented in Meowstik to ensure that sensitive credentials (API keys, tokens, passwords, secrets) are never exposed in logs, memory files, or system output.

## Changes Made

### 1. System Prompt Updates (`prompts/core-directives.md`)

Added a comprehensive **SECURE CREDENTIAL STORAGE PROTOCOL** section that includes:

- **Storage Location**: All credentials must be stored in a dedicated `.secrets` folder in the user's Google Drive
- **Format**: Each credential in a separate, structured JSON file
- **Retrieval Workflow**: On-demand access using Drive API, immediate use, and discard
- **Security Requirements**: Mandatory rules to prevent credential exposure in logs, cache, memory, or conversation history

#### Example Credential File Structure
```json
{
  "service": "GitHub",
  "credential_type": "personal_access_token",
  "token": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "created_at": "2026-02-03T19:00:00Z",
  "notes": "Full repo access for Meowstik development"
}
```

### 2. Execution Log Security (`server/services/io-logger.ts`)

Implemented comprehensive credential redaction in the I/O logger:

- **Pattern-Based Detection**: Detects common credential formats including:
  - GitHub tokens (ghp_, gho_, github_pat_)
  - OpenAI API keys (sk-, sk-proj-)
  - Google API keys (AIza, ya29.)
  - Twilio credentials (AC, SK)
  - Authorization headers (Bearer, Basic)
  - Generic API keys, tokens, secrets, passwords

- **String Redaction**: `redactCredentials()` function scans and replaces credential patterns with `[REDACTED]`

- **Object Redaction**: `redactObjectCredentials()` recursively processes objects to redact credentials based on:
  - Field names (password, secret, token, api_key, etc.)
  - String content patterns

- **Applied to All Logs**: Both `logInput()` and `logOutput()` methods now redact:
  - System prompts
  - User messages
  - Conversation history
  - RAG context
  - Tool call parameters
  - Tool results

### 3. Orchestration Log Security (`server/services/orchestration-logger.ts`)

Added credential redaction to the orchestration logger:

- **Message Redaction**: `redactLogMessage()` function for log message text
- **Data Redaction**: `redactLogData()` function for structured log data
- **Automatic Application**: All log entries are automatically redacted in the core `log()` method
- **Coverage**: Protects debug, info, warn, error, and critical level logs

### 4. Comprehensive Test Suite (`server/services/__tests__/credential-redaction.test.ts`)

Created 22 automated tests covering:

1. **Basic Redaction**: GitHub PAT, OpenAI keys, Google keys, Twilio SIDs, Bearer tokens, API keys
2. **Object Redaction**: Simple objects, nested objects, arrays, password/secret fields
3. **Real-World Scenarios**: API request logs, .secrets file content, environment variables, tool calls
4. **Edge Cases**: Empty strings, null/undefined, very long credentials, multiple credentials

All tests pass successfully ✅

## Security Guarantees

### What is Protected
- ✅ All log files in `logs/debug-io/`
- ✅ Orchestration logs
- ✅ System prompt content
- ✅ User message content
- ✅ Conversation history
- ✅ Tool parameters and results
- ✅ Error messages and stack traces

### Credential Types Detected
- GitHub tokens (multiple formats)
- OpenAI API keys
- Google Cloud API keys and OAuth tokens
- Twilio Account SIDs and Auth Tokens
- Slack tokens
- AWS Access Keys
- Generic API keys (20+ character alphanumeric)
- Authorization headers
- Password fields
- Secret fields

### Logging Output
All redacted logs include a security notice:
```
⚠️ SECURITY NOTE: All credentials have been redacted for security ⚠️
```

## AI Agent Directives

The system prompt now instructs the AI to:

1. **Store credentials** in `.secrets` folder in Google Drive
2. **Retrieve credentials** on-demand using Drive API
3. **Use credentials** immediately and discard
4. **Never log credentials** to cache, memory, or execution logs
5. **Never echo credentials** back to users

## Testing

Run the credential redaction test suite:
```bash
npx tsx server/services/__tests__/credential-redaction.test.ts
```

Expected output: All 22 tests pass ✅

## Verification Checklist

- [x] System prompt includes secure credential protocol
- [x] io-logger.ts implements credential redaction
- [x] orchestration-logger.ts implements credential redaction
- [x] Comprehensive test suite created and passing
- [x] Clickable links directive verified (already comprehensive)
- [x] Documentation created

## Related Files Modified

1. `prompts/core-directives.md` - Added secure credential storage protocol section
2. `server/services/io-logger.ts` - Added credential redaction functions and applied to all logging
3. `server/services/orchestration-logger.ts` - Added credential redaction for orchestration logs
4. `server/services/__tests__/credential-redaction.test.ts` - New comprehensive test suite

## Future Enhancements

Potential improvements for future consideration:

1. **Machine Learning**: Train a model to detect custom credential patterns
2. **Context-Aware Redaction**: More sophisticated detection based on surrounding context
3. **Audit Trail**: Log when credentials are detected and redacted (without logging the credential itself)
4. **Configuration**: Allow customization of redaction patterns via config file
5. **Performance**: Optimize pattern matching for large log files

## Support

For questions or issues related to credential security, refer to:
- This documentation
- The test suite for examples
- The system prompt in `prompts/core-directives.md`
