import "dotenv/config";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { AppError, isAppError } from "./lib/errors";
import achievementRoutes from "./routes/achievementRoutes";
import syncRoutes from "./routes/syncRoutes";
import webhookRoutes from "./routes/webhookRoutes";

const app = express();
const port = Number(process.env.PORT) || 5050;
const isProduction = process.env.NODE_ENV === "production";
const corsOrigin = process.env.CORS_ORIGIN?.trim();
const allowedCorsOrigins =
  corsOrigin && corsOrigin !== "*"
    ? corsOrigin
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
const rateLimitWindowMs = 5 * 60 * 1000;
const rateLimitMaxRequests = Number(process.env.API_RATE_LIMIT_MAX ?? 100);

if (isProduction && allowedCorsOrigins.length === 0) {
  throw new Error(
    "CORS_ORIGIN must be set to your frontend origin in production.",
  );
}

function sanitizeErrorDetails(error: AppError): unknown {
  if (!isProduction) {
    return error.details ?? null;
  }

  if (
    error.code === "GITHUB_RATE_LIMIT" &&
    error.details &&
    typeof error.details === "object"
  ) {
    const resetAt = (error.details as { resetAt?: unknown }).resetAt;
    return typeof resetAt === "string" ? { resetAt } : null;
  }

  return null;
}

app.disable("x-powered-by");
app.use(helmet());

app.use(
  cors({
    origin: allowedCorsOrigins.length > 0 ? allowedCorsOrigins : true,
    credentials: false,
  }),
);

app.use(
  "/api",
  rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait and try again.",
    },
  }),
);

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }),
);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/achievements", achievementRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/webhooks", webhookRoutes);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isAppError(error)) {
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
