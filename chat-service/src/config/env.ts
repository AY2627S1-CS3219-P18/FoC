/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented conversation listing.
 * Author review:
 */
import { z } from "zod";
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^mysql$/ }),
  USER_SERVICE_URL: z.url().default("http://user-service:3001"),
  CHAT_SERVICE_API_KEY: z.string().min(1),
});
export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  return schema.parse(source);
}
