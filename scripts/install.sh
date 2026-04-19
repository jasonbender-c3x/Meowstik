#!/usr/bin/env bash
# ============================================================
#  Meowstik Smart Installer
#  Powered by GitHub Copilot CLI
#  Usage: curl -fsSL https://meowstik.com/install.sh | bash
# ============================================================
set -euo pipefail

MEOWSTIK_SPEC_URL="https://meowstik.com/install-spec"
MEOWSTIK_PRODUCT_URL="https://meowstik.com/download"
BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

banner() {
  echo -e "${CYAN}"
  echo "  ███╗   ███╗███████╗ ██████╗ ██╗    ██╗███████╗████████╗██╗██╗  ██╗"
  echo "  ████╗ ████║██╔════╝██╔═══██╗██║    ██║██╔════╝╚══██╔══╝██║██║ ██╔╝"
  echo "  ██╔████╔██║█████╗  ██║   ██║██║ █╗ ██║███████╗   ██║   ██║█████╔╝ "
  echo "  ██║╚██╔╝██║██╔══╝  ██║   ██║██║███╗██║╚════██║   ██║   ██║██╔═██╗ "
  echo "  ██║ ╚═╝ ██║███████╗╚██████╔╝╚███╔███╔╝███████║   ██║   ██║██║  ██╗"
  echo "  ╚═╝     ╚═╝╚══════╝ ╚═════╝  ╚══╝╚══╝ ╚══════╝   ╚═╝   ╚═╝╚═╝  ╚═╝"
  echo -e "${RESET}"
  echo -e "${BOLD}  Smart Installer — powered by GitHub Copilot${RESET}"
  echo ""
}

info()    { echo -e "  ${CYAN}▶${RESET} $*"; }
success() { echo -e "  ${GREEN}✔${RESET} $*"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
die()     { echo -e "  ${RED}✘${RESET} $*"; exit 1; }

# ── 1. Check prerequisites ────────────────────────────────────────────────────
banner

info "Checking prerequisites..."

if ! command -v curl &>/dev/null; then
  die "curl is required. Install it and re-run this script."
fi

OS="$(uname -s)"
ARCH="$(uname -m)"
info "Detected: ${OS} / ${ARCH}"

# ── 2. Install GitHub CLI ─────────────────────────────────────────────────────
if command -v gh &>/dev/null; then
  success "GitHub CLI already installed ($(gh --version | head -1))"
else
  info "Installing GitHub CLI..."
  case "$OS" in
    Linux)
      if command -v apt-get &>/dev/null; then
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
          | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
          | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt-get update -qq && sudo apt-get install -y gh
      elif command -v dnf &>/dev/null; then
        sudo dnf install -y 'dnf-command(config-manager)'
        sudo dnf config-manager --add-repo https://cli.github.com/packages/rpm/gh-cli.repo
        sudo dnf install -y gh
      elif command -v brew &>/dev/null; then
        brew install gh
      else
        die "Unsupported Linux distro. Install gh manually: https://cli.github.com"
      fi
      ;;
    Darwin)
      if command -v brew &>/dev/null; then
        brew install gh
      else
        die "Homebrew required on macOS. Install it first: https://brew.sh"
      fi
      ;;
    *)
      die "Unsupported OS: $OS. Install gh manually: https://cli.github.com"
      ;;
  esac
  success "GitHub CLI installed"
fi

# ── 3. Authenticate with GitHub ───────────────────────────────────────────────
if gh auth status &>/dev/null; then
  success "Already authenticated with GitHub"
else
  info "Authenticating with GitHub..."
  echo ""
  echo -e "  ${YELLOW}A browser window will open. Sign in to GitHub to continue.${RESET}"
  echo ""
  gh auth login --web --git-protocol https || die "GitHub authentication failed"
  success "Authenticated with GitHub"
fi

# ── 4. Install GitHub Copilot CLI extension ───────────────────────────────────
if gh extension list 2>/dev/null | grep -q "copilot"; then
  success "GitHub Copilot extension already installed"
else
  info "Installing GitHub Copilot CLI extension..."
  gh extension install github/gh-copilot || die "Failed to install Copilot extension"
  success "Copilot extension installed"
fi

# ── 5. Hand off to Copilot — the smart part ───────────────────────────────────
echo ""
echo -e "${BOLD}  ✨ Handing off to GitHub Copilot for intelligent setup...${RESET}"
echo ""

COPILOT_PROMPT="You are setting up Meowstik on this machine.
1. Download the latest Meowstik release from ${MEOWSTIK_PRODUCT_URL} for this OS and architecture.
2. Follow the exact installation and configuration instructions at ${MEOWSTIK_SPEC_URL}.
3. Verify the installation is working correctly when done.
Do not ask for confirmation — execute each step automatically."

gh copilot suggest -t shell "$COPILOT_PROMPT"

echo ""
success "Meowstik setup complete!"
echo ""
echo -e "  ${BOLD}Get started:${RESET} https://meowstik.com/docs/quickstart"
echo ""
