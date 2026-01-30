#!/bin/bash

# Script to check for merge conflicts in the repository
# Usage: ./scripts/check-merge-conflicts.sh

set -e

echo "🔍 Checking for merge conflicts..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

has_issues=0

# Check for unresolved conflicts in git
echo "Checking git status for unresolved conflicts..."
conflicts=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")

if [ -n "$conflicts" ]; then
    echo -e "${RED}⚠️  Found unresolved conflicts in:${NC}"
    echo "$conflicts"
    has_issues=1
    echo ""
fi

# Check for conflict markers in files (actual Git conflict markers)
echo "Scanning files for conflict markers..."
# Exclude documentation files that contain examples of conflict markers
markers=$(git grep -n "^<<<<<<< \|^=======$\|^>>>>>>> " -- \
  ':!docs/MERGE_CONFLICT_RESOLUTION.md' \
  ':!docs/MERGE_CONFLICT_QUICK_REF.md' \
  ':!docs/THREE_FILE_PROBLEM.md' \
  ':!docs/REPLIT_GIT_WORKFLOW.md' \
  ':!scripts/check-merge-conflicts.sh' \
  2>/dev/null || echo "")

if [ -n "$markers" ]; then
    echo -e "${RED}⚠️  Found conflict markers in files:${NC}"
    echo "$markers"
    has_issues=1
    echo ""
fi

# Check for .orig files (backup files created during merge)
echo "Checking for merge backup files..."
orig_files=$(find . -name "*.orig" -o -name "*.rej" 2>/dev/null | grep -v node_modules || echo "")

if [ -n "$orig_files" ]; then
    echo -e "${YELLOW}⚠️  Found merge backup files:${NC}"
    echo "$orig_files"
    echo -e "${YELLOW}Consider removing these after confirming conflicts are resolved${NC}"
    echo ""
fi

# Check if we're in the middle of a merge
if [ -d ".git/MERGE_HEAD" ]; then
    echo -e "${YELLOW}⚠️  Repository is in the middle of a merge${NC}"
    echo "Complete the merge with: git commit"
    echo "Or abort with: git merge --abort"
    has_issues=1
    echo ""
fi

# Check if we're in the middle of a rebase
if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
    echo -e "${YELLOW}⚠️  Repository is in the middle of a rebase${NC}"
    echo "Continue with: git rebase --continue"
    echo "Or abort with: git rebase --abort"
    has_issues=1
    echo ""
fi

# Check for diverged branches
echo "Checking branch status..."
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
    # Try to get upstream branch
    upstream=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")
    
    if [ -n "$upstream" ]; then
        ahead=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "0")
        behind=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "0")
        
        if [ "$ahead" -gt 0 ] && [ "$behind" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Branch has diverged from upstream:${NC}"
            echo "  Your branch is $behind commit(s) ahead and $ahead commit(s) behind $upstream"
            echo "  Consider: git pull --rebase"
            echo ""
        elif [ "$ahead" -gt 0 ]; then
            echo -e "${YELLOW}ℹ️  Branch is $ahead commit(s) behind $upstream${NC}"
            echo "  Consider: git pull"
            echo ""
        fi
    fi
fi

# Final report
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $has_issues -eq 0 ]; then
    echo -e "${GREEN}✅ No merge conflicts detected${NC}"
    echo "Repository is clean and ready for operations."
    exit 0
else
    echo -e "${RED}❌ Issues found - review above output${NC}"
    echo "See docs/MERGE_CONFLICT_RESOLUTION.md for help."
    exit 1
fi
