/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Added the MinIO test Vitest config from the Phase 2 plan (Task 2).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { defineConfig } from 'vitest/config';

// Tests that need the local photo store (compose.photo-store.yaml) to be running.
export default defineConfig({
  test: { include: ['src/**/*.minio.test.ts'], testTimeout: 15_000 },
});
