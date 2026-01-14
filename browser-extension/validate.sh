#!/bin/bash
# Validation script for Meowstik Browser Extension

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔍 Validating Meowstik Browser Extension..."
echo ""

# Check manifest.json
echo "1️⃣ Checking manifest.json..."
if [ -f "$SCRIPT_DIR/manifest.json" ]; then
  cat "$SCRIPT_DIR/manifest.json" | python3 -m json.tool > /dev/null
  echo "   ✅ manifest.json is valid JSON"
else
  echo "   ❌ manifest.json not found"
  exit 1
fi

# Check required files
echo ""
echo "2️⃣ Checking required files..."
FILES=(
  "background/service-worker.js"
  "content/content-script.js"
  "content/content-style.css"
  "popup/popup.html"
  "popup/popup.js"
  "popup/popup.css"
  "popup/audio-processor.js"
  "icons/icon16.png"
  "icons/icon32.png"
  "icons/icon48.png"
  "icons/icon128.png"
)

MISSING=0
for file in "${FILES[@]}"; do
  if [ -f "$SCRIPT_DIR/$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file MISSING"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  echo "   ❌ $MISSING files missing"
  exit 1
fi

# Check JavaScript syntax
echo ""
echo "3️⃣ Checking JavaScript syntax..."
JS_FILES=(
  "background/service-worker.js"
  "content/content-script.js"
  "popup/popup.js"
  "popup/audio-processor.js"
)

for file in "${JS_FILES[@]}"; do
  if node --check "$SCRIPT_DIR/$file" 2>&1; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file has syntax errors"
    exit 1
  fi
done

# Check icon files
echo ""
echo "4️⃣ Checking icon files..."
for size in 16 32 48 128; do
  icon="$SCRIPT_DIR/icons/icon${size}.png"
  if [ -s "$icon" ]; then
    filesize=$(stat -c%s "$icon" 2>/dev/null || stat -f%z "$icon" 2>/dev/null)
    echo "   ✅ icon${size}.png (${filesize} bytes)"
  else
    echo "   ❌ icon${size}.png is empty or missing"
    exit 1
  fi
done

# Check manifest permissions
echo ""
echo "5️⃣ Checking manifest permissions..."
REQUIRED_PERMS=("tabs" "activeTab" "storage" "scripting")
for perm in "${REQUIRED_PERMS[@]}"; do
  if grep -q "\"$perm\"" "$SCRIPT_DIR/manifest.json"; then
    echo "   ✅ $perm"
  else
    echo "   ⚠️  $perm not found"
  fi
done

# Check web_accessible_resources
echo ""
echo "6️⃣ Checking web_accessible_resources..."
if grep -q "audio-processor.js" "$SCRIPT_DIR/manifest.json"; then
  echo "   ✅ audio-processor.js is web accessible"
else
  echo "   ❌ audio-processor.js not in web_accessible_resources"
  exit 1
fi

echo ""
echo "✅ All validation checks passed!"
echo ""
echo "Extension is ready to use. Run './build.sh' to create distribution package."
