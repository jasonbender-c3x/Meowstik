# Replit GitHub Workflow Guide

## Overview

This guide provides best practices for working with GitHub repositories in the Replit environment, especially addressing common merge conflict issues.

## Understanding Replit's Git Integration

Replit provides built-in Git integration that can automatically:
- Detect changes in your workspace
- Create commits
- Push changes to GitHub

However, this automation can sometimes lead to merge conflicts when multiple people (or agents) are working on the same repository.

## Common Issues

### The "Three File Problem"

**Symptoms:**
- The same 3 files repeatedly show conflicts
- Parts of code are missing after merge attempts
- Push/pull cycles fail with the same conflicts

**Common Culprits:**
1. **`.replit`** - Replit configuration file
2. **`replit.nix`** - Nix environment specification
3. **`package-lock.json`** - NPM lock file

These files are frequently modified by both Replit and developers, causing conflicts.

## Recommended Replit Settings

### 1. Disable Auto-Commit (Recommended)

In your Replit workspace:

1. Click on the three dots menu (⋮) in the left sidebar
2. Go to "Settings" or "Preferences"
3. Look for Git-related settings
4. Disable "Auto-commit" or "Automatic Git operations"

This gives you full control over when commits happen.

### 2. Configure Git Identity

Always set your Git identity in Replit:

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

## Safe Workflow for Replit

### Starting Your Work Session

```bash
# 1. Check current state
git status

# 2. Fetch latest changes from GitHub
git fetch origin

# 3. Check what's changed
git log HEAD..origin/main --oneline

# 4. If there are updates, pull them
git pull origin main

# If there are conflicts, resolve them before proceeding
# See docs/MERGE_CONFLICT_RESOLUTION.md
```

### During Work

```bash
# Commit regularly with clear messages
git add .
git commit -m "Clear description of what changed"

# Push to your branch (not main)
git push origin your-branch-name
```

### Before Ending Session

```bash
# Make sure everything is committed
git status

# Push all changes
git push origin your-branch-name

# If working on main (not recommended)
git push origin main
```

## Handling the "Same Three Files" Issue

### Quick Fix for .replit and replit.nix

If these files have conflicts:

```bash
# Strategy 1: Keep your Replit environment's version
git checkout --ours .replit
git checkout --ours replit.nix
git add .replit replit.nix

# Strategy 2: Keep GitHub's version
git checkout --theirs .replit
git checkout --theirs replit.nix
git add .replit replit.nix

# Strategy 3: Manually merge (open files and edit)
# Remove conflict markers and keep both versions' important parts
```

**Note:** After resolving `.replit` or `replit.nix`, test that your Replit still runs correctly!

### Quick Fix for package-lock.json

```bash
# The safest approach: regenerate it
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Regenerate package-lock.json to resolve conflicts"
```

## Prevention: Branch-Based Workflow

### Recommended Approach

Instead of working directly on `main`, use feature branches:

```bash
# Create a new branch for your work
git checkout -b feature/descriptive-name

# Make your changes
# ... work work work ...

# Commit and push to your branch
git add .
git commit -m "Implement feature X"
git push origin feature/descriptive-name

# Create a Pull Request on GitHub to merge into main
```

This way:
- Your work is isolated
- Others can review changes
- Conflicts are resolved during PR merge, not during active development

## Handling Replit Agent Changes

If Replit Agent is making changes:

### 1. Review Agent Changes

```bash
# See what the agent changed
git diff

# If changes look good
git add .
git commit -m "Apply Replit Agent suggestions"
```

### 2. Reject Agent Changes

```bash
# Discard all uncommitted changes
git checkout .

# Or discard specific files
git checkout HEAD -- path/to/file
```

### 3. Coordinate with Agent

If Replit Agent is automatically committing:

1. Let it finish its changes
2. Pull those changes: `git pull origin main`
3. Then make your changes
4. Commit and push your changes

## Common Commands Cheat Sheet

### Checking Status

```bash
# What's changed?
git status

# What's different from remote?
git fetch origin
git log HEAD..origin/main --oneline  # Commits you don't have
git log origin/main..HEAD --oneline  # Commits they don't have

# See actual differences
git diff origin/main
```

### Syncing with Remote

```bash
# Get latest without merging
git fetch origin

# Get latest and merge
git pull origin main

# Get latest and rebase (cleaner)
git pull --rebase origin main

# Push your changes
git push origin your-branch
```

### Handling Conflicts

```bash
# See conflicted files
git status

# Choose our version for specific file
git checkout --ours path/to/file
git add path/to/file

# Choose their version
git checkout --theirs path/to/file
git add path/to/file

# After resolving all conflicts
git commit -m "Resolve merge conflicts"
git push origin your-branch
```

### Emergency: Start Over

```bash
# Discard ALL local changes (be careful!)
git reset --hard origin/main

# Discard uncommitted changes only
git checkout .

# Go back to a specific commit
git reset --hard <commit-hash>
```

