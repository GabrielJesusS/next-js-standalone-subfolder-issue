// Lives at the repo root while the app is built from ./web (`next build web`).
// That nested layout plus a custom cacheHandler and the standalone server triggers the bug.
module.exports = {
  output: 'standalone',
  cacheHandler: require.resolve('./web/cache-handler.js'),
  cacheMaxMemorySize: 0,
};
