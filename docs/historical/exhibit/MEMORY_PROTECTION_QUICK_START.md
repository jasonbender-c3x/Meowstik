# Memory Protection - Quick Start

## Easy-to-Remember Scripts

The repository includes two simple scripts in the root directory for managing memory log protection:

### 🛡️ `./protect-memory.sh` - Setup Protection

**What it does**: Configures git to always merge memory files instead of overwriting them

**Usage**:
```bash
./protect-memory.sh
```

**Interactive Steps**:
1. Shows welcome message
2. Configures git merge driver
3. Lists protected files
4. Verifies configuration
5. Shows completion message

Press ENTER at each pause to continue through the setup.

---

### ✅ `./check-memory.sh` - Check Status

**What it does**: Verifies if memory log protection is active

**Usage**:
```bash
./check-memory.sh
```

**Output**:
- Shows protection status (ACTIVE ✅ or NOT ACTIVE ❌)
- Lists which files are protected
- Shows current configuration
- Explains what protection means

---

## Quick Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `./protect-memory.sh` | Enable protection | First time setup or after fresh clone |
| `./check-memory.sh` | Verify status | To check if protection is working |
| `./scripts/setup-memory-protection.sh` | Advanced setup | Non-interactive version for scripts |

## One-Line Commands

For automation or scripts:

```bash
# Silent setup (non-interactive)
./scripts/setup-memory-protection.sh

# Check and setup if needed
./check-memory.sh || ./protect-memory.sh
```

## What Gets Protected

These memory log files are protected from git operations:

- `logs/cache.md` - Inter-turn conversation cache
- `logs/execution.md` - Command execution history
- `logs/Short_Term_Memory.md` - Working memory
- `logs/personal.md` - Personal notes and preferences
- `logs/replit.md` - Platform-specific context
- `logs/STM_APPEND.md` - Append-only memory log

## How Protection Works

1. **Git Tracking**: Files are tracked by git (removed from .gitignore)
2. **Union Merge**: When conflicts occur, both versions are kept and merged
3. **Automatic**: No manual intervention needed during git operations

## Common Scenarios

### First Clone
```bash
git clone <repo-url>
cd Meowstik
./protect-memory.sh
```

### After Pull
```bash
git pull
./check-memory.sh  # Verify protection still active
```

### Before Risky Operations
```bash
./check-memory.sh  # Make sure protection is active
git reset --hard HEAD  # Safe! Memory files will be restored
```

## Troubleshooting

### Protection Shows as NOT ACTIVE

**Solution**:
```bash
./protect-memory.sh  # Run setup again
./check-memory.sh    # Verify it worked
```

### Script Not Executable

**Solution**:
```bash
chmod +x protect-memory.sh check-memory.sh
```

### Want Non-Interactive Setup

**Solution**:
```bash
./scripts/setup-memory-protection.sh  # No pauses, just output
```

## Visual Guide

### Running protect-memory.sh

```
╔══════════════════════════════════════════════════════════════════╗
║              MEMORY LOG PROTECTION SETUP                         ║
╚══════════════════════════════════════════════════════════════════╝

This script will protect your memory logs from git operations.

Press ENTER to continue...

Step 1: Configuring git merge strategy...
✅ Git merge driver configured

Press ENTER to continue...

Step 2: Protected files:
  • logs/cache.md
  • logs/execution.md
  • logs/Short_Term_Memory.md
  • logs/personal.md
  • logs/replit.md
  • logs/STM_APPEND.md

Press ENTER to continue...

Step 3: Verifying configuration...

✅ Merge driver: ACTIVE

Press ENTER to continue...

╔══════════════════════════════════════════════════════════════════╗
║                      SETUP COMPLETE! ✅                          ║
╚══════════════════════════════════════════════════════════════════╝

Your memory logs are now protected!

What this means:
  • Memory files are tracked by git
  • Changes always merge (never overwrite)
  • Safe from 'git reset --hard'
  • Safe from 'git clean -fd'

Press ENTER to finish...
✨ Memory protection is active!
```

### Running check-memory.sh

```
╔══════════════════════════════════════════════════════════════════╗
║              MEMORY LOG PROTECTION STATUS                        ║
╚══════════════════════════════════════════════════════════════════╝

🛡️  Protection Status: ACTIVE ✅

📁 Protected Files:
  ✅ logs/cache.md
  ✅ logs/execution.md
  ✅ logs/Short_Term_Memory.md
  ✅ logs/personal.md
  ✅ logs/replit.md
  ✅ logs/STM_APPEND.md

🔧 Configuration:
  Merge Driver: git merge-file --union %O %A %B

📊 What this means:
  • Your memory logs won't be deleted by git operations
  • Changes from different branches will merge automatically
  • No data loss from 'git reset --hard' or 'git clean'

Press ENTER to exit...
```

## For Advanced Users

All three scripts do the same thing, choose based on preference:

| Script | Location | Style | Best For |
|--------|----------|-------|----------|
| `protect-memory.sh` | Root | Interactive with pauses | First-time users |
| `check-memory.sh` | Root | Status checker | Quick verification |
| `scripts/setup-memory-protection.sh` | scripts/ | Non-interactive | Automation/CI |

## Related Documentation

- [Full Documentation](MEMORY_LOG_PROTECTION.md) - Complete technical guide
- [Implementation Summary](MEMORY_PROTECTION_SUMMARY.md) - How it was implemented
- [README](../README.md) - Main repository documentation

---

**Remember**: 
- Run `./protect-memory.sh` once after cloning
- Run `./check-memory.sh` anytime to verify
- Both scripts are safe to run multiple times
