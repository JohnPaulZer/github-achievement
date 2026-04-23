import { CachedAnalyzeResult } from "../types";

const cache = new Map<string, CachedAnalyzeResult>();
const STALE_RETENTION_MS = 1000 * 60 * 60 * 6;

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.staleExpiresAt <= now) {
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
    return null;
  }

  return entry;
}

export function getMostRecentAnalyzeResult(
  key: string,
): CachedAnalyzeResult | null {
  pruneExpired();
  return cache.get(key) ?? null;
}

export function setCachedAnalyzeResult(
  key: string,
  payload: CachedAnalyzeResult["payload"],
  ttlMs: number,
) {
  const now = Date.now();
  cache.set(key, {
    payload,
    expiresAt: now + ttlMs,
    staleExpiresAt: now + Math.max(ttlMs, STALE_RETENTION_MS),
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
