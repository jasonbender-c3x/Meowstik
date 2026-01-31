# Memory Log Protection System

## Overview

The Memory Log Protection System ensures that critical memory files in the `/logs` directory are never lost or overwritten during git operations. This system implements an **always-merge** strategy for memory logs, as requested in issue #[issue-number].

## Problem Statement

Previously, `logs/cache.md` and `logs/execution.md` were in `.gitignore`, making them vulnerable to:

1. **Destructive Git Operations**: Commands like `git reset --hard` or `git clean -fd` would permanently delete these untracked files
2. **Workspace Sync Issues**: Replit or other workspace sync mechanisms could overwrite or clear the logs directory
3. **Agent Commands**: Agents running terminal commands could inadvertently trigger git operations that damage memory files
4. **Loss of Context**: The prompt composer depends on these files for maintaining conversation context and execution state

## Solution Architecture

### 1. Git Tracking

Memory log files are now **tracked by git**:
- Removed `logs/cache.md` and `logs/execution.md` from `.gitignore`
- All memory files are now committed to the repository
- Git will preserve these files during any operation (checkout, reset, pull, etc.)

### 2. Union Merge Strategy

A custom git merge strategy ensures memory files are **always merged, never overwritten**:

```gitattributes
# .gitattributes
logs/cache.md merge=union
logs/execution.md merge=union
logs/Short_Term_Memory.md merge=union
logs/personal.md merge=union
logs/replit.md merge=union
logs/STM_APPEND.md merge=union
```

The `union` merge driver:
- Concatenates both versions during merge conflicts
- Never discards content from either branch
- Preserves all historical memory entries
- Works automatically during `git pull`, `git merge`, and branch switches

### 3. Automatic Setup

The setup script `scripts/setup-memory-protection.sh` configures the git merge driver:

```bash
git config --local merge.union.driver "git merge-file --union %O %A %B"
git config --local merge.union.name "Always merge by union (append both versions)"
```

## Protected Files

The following memory log files are protected:

| File | Purpose | Merge Strategy |
|------|---------|----------------|
| `logs/cache.md` | Inter-turn cache for conversation context | Union (append) |
| `logs/execution.md` | Execution history and command logs | Union (append) |
| `logs/Short_Term_Memory.md` | Short-term working memory | Union (append) |
| `logs/personal.md` | Personal notes and preferences | Union (append) |
| `logs/replit.md` | Replit-specific context | Union (append) |
| `logs/STM_APPEND.md` | Append-only memory log | Union (append) |

## How It Works

### Normal Operations

```bash
# User A makes changes to logs/cache.md
echo "User A: New context" >> logs/cache.md
git commit -m "Update cache"
git push

# User B makes different changes
echo "User B: Different context" >> logs/cache.md
git commit -m "Update cache"

# When User B pulls, content is merged automatically
git pull  # No conflicts! Both contents preserved
```

### Merge Conflicts

With the union merge strategy, traditional "conflicts" don't occur for memory files:

1. **Both versions are kept**: All content from both branches is preserved
2. **Automatic concatenation**: Content is appended from both sources
3. **No manual intervention**: The merge completes automatically
4. **Chronological order**: Newer entries appear after older ones

### Protection Guarantees

✅ **Protected Against:**
- `git reset --hard` - Files are tracked, will be restored
- `git clean -fd` - Files are tracked, won't be deleted
- `git checkout <branch>` - Files merge automatically
- `git pull` - Content merges, never overwrites
- Workspace sync operations - Git maintains file integrity

❌ **Not Protected Against:**
- Manual file deletion followed by commit
- Explicit `git rm` commands
- File system corruption
- Direct overwrites by malicious code

## Setup Instructions

### Automatic Setup (Recommended)

Run the setup script after cloning the repository:

```bash
./scripts/setup-memory-protection.sh
```

This configures the git merge driver for the current repository.

### Manual Setup

If needed, configure manually:

```bash
# Configure union merge driver
git config --local merge.union.driver "git merge-file --union %O %A %B"
git config --local merge.union.name "Always merge by union"

# Verify configuration
git config --local --get merge.union.driver
```

### First-Time Setup

For existing clones, run:

```bash
# Pull latest .gitattributes
git pull origin main

# Run setup script
./scripts/setup-memory-protection.sh

# Verify protection is active
git check-attr merge logs/cache.md
# Should output: logs/cache.md: merge: union
```

## Evolution Engine Integration

The Evolution Engine creates PRs that may modify the repository. The memory protection system ensures:

1. **Evolution PRs preserve memory**: When evolution creates branches, memory files are copied with union merge attributes
2. **PR merges don't lose memory**: Merging evolution PRs automatically combines memory logs from both branches
3. **Branch switches are safe**: Switching between branches preserves and merges memory content

### Example Evolution Flow

```
main branch:
  logs/cache.md: "Original context A"

Evolution creates branch evolution/feature-123:
  logs/cache.md: "Original context A"
  + "Evolution analysis B"

PR merged back to main:
  logs/cache.md: "Original context A"
                 "Evolution analysis B"
  (Both contents preserved!)
```

