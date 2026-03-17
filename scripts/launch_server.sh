#!/bin/bash

# Kill any existing server/electron processes
pkill -f "node /usr/local/bin/pnpm start" || true
pkill -f "electron" || true
pkill -f "tsx server/index.ts" || true

# Set environment to disable desktop agent
export ENABLE_DESKTOP_AGENT=false
export NODE_ENV=development

# Navigate to project root
cd "$HOME/Meowstik"

# Start the server in the background
echo "🚀 Starting Meowstik Server (Web Only)..."
nohup pnpm run dev > "$HOME/workspace/logs/server.log" 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
timeout 30s bash -c 'until curl -s http://localhost:5000/api/health > /dev/null; do sleep 1; done'

if [ $? -eq 0 ]; then
    echo "✅ Server is UP!"
    # Open Chrome
    google-chrome http://localhost:5000 &
else
    echo "❌ Server failed to start within 30s. Check logs at ~/workspace/logs/server.log"
fi
