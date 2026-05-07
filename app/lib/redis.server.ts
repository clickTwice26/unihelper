import Redis from "ioredis";

import { env } from "~/lib/env.server";
import { logger } from "~/lib/logger.server";

const globalForRedis = globalThis as typeof globalThis & {
  redis?: Redis;
};

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    retryStrategy: () => null,
  });

redis.on("error", (error) => {
  logger.warn({ err: error }, "Redis connection error");
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}