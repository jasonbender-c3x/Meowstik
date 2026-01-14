#!/bin/bash
# Build script for Meowstik Browser Extension

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/dist"
ZIP_NAME="meowstik-extension.zip"

echo "🐱 Building Meowstik Browser Extension..."

# Clean previous build
if [ -d "$BUILD_DIR" ]; then
  echo "Cleaning previous build..."
  rm -rf "$BUILD_DIR"
fi

# Create dist directory
mkdir -p "$BUILD_DIR"

# Copy extension files
echo "Copying extension files..."
cp -r "$SCRIPT_DIR/background" "$BUILD_DIR/"
cp -r "$SCRIPT_DIR/content" "$BUILD_DIR/"
cp -r "$SCRIPT_DIR/popup" "$BUILD_DIR/"
cp -r "$SCRIPT_DIR/icons" "$BUILD_DIR/"
cp "$SCRIPT_DIR/manifest.json" "$BUILD_DIR/"
cp "$SCRIPT_DIR/README.md" "$BUILD_DIR/"

# Create ZIP archive
echo "Creating ZIP archive..."
cd "$BUILD_DIR"
zip -r "../$ZIP_NAME" . -q
cd ..

echo "✅ Build complete!"
echo "📦 Extension package: $SCRIPT_DIR/$ZIP_NAME"
echo "📁 Unpacked extension: $BUILD_DIR"
echo ""
echo "To install in Chrome:"
echo "1. Go to chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked' and select: $BUILD_DIR"
echo "   OR"
echo "4. Drag and drop: $SCRIPT_DIR/$ZIP_NAME"
