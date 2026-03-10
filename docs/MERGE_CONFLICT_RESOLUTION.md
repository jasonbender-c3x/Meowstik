# Merge Conflict Resolution Guide

## Overview

This guide provides comprehensive instructions for resolving merge conflicts in the Meowstik repository, with special attention to issues arising from the Replit environment.

## Common Scenarios

### Replit Agent Auto-Merge Issues

When working with Replit, the Replit Agent may automatically attempt to merge changes, which can sometimes lead to conflicts or lost changes.

**Symptoms:**
- Same files repeatedly showing conflicts
- Parts of code missing after merge
- Unable to push/pull without conflicts recurring

**Common Problematic Files:**
Based on the repository structure, these types of files often cause conflicts:
1. Configuration files (`.replit`, `replit.nix`, `package.json`)
2. Environment files (`.env`, `.env.example`)
3. Documentation files that are frequently updated
4. Lock files (`package-lock.json`)

## Prevention Strategies

### 1. Proper `.gitignore` Configuration

Ensure your `.gitignore` file excludes files that shouldn't be committed:

```gitignore
# Dependencies
node_modules/
dist/

# Environment files
.env
google-credentials.json

# Logs and temporary files
logs/
repos/

# Build artifacts
*.tar.gz
server/public
```

### 2. Regular Sync Workflow

Always follow this workflow to minimize conflicts:

```bash
# 1. Before starting work - get latest changes
git fetch origin
git status

# 2. Stash any local changes if needed
git stash save "WIP: description of current work"

# 3. Pull latest changes
git pull origin main --rebase

# 4. Apply stashed changes if any
git stash pop

# 5. Resolve any conflicts that arise
# (see conflict resolution steps below)

# 6. After completing work
git add .
git commit -m "Clear description of changes"
git push origin your-branch-name
```

### 3. Replit-Specific Considerations

**Disable Auto-Commit in Replit:**
In Replit settings, consider disabling automatic git operations to have more control over commits.

**Use Separate Branches:**
- Work on feature branches, not `main`
- Name branches descriptively: `feature/description` or `fix/issue-number`

## Resolving Active Conflicts

### Step 1: Identify Conflicted Files

```bash
# Check current status
git status

# Files with conflicts will be listed as "both modified" or "unmerged paths"
```

### Step 2: Understanding Conflict Markers

When you open a conflicted file, you'll see markers like this:

```
<<<<<<< HEAD (Current Change)
Your current code
=======
Incoming code from the branch being merged
>>>>>>> branch-name (Incoming Change)
```

### Step 3: Manual Resolution

**For each conflicted file:**

1. Open the file in your editor
2. Find all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
3. Decide which version to keep (or combine both)
4. Remove the conflict markers
5. Test that the code works
6. Mark as resolved:

```bash
git add path/to/resolved/file
```

### Step 4: Complete the Merge

```bash
# After resolving all conflicts
git status  # Verify all conflicts are resolved

# Commit the merge
git commit -m "Resolve merge conflicts in [file names]"

# Push the changes
git push origin your-branch-name
```

## Automated Conflict Detection Script

Save this as `scripts/check-merge-conflicts.sh`:

```bash
#!/bin/bash

echo "Checking for merge conflicts..."

# Check for conflict markers in tracked files
conflicts=$(git diff --name-only --diff-filter=U)

if [ -n "$conflicts" ]; then
    echo "⚠️  Found unresolved conflicts in:"
    echo "$conflicts"
    exit 1
fi

# Check for conflict markers in files
markers=$(git grep -n "<<<<<<< \|=======$\|>>>>>>> " -- ':!docs/MERGE_CONFLICT_RESOLUTION.md' 2>/dev/null)

if [ -n "$markers" ]; then
    echo "⚠️  Found conflict markers in files:"
    echo "$markers"
    exit 1
fi

echo "✅ No merge conflicts detected"
exit 0
```

Make it executable:
```bash
chmod +x scripts/check-merge-conflicts.sh
```

## Advanced Resolution Strategies

### Strategy 1: Use Git Mergetool

Git provides a merge tool for visual conflict resolution:

```bash
# Configure a merge tool (example with VS Code)
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'

# Launch the merge tool
git mergetool
```

### Strategy 2: Accept One Side Completely

If you know one side is completely correct:

```bash
# Keep only YOUR changes (current branch)
git checkout --ours path/to/file
git add path/to/file

# Keep only THEIR changes (incoming branch)
git checkout --theirs path/to/file
git add path/to/file
```

### Strategy 3: Abort and Start Over

If the merge becomes too complex:

```bash
# Abort the current merge
git merge --abort

# Or if you've made mistakes
git reset --hard HEAD

# Start fresh with a clean state
git fetch origin
git reset --hard origin/main
```

## Specific File Handling

### package.json and package-lock.json

These files often conflict. Best practice:

