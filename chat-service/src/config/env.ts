/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented conversation listing.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented the team-specified message sending and realtime delivery.
 * Author review: tng wen xi
 */
import { z } from "zod";
const schema = z.object({
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_TLS: z.enum(["true", "false"]).default("false"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^mysql$/ }),
  USER_SERVICE_URL: z.url().default("http://user-service:3001"),
  CHAT_SERVICE_API_KEY: z.string().min(1),
});
export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  return schema.parse(source);
}

// AI-generated
export function redisConnectionOptions(env: ReturnType<typeof loadEnv>) {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    ...(env.REDIS_TLS === "true" ? { tls: {} } : {}),
  };
}
