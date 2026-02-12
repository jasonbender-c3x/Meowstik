#!/bin/bash

# Quick setup and test script for Playwright MCP Server

set -e

echo "🚀 Setting up Playwright MCP Server..."
echo ""

cd "$(dirname "$0")"

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium

echo ""
echo "🔨 Building server..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next steps:"
echo ""
echo "1️⃣  Test the server:"
echo "   npm start"
echo ""
echo "2️⃣  Or use MCP Inspector:"
echo "   npx @modelcontextprotocol/inspector node build/index.js"
echo ""
echo "3️⃣  Connect to Claude Desktop:"
echo "   Add to ~/Library/Application Support/Claude/claude_desktop_config.json:"
echo ""
echo '   {'
echo '     "mcpServers": {'
echo '       "playwright": {'
echo '         "command": "node",'
echo "         \"args\": [\"$(pwd)/build/index.js\"]"
echo '       }'
echo '     }'
echo '   }'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
