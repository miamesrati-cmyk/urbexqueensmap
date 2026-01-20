type Scheduler = (cb: () => void) => number;
type Cancel = (id: number) => void;

const hasWindow = typeof window !== "undefined";
const hasRIC = hasWindow && "requestIdleCallback" in window;

const schedule: Scheduler = (cb) => {
  if (!hasWindow) {
    const timeout = globalThis.setTimeout(() => cb(), 0);
    return typeof timeout === "number" ? timeout : Number(timeout);
  }
  if (hasRIC) {
    // @ts-expect-error requestIdleCallback exists when guard passes
    return window.requestIdleCallback(() => cb(), { timeout: 800 });
  }
  return window.setTimeout(() => cb(), 250);
};

const cancel: Cancel = (id) => {
  if (!hasWindow) {
    globalThis.clearTimeout(id);
    return;
  }
  if (hasRIC) {
    // @ts-expect-error cancelIdleCallback exists when guard passes
    window.cancelIdleCallback(id);
    return;
  }
  window.clearTimeout(id);
};

type DeferredOptions<T> = {
  key?: string;
  ttlMs?: number;
  timeoutMs?: number;
  immediateIfCached?: boolean;
};

type CacheEntry<T> = { value: T; expiresAt: number };

const pendingByKey = new Map<string, Promise<any>>();
const timerByKey = new Map<string, number>();
const cacheByKey = new Map<string, CacheEntry<any>>();

export function clearDeferredTaskCache(prefix?: string) {
  if (!prefix) {
    cacheByKey.clear();
    pendingByKey.clear();
    timerByKey.forEach((id) => cancel(id));
    timerByKey.clear();
    return;
  }
  for (const key of cacheByKey.keys()) {
    if (key.startsWith(prefix)) {
      cacheByKey.delete(key);
    }
  }
  for (const key of pendingByKey.keys()) {
    if (key.startsWith(prefix)) {
      pendingByKey.delete(key);
    }
  }
  for (const [key, id] of Array.from(timerByKey.entries())) {
    if (key.startsWith(prefix)) {
      cancel(id);
      timerByKey.delete(key);
    }
  }
}

/**
 * Schedules async work after render (idle/timeout), with optional dedupe key + TTL cache.
 * - If key is provided and a task is already pending, returns the same promise.
 * - If key is cached (ttlMs), returns the cached value immediately.
 */
export function scheduleDeferredTask<T>(
  work: () => Promise<T>,
  opts: DeferredOptions<T> = {}
): Promise<T> {
  const { key, ttlMs = 0, immediateIfCached = true } = opts;

  if (key && ttlMs > 0) {
    const cached = cacheByKey.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) {
      return immediateIfCached
        ? Promise.resolve(cached.value)
        : Promise.resolve(cached.value);
    }
    if (cached) {
      cacheByKey.delete(key);
    }
  }

  if (key) {
    const pending = pendingByKey.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }
  }

  const promise = new Promise<T>((resolve, reject) => {
    const id = schedule(() => {
      if (key) {
        timerByKey.delete(key);
      }
      work()
        .then((res) => {
          if (key && ttlMs > 0) {
            cacheByKey.set(key, { value: res, expiresAt: Date.now() + ttlMs });
          }
          resolve(res);
        })
        .catch(reject)
        .finally(() => {
          if (key) {
            pendingByKey.delete(key);
          }
        });
    });
    if (key) {
      timerByKey.set(key, id);
    }
  });

  if (key) {
    pendingByKey.set(key, promise);
  }

  return promise;
}
