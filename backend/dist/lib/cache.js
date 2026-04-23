"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedAnalyzeResult = getCachedAnalyzeResult;
exports.getMostRecentAnalyzeResult = getMostRecentAnalyzeResult;
exports.setCachedAnalyzeResult = setCachedAnalyzeResult;
exports.invalidateAnalyzeCacheByUsername = invalidateAnalyzeCacheByUsername;
exports.clearAnalyzeCache = clearAnalyzeCache;
const cache = new Map();
const STALE_RETENTION_MS = 1000 * 60 * 60 * 6;
function pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (entry.staleExpiresAt <= now) {
            cache.delete(key);
        }
    }
}
function getCachedAnalyzeResult(key) {
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
function getMostRecentAnalyzeResult(key) {
    pruneExpired();
    return cache.get(key) ?? null;
}
function setCachedAnalyzeResult(key, payload, ttlMs) {
    const now = Date.now();
    cache.set(key, {
        payload,
        expiresAt: now + ttlMs,
        staleExpiresAt: now + Math.max(ttlMs, STALE_RETENTION_MS),
    });
}
function invalidateAnalyzeCacheByUsername(username) {
    const lookup = `${username.toLowerCase()}:`;
    for (const key of cache.keys()) {
        if (key.startsWith(lookup)) {
            cache.delete(key);
        }
    }
}
function clearAnalyzeCache() {
    cache.clear();
}
//# sourceMappingURL=cache.js.map