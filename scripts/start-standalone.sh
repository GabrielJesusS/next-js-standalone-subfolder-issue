#!/bin/sh
# Runs the standalone output the way Next documents it: copy static assets next to
# server.js, then start it. With the app built from ./web and the tracing root at the
# repo root, the standalone server lives in web/.next/standalone/web/.
set -e
cd "$(dirname "$0")/.."
APP=web/.next/standalone/web
[ -f "$APP/server.js" ] || { echo "standalone server not found at $APP/server.js; run npm run build" >&2; exit 1; }
rm -rf "$APP/.next/static"
cp -r web/.next/static "$APP/.next/static"
[ -d web/public ] && cp -r web/public "$APP/public"
PORT="${PORT:-3100}" HOSTNAME=127.0.0.1 exec node "$APP/server.js"
