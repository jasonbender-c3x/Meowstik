#!/bin/bash
# Wrapper script to launch Meowstik Desktop App with proper environment

# Ensure we are in the root directory
cd "$(dirname "$0")/.."

# Check if node_modules exists, install if not
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Prevent GH Copilot CLI from launching helpers during desktop startup
if pgrep -f "gh copilot" >/dev/null 2>&1; then
    echo "💡 stopping GH Copilot helper to keep shells under control..."
    pkill -f "gh copilot" || true
    sleep 1
fi

# Check if desktop-app is built
if [ ! -d "desktop-app/dist" ]; then
    echo "🛠️ Building desktop app..."
    cd desktop-app
    pnpm run build
    cd ..
fi

echo "🚀 Starting Meowstik Desktop..."
cd desktop-app
pnpm start
