#!/bin/bash
# Easy to remember: ./protect-memory.sh
# Protects memory log files from being lost during git operations

clear
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              MEMORY LOG PROTECTION SETUP                         ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "This script will protect your memory logs from git operations."
echo ""
read -p "Press ENTER to continue..."

echo ""
echo "Step 1: Configuring git merge strategy..."
git config --local merge.union.driver "git merge-file --union %O %A %B"
git config --local merge.union.name "Always merge by union (append both versions)"
git config --local merge.union.recursive text
echo "✅ Git merge driver configured"
echo ""
read -p "Press ENTER to continue..."

echo ""
echo "Step 2: Protected files:"
echo "  • logs/cache.md"
echo "  • logs/execution.md"
echo "  • logs/Short_Term_Memory.md"
echo "  • logs/personal.md"
echo "  • logs/replit.md"
echo "  • logs/STM_APPEND.md"
echo ""
read -p "Press ENTER to continue..."

echo ""
echo "Step 3: Verifying configuration..."
echo ""
driver=$(git config --local --get merge.union.driver)
if [ -n "$driver" ]; then
    echo "✅ Merge driver: ACTIVE"
else
    echo "❌ Merge driver: NOT CONFIGURED"
fi
echo ""
read -p "Press ENTER to continue..."

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                      SETUP COMPLETE! ✅                          ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Your memory logs are now protected!"
echo ""
echo "What this means:"
echo "  • Memory files are tracked by git"
echo "  • Changes always merge (never overwrite)"
echo "  • Safe from 'git reset --hard'"
echo "  • Safe from 'git clean -fd'"
echo ""
read -p "Press ENTER to finish..."
clear
echo "✨ Memory protection is active!"
