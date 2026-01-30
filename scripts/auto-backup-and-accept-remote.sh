#!/bin/bash

# =============================================================================
# Auto-Backup & Accept Remote for Merge Conflicts
# =============================================================================
#
# This script automatically:
# 1. Detects the 3 common conflicting files (.replit, replit.nix, package-lock.json)
# 2. Creates a timestamped backup ZIP of your local versions
# 3. Accepts GitHub's versions (remote/theirs)
# 4. Stages the changes
#
# Usage: ./scripts/auto-backup-and-accept-remote.sh
#
# The backup ZIP is saved to: /tmp/meowstik-conflict-backup-TIMESTAMP.zip
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}🔄 Auto-Backup & Accept Remote${NC}                            ${CYAN}║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Define the three problem files
PROBLEM_FILES=(".replit" "replit.nix" "package-lock.json")

# Check if any of these files have conflicts
echo -e "${BLUE}➤ Checking for conflicts in problem files...${NC}"
echo ""

conflicted_files=()
for file in "${PROBLEM_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check if file is in conflict
        if git diff --name-only --diff-filter=U 2>/dev/null | grep -q "^${file}$"; then
            conflicted_files+=("$file")
            echo -e "  ${YELLOW}⚠️${NC}  $file (in conflict)"
        else
            # Check if file exists and differs from remote
            if git diff --name-only "origin/$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null | grep -q "^${file}$"; then
                echo -e "  ${CYAN}ℹ️${NC}  $file (differs from remote)"
            else
                echo -e "  ${GREEN}✓${NC}  $file (no conflict)"
            fi
        fi
    fi
done

echo ""

if [ ${#conflicted_files[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ No conflicts found in the problem files${NC}"
    echo ""
    echo "If you're still having issues, run: ./scripts/check-merge-conflicts.sh"
    exit 0
fi

echo -e "${YELLOW}Found ${#conflicted_files[@]} conflicted file(s)${NC}"
echo ""

# Create backup directory with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/meowstik-conflict-backup-${TIMESTAMP}"
BACKUP_ZIP="/tmp/meowstik-conflict-backup-${TIMESTAMP}.zip"

echo -e "${BLUE}➤ Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"

# Copy conflicted files to backup directory
for file in "${conflicted_files[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/" 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} Backed up: $file"
    fi
done

# Also backup git status and diff info
git status > "$BACKUP_DIR/git-status.txt" 2>&1 || true
git diff > "$BACKUP_DIR/git-diff.txt" 2>&1 || true

# Create a README in the backup
cat > "$BACKUP_DIR/README.txt" << EOF
Meowstik Conflict Backup
========================

Created: $(date)
Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

This backup contains your local versions of files that were in conflict.
The script has accepted GitHub's versions (remote) for these files.

Files backed up:
EOF

for file in "${conflicted_files[@]}"; do
    echo "  - $file" >> "$BACKUP_DIR/README.txt"
done

echo "" >> "$BACKUP_DIR/README.txt"
echo "To restore a file, copy it from this backup back to your repository." >> "$BACKUP_DIR/README.txt"
echo "" >> "$BACKUP_DIR/README.txt"
echo "Git status at backup time is in: git-status.txt" >> "$BACKUP_DIR/README.txt"
echo "Git diff at backup time is in: git-diff.txt" >> "$BACKUP_DIR/README.txt"

# Create ZIP file
echo ""
echo -e "${BLUE}➤ Creating ZIP archive...${NC}"

if command -v zip &> /dev/null; then
    cd /tmp
    zip -r "meowstik-conflict-backup-${TIMESTAMP}.zip" "meowstik-conflict-backup-${TIMESTAMP}" > /dev/null 2>&1
    echo -e "  ${GREEN}✓${NC} Created: $BACKUP_ZIP"
    
    # Clean up directory after zipping
    rm -rf "$BACKUP_DIR"
else
    echo -e "  ${YELLOW}⚠️${NC}  'zip' command not found, keeping directory: $BACKUP_DIR"
    BACKUP_ZIP="$BACKUP_DIR"
fi

echo ""
echo -e "${GREEN}✅ Backup created!${NC}"
echo -e "   Location: ${BOLD}$BACKUP_ZIP${NC}"
echo ""

# Now accept remote versions
echo -e "${BLUE}➤ Accepting GitHub's versions (remote/theirs)...${NC}"
echo ""

for file in "${conflicted_files[@]}"; do
    if [ -f "$file" ]; then
        if git checkout --theirs "$file" 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Accepted remote: $file"
        else
            echo -e "  ${RED}✗${NC} Failed to accept remote: $file"
        fi
    fi
done

# Special handling for package-lock.json
if [[ " ${conflicted_files[@]} " =~ " package-lock.json " ]]; then
    echo ""
    echo -e "${BLUE}➤ Regenerating package-lock.json...${NC}"
    
    if [ -f "package-lock.json" ]; then
        rm package-lock.json
    fi
    
    if command -v npm &> /dev/null; then
        npm install > /dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} Regenerated package-lock.json" || echo -e "  ${YELLOW}⚠️${NC}  npm install had warnings"
    else
        echo -e "  ${YELLOW}⚠️${NC}  npm not found, skipping regeneration"
    fi
fi

# Stage the files
echo ""
echo -e "${BLUE}➤ Staging resolved files...${NC}"

for file in "${conflicted_files[@]}"; do
    if [ -f "$file" ]; then
        git add "$file" 2>/dev/null && echo -e "  ${GREEN}✓${NC} Staged: $file" || echo -e "  ${YELLOW}⚠️${NC}  Could not stage: $file"
    fi
done

if [ -f "package-lock.json" ]; then
    git add package-lock.json 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}✅ Done!${NC}                                                    ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1️⃣  Review the changes: ${CYAN}git status${NC}"
echo -e "  2️⃣  Commit the resolution: ${CYAN}git commit -m \"Resolve conflicts\"${NC}"
echo -e "  3️⃣  Push to GitHub: ${CYAN}git push origin $(git rev-parse --abbrev-ref HEAD)${NC}"
echo ""
echo -e "${BOLD}Your backup:${NC}"
echo -e "  📦 ${BACKUP_ZIP}"
echo -e "  💡 Examine this later if you need to recover any lost work"
echo ""
echo -e "${YELLOW}⚠️  Remember to test that your app still runs correctly!${NC}"
echo ""
