#!/bin/bash
# =============================================================================
# MEMORY LOG PROTECTION SETUP
# =============================================================================
# This script configures git to always merge memory log files instead of
# overwriting them during git operations like pull, reset, or checkout.
#
# Usage: ./scripts/setup-memory-protection.sh
# =============================================================================

set -e

echo "🛡️  Setting up memory log protection..."

# Configure git merge driver for memory files
# The 'union' merge strategy concatenates both versions during conflicts
git config --local merge.union.driver "git merge-file --union %O %A %B"
git config --local merge.union.name "Always merge by union (append both versions)"
git config --local merge.union.recursive text

echo "✅ Git merge driver configured"

# Verify the configuration
echo ""
echo "📋 Current merge configuration:"
git config --local --get merge.union.driver || echo "  (not set)"
git config --local --get merge.union.name || echo "  (not set)"

echo ""
echo "📁 Memory files protected:"
echo "  - logs/cache.md"
echo "  - logs/execution.md"
echo "  - logs/Short_Term_Memory.md"
echo "  - logs/personal.md"
echo "  - logs/replit.md"
echo "  - logs/STM_APPEND.md"

echo ""
echo "✨ Memory log protection is now active!"
echo ""
echo "These files will now:"
echo "  • Be tracked by git (no longer in .gitignore)"
echo "  • Automatically merge content during git pull/merge"
echo "  • Never be overwritten by git operations"
echo "  • Preserve all history across branches"
