"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const achievementService_1 = require("../services/achievementService");
const router = (0, express_1.Router)();
router.post("/analyze", async (req, res, next) => {
    try {
        const username = typeof req.body?.username === "string" ? req.body.username : "";
        const token = typeof req.body?.token === "string" ? req.body.token : undefined;
        const forceRefresh = Boolean(req.body?.forceRefresh);
        const result = await (0, achievementService_1.analyzeAchievementProgress)({
            username,
            token,
            forceRefresh,
        });
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get("/analyze/:username", async (req, res, next) => {
    try {
        const result = await (0, achievementService_1.analyzeAchievementProgress)({
            username: req.params.username,
            forceRefresh: req.query.forceRefresh === "true",
        });
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=achievementRoutes.js.map