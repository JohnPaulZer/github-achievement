"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const syncEvents_1 = require("../lib/syncEvents");
const router = (0, express_1.Router)();
router.get("/events/:username", (req, res) => {
    const username = req.params.username?.trim();
    if (!username) {
        res.status(400).json({
            ok: false,
            code: "INVALID_USERNAME",
            message: "Username is required for sync channel.",
        });
        return;
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write("retry: 10000\n\n");
    const unsubscribe = (0, syncEvents_1.subscribeToUserSync)(username, res);
    req.on("close", () => {
        unsubscribe();
    });
});
exports.default = router;
//# sourceMappingURL=syncRoutes.js.map