## Automated Conflict Checking

Run before committing:

```bash
./scripts/check-merge-conflicts.sh
```

This script will:
- Check for unresolved conflicts
- Find conflict markers in files
- Detect merge/rebase in progress
- Report branch divergence

## Replit-Specific Tips

### File Watching

Replit watches files and may auto-reload. After resolving conflicts:

1. Let Replit finish loading
2. Check that the app still runs
3. Test key functionality

### Terminal vs UI

- Use Replit's terminal for git commands (more control)
- Use Replit's Git UI for viewing diffs (visual)
- Don't mix both - pick one workflow

### .replit Configuration

Your `.replit` file controls how the app runs. Key sections:

```toml
[nix]
channel = "stable-24_05"

[deployment]
run = ["npm", "run", "start"]

[workflows]
# This is where run button behavior is defined
```

When merging conflicts in `.replit`:
- Keep the `[nix]` section that works
- Keep your preferred `[deployment]` settings
- Merge `[workflows]` carefully to preserve functionality

## Working with Multiple Developers

### Communication is Key

1. **Before starting work:** Check if anyone else is working on same files
2. **During work:** Use GitHub issues to claim tasks
3. **Before committing:** Pull latest changes
4. **After committing:** Push immediately and notify team

### Lock File Strategy

For `package-lock.json`:

**Option 1: Ignore in Replit**
Add to `.gitignore` in Replit:
```
package-lock.json
```

Regenerate when deploying to production.

**Option 2: Designate One Person**
One person manages `package-lock.json`, others just work with `package.json`.

## Troubleshooting Replit-Specific Issues

### "Push rejected" in Replit

```bash
# Fetch and see what's different
git fetch origin
git status

# Pull with merge
git pull origin main

# Or pull with rebase
git pull --rebase origin main

# Resolve any conflicts, then
git push origin main
```

### "Replit won't let me push"

Check:
1. Do you have write permissions on GitHub repo?
2. Is your Git identity configured?
3. Are you connected to GitHub in Replit settings?

```bash
# Verify remote
git remote -v

# Re-add remote if needed
git remote set-url origin https://github.com/username/repository.git
```

### "Lost changes after Replit reload"

Replit auto-saves, but:

```bash
# Check if changes are uncommitted
git status

# Commit immediately to preserve
git add .
git commit -m "Save work before reload"
```

## Best Practices Summary

### DO:
- ✅ Commit frequently with clear messages
- ✅ Pull before starting work
- ✅ Work on feature branches
- ✅ Test after resolving conflicts
- ✅ Use descriptive branch names
- ✅ Push at end of each work session

### DON'T:
- ❌ Force push to main branch
- ❌ Ignore conflict markers
- ❌ Work directly on main with others
- ❌ Commit without testing
- ❌ Mix tabs and spaces (configure editor)
- ❌ Leave conflicts unresolved

## Quick Reference: Resolve Conflicts with Replit

```bash
# 1. Check what's wrong
git status
./scripts/check-merge-conflicts.sh

# 2. For the "three file problem"
git checkout --ours .replit replit.nix
rm package-lock.json && npm install
git add .replit replit.nix package-lock.json

# 3. Complete the merge
git commit -m "Resolve conflicts in config files"

# 4. Push
git push origin your-branch

# 5. Verify Replit still works
# Click Run button, check for errors
```

## Getting Help

### Collect This Information

```bash
# Current state
git status
git log --oneline -5

# Remote state
git remote -v
git fetch origin
git log origin/main --oneline -5

# Configuration
git config --list | grep user
git config --list | grep pull
```

### Where to Ask

1. Check `docs/MERGE_CONFLICT_RESOLUTION.md`
2. Run `./scripts/check-merge-conflicts.sh`
3. Create a GitHub issue with diagnostic information
4. Check Replit's documentation: https://docs.replit.com/

## Appendix: Understanding Git in Replit

### How Replit Uses Git

Replit workspace → Git commits → GitHub repository

- Replit maintains a local Git repository
- Changes you make are in the working directory
- You commit to local repo
- Push syncs local → GitHub

### Replit's File System

Replit uses a persistent file system:
- Changes persist between sessions
- Git operations work normally
- But auto-saving can sometimes cause confusion with Git

### Integration Points

Replit integrates with GitHub at:
1. **Import:** Clone repository into Replit
2. **Pull:** Sync GitHub changes to Replit
3. **Push:** Sync Replit changes to GitHub
4. **Deploy:** Can auto-deploy from GitHub

## Conclusion

Working with Git in Replit requires:
- Understanding that Replit may auto-commit
- Being proactive about pulling changes
- Using feature branches for safety
- Regular commits with clear messages
- Testing after conflict resolution

**Remember:** When in doubt:
1. Check status: `git status`
2. Check for conflicts: `./scripts/check-merge-conflicts.sh`
3. Read the error messages carefully
4. Refer to `docs/MERGE_CONFLICT_RESOLUTION.md`
