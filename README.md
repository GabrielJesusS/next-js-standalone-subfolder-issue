# Next.js: custom `cacheHandler` not found by the standalone server when the app is built from a subfolder

Minimal reproduction. An app built from a subfolder (`next build web`) with `output: 'standalone'`
and a custom `cacheHandler` answers **500 on every page** when started with the generated
standalone `server.js`:

```
Error: Cannot find module '<repo>/web/.next/standalone/cache-handler.js'
  imported from <repo>/web/.next/standalone/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js
code: 'ERR_MODULE_NOT_FOUND'
```

The handler exists at `web/.next/standalone/web/cache-handler.js`. Next looks for it one folder
too high: one level per segment of the subfolder (`web`), so two levels for an app in
`source/presentation`.

- **Introduced in:** `15.4.2-canary.15` (first stable release: **15.5.0**), by
  [#81944 "Remove extra base-server code"](https://github.com/vercel/next.js/pull/81944).
- **Last versions without it:** `15.4.2-canary.14` (canary) and **15.4.11** (stable).
- **Still present in:** 16.4.3 (latest stable) and the current canary.
- `next start web` is **not** affected; only the standalone server is.

## How to reproduce

Requirements: Node 20+ and npm.

```bash
npm ci
npm run check            # build + start standalone + request / and /dynamic
```

Expected output on the pinned `next@16.4.3`:

```
== next@16.4.3: building
== starting standalone server on :3100
   GET /         -> 500
   GET /dynamic  -> 500
   server log: Cannot find module '…/web/.next/standalone/cache-handler.js'
FAIL next@16.4.3: standalone returned 500/500 (bug reproduced)
```

By hand, the same steps are `npm run build`, then `npm run start:standalone`, then open
http://localhost:3100/.

### Test any version in this same repository

`check` takes a Next version. It installs that version (and a matching React) without changing
`package.json` or the lockfile; `npm ci` puts the pinned version back.

```bash
npm run check -- 15.4.11     # last stable without the bug  -> PASS
npm run check -- 15.5.0      # first stable with the bug    -> FAIL
npm run check -- canary      # current canary               -> FAIL
npm run matrix               # all versions below, then restores the pinned install
npm run matrix -- 15.4.2-canary.14 15.4.2-canary.15   # any list of versions
```

### Prove the root cause

```bash
npm ci
npm run fix      # replaces `||` with `??` in node_modules/next (opt-in, see below)
npm run check    # -> PASS on the same 16.4.3 build that failed
npm ci           # restores the original Next files
```

## How it works

| File | Role |
|---|---|
| `next.config.js` | At the **repo root**: `output: 'standalone'`, `cacheHandler: require.resolve('./web/cache-handler.js')` |
| `web/` | The Next app, built with `next build web`, so the app lives in a **subfolder** of the tracing root |
| `web/cache-handler.js` | Minimal in-memory cache handler; logs `[cache-handler] loaded` when Next constructs it |
| `web/app/page.js`, `web/app/dynamic/page.js` | One ISR page (`revalidate = 60`) and one `force-dynamic` page |
| `scripts/start-standalone.sh` | Copies `.next/static` next to the standalone `server.js` and runs it (port 3100) |
| `scripts/check.sh` | Optional version install, build, start, request both pages, print `PASS`/`FAIL` (exit 0/1) |
| `scripts/matrix.sh` | Runs `check.sh` for a list of versions and prints a summary |
| `scripts/apply-fix.js` | Opt-in: patches the one-character fix into `node_modules/next` to prove the cause |

The bug needs all three conditions together: the app built from a subfolder, a custom
`cacheHandler`, and the standalone `server.js`.

## Root cause

Since #81944, route modules resolve the project folder themselves
(`packages/next/src/server/route-modules/route-module.ts`):

```ts
const absoluteProjectDir = join(
  process.cwd(),
  getRequestMeta(req, 'relativeProjectDir') || this.relativeProjectDir
)
```

1. `next-server` sets the request meta to `path.relative(process.cwd(), this.dir)`. The standalone
   `server.js` runs `process.chdir(__dirname)` and passes `dir = __dirname`, so the value is `""`.
2. `""` is falsy, so `||` falls back to the build-time `relativeProjectDir` (`"web"`, from
   `__NEXT_RELATIVE_PROJECT_DIR`). `absoluteProjectDir` becomes `standalone/web/web` instead of
   `standalone/web`, and the relative `distDir` becomes `../.next` instead of `.next`.
3. The cache handler is loaded from `join(distDir, nextConfig.cacheHandler)`. `cacheHandler` was
   stored relative to the dist dir (`../cache-handler.js`), so the result is one folder too high.

**Fix:** use `??` instead of `||`, so an empty `relativeProjectDir` is kept:

```ts
getRequestMeta(req, 'relativeProjectDir') ?? this.relativeProjectDir
```

The same expression appears 5 times in `route-module.ts`. In the published package it is in
`dist/server/route-modules/route-module.js`, `dist/esm/…` and every
`dist/compiled/next-server/*.runtime.*.js`.

Before 15.4.2-canary.15 only `next-server` loaded the cache handler, from an absolute `distDir`
(`path.join(this.dir, distDir)`), so the subfolder layout worked.

## Results

Output of `npm run matrix` (Node 24.13.1, Linux, 2026-10-28):

| Next version | Result | `GET /` | `GET /dynamic` |
|---|---|---|---|
| 14.2.35 | PASS | 200 | 200 |
| 15.4.11 (last stable without the bug) | PASS | 200 | 200 |
| 15.4.2-canary.14 (last canary without the bug) | PASS | 200 | 200 |
| **15.4.2-canary.15** (first canary with the bug, includes #81944) | **FAIL** | 500 | 500 |
| **15.5.0** (first stable with the bug) | **FAIL** | 500 | 500 |
| 16.4.3 (latest stable) | FAIL | 500 | 500 |
| 16.5.0-canary.29 (`canary`) | FAIL | 500 | 500 |
| 16.4.3 + `npm run fix` (`||` → `??`) | PASS | 200 | 200 |
| 16.4.3 with `next start web` (no standalone) | works | 200 | 200 |

Every failing run logs the same error:
`Cannot find module '<repo>/web/.next/standalone/cache-handler.js'`.
