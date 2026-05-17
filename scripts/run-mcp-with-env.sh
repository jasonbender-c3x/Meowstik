#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${MEOWSTIK_ENV_FILE:-$ROOT_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: run-mcp-with-env.sh <command> [args...]" >&2
  exit 64
fi

command="$1"
shift

resolved_args=()
for arg in "$@"; do
  if [[ "$arg" =~ ^@ENV:([A-Za-z_][A-Za-z0-9_]*)$ ]]; then
    var_name="${BASH_REMATCH[1]}"
    if [[ -z "${!var_name+x}" ]]; then
      echo "Required environment variable $var_name is not set" >&2
      exit 1
    fi
    resolved_args+=("${!var_name}")
    continue
  fi

  resolved_args+=("$arg")
done

exec "$command" "${resolved_args[@]}"
