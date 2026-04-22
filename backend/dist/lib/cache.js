"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedAnalyzeResult = getCachedAnalyzeResult;
exports.setCachedAnalyzeResult = setCachedAnalyzeResult;
exports.invalidateAnalyzeCacheByUsername = invalidateAnalyzeCacheByUsername;
exports.clearAnalyzeCache = clearAnalyzeCache;
const cache = new Map();
function pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt <= now) {
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
        cache.delete(key);
        return null;
    }
    return entry;
}
function setCachedAnalyzeResult(key, payload, ttlMs) {
    cache.set(key, {
        payload,
        expiresAt: Date.now() + ttlMs,
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