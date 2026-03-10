#!/bin/bash

# Meowstik Startup Script
# This script helps you start the application easily

set -e

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                        Meowstik Startup Script                           ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}✗ Error: .env file not found${NC}"
    echo ""
    echo "Please create .env file:"
    echo "  1. Copy .env.example to .env"
    echo "  2. Fill in your credentials"
    echo ""
    echo "Run: cp .env.example .env"
    exit 1
fi

echo -e "${GREEN}✓ .env file found${NC}"

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}⚠ node_modules not found. Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Check for required environment variables
echo ""
echo "Checking environment variables..."

check_env() {
    if grep -q "^$1=" .env && ! grep -q "^$1=your_" .env && ! grep -q "^$1=$" .env; then
        echo -e "${GREEN}✓ $1${NC}"
        return 0
    else
        echo -e "${RED}✗ $1 not configured${NC}"
        return 1
    fi
}

ALL_OK=true

# Required variables
check_env "DATABASE_URL" || ALL_OK=false
check_env "GEMINI_API_KEY" || ALL_OK=false

# Check if using HOME_DEV_MODE or OAuth
if grep -q "^HOME_DEV_MODE=true" .env; then
    echo -e "${YELLOW}⚠ HOME_DEV_MODE enabled (development only)${NC}"
else
    check_env "GOOGLE_CLIENT_ID" || ALL_OK=false
    check_env "GOOGLE_CLIENT_SECRET" || ALL_OK=false
fi

# Optional but recommended for SMS
if check_env "TWILIO_ACCOUNT_SID" && check_env "TWILIO_AUTH_TOKEN" && check_env "TWILIO_PHONE_NUMBER" && check_env "OWNER_PHONE_NUMBER"; then
    echo -e "${GREEN}✓ Twilio SMS configured${NC}"
else
    echo -e "${YELLOW}⚠ Twilio not configured (SMS features disabled)${NC}"
fi

echo ""

if [ "$ALL_OK" = false ]; then
    echo -e "${RED}✗ Some required environment variables are missing${NC}"
    echo ""
    echo "Please edit .env and configure:"
    echo "  - DATABASE_URL"
    echo "  - GEMINI_API_KEY"
    echo "  - GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET (or enable HOME_DEV_MODE)"
    echo ""
    echo "See QUICK_START.md for detailed setup instructions"
    exit 1
fi

echo -e "${GREEN}✓ All required environment variables configured${NC}"
echo ""

# Ask which mode to start
echo "How do you want to start the application?"
echo ""
echo "  1) Development mode (recommended)"
echo "     - Hot reload on file changes"
echo "     - Detailed error messages"
echo "     - Requires 2 terminals"
echo ""
echo "  2) Production mode"
echo "     - Builds and runs optimized version"
echo "     - Single terminal"
echo ""
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        echo ""
        echo "Starting development mode..."
        echo ""
        echo -e "${YELLOW}⚠ You need to run these in TWO SEPARATE TERMINALS:${NC}"
        echo ""
        echo -e "${GREEN}Terminal 1 (Backend):${NC}"
        echo "  npm run dev"
        echo ""
        echo -e "${GREEN}Terminal 2 (Frontend):${NC}"
        echo "  npm run dev:client"
        echo ""
        echo "Or press Ctrl+C and run this script with --dev to start backend now"
        echo ""
        
        if [ "$1" = "--dev" ]; then
            echo "Starting backend server..."
            npm run dev
        fi
        ;;
    2)
        echo ""
        echo "Building application..."
        npm run build
        echo ""
        echo "Starting production server..."
        npm start
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac
