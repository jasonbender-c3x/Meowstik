#!/usr/bin/env bash
# update-brain <project> <session-summary>
# Append today's session log to projects/<project>/sessions/<date>.md
# and update the last-modified line in BRAIN.md.
#
# Usage:
#   update-brain greplit "Fixed auth bug. Discussed Greplit pricing."
#
# Reads full content from stdin if no summary arg is provided.

set -euo pipefail

PROJECTS_DIR="$(cd "$(dirname "$0")/../../projects" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: update-brain <project> [summary]" >&2
  exit 1
fi

PROJECT="$1"
shift
BRAIN="$PROJECTS_DIR/$PROJECT/BRAIN.md"

if [[ ! -d "$PROJECTS_DIR/$PROJECT" ]]; then
  echo "Project '$PROJECT' not found." >&2
  exit 1
fi

TODAY=$(date -u +%Y-%m-%d)
SESSION_FILE="$PROJECTS_DIR/$PROJECT/sessions/$TODAY.md"
mkdir -p "$(dirname "$SESSION_FILE")"

# Build session content
{
  echo "# Session $TODAY"
  echo ""
  if [[ $# -gt 0 ]]; then
    echo "$*"
  else
    cat  # read from stdin
  fi
  echo ""
  echo "_Updated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")_"
} >> "$SESSION_FILE"

# Update last-modified in BRAIN.md
if [[ -f "$BRAIN" ]]; then
  sed -i "s/^_Last updated:.*/_Last updated: $TODAY_/" "$BRAIN" 2>/dev/null || true
fi

echo "✓ Session logged → $SESSION_FILE"
