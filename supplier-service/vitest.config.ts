/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated Vitest config that supplies the environment variables src/config.ts requires,
 *        using the values from .env.example, so tests can import config. No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      PORT: '3002',
      NODE_ENV: 'test',
      DB_HOST: 'supplier-db',
      DB_PORT: '3306',
      DB_NAME: 'supplier_service',
      DB_USER: 'root',
      DB_PASSWORD: 'supplier_root_password',
      REDIS_HOST: 'supplier-redis',
      REDIS_PORT: '6379',
      USER_SERVICE_URL: 'http://user-service:3001',
    },
  },
});
