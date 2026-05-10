import path from "node:path";
import pino from "pino";

import { env } from "~/lib/env.server";

// In production write to logs/app.log (append); in dev keep stdout for DX.
// pino/file transport uses a worker thread so it never blocks the event loop.
const transport =
  env.NODE_ENV === "production"
    ? pino.transport({
        target: "pino/file",
        options: {
          destination: path.resolve(process.cwd(), "logs/app.log"),
          mkdir: true,
          append: true,
          sync: false,
        },
      })
    : undefined;

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport,
);