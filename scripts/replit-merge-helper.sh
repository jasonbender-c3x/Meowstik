#!/bin/bash

# =============================================================================
# Interactive Merge Conflict Resolver for Replit
# =============================================================================
#
# This script provides an interactive, guided approach to resolving merge
# conflicts in the Replit environment. It's designed to be user-friendly
# for developers who aren't Git experts.
#
# Usage: ./scripts/replit-merge-helper.sh
#
# =============================================================================

set -e

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Clear screen function
clear_screen() {
    clear
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}🐱 Meowstik Merge Conflict Helper for Replit${NC}           ${CYAN}║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Pause function
pause() {
    echo ""
    echo -e "${CYAN}Press Enter to continue...${NC}"
    read -r
}

# Function to show a menu and get user choice
show_menu() {
    local title="$1"
    shift
    local options=("$@")
    
    echo -e "${BOLD}${title}${NC}"
    echo ""
    
    local i=1
    for option in "${options[@]}"; do
        echo -e "  ${GREEN}${i})${NC} ${option}"
        ((i++))
    done
    
    echo ""
    echo -e "${YELLOW}Enter your choice (1-${#options[@]})${NC}: "
    read -r choice
    
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#options[@]}" ]; then
        return "$choice"
    else
        echo -e "${RED}Invalid choice. Please try again.${NC}"
        pause
        return 0
    fi
}

# Function to check Git status
check_git_status() {
    clear_screen
    echo -e "${BOLD}📊 Current Git Status${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    git status
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    pause
}

# Function to check for conflicts
check_for_conflicts() {
    local conflicts=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")
    
    if [ -n "$conflicts" ]; then
        echo -e "${RED}⚠️  Found unresolved conflicts:${NC}"
        echo ""
        echo "$conflicts" | while read -r file; do
            echo -e "  ${YELLOW}▸${NC} $file"
        done
        echo ""
        return 1
    else
        echo -e "${GREEN}✅ No unresolved conflicts found${NC}"
        echo ""
        return 0
    fi
}

# Function to resolve the "three file problem"
resolve_three_files() {
    clear_screen
    echo -e "${BOLD}🔧 Quick Fix: Three File Problem${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "This will resolve conflicts in:"
    echo -e "  ${YELLOW}▸${NC} .replit"
    echo -e "  ${YELLOW}▸${NC} replit.nix"
    echo -e "  ${YELLOW}▸${NC} package-lock.json"
    echo ""
    echo -e "${YELLOW}Which version do you want to keep?${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} Keep YOUR version (what's currently in Replit)"
    echo -e "  ${GREEN}2)${NC} Keep THEIR version (what's in GitHub)"
    echo -e "  ${GREEN}3)${NC} Auto-backup YOUR version, then accept GitHub's (RECOMMENDED) 📦"
    echo -e "  ${GREEN}4)${NC} Cancel"
    echo ""
    read -p "Enter choice (1-4): " choice
    
    case $choice in
        1)
            echo ""
            echo -e "${BLUE}➤ Keeping your local versions...${NC}"
            
            # Check if files exist and have conflicts
            for file in .replit replit.nix; do
                if [ -f "$file" ]; then
                    git checkout --ours "$file" 2>/dev/null || echo "  ℹ️  $file not in conflict"
                fi
            done
            
            echo -e "${BLUE}➤ Regenerating package-lock.json...${NC}"
            if [ -f "package-lock.json" ]; then
                rm -f package-lock.json
                npm install
            fi
            
            echo ""
            echo -e "${GREEN}✅ Fixed! Now staging files...${NC}"
            git add .replit replit.nix package-lock.json 2>/dev/null || true
            
            echo ""
            echo -e "${GREEN}✅ Files are ready to commit${NC}"
            pause
            ;;
        2)
            echo ""
            echo -e "${BLUE}➤ Keeping GitHub's versions...${NC}"
            
            for file in .replit replit.nix package-lock.json; do
                if [ -f "$file" ]; then
                    git checkout --theirs "$file" 2>/dev/null || echo "  ℹ️  $file not in conflict"
                fi
            done
            
            echo ""
            echo -e "${GREEN}✅ Fixed! Now staging files...${NC}"
            git add .replit replit.nix package-lock.json 2>/dev/null || true
            
            echo ""
            echo -e "${YELLOW}⚠️  Remember to test that Replit still runs correctly!${NC}"
            pause
            ;;
        3)
            echo ""
            echo -e "${BLUE}➤ Running auto-backup script...${NC}"
            echo ""
            if [ -f "scripts/auto-backup-and-accept-remote.sh" ]; then
                ./scripts/auto-backup-and-accept-remote.sh
            else
                echo -e "${RED}Error: auto-backup-and-accept-remote.sh not found${NC}"
            fi
            pause
            ;;
        4)
            echo -e "${YELLOW}Cancelled${NC}"
            pause
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            pause
            ;;
    esac
}

