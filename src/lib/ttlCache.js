// Memoises an async loader for ttlMs; concurrent callers share one load and
// a failed load is not cached.
export function cacheFor(ttlMs, load) {
  let value;
  let expiresAt = 0;
  let pending = null;

  return async function cached() {
    if (Date.now() < expiresAt) return value;
    pending ??= load()
      .then((loaded) => {
        value = loaded;
        expiresAt = Date.now() + ttlMs;
        return loaded;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}
