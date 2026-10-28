#!/bin/sh
# Usage: npm run check [-- <next version>]
# Builds the app, starts the standalone server, requests two pages and prints PASS or FAIL.
# With a version, installs that next (and a matching react) first, without touching
# package.json or the lockfile; `npm ci` restores the pinned version.
set -e
cd "$(dirname "$0")/.."
VERSION="$1"
PORT="${PORT:-3100}"
LOG="$(mktemp)"

if [ -n "$VERSION" ]; then
  case "$VERSION" in
    13.*|14.*) REACT=18.3.1 ;;
    *) REACT=19.2.0 ;;
  esac
  echo "== installing next@$VERSION (react@$REACT)"
  npm install --no-save --no-audit --no-fund "next@$VERSION" "react@$REACT" "react-dom@$REACT" >/dev/null 2>&1
fi
INSTALLED="$(node -p "require('next/package.json').version")"
echo "== next@$INSTALLED: building"
rm -rf web/.next
npx next build web >"$LOG.build" 2>&1 || { tail -20 "$LOG.build"; echo "BUILD FAILED"; exit 2; }

echo "== starting standalone server on :$PORT"
PORT="$PORT" sh scripts/start-standalone.sh >"$LOG" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
i=0
until curl -s -o /dev/null "http://127.0.0.1:$PORT/" || [ $i -ge 30 ]; do i=$((i + 1)); sleep 1; done

HOME_STATUS="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")"
DYNAMIC_STATUS="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/dynamic")"
sleep 1
kill $SERVER 2>/dev/null || true
wait $SERVER 2>/dev/null || true
trap - EXIT

echo "   GET /         -> $HOME_STATUS"
echo "   GET /dynamic  -> $DYNAMIC_STATUS"
MISSING="$(grep -o "Cannot find module '[^']*cache-handler.js'" "$LOG" | head -1 || true)"
[ -n "$MISSING" ] && echo "   server log: $MISSING"

if [ "$HOME_STATUS" = 200 ] && [ "$DYNAMIC_STATUS" = 200 ] && grep -q '\[cache-handler\] loaded' "$LOG"; then
  echo "PASS next@$INSTALLED: standalone served pages with the custom cache handler"
  exit 0
fi
if [ -n "$MISSING" ]; then
  echo "FAIL next@$INSTALLED: standalone returned $HOME_STATUS/$DYNAMIC_STATUS (bug reproduced)"
  exit 1
fi
echo "UNEXPECTED next@$INSTALLED: statuses $HOME_STATUS/$DYNAMIC_STATUS; server log:"
tail -20 "$LOG"
exit 3
