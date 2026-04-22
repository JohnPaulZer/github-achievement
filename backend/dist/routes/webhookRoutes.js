"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const cache_1 = require("../lib/cache");
const syncEvents_1 = require("../lib/syncEvents");
const router = (0, express_1.Router)();
function verifyWebhookSignature(req) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
        return true;
    }
    const signatureHeader = req.header("x-hub-signature-256");
    const rawBody = req.rawBody;
    if (!signatureHeader || !rawBody) {
        return false;
    }
    const expected = `sha256=${crypto_1.default
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex")}`;
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
    }
    catch {
        return false;
    }
}
function collectPossibleUsernames(payload) {
    const names = new Set();
    const visited = new Set();
    function visit(value, depth) {
        if (!value || depth > 8) {
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                visit(item, depth + 1);
            }
            return;
        }
        if (typeof value !== "object") {
            return;
        }
        if (visited.has(value)) {
            return;
        }
        visited.add(value);
        const maybeLogin = value.login;
        if (typeof maybeLogin === "string" && maybeLogin.trim()) {
            names.add(maybeLogin.trim());
        }
        for (const nestedValue of Object.values(value)) {
            visit(nestedValue, depth + 1);
        }
    }
    visit(payload, 0);
    return [...names];
}
router.post("/github", async (req, res) => {
    if (!verifyWebhookSignature(req)) {
        res.status(401).json({
            ok: false,
            message: "Invalid webhook signature.",
        });
        return;
    }
    const payload = (req.body ?? {});
    const usernames = collectPossibleUsernames(payload);
    if (usernames.length > 0) {
        for (const username of usernames) {
            (0, cache_1.invalidateAnalyzeCacheByUsername)(username);
            (0, syncEvents_1.publishSyncEventForUser)(username, {
                username,
                reason: "webhook-event",
                timestamp: new Date().toISOString(),
            });
        }
    }
    else {
        (0, cache_1.clearAnalyzeCache)();
    }
    res.status(202).json({
        ok: true,
        invalidatedUsers: usernames,
    });
});
exports.default = router;
//# sourceMappingURL=webhookRoutes.js.map