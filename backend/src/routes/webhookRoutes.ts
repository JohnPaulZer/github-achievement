import crypto from "crypto";
import { Request, Router } from "express";
import {
  clearAnalyzeCache,
  invalidateAnalyzeCacheByUsername,
} from "../lib/cache";
import { publishSyncEventForUser } from "../lib/syncEvents";

const router = Router();

function verifyWebhookSignature(req: Request): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }

  const signatureHeader = req.header("x-hub-signature-256");
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!signatureHeader || !rawBody) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

function collectPossibleUsernames(payload: Record<string, unknown>): string[] {
  const names = new Set<string>();
  const visited = new Set<object>();

  function visit(value: unknown, depth: number) {
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

    const maybeLogin = (value as { login?: unknown }).login;
    if (typeof maybeLogin === "string" && maybeLogin.trim()) {
      names.add(maybeLogin.trim());
    }

    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
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

  const payload = (req.body ?? {}) as Record<string, unknown>;
  const usernames = collectPossibleUsernames(payload);

  if (usernames.length > 0) {
    for (const username of usernames) {
      invalidateAnalyzeCacheByUsername(username);
      publishSyncEventForUser(username, {
        username,
        reason: "webhook-event",
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    clearAnalyzeCache();
  }

  res.status(202).json({
    ok: true,
    invalidatedUsers: usernames,
  });
});

export default router;
