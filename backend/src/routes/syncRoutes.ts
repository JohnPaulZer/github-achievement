import { Router } from "express";
import { subscribeToUserSync } from "../lib/syncEvents";

const router = Router();

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

  const unsubscribe = subscribeToUserSync(username, res);

  req.on("close", () => {
    unsubscribe();
  });
});

export default router;