## Monitoring and Maintenance

### Verify Protection Status

Check if protection is active:

```bash
# Check git attributes
git check-attr -a logs/cache.md

# Check merge configuration
git config --local --get merge.union.driver

# Test merge behavior (safe, creates temp files)
git merge-file --union /dev/null logs/cache.md /dev/null
```

### Troubleshooting

#### Protection Not Working

1. **Check .gitattributes exists**: `cat .gitattributes`
2. **Verify git config**: `git config --local --get merge.union.driver`
3. **Re-run setup**: `./scripts/setup-memory-protection.sh`
4. **Check file is tracked**: `git ls-files logs/cache.md`

#### Merge Conflicts Still Appearing

If conflicts still appear, the union driver may not be configured:

```bash
# Reconfigure
git config --local merge.union.driver "git merge-file --union %O %A %B"

# Force attribute refresh
rm .git/index
git reset
```

#### File Lost After Git Operation

If a memory file is lost:

```bash
# Check if file is tracked
git ls-files logs/cache.md

# Restore from last commit
git checkout HEAD -- logs/cache.md

# Or restore from specific commit
git show <commit-hash>:logs/cache.md > logs/cache.md
```

## Best Practices

### For Developers

1. **Never manually delete** memory log files
2. **Always use setup script** when cloning the repository
3. **Verify protection** before destructive git operations
4. **Commit memory changes** regularly to preserve history

### For AI Agents

1. **Never execute** `git clean -fd` or `git reset --hard` without user confirmation
2. **Check memory integrity** after git operations
3. **Log memory access** to execution.md for audit trail
4. **Avoid modifying** .gitattributes or merge configuration

### For Evolution Engine

1. **Preserve .gitattributes** when creating branches
2. **Test memory merge** before creating PRs
3. **Document memory changes** in PR descriptions
4. **Verify memory integrity** after PR merge

## Technical Details

### Union Merge Algorithm

The `git merge-file --union` algorithm works as follows:

1. **Common ancestor** (O): Original file before divergence
2. **Current version** (A): File in current branch
3. **Other version** (B): File in merging branch
4. **Result**: Concatenate unique lines from A and B, removing duplicates

### Merge Driver Configuration

The merge driver is configured at repository level:

```ini
# .git/config
[merge "union"]
    driver = git merge-file --union %O %A %B
    name = Always merge by union (append both versions)
    recursive = text
```

### Attribute Specification

Attributes are defined in `.gitattributes`:

```
logs/cache.md merge=union
```

This tells git: "When merging logs/cache.md, use the 'union' merge driver"

## Migration Guide

### Existing Repositories

If you have an existing clone with untracked memory files:

```bash
# 1. Pull latest changes (includes .gitattributes)
git pull origin main

# 2. Run setup script
./scripts/setup-memory-protection.sh

# 3. Stage previously ignored files
git add logs/cache.md logs/execution.md

# 4. Commit
git commit -m "chore: track memory log files for protection"

# 5. Push
git push
```

### New Clones

New clones automatically have protection:

```bash
# 1. Clone repository
git clone <repo-url>

# 2. Run setup (configures merge driver)
./scripts/setup-memory-protection.sh

# Protection is now active!
```

## Future Enhancements

Potential improvements to the memory protection system:

1. **Pre-commit hooks**: Validate memory file integrity before commits
2. **Automatic backups**: Periodic backups of memory files to external storage
3. **Merge validation**: Check for duplicate or conflicting memory entries
4. **Content deduplication**: Remove duplicate memory entries during merge
5. **Memory compaction**: Periodic cleanup of old or redundant memory entries
6. **Checksums**: Verify memory file integrity using checksums
7. **Encryption**: Encrypt memory files for additional security

## Related Documentation

- [System Overview](SYSTEM_OVERVIEW.md)
- [Prompt Lifecycle](03-prompt-lifecycle.md)
- [Evolution Engine](LLM_ORCHESTRATION_GUIDE.md)
- [Git Best Practices](local-development.md)

## Security Considerations

While this system protects against accidental loss, it does not protect against:

- **Malicious code**: Direct file deletion or overwrite by malicious scripts
- **Privilege escalation**: Root access can bypass git protection
- **Repository deletion**: Deleting the entire repository
- **Force push**: `git push --force` can overwrite remote history

For production environments, implement additional safeguards:

1. **Regular backups** of the logs directory
2. **Access controls** on the repository
3. **Audit logging** of all memory file modifications
4. **Monitoring alerts** for suspicious changes to memory files

## Support

For issues or questions about memory log protection:

1. Check [Troubleshooting](#troubleshooting) section above
2. Review [git merge documentation](https://git-scm.com/docs/git-merge)
3. Open an issue on GitHub
4. Contact the development team

---

*Last updated: 2026-01-15*
*Version: 1.0.0*
