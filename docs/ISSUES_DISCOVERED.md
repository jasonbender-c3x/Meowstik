# Issues Discovered During SSH Deployment Analysis

**Document**: Issue tracking for items found during documentation phase  
**Date**: January 15, 2026  
**Status**: Ready for implementation

---

## Priority 1: Critical Fixes

### Issue 1: SSH Tool Path Resolution

**Title**: Use explicit /usr/bin/ssh-keygen path instead of relying on PATH

**Description**:  
The `generateSshKey()` function fails in environments where `/usr/bin` is not in PATH, causing false "command not found" errors.

**Files**:
- `server/services/ssh-service.ts` (lines 67, 79)

**Fix**:
```typescript
// BEFORE:
await execAsync(`ssh-keygen -t ed25519 ...`);

// AFTER:
await execAsync(`/usr/bin/ssh-keygen -t ed25519 ...`);
```

**Assignee**: @copilot  
**Labels**: bug, ssh, p1

---

### Issue 2: Add Environment Detection

**Title**: Implement SSH tool availability checking

**Description**:  
Add pre-flight checks to verify SSH tools are available before attempting to use them.

**Files**:
- `server/services/ssh-service.ts` (new function)

**Implementation**:
```typescript
export async function checkSSHAvailability(): Promise<{
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
}> {
  try {
    const { stdout } = await execAsync('/usr/bin/ssh-keygen -h 2>&1');
    const version = await execAsync('/usr/bin/ssh-keygen -V 2>&1');
    return {
      available: true,
      path: '/usr/bin/ssh-keygen',
      version: version.stdout.trim()
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
    };
  }
}
```

**Assignee**: @copilot  
**Labels**: enhancement, ssh, p1

---

## Priority 2: Documentation Updates

### Issue 3: Update LLM System Prompts

**Title**: Add environment awareness to LLM system prompts

**Description**:  
Update `prompts/core-directives.md` to include information about execution environment and available tools.

**Files**:
- `prompts/core-directives.md`

**Content to Add**:
```markdown
## Environment Awareness

You are running on Replit with the following capabilities:

### Available Tools
- **SSH**: `/usr/bin/ssh-keygen` for key generation
- **Git**: Full git CLI access
- **Node.js**: v20+ with npm/npx
- **PostgreSQL**: Via DATABASE_URL

### Deployment
- **Platform**: Replit Deployments (auto-scales)
- **HTTPS**: Automatic SSL certificates
- **Webhooks**: All POST endpoints are publicly accessible
- **No SSH needed**: For deploying to Replit itself

### When to Use SSH
- ✅ Connecting to external servers
- ✅ Deploying to VPS/dedicated servers
- ❌ NOT for deploying to Replit (use git push instead)
```

**Assignee**: @copilot  
**Labels**: documentation, llm, p2

---

### Issue 4: Clarify "Spark" Concept

**Title**: Document or remove "Spark" reference

**Description**:  
The issue mentions "what is spark?" but there are zero references to "Spark" in the codebase.

**Action Items**:
1. Get clarification from @jasonbender-c3x
2. If it's a planned feature, create spec document
3. If it's a misunderstanding, update issue description

**Assignee**: @jasonbender-c3x  
**Labels**: question, documentation, p2

---

## Priority 3: Enhancements

### Issue 5: Improve Error Messages

**Title**: Better error messages for SSH failures

**Description**:  
Distinguish between different failure modes (command not found, permission denied, connection refused, etc.)

**Files**:
- `server/services/ssh-service.ts`

**Implementation**:
```typescript
catch (error: any) {
  let userMessage: string;
  
  if (error.message.includes('command not found')) {
    userMessage = 'SSH tool not available. Try using Replit Deployments instead.';
  } else if (error.message.includes('permission denied')) {
    userMessage = 'Permission denied. Check file permissions and user access.';
  } else if (error.message.includes('connection refused')) {
    userMessage = 'Cannot connect to server. Verify hostname and port.';
  } else {
    userMessage = `SSH error: ${error.message}`;
  }
  
  throw new Error(userMessage);
}
```

**Assignee**: @copilot  
**Labels**: enhancement, dx, p3

---

### Issue 6: Add Unit Tests

**Title**: Add unit tests for SSH service

**Description**:  
Create test suite for SSH service functions.

**Files**:
- `server/services/__tests__/ssh-service.test.ts` (new)

**Test Cases**:
- Key generation with explicit paths
- Environment detection
- Error handling for missing tools
- Connection management
- Command execution

**Assignee**: @copilot  
**Labels**: testing, ssh, p3

---

### Issue 7: SSH Key Rotation

**Title**: Implement automated SSH key rotation

**Description**:  
Add ability to automatically rotate SSH keys on a schedule for improved security.

**Features**:
- Generate new key pair
- Update server authorized_keys
- Revoke old key
- Track rotation history

**Assignee**: Future  
**Labels**: enhancement, security, p4

---

## Priority 4: Architecture Improvements

### Issue 8: Auto-Tag Copilot in Evolution PRs

**Title**: Automatically tag @copilot in evolution engine PRs

**Description**:  
When evolution engine creates a PR, automatically add a comment tagging @copilot to trigger implementation.

**Files**:
- `server/services/evolution-engine.ts`

**Implementation**:
```typescript
// After creating PR
await github.createIssueComment(
  repo.owner,
  repo.repo,
  pr.number,
  `@copilot This PR contains AI-generated improvements based on user feedback.\n\nPlease review and implement the proposed changes.\n\n**Summary**: ${report.summary}\n\n**Action Items**: See PR description for detailed instructions.`
);
```

**Assignee**: @copilot  
**Labels**: enhancement, orchestration, p4

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| P1 (Critical) | 2 | Ready |
| P2 (Documentation) | 2 | Ready |
| P3 (Enhancement) | 3 | Ready |
| P4 (Architecture) | 1 | Future |

**Total Issues**: 8  
**Assignee**: @copilot (7), @jasonbender-c3x (1)

---

## Next Steps

1. ✅ Documentation complete (this document + SSH_DEPLOYMENT_ANALYSIS)
2. ⏳ Get approval from @jasonbender-c3x
3. ⏳ Implement P1 issues
4. ⏳ Implement P2 issues
5. ⏳ Code review and testing
6. ⏳ Deploy and monitor

---

**Created**: January 15, 2026  
**Author**: GitHub Copilot (@copilot)  
**Related Documents**:
- `docs/SSH_DEPLOYMENT_ANALYSIS_FULL.md`
- `docs/LLM_ORCHESTRATION_GUIDE.md`
