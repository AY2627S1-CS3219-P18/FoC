/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Tests for the logging mock Order/Message clients (Phase 4 plan Task 10). No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { describe, expect, it, vi } from 'vitest';
import { createMockMessageClient, createMockOrderClient } from '../../src/worker/downstream.js';

describe('mock downstream clients', () => {
  it('log the call and succeed by default', async () => {
    const log = vi.fn();
    await createMockOrderClient({ log }).deleteUncollectedRequests(101);
    await createMockMessageClient({ log }).notifyAffected(101);
    expect(log).toHaveBeenCalledTimes(2);
    expect(String(log.mock.calls[0]?.[0])).toContain('101');
  });

  it('reject when forced to fail, so retries can be exercised', async () => {
    const log = vi.fn();
    await expect(createMockOrderClient({ fail: true, log }).deleteUncollectedRequests(101)).rejects.toThrow();
    await expect(createMockMessageClient({ fail: true, log }).notifyAffected(101)).rejects.toThrow();
  });
});
