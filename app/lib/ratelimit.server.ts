/**
 * Redis-backed true sliding-window rate limiter.
 *
 * Uses a sorted set per key where every member is a unique request ID and its
 * score is the hit timestamp in milliseconds.  On each request we:
 *   1. Remove all members whose score is older than the current window.
 *   2. Count remaining members — if >= limit, reject.
 *   3. Add the new member with score = now.
 *   4. Refresh the key TTL so idle keys expire automatically.
 *
 * All four operations run in a single MULTI/EXEC pipeline so the check-and-
 * increment is atomic.  This eliminates the burst-at-window-edge flaw of a
 * fixed-window counter.
 *
 * Usage:
 *   await rateLimit({ key: `login:${ip}`, limit: 10, windowSec: 900 });
 */

import { randomBytes } from "node:crypto";
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
  const redisKey = `rl:sw:${key}`;
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const windowStart = now - windowMs;

  try {
    // Atomic pipeline: prune → count → add → expire
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zcard(redisKey);
    pipeline.zadd(redisKey, now, `${now}-${randomBytes(6).toString("hex")}`);
    pipeline.expire(redisKey, windowSec + 1);

    const results = await pipeline.exec();
    // results[1] is [error, count] — the count BEFORE we added the new member
    const countBefore = (results?.[1]?.[1] as number) ?? 0;

    if (countBefore >= limit) {
      // Remove the member we just added since the request is rejected
      await redis.zremrangebyscore(redisKey, now, now);
      throw rateLimitResponse(Math.ceil(windowMs / 1000));
    }
  } catch (err) {
    // If Redis is unavailable, let the request through rather than blocking
    // all traffic. Re-throw only genuine rate-limit responses.
    if (err instanceof Response) throw err;
    // Redis error — fail open and continue
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

/**
 * Extract the best-effort client IP from the request headers.
 *
 * SECURITY: `x-forwarded-for` is set by proxies and can be spoofed by
 * clients unless you control every hop.  We read only the *last* entry in
 * the XFF chain (added by the edge/proxy closest to the server) rather than
 * the first (which a client can inject).  When running behind a trusted
 * reverse proxy (Nginx, Cloudflare, etc.) the last entry is reliable.
 * In development with no proxy the header is absent and we fall back to
 * "unknown".
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    // Take the LAST IP — the one appended by the actual trusted proxy
    const ips = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const last = ips[ips.length - 1];
    if (last) return last;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