# Function to resolve a specific file
resolve_specific_file() {
    clear_screen
    echo -e "${BOLD}📝 Resolve Specific File${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Get list of conflicted files
    local conflicts=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")
    
    if [ -z "$conflicts" ]; then
        echo -e "${GREEN}✅ No conflicted files found${NC}"
        pause
        return
    fi
    
    echo "Conflicted files:"
    echo ""
    
    # Convert to array
    local files=()
    while IFS= read -r file; do
        files+=("$file")
    done <<< "$conflicts"
    
    # Display files
    local i=1
    for file in "${files[@]}"; do
        echo -e "  ${GREEN}${i})${NC} $file"
        ((i++))
    done
    
    echo -e "  ${GREEN}${i})${NC} Back to menu"
    
    echo ""
    read -p "Select file to resolve (1-${i}): " choice
    
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -lt "$i" ]; then
        local selected_file="${files[$((choice-1))]}"
        
        clear_screen
        echo -e "${BOLD}Resolving: ${selected_file}${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${YELLOW}What do you want to do?${NC}"
        echo ""
        echo -e "  ${GREEN}1)${NC} Keep YOUR version (current)"
        echo -e "  ${GREEN}2)${NC} Keep THEIR version (incoming)"
        echo -e "  ${GREEN}3)${NC} Edit manually in Replit"
        echo -e "  ${GREEN}4)${NC} Show the conflicts"
        echo -e "  ${GREEN}5)${NC} Cancel"
        echo ""
        read -p "Enter choice (1-5): " action
        
        case $action in
            1)
                git checkout --ours "$selected_file"
                git add "$selected_file"
                echo -e "${GREEN}✅ Kept your version and staged${NC}"
                pause
                ;;
            2)
                git checkout --theirs "$selected_file"
                git add "$selected_file"
                echo -e "${GREEN}✅ Kept their version and staged${NC}"
                pause
                ;;
            3)
                echo ""
                echo -e "${CYAN}Opening file info...${NC}"
                echo ""
                echo "File: $selected_file"
                echo ""
                echo "Look for these conflict markers:"
                echo -e "  ${RED}<<<<<<< HEAD${NC} (your version starts)"
                echo -e "  ${YELLOW}=======${NC} (separator)"
                echo -e "  ${RED}>>>>>>> branch-name${NC} (their version ends)"
                echo ""
                echo "Edit the file in Replit's editor, remove the markers,"
                echo "and keep the code you want."
                echo ""
                echo "When done, come back here and choose 'Stage resolved files'"
                pause
                ;;
            4)
                echo ""
                echo -e "${CYAN}Showing conflicts in ${selected_file}:${NC}"
                echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                git diff "$selected_file" || cat "$selected_file"
                echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                pause
                ;;
            5)
                echo -e "${YELLOW}Cancelled${NC}"
                pause
                ;;
            *)
                echo -e "${RED}Invalid choice${NC}"
                pause
                ;;
        esac
    fi
}

