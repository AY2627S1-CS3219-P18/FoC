/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: gpt-5.6-luna), date: 2026-09-28
 * Scope: Phase 0 Task 2 config loader; no requirements, architecture, schema, or API decisions made.
 * Author review: Congchen
 */

import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();

const envSchema = z.object({
  PORT: positiveInteger,
  NODE_ENV: z.enum(["development", "production", "test"]),
  DB_HOST: z.string().min(1),
  DB_PORT: positiveInteger,
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: positiveInteger,
  USER_SERVICE_URL: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`- ${issue.path.join(".") || "environment"}: ${issue.message}`);
  }
  process.exit(1);
}

const values = parsed.data;

export const config = Object.freeze({
  env: values.NODE_ENV,
  server: Object.freeze({ port: values.PORT }),
  db: Object.freeze({
    host: values.DB_HOST,
    port: values.DB_PORT,
    name: values.DB_NAME,
    user: values.DB_USER,
    password: values.DB_PASSWORD,
  }),
  redis: Object.freeze({ host: values.REDIS_HOST, port: values.REDIS_PORT }),
  userServiceUrl: values.USER_SERVICE_URL,
});
