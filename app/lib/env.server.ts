import { cleanEnv, port, str } from "envalid";

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),
  APP_NAME: str({ default: "UniBuddy" }),
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
  // Cloudflare R2 Storage
  R2_ACCOUNT_ID: str(),
  R2_ACCESS_KEY_ID: str(),
  R2_SECRET_ACCESS_KEY: str(),
  R2_BUCKET: str(),
  R2_ENDPOINT: str(),
  R2_PUBLIC_URL: str(),
});