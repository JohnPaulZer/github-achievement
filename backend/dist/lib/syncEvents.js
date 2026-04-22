"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToUserSync = subscribeToUserSync;
exports.publishSyncEventForUser = publishSyncEventForUser;
const subscribers = new Map();
function keyFor(username) {
    return username.toLowerCase();
}
function writeEvent(res, eventName, payload) {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
function subscribeToUserSync(username, res) {
    const key = keyFor(username);
    const bucket = subscribers.get(key) ?? new Set();
    bucket.add(res);
    subscribers.set(key, bucket);
    writeEvent(res, "connected", {
        username,
        timestamp: new Date().toISOString(),
    });
    const ping = setInterval(() => {
        writeEvent(res, "ping", {
            timestamp: new Date().toISOString(),
        });
    }, 25000);
    return () => {
        clearInterval(ping);
        const list = subscribers.get(key);
        if (!list) {
            return;
        }
        list.delete(res);
        if (list.size === 0) {
            subscribers.delete(key);
        }
    };
}
function publishSyncEventForUser(username, payload) {
    const key = keyFor(username);
    const list = subscribers.get(key);
    if (!list || list.size === 0) {
        return;
    }
    for (const res of list) {
        writeEvent(res, "refresh-needed", payload);
    }
}
//# sourceMappingURL=syncEvents.js.map