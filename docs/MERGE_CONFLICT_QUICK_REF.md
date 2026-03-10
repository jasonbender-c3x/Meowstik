# Quick Merge Conflict Resolution - Reference Card

## 🆘 Emergency: I Have Conflicts Right Now!

### Step 1: Identify the Problem
```bash
git status
```

Look for files marked as "both modified" or "unmerged".

### Step 2: Quick Fix for Common Files

**For .replit and replit.nix:**
```bash
# Keep your version (what's in Replit now)
git checkout --ours .replit replit.nix
git add .replit replit.nix
```

**For package-lock.json:**
```bash
# Regenerate it
rm package-lock.json
npm install
git add package-lock.json
```

**For other files:**
Open the file, look for these markers:
```
<<<<<<< HEAD
Your version
=======
Their version
>>>>>>> branch-name
```
Delete the markers and keep the version you want (or combine both).

### Step 3: Complete the Merge
```bash
# Mark all conflicts as resolved
git add .

# Commit the merge
git commit -m "Resolve merge conflicts"

# Push your changes
git push origin your-branch-name
```

### Step 4: Verify
```bash
# Check everything is clean
git status

# Should say: "nothing to commit, working tree clean"
```

---

## 🔄 Daily Workflow (Prevent Conflicts)

### Morning / Start of Session
```bash
git fetch origin
git pull origin main
```

### During Work
```bash
# Every time you make progress
git add .
git commit -m "What you did"
```

### End of Session
```bash
git push origin your-branch-name
```

---

## 🛠️ Most Useful Commands

### Check Status
```bash
git status                    # What's changed
git diff                      # See exact changes
git log --oneline -10         # Recent commits
```

### Sync with GitHub
```bash
git fetch origin              # Get updates (don't merge yet)
git pull origin main          # Get updates and merge
git push origin branch-name   # Send your changes
```

### Undo Things
```bash
git checkout .                # Discard ALL changes (careful!)
git checkout -- file.txt      # Discard changes to one file
git reset --hard HEAD         # Reset to last commit
git reset --hard origin/main  # Reset to GitHub version
```

### Branch Operations
```bash
git branch                    # List branches
git checkout -b new-branch    # Create and switch to branch
git checkout branch-name      # Switch to existing branch
git branch -d branch-name     # Delete branch
```

---

## 🚨 Common Errors & Fixes

### "Your branch has diverged"
```bash
git fetch origin
git rebase origin/main
# Or if rebase fails:
git pull origin main --rebase
```

### "Push rejected"
```bash
git pull origin main
# Resolve any conflicts, then:
git push origin your-branch
```

### "Cannot pull with rebase"
```bash
# Abort the rebase and try merge instead
git rebase --abort
git pull origin main
```

### "Merge conflict in..."
- See Step 2 in Emergency section above
- Or check full guide: `docs/MERGE_CONFLICT_RESOLUTION.md`

---

## 🎯 Best Practices

### ✅ DO
- Commit often with clear messages
- Pull before starting work
- Work on feature branches
- Test after resolving conflicts
- Push at end of day

### ❌ DON'T
- Force push to main
- Ignore conflict markers
- Commit without testing
- Work directly on main with teammates

---

## 🔍 Diagnostic Tools

### Check for Conflicts
```bash
./scripts/check-merge-conflicts.sh
```

### See Differences
```bash
# Between your work and GitHub
git fetch origin
git diff origin/main

# Between two branches
git diff branch1..branch2

# For specific file
git diff HEAD -- filename
```

### View History
```bash
# Commits on your branch not on main
git log origin/main..HEAD --oneline

# Commits on main not on your branch
git log HEAD..origin/main --oneline

# Visual tree
git log --graph --oneline --all -10
```

---

## 📞 When to Ask for Help

Ask for help if:
- Same conflicts appear repeatedly
- You've lost important changes
- Can't identify which version to keep
- Repository won't let you commit/push
- Error messages don't make sense

**Before asking, collect:**
```bash
git status
git log --oneline -5
git remote -v
```

---

## 📚 More Resources

- **Full Guide:** `docs/MERGE_CONFLICT_RESOLUTION.md`
- **Replit Specific:** `docs/REPLIT_GIT_WORKFLOW.md`
- **Check Conflicts:** `./scripts/check-merge-conflicts.sh`

---

## 🔑 Keyboard Shortcuts (Git in Terminal)

- `Ctrl+C` - Cancel current command
- `Ctrl+Z` - Suspend command (use `fg` to resume)
- `git <command> --help` - Get help on any command
- `q` - Quit when viewing git log or diff

---

## 💡 Pro Tips

1. **Commit message template:**
   ```
   <type>: <subject>
   
   <body>
   
   <footer>
   ```
   Example: `fix: resolve merge conflict in .replit file`

2. **See what changed in a commit:**
   ```bash
   git show <commit-hash>
   ```

3. **Undo last commit (keep changes):**
   ```bash
   git reset HEAD~1
   ```

4. **Compare your file with GitHub version:**
   ```bash
   git diff origin/main -- filename
   ```

5. **List files changed between branches:**
   ```bash
   git diff --name-only origin/main
   ```

---

## 🎓 Understanding Conflict Markers

When you open a conflicted file:

```
normal code here...

<<<<<<< HEAD (Current Change)
your version of the code
=======
their version of the code
>>>>>>> branch-name (Incoming Change)

more normal code...
```

**How to resolve:**
1. Decide which version to keep (or combine)
2. Delete the `<<<<<<<`, `=======`, and `>>>>>>>` lines
3. Save the file
4. Run `git add filename`

---

## 🔬 Advanced: Find Who Changed What

```bash
# See who last modified each line
git blame filename

# See history of a file
git log -- filename

# See changes to a file over time
git log -p -- filename
```

---

## 📱 Quick Replit Commands

```bash
# In Replit Shell

# Check if Replit can connect to GitHub
git remote -v

# See Replit's Git settings
git config --list | grep user

# Force reload from GitHub (DESTRUCTIVE)
git fetch origin
git reset --hard origin/main
```

---

**Remember:** When in doubt, check status first!
```bash
git status
```

This card is a quick reference. For detailed explanations, see:
- `docs/MERGE_CONFLICT_RESOLUTION.md`
- `docs/REPLIT_GIT_WORKFLOW.md`
