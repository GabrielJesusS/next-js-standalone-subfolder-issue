// Minimal in-memory cache handler. It only needs to load: if it does, the bug is not present.
const store = new Map();

module.exports = class CacheHandler {
  constructor() {
    console.log('[cache-handler] loaded');
  }

  async get(key) {
    return store.get(key) ?? null;
  }

  async set(key, data, ctx) {
    store.set(key, { value: data, lastModified: Date.now(), tags: ctx?.tags ?? [] });
  }

  async revalidateTag(tags) {
    const list = [tags].flat();
    for (const [key, entry] of store) {
      if (entry.tags.some((tag) => list.includes(tag))) store.delete(key);
    }
  }

  resetRequestCache() {}
};
