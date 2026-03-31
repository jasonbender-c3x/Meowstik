# 🐱 Meowstik Merge Helper - Interactive Script

An interactive, user-friendly script for resolving merge conflicts in Replit.

## Quick Start

In Replit Shell, run:

```bash
./scripts/replit-merge-helper.sh
```

## Features

### 1. **Check Git Status** 
View current repository state, branch, and file changes

### 2. **Run Conflict Checker**
Automated scan for merge conflicts and issues

### 3. **Quick Fix: Three File Problem** ⭐
One-click solution for common `.replit`, `replit.nix`, and `package-lock.json` conflicts

Choose to keep:
- YOUR version (what's in Replit now)
- THEIR version (what's in GitHub)

### 4. **Resolve Specific File**
Interactive file-by-file conflict resolution with options to:
- Keep your version
- Keep their version
- Edit manually
- Show the conflicts

### 5. **Pull from GitHub**
Safely pull latest changes with automatic stash/commit handling

### 6. **Stage Resolved Files**
Stage files after resolving conflicts

### 7. **Commit Changes**
Commit with a custom message

### 8. **Push to GitHub**
Push your changes to GitHub

### 9. **View Documentation**
Access all merge conflict guides from within the script

### 10. **Exit**
Close the helper

## Visual Interface

```
╔═══════════════════════════════════════════════════════════════╗
║  🐱 Meowstik Merge Conflict Helper for Replit                ║
╚═══════════════════════════════════════════════════════════════╝

Main Menu

  1)  Check Git Status
  2)  Run Conflict Checker
  3)  Quick Fix: Three File Problem
  4)  Resolve Specific File
  5)  Pull from GitHub
  6)  Stage Resolved Files
  7)  Commit Changes
  8)  Push to GitHub
  9)  View Documentation
  10) Exit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quick Status:
✅ No unresolved conflicts found
Current branch: main
Staged files: 0 | Unstaged: 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Common Workflows

### Scenario 1: You Have the "Three File Problem"

1. Run the script: `./scripts/replit-merge-helper.sh`
2. Choose option **3** (Quick Fix: Three File Problem)
3. Select **1** (Keep YOUR version) if Replit is working
4. Choose option **7** to commit
5. Choose option **8** to push

### Scenario 2: Pull Latest Changes

1. Run the script
2. Choose option **5** (Pull from GitHub)
3. If prompted about uncommitted changes, choose to stash or commit
4. If conflicts occur, use option **3** or **4** to resolve

### Scenario 3: Resolve Unknown Conflicts

1. Run the script
2. Choose option **2** (Run Conflict Checker) to see what's wrong
3. Choose option **4** (Resolve Specific File)
4. Select the file and choose how to resolve
5. Repeat for all conflicted files
6. Choose option **6** to stage
7. Choose option **7** to commit
8. Choose option **8** to push

### Scenario 4: Regular Commit and Push

1. Make your code changes in Replit
2. Run the script
3. Choose option **1** to check status
4. Choose option **7** to commit (enters message)
5. Choose option **8** to push

## Tips

- **Color Coding**:
  - 🟢 Green = Success, safe options
  - 🟡 Yellow = Warnings, important info
  - 🔴 Red = Errors, problems
  - 🔵 Blue = Processing
  - 🟣 Cyan = Headers, UI elements

- **Navigation**: 
  - Always press `Enter` to continue after viewing info
  - Use number keys to select menu options
  - Invalid choices won't break anything

- **Safety**: 
  - The script won't force push or delete code
  - You can always choose "Cancel" in any submenu
  - Changes aren't permanent until you commit and push

## Troubleshooting

### "Permission denied"
```bash
chmod +x scripts/replit-merge-helper.sh
```

### "File not found"
Make sure you're in the project root directory:
```bash
cd /path/to/Meowstik
./scripts/replit-merge-helper.sh
```

### "Git command failed"
The script will show you the error message. Common fixes:
- Check your internet connection
- Verify GitHub authentication
- Try option **1** (Check Git Status) for more info

## What's Inside

The script provides:
- ✅ Interactive menus (no command memorization needed)
- ✅ Color-coded output for clarity
- ✅ Quick status dashboard
- ✅ Automatic conflict detection
- ✅ Guided resolution steps
- ✅ Built-in documentation viewer
- ✅ Safe operations with confirmations
- ✅ Error handling and helpful messages

## Alternative: Command Line

If you prefer direct commands, see:
- `docs/MERGE_CONFLICT_QUICK_REF.md` - Command reference
- `docs/THREE_FILE_PROBLEM.md` - Specific solutions
- `scripts/check-merge-conflicts.sh` - Automated checker only

## Getting Help

While in the script:
- Choose option **9** (View Documentation)
- Select the guide relevant to your issue

Outside the script:
- Check `docs/` directory for full guides
- Run `./scripts/check-merge-conflicts.sh` for diagnostics

## Features for Advanced Users

The script also handles:
- Automatic stashing before pull
- Branch detection
- Conflict marker scanning
- Staged vs unstaged file tracking
- Safe abort at any step

## System Requirements

- Bash shell (available in Replit)
- Git (pre-installed in Replit)
- Node.js and npm (for package-lock.json regeneration)

## License

Part of the Meowstik project.

---

**Pro Tip**: Bookmark this script in your Replit shell history for quick access!

```bash
# Add an alias to your shell (optional)
alias merge-help='./scripts/replit-merge-helper.sh'

# Then just type:
merge-help
```
