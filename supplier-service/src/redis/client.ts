/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: gpt-5.6-luna), date: 2026-09-28
 * Scope: Phase 0 Task 4 Redis scaffold; deferred job/cache workflows only.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Scope (2026-09-29, Claude Code, model: claude-sonnet-5): changed the ioredis import to the named
 *        `Redis` export to fix a TS2351 under NodeNext; no other change.
 * Author review: Congchen
 */

import { Redis } from "ioredis";

import { config } from "../config.js";

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

export default redis;
