#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<EOF
Usage: $0 --threshold <MiB> [--mode warn|fail] [--dir <dist-dir>]

--threshold  Size threshold in MiB that triggers a warning or failure.
--mode       Determine behavior when threshold is hit: warn (default) or fail.
--dir        Directory containing the build output (default: dist).
EOF
  exit 1
}

THRESHOLD=""
MODE="warn"
DIR="dist"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --threshold)
      THRESHOLD="$2"
      shift 2
      ;;
    --mode)
      MODE="$2"
      shift 2
      ;;
    --dir)
      DIR="$2"
      shift 2
      ;;
    *)
      print_usage
      ;;
  esac
done

if [[ -z "$THRESHOLD" ]]; then
  echo "Missing --threshold argument" >&2
  print_usage
fi

if [[ ! -d "$DIR" ]]; then
  echo "'$DIR' not found or is not a directory" >&2
  exit 1
fi

size=$(du -sm "$DIR" | cut -f1)
printf "Total bundle size: %s MiB (threshold %s MiB)\n" "$size" "$THRESHOLD"
printf "Largest JS assets:\n"
find "$DIR" -type f -name '*.js' -print0 | xargs -0 du -h 2>/dev/null | sort -hr | head -n 5 || true

if [[ "$size" -gt "$THRESHOLD" ]]; then
  message="Bundle size $size MiB exceeds threshold $THRESHOLD MiB"
  if [[ "$MODE" == "fail" ]]; then
    echo "$message" >&2
    exit 1
  fi
  echo "WARNING: $message" >&2
fi
