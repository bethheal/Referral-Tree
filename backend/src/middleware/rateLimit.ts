import { env } from "../config/env.ts";
import { HttpError } from "../utils/http.ts";

type WindowState = { count: number; resetAt: number };
const windows = new Map<string, WindowState>();
let lastPrunedAt = 0;

export const enforceRateLimit = (
  key: string,
  limit = env.rateLimitMaxRequests,
  windowMs = env.rateLimitWindowMs
) => {
  const now = Date.now();
  if (now - lastPrunedAt > windowMs) {
    for (const [entryKey, state] of windows) {
      if (state.resetAt <= now) windows.delete(entryKey);
    }
    lastPrunedAt = now;
  }

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  current.count += 1;
  if (current.count > limit) {
    throw new HttpError("Too many requests. Try again shortly.", 429, "RATE_LIMITED");
  }
};
