#!/usr/bin/env sh
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
commit=${1:-HEAD}

if ! git -C "$repo_root" rev-parse --verify "$commit" >/dev/null 2>&1; then
  printf 'error: commit %s not found\n' "$commit" >&2
  exit 1
fi

printf 'Files in commit %s:\n' "$commit"
git -C "$repo_root" show --name-only --pretty=format:'' "$commit" | awk 'NF'