# Function to pull from GitHub
pull_from_github() {
    clear_screen
    echo -e "${BOLD}⬇️  Pull from GitHub${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
        echo ""
        echo "What do you want to do?"
        echo ""
        echo -e "  ${GREEN}1)${NC} Stash changes and pull"
        echo -e "  ${GREEN}2)${NC} Commit changes first"
        echo -e "  ${GREEN}3)${NC} Cancel"
        echo ""
        read -p "Enter choice (1-3): " choice
        
        case $choice in
            1)
                echo ""
                echo -e "${BLUE}➤ Stashing changes...${NC}"
                git stash save "Auto-stash before pull $(date)"
                echo -e "${GREEN}✅ Changes stashed${NC}"
                echo ""
                ;;
            2)
                echo ""
                read -p "Enter commit message: " msg
                git add .
                git commit -m "$msg"
                echo -e "${GREEN}✅ Changes committed${NC}"
                echo ""
                ;;
            3)
                echo -e "${YELLOW}Cancelled${NC}"
                pause
                return
                ;;
        esac
    fi
    
    echo -e "${BLUE}➤ Fetching from GitHub...${NC}"
    git fetch origin
    
    echo ""
    echo -e "${BLUE}➤ Pulling changes...${NC}"
    
    if git pull origin main; then
        echo ""
        echo -e "${GREEN}✅ Pull successful!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Pull failed - probably due to conflicts${NC}"
        echo ""
        echo "Use the conflict resolution options in the main menu"
    fi
    
    pause
}

# Function to push to GitHub
push_to_github() {
    clear_screen
    echo -e "${BOLD}⬆️  Push to GitHub${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Check if there are uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
        echo ""
        read -p "Commit message: " msg
        
        if [ -z "$msg" ]; then
            echo -e "${RED}Commit message cannot be empty${NC}"
            pause
            return
        fi
        
        git add .
        git commit -m "$msg"
        echo -e "${GREEN}✅ Changes committed${NC}"
        echo ""
    fi
    
    echo -e "${BLUE}➤ Pushing to GitHub...${NC}"
    
    # Get current branch
    local branch=$(git rev-parse --abbrev-ref HEAD)
    
    if git push origin "$branch"; then
        echo ""
        echo -e "${GREEN}✅ Push successful!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Push failed${NC}"
        echo ""
        echo -e "${YELLOW}Common reasons:${NC}"
        echo "  • Remote has changes you don't have (try pull first)"
        echo "  • Merge conflicts need to be resolved"
        echo "  • Authentication issues"
    fi
    
    pause
}

# Function to stage resolved files
stage_resolved_files() {
    clear_screen
    echo -e "${BOLD}✓ Stage Resolved Files${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Show current status
    git status --short
    
    echo ""
    echo -e "${YELLOW}Stage all files?${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} Yes, stage everything"
    echo -e "  ${GREEN}2)${NC} No, let me choose"
    echo -e "  ${GREEN}3)${NC} Cancel"
    echo ""
    read -p "Enter choice (1-3): " choice
    
    case $choice in
        1)
            git add .
            echo ""
            echo -e "${GREEN}✅ All files staged${NC}"
            pause
            ;;
        2)
            echo ""
            echo -e "${CYAN}Use 'git add <file>' in Replit shell to stage specific files${NC}"
            pause
            ;;
        3)
            echo -e "${YELLOW}Cancelled${NC}"
            pause
            ;;
    esac
}

# Function to commit changes
commit_changes() {
    clear_screen
    echo -e "${BOLD}💾 Commit Changes${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Check if there are staged changes
    if git diff --cached --quiet; then
        echo -e "${YELLOW}⚠️  No staged changes to commit${NC}"
        echo ""
        echo "Use 'Stage resolved files' first"
        pause
        return
    fi
    
    # Show what will be committed
    echo "Files to be committed:"
    echo ""
    git diff --cached --name-only | while read -r file; do
        echo -e "  ${GREEN}▸${NC} $file"
    done
    
    echo ""
    read -p "Enter commit message: " msg
    
    if [ -z "$msg" ]; then
        echo -e "${RED}Commit message cannot be empty${NC}"
        pause
        return
    fi
    
    if git commit -m "$msg"; then
        echo ""
        echo -e "${GREEN}✅ Changes committed successfully!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Commit failed${NC}"
    fi
    
    pause
}

