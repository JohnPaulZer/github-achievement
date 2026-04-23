"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const errors_1 = require("./lib/errors");
const achievementRoutes_1 = __importDefault(require("./routes/achievementRoutes"));
const syncRoutes_1 = __importDefault(require("./routes/syncRoutes"));
const webhookRoutes_1 = __importDefault(require("./routes/webhookRoutes"));
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 5050;
const isProduction = process.env.NODE_ENV === "production";
const corsOrigin = process.env.CORS_ORIGIN?.trim();
const allowedCorsOrigins = corsOrigin && corsOrigin !== "*"
    ? corsOrigin
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
const rateLimitWindowMs = 5 * 60 * 1000;
const rateLimitMaxRequests = Number(process.env.API_RATE_LIMIT_MAX ?? 100);
if (isProduction && allowedCorsOrigins.length === 0) {
    throw new Error("CORS_ORIGIN must be set to your frontend origin in production.");
}
function sanitizeErrorDetails(error) {
    if (!isProduction) {
        return error.details ?? null;
    }
    if (error.code === "GITHUB_RATE_LIMIT" &&
        error.details &&
        typeof error.details === "object") {
        const resetAt = error.details.resetAt;
        return typeof resetAt === "string" ? { resetAt } : null;
    }
    return null;
}
app.disable("x-powered-by");
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: allowedCorsOrigins.length > 0 ? allowedCorsOrigins : true,
    credentials: false,
}));
app.use("/api", (0, express_rate_limit_1.default)({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        ok: false,
        code: "RATE_LIMITED",
        message: "Too many requests. Please wait and try again.",
    },
}));
app.use(express_1.default.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
        req.rawBody = Buffer.from(buffer);
    },
}));
app.get("/api/health", (_req, res) => {
    res.status(200).json({
        ok: true,
        service: "backend",
        timestamp: new Date().toISOString(),
    });
});
app.use("/api/achievements", achievementRoutes_1.default);
app.use("/api/sync", syncRoutes_1.default);
app.use("/api/webhooks", webhookRoutes_1.default);
app.use((error, _req, res, _next) => {
    if ((0, errors_1.isAppError)(error)) {
        res.status(error.statusCode).json({
            ok: false,
            code: error.code,
            message: error.message,
            details: sanitizeErrorDetails(error),
        });
        return;
    }
    console.error("Unhandled server error:", error);
    res.status(500).json({
        ok: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error occurred.",
    });
});
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map