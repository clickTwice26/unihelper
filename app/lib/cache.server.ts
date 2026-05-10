/**
 * cache.server.ts — Simple Redis cache-aside helper.
 *
 * Usage:
 *   const data = await cached("key", 30, () => db.course.findMany(...));
 *
 * - On a cache hit the serialized JSON is returned immediately.
 * - On a miss the factory function is called, the result is stored, and the
 *   result is returned.
 * - If Redis is unavailable, the factory is always called (fail-open).
 * - Call invalidateCache(key) after mutations to keep data fresh.
 */

import { redis } from "~/lib/redis.server";

export async function cached<T>(key: string, ttlSec: number, factory: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(`cache:${key}`);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // Redis unavailable — fall through to factory
  }

  const result = await factory();

  try {
    await redis.setex(`cache:${key}`, ttlSec, JSON.stringify(result));
  } catch {
    // Best-effort — if we can't cache, still return the result
  }

  return result;
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys.map((k) => `cache:${k}`));
  } catch {
    // Fail silently — stale data will expire on its own TTL
  }
}

/** Invalidate all cache keys matching a glob pattern. */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(`cache:${pattern}`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Fail silently
  }
}