```bash
# After resolving package.json conflicts
npm install  # This regenerates package-lock.json correctly
git add package.json package-lock.json
```

### .replit and replit.nix

For Replit configuration files:

1. Favor the version that works in your current Replit environment
2. Test by running the app in Replit after resolution
3. Document any manual changes made

### Documentation Files

For markdown files in `docs/`:

1. Both versions usually have value - combine them
2. Maintain consistent formatting
3. Update table of contents if needed

## Preventing Future Conflicts

### 1. Communication

- Coordinate with team members before working on same files
- Use GitHub Issues to track who's working on what
- Make smaller, focused commits

### 2. Branch Strategy

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Work on your changes
# ... make changes ...
git add .
git commit -m "Description"

# Before merging, update from main
git fetch origin
git rebase origin/main

# Resolve any conflicts during rebase
# Then force push your feature branch (if it's your own)
git push origin feature/your-feature-name --force-with-lease
```

### 3. Lock Files

For `package-lock.json`, consider:

```bash
# In case of persistent conflicts with lock files
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Regenerate package-lock.json"
```

## Emergency Recovery

### If You've Lost Changes

```bash
# View reflog to find lost commits
git reflog

# Recover a specific commit
git checkout <commit-hash>
git checkout -b recovery-branch

# Or reset to a previous state
git reset --hard <commit-hash>
```

### If Repository is Corrupted

```bash
# Verify repository integrity
git fsck

# If there are issues, you may need to re-clone
cd /path/to/parent/directory
git clone https://github.com/jasonbender-c3x/Meowstik.git Meowstik-fresh
cd Meowstik-fresh

# Copy over your uncommitted work from old directory if needed
```

## Replit-GitHub Workflow Best Practices

### 1. Initial Setup in Replit

```bash
# Configure git identity in Replit
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# Set default branch behavior
git config --global pull.rebase false  # Use merge (default)
# OR
git config --global pull.rebase true   # Use rebase (cleaner history)
```

### 2. Daily Workflow

**Morning routine:**
```bash
git fetch origin
git pull origin main
```

**Before breaks:**
```bash
git add .
git commit -m "WIP: description"
git push origin your-branch
```

**End of day:**
```bash
# Clean up WIP commits if needed
git rebase -i HEAD~3  # Interactive rebase last 3 commits
# Squash WIP commits into meaningful commits

git push origin your-branch --force-with-lease
```

### 3. Collaboration Tips

- **Use PR (Pull Requests):** Don't push directly to `main`
- **Request Reviews:** Have someone review before merging
- **Small PRs:** Keep changes focused and small
- **Test Before Push:** Always test your changes work

## Troubleshooting Common Issues

### Issue: "Your branch has diverged from 'origin/main'"

```bash
# See what's different
git log HEAD..origin/main --oneline
git log origin/main..HEAD --oneline

# Strategy 1: Rebase your changes
git rebase origin/main

# Strategy 2: Merge their changes
git merge origin/main

# Strategy 3: Reset to match remote (LOSES LOCAL CHANGES)
git reset --hard origin/main
```

### Issue: "Cannot push - Updates were rejected"

```bash
# Fetch latest changes
git fetch origin

# Option 1: Pull and merge
git pull origin main

# Option 2: Pull and rebase
git pull --rebase origin main

# If you're sure your version is correct (use with caution)
git push --force-with-lease origin your-branch
```

### Issue: "File has conflicts after multiple merge attempts"

```bash
# Start completely fresh with the file
git checkout origin/main -- path/to/file

# Or start with your version
git checkout HEAD -- path/to/file

# Manually re-apply only the changes you need
# Then commit
git add path/to/file
git commit -m "Resolve conflicts in file by starting fresh"
```

## Getting Help

### Diagnostic Information to Collect

When asking for help, provide:

```bash
# Repository status
git status

# Recent commits
git log --oneline -10

# Branch information
git branch -vv

# Remote configuration
git remote -v

# Conflict details
git diff
```

### Contact and Resources

- GitHub Issues: Report persistent problems
- Git Documentation: https://git-scm.com/doc
- Replit Docs: https://docs.replit.com/

## Checklist for Clean Merges

- [ ] Fetched latest changes from origin
- [ ] Committed all local changes
- [ ] Resolved all conflicts
- [ ] Tested that code still works
- [ ] Removed all conflict markers
- [ ] Committed merge with clear message
- [ ] Pushed to remote successfully
- [ ] Verified changes in GitHub
- [ ] Cleaned up temporary branches if created

## Summary

**Key Principles:**
1. **Communicate** - Know what others are working on
2. **Commit Often** - Small, focused commits are easier to merge
3. **Pull Regularly** - Stay in sync with the team
4. **Test Everything** - Make sure code works after resolution
5. **Document Decisions** - Note why you chose specific resolutions

**When in Doubt:**
- Ask for help before forcing changes
- Create a backup branch before attempting complex merges
- Use `git reflog` to recover from mistakes
