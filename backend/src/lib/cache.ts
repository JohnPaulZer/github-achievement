import { CachedAnalyzeResult } from "../types";

const cache = new Map<string, CachedAnalyzeResult>();

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

export function getCachedAnalyzeResult(
  key: string,
): CachedAnalyzeResult | null {
  pruneExpired();
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry;
}

export function setCachedAnalyzeResult(
  key: string,
  payload: CachedAnalyzeResult["payload"],
  ttlMs: number,
) {
  cache.set(key, {
    payload,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateAnalyzeCacheByUsername(username: string) {
  const lookup = `${username.toLowerCase()}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(lookup)) {
      cache.delete(key);
    }
  }
}

export function clearAnalyzeCache() {
  cache.clear();
}
