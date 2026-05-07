import { cleanEnv, port, str } from "envalid";

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),
  APP_NAME: str({ default: "Unihelper" }),
  PORT: port({ default: 3000 }),
  LOG_LEVEL: str({
    choices: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
    default: "info",
  }),
  DATABASE_URL: str({
    devDefault: "postgresql://postgres:postgres@localhost:5432/unihelper?schema=public",
  }),
  REDIS_URL: str({
    devDefault: "redis://localhost:6379",
  }),
  SESSION_SECRET: str({
    devDefault: "dev-session-secret-change-me",
  }),
});