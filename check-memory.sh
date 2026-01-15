#!/bin/bash
# Easy to remember: ./check-memory.sh
# Checks if memory log protection is active

clear
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              MEMORY LOG PROTECTION STATUS                        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Check merge driver
driver=$(git config --local --get merge.union.driver)
if [ -n "$driver" ]; then
    echo "🛡️  Protection Status: ACTIVE ✅"
else
    echo "⚠️  Protection Status: NOT ACTIVE ❌"
    echo ""
    echo "Run './protect-memory.sh' to activate protection"
    echo ""
    read -p "Press ENTER to exit..."
    exit 1
fi

echo ""
echo "📁 Protected Files:"
git ls-files logs/*.md 2>/dev/null | while read file; do
    attr=$(git check-attr merge "$file" 2>/dev/null | awk '{print $3}')
    if [ "$attr" = "union" ]; then
        echo "  ✅ $file"
    else
        echo "  ⚪ $file (not protected)"
    fi
done

echo ""
echo "🔧 Configuration:"
echo "  Merge Driver: $driver"
echo ""
echo "📊 What this means:"
echo "  • Your memory logs won't be deleted by git operations"
echo "  • Changes from different branches will merge automatically"
echo "  • No data loss from 'git reset --hard' or 'git clean'"
echo ""
read -p "Press ENTER to exit..."
