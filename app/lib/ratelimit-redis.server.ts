// Thin re-export of the shared Redis singleton for the rate-limiter.
// Keeping this separate means the rate-limiter can be tested/replaced
// without touching the main redis.server.ts.
export { redis } from "~/lib/redis.server";