# Function to view documentation
view_docs() {
    clear_screen
    echo -e "${BOLD}📚 Documentation${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Available documentation:"
    echo ""
    echo -e "  ${GREEN}1)${NC} Quick Reference Card"
    echo -e "  ${GREEN}2)${NC} Three File Problem Guide"
    echo -e "  ${GREEN}3)${NC} Complete Merge Conflict Guide"
    echo -e "  ${GREEN}4)${NC} Replit Git Workflow Guide"
    echo -e "  ${GREEN}5)${NC} Implementation Summary"
    echo -e "  ${GREEN}6)${NC} Back to menu"
    echo ""
    read -p "Select document (1-6): " choice
    
    case $choice in
        1)
            if [ -f "docs/MERGE_CONFLICT_QUICK_REF.md" ]; then
                less docs/MERGE_CONFLICT_QUICK_REF.md
            else
                echo -e "${RED}File not found${NC}"
            fi
            ;;
        2)
            if [ -f "docs/THREE_FILE_PROBLEM.md" ]; then
                less docs/THREE_FILE_PROBLEM.md
            else
                echo -e "${RED}File not found${NC}"
            fi
            ;;
        3)
            if [ -f "docs/MERGE_CONFLICT_RESOLUTION.md" ]; then
                less docs/MERGE_CONFLICT_RESOLUTION.md
            else
                echo -e "${RED}File not found${NC}"
            fi
            ;;
        4)
            if [ -f "docs/REPLIT_GIT_WORKFLOW.md" ]; then
                less docs/REPLIT_GIT_WORKFLOW.md
            else
                echo -e "${RED}File not found${NC}"
            fi
            ;;
        5)
            if [ -f "docs/MERGE_CONFLICT_IMPLEMENTATION_SUMMARY.md" ]; then
                less docs/MERGE_CONFLICT_IMPLEMENTATION_SUMMARY.md
            else
                echo -e "${RED}File not found${NC}"
            fi
            ;;
        6)
            return
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            pause
            ;;
    esac
}

# Function to run conflict checker
run_conflict_checker() {
    clear_screen
    echo -e "${BOLD}🔍 Running Conflict Checker${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    if [ -f "scripts/check-merge-conflicts.sh" ]; then
        ./scripts/check-merge-conflicts.sh
    else
        echo -e "${RED}Conflict checker script not found${NC}"
    fi
    
    pause
}

# Main menu
main_menu() {
    while true; do
        clear_screen
        
        echo -e "${BOLD}Main Menu${NC}"
        echo ""
        echo -e "  ${GREEN}1)${NC}  Check Git Status"
        echo -e "  ${GREEN}2)${NC}  Run Conflict Checker"
        echo -e "  ${GREEN}3)${NC}  Quick Fix: Three File Problem"
        echo -e "  ${GREEN}4)${NC}  Resolve Specific File"
        echo -e "  ${GREEN}5)${NC}  Pull from GitHub"
        echo -e "  ${GREEN}6)${NC}  Stage Resolved Files"
        echo -e "  ${GREEN}7)${NC}  Commit Changes"
        echo -e "  ${GREEN}8)${NC}  Push to GitHub"
        echo -e "  ${GREEN}9)${NC}  View Documentation"
        echo -e "  ${GREEN}10)${NC} Exit"
        echo ""
        
        # Show quick status
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}Quick Status:${NC}"
        
        if check_for_conflicts 2>/dev/null; then
            true  # Status already printed
        fi
        
        local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
        echo -e "Current branch: ${CYAN}${branch}${NC}"
        
        local staged=$(git diff --cached --name-only 2>/dev/null | wc -l)
        local unstaged=$(git diff --name-only 2>/dev/null | wc -l)
        echo -e "Staged files: ${GREEN}${staged}${NC} | Unstaged: ${YELLOW}${unstaged}${NC}"
        
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        
        read -p "Select option (1-10): " choice
        
        case $choice in
            1) check_git_status ;;
            2) run_conflict_checker ;;
            3) resolve_three_files ;;
            4) resolve_specific_file ;;
            5) pull_from_github ;;
            6) stage_resolved_files ;;
            7) commit_changes ;;
            8) push_to_github ;;
            9) view_docs ;;
            10)
                clear_screen
                echo -e "${GREEN}Thanks for using Meowstik Merge Helper! 🐱${NC}"
                echo ""
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid choice. Please try again.${NC}"
                pause
                ;;
        esac
    done
}

# Start the script
main_menu
