/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: gpt-5.6-luna), date: 2026-09-28
 * Scope: Phase 0 Task 4 Redis scaffold; deferred job/cache workflows only.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import Redis from "ioredis";

import { config } from "../config.js";

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

export default redis;
