import { db } from "~/lib/db.server";
import { redis } from "~/lib/redis.server";

type DependencyStatus = {
  latencyMs: number;
  status: "ok" | "error";
  error?: string;
};

type ReadinessReport = {
  app: string;
  status: "ok" | "degraded";
  checks: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
  };
};

async function timeCheck(check: () => Promise<void>): Promise<DependencyStatus> {
  const startedAt = performance.now();

  try {
    await check();

    return {
      latencyMs: Math.round(performance.now() - startedAt),
      status: "ok",
    };
  } catch (error) {
    return {
      latencyMs: Math.round(performance.now() - startedAt),
      status: "error" as const,
      // Strip raw error messages in production to avoid leaking internal details
      // (connection strings, hostnames, etc.) to unauthenticated callers.
      error:
        process.env.NODE_ENV === "production"
          ? "Dependency check failed"
          : error instanceof Error
            ? error.message
            : "Unknown dependency failure",
    };
  }
}

export async function getReadinessReport(): Promise<ReadinessReport> {
  const [postgres, redisCheck] = await Promise.all([
    timeCheck(async () => {
      await db.$queryRaw`SELECT 1`;
    }),
    timeCheck(async () => {
      if (redis.status !== "ready") {
        await redis.connect();
      }

      const response = await redis.ping();

      if (response !== "PONG") {
        throw new Error("Unexpected Redis ping response");
      }
    }),
  ]);

  return {
    app: "unihelper",
    status:
      postgres.status === "ok" && redisCheck.status === "ok" ? "ok" : "degraded",
    checks: {
      postgres,
      redis: redisCheck,
    },
  };
}