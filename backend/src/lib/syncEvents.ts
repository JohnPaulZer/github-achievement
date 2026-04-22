import { Response } from "express";

type EventPayload = Record<string, unknown>;

const subscribers = new Map<string, Set<Response>>();

function keyFor(username: string): string {
  return username.toLowerCase();
}

function writeEvent(res: Response, eventName: string, payload: EventPayload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function subscribeToUserSync(
  username: string,
  res: Response,
): () => void {
  const key = keyFor(username);
  const bucket = subscribers.get(key) ?? new Set<Response>();
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

export function publishSyncEventForUser(
  username: string,
  payload: EventPayload,
) {
  const key = keyFor(username);
  const list = subscribers.get(key);
  if (!list || list.size === 0) {
    return;
  }

  for (const res of list) {
    writeEvent(res, "refresh-needed", payload);
  }
}
