import "dotenv/config";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { isAppError } from "./lib/errors";
import achievementRoutes from "./routes/achievementRoutes";
import syncRoutes from "./routes/syncRoutes";
import webhookRoutes from "./routes/webhookRoutes";

const app = express();
const port = Number(process.env.PORT) || 5050;
const corsOrigin = process.env.CORS_ORIGIN ?? "*";

app.use(
  cors({
    origin:
      corsOrigin === "*"
        ? true
        : corsOrigin.split(",").map((origin) => origin.trim()),
    credentials: false,
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
      details: error.details ?? null,
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
