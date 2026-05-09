/**
 * Redis-backed sliding window rate limiter.
 *
 * Uses a fixed-window counter via INCR + EXPIRE.  On the first hit in a
 * window the key is created and its TTL is set; subsequent hits just
 * increment the counter.  When the limit is exceeded a 429 Response is
 * thrown so the caller can catch it or let it bubble up as an error boundary.
 *
 * Usage:
 *   await rateLimit({ key: `login:${ip}`, limit: 10, windowSec: 900 });
 */

import { redis } from "~/lib/ratelimit-redis.server";

export type RateLimitOptions = {
  /** Unique key for this bucket (e.g. "login:127.0.0.1") */
  key: string;
  /** Maximum allowed hits in the window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
};

export async function rateLimit({ key, limit, windowSec }: RateLimitOptions) {
  const redisKey = `rl:${key}`;

  try {
    const count = await redis.incr(redisKey);

    // Set expiry only on first hit so the window starts fresh
    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }

    if (count > limit) {
      const ttl = await redis.ttl(redisKey);
      throw rateLimitResponse(ttl > 0 ? ttl : windowSec);
    }
  } catch (err) {
    // If Redis is unavailable, let the request through rather than blocking
    // all traffic.  Re-throw only genuine rate-limit responses.
    if (err instanceof Response) throw err;
    // Redis error — log silently and continue
  }
}

function rateLimitResponse(retryAfterSec: number): Response {
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      "Retry-After": String(retryAfterSec),
      "Content-Type": "text/plain",
    },
  });
}

/** Extract the best-effort client IP from the request headers. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
