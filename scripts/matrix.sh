#!/bin/sh
# Usage: npm run matrix [-- <version> ...]
# Runs check.sh for each version and prints a summary. Restores the pinned install at the end.
cd "$(dirname "$0")/.."
VERSIONS="${*:-14.2.35 15.4.11 15.4.2-canary.14 15.4.2-canary.15 15.5.0 16.4.3 canary}"
SUMMARY=""
for v in $VERSIONS; do
  echo
  out="$(sh scripts/check.sh "$v" 2>&1)"
  echo "$out"
  SUMMARY="$SUMMARY
$(echo "$out" | grep -E '^(PASS|FAIL|UNEXPECTED|BUILD FAILED)' | tail -1) [requested $v]"
done
echo
echo "== summary$SUMMARY"
echo
echo "== restoring the pinned install (npm ci)"
npm ci --no-audit --no-fund >/dev/null 2>&1 && echo "restored next@$(node -p "require('next/package.json').version")"
