#!/usr/bin/env bash
# brief-project [name]
# Print a 30-min catch-up brief for a project brain.
# With no args, lists available projects.

set -euo pipefail

PROJECTS_DIR="$(cd "$(dirname "$0")/../../projects" && pwd)"

if [[ $# -eq 0 ]]; then
  echo "Available projects:"
  for d in "$PROJECTS_DIR"/*/; do
    name=$(basename "$d")
    [[ "$name" == "_template" ]] && continue
    echo "  $name"
  done
  exit 0
fi

PROJECT="$1"
BRAIN="$PROJECTS_DIR/$PROJECT/BRAIN.md"

if [[ ! -f "$BRAIN" ]]; then
  echo "No BRAIN.md found for project '$PROJECT'" >&2
  echo "Available: $(ls "$PROJECTS_DIR" | grep -v _template | tr '\n' ' ')" >&2
  exit 1
fi

cat "$BRAIN"

# Also show latest session if it exists
SESSIONS_DIR="$PROJECTS_DIR/$PROJECT/sessions"
if [[ -d "$SESSIONS_DIR" ]]; then
  LATEST=$(ls -t "$SESSIONS_DIR"/*.md 2>/dev/null | head -1)
  if [[ -n "$LATEST" ]]; then
    echo ""
    echo "---"
    echo "## Latest session: $(basename "$LATEST" .md)"
    cat "$LATEST"
  fi
fi
