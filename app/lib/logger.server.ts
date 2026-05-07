import pino from "pino";

import { env } from "~/lib/env.server";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});