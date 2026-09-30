/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: MySQL implementation of DeadLetterRepository (Phase 4 plan Task 9). No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type { Pool } from 'mysql2/promise';
import type { DeadLetterRepository } from './deadLetterRepository.js';

export function createMysqlDeadLetterRepository(pool: Pool): DeadLetterRepository {
  return {
    async insert(entry) {
      await pool.query(
        `INSERT INTO dead_letter_jobs (job_id, task_name, payload, error_trace, failed_at)
         VALUES (?, ?, CAST(? AS JSON), ?, ?)`,
        [entry.jobId, entry.taskName, JSON.stringify(entry.payload), entry.errorTrace, entry.failedAt],
      );
    },
  };
}
