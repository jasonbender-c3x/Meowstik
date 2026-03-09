#!/bin/bash
# =============================================================================
# MEOWSTIK DESKTOP INSTALLER
# =============================================================================
#
# This script sets up Meowstik Desktop on your local machine.
#
# What it does:
# 1. Checks for secrets.json in the current directory
# 2. Parses secrets.json and creates a secure .env file
# 3. Installs system dependencies via apt
# 4. Installs Node.js packages
# 5. Copies the browser extension to ~/.meowstik/extension/
# 6. Guides you through Chrome extension installation
#
# Usage:
#   chmod +x install.sh
#   ./install.sh
#
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}=============================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}=============================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

pause_for_user() {
    echo ""
    echo -e "${YELLOW}$1${NC}"
    read -p "Press Enter to continue..."
    echo ""
}

# =============================================================================
# STEP 1 & 2: CONFIGURE ENVIRONMENT
# =============================================================================

print_header "MEOWSTIK DESKTOP INSTALLER"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
SECRETS_FILE="$SCRIPT_DIR/secrets.json"
ENV_FILE="$SCRIPT_DIR/.env"
ROOT_ENV_FILE="$PROJECT_ROOT/.env"
EXTENSION_DEST="$HOME/.meowstik/extension"

print_step "Configuring environment..."

if [ -f "$ENV_FILE" ]; then
    print_success "Existing .env file found. Skipping secrets.json processing."
elif [ -f "$SECRETS_FILE" ]; then
    print_step "Found secrets.json. Creating .env file..."

    # Check if jq is available, otherwise use Node.js
    if command -v jq &> /dev/null; then
        # Use jq to parse JSON
        jq -r 'to_entries | .[] | "\(.key)=\(.value)"' "$SECRETS_FILE" > "$ENV_FILE"
    elif command -v node &> /dev/null; then
        # Use Node.js to parse JSON
        node -e "
            const fs = require('fs');
            const secrets = JSON.parse(fs.readFileSync('$SECRETS_FILE', 'utf8'));
            const env = Object.entries(secrets)
                .map(([key, value]) => \`\${key}=\${value}\`)
                .join('\n');
            fs.writeFileSync('$ENV_FILE', env);
        "
    else
        print_error "Neither jq nor Node.js found. Please install one of them first."
        echo "  sudo apt install jq"
        echo "  OR"
        echo "  sudo apt install nodejs"
        exit 1
    fi

    # Set secure permissions (read/write for owner only)
    chmod 600 "$ENV_FILE"
    print_success "Created .env with secure permissions (600)"
elif [ -f "$ROOT_ENV_FILE" ]; then
    print_step "secrets.json not found, but found root .env. Copying..."
    cp "$ROOT_ENV_FILE" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    print_success "Copied .env from project root"
else
    print_error "No secrets.json or .env found!"
    echo "Please provide one of the following:"
    echo "1. A secrets.json file in $SCRIPT_DIR/"
    echo "2. An .env file in $SCRIPT_DIR/"
    echo "3. An .env file in the project root"
    echo ""
    echo "secrets.json example:"
    echo '  {'
    echo '    "GEMINI_API_KEY": "your-api-key-here",'
    echo '    "DATABASE_URL": "postgresql://..."'
    echo '  }'
    echo ""
    exit 1
fi

# =============================================================================
# STEP 3: INSTALL SYSTEM DEPENDENCIES
# =============================================================================

print_step "Installing system dependencies..."

# Check if Node.js is already installed
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    print_success "Node.js $(node -v) and npm $(npm -v) are already installed. Skipping apt install."
    
    # Still verify build-essential if possible, but don't fail if we can't
    if command -v apt &> /dev/null; then
         if [ "$EUID" -eq 0 ]; then
            apt update && apt install -y build-essential || echo "Failed to install build-essential, continuing anyway..."
        elif command -v sudo &> /dev/null; then
            sudo apt update && sudo apt install -y build-essential || echo "Failed to install build-essential, continuing anyway..."
        fi
    fi
else
    # Check if we can use apt
    if command -v apt &> /dev/null; then
    echo "Installing Node.js and build tools..."
    
    # Check if running as root or can use sudo
    if [ "$EUID" -eq 0 ]; then
        apt update
        apt install -y nodejs npm build-essential
    elif command -v sudo &> /dev/null; then
        sudo apt update
        sudo apt install -y nodejs npm build-essential
    else
        print_warning "Cannot run apt without sudo. Please install manually:"
        echo "  apt install nodejs npm build-essential"
    fi
    
    print_success "System dependencies installed"
else
    print_warning "apt not found. Please install Node.js 18+ manually for your system."
fi
fi

# =============================================================================
# STEP 4: INSTALL NODE.JS PACKAGES
# =============================================================================

print_step "Installing Node.js packages..."

# Install main project dependencies
if [ -f "$PROJECT_ROOT/package.json" ]; then
    print_step "Installing main project dependencies..."
    cd "$PROJECT_ROOT"
    npm install
    print_success "Main project dependencies installed"
fi

# Install desktop-app dependencies
if [ -f "$SCRIPT_DIR/package.json" ]; then
    print_step "Installing desktop app dependencies..."
    cd "$SCRIPT_DIR"
    npm install
    print_success "Desktop app dependencies installed"
fi

# =============================================================================
# STEP 5: COPY BROWSER EXTENSION
# =============================================================================

print_step "Setting up browser extension..."

EXTENSION_SRC="$PROJECT_ROOT/extension"

if [ -d "$EXTENSION_SRC" ]; then
    # Create destination directory
    mkdir -p "$EXTENSION_DEST"
    
    # Copy extension files (space-safe using /. instead of /*)
    cp -r "$EXTENSION_SRC"/. "$EXTENSION_DEST"
    
    if [ $? -eq 0 ]; then
        print_success "Extension copied to: $EXTENSION_DEST"
    else
        print_error "Failed to copy extension files"
        print_warning "You may need to copy the extension manually from: $EXTENSION_SRC"
    fi
else
    print_warning "Extension source not found at: $EXTENSION_SRC"
    print_warning "You may need to copy the extension manually later."
fi

# =============================================================================
# STEP 6: CHROME EXTENSION INSTALLATION GUIDE
# =============================================================================

print_header "INSTALL CHROME EXTENSION"

echo -e "${GREEN}The Meowstik browser extension has been copied to:${NC}"
echo ""
echo "  $EXTENSION_DEST"
echo ""
echo -e "${YELLOW}To install the extension in Chrome:${NC}"
echo ""
echo "  1. Open Chrome and go to: chrome://extensions"
echo ""
echo "  2. Enable 'Developer mode' (toggle in top-right corner)"
echo ""
echo "  3. Click 'Load unpacked'"
echo ""
echo "  4. Navigate to and select this folder:"
echo "     $EXTENSION_DEST"
echo ""
echo "  5. The Meowstik extension should now appear in your extensions!"
echo ""

pause_for_user "Please install the Chrome extension now, then press Enter to continue..."

# =============================================================================
# STEP 7: FINAL SETUP
# =============================================================================

print_header "SETUP COMPLETE!"

echo -e "${GREEN}Meowstik Desktop is ready to use!${NC}"
echo ""
echo "To start the app:"
echo ""
echo "  cd $SCRIPT_DIR"
echo "  npm run dev       # Development mode"
echo "  npm start         # Production mode"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  - Your .env file contains sensitive API keys"
echo "  - Keep it secure and never commit it to git"
echo "  - Consider deleting secrets.json after setup"
echo ""
echo -e "${CYAN}Enjoy using Meowstik! 🐱${NC}"
echo ""
