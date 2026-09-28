/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: gpt-5.6-luna), date: 2026-09-28
 * Scope: Generated Phase0 Task5 tests for SGT timestamp formatting.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { describe, expect, it } from 'vitest';
import { sgtTimestamp } from './time.js';

describe('sgtTimestamp', () => {
  it('formats a UTC date as an SGT timestamp', () => {
    expect(sgtTimestamp(new Date('2026-09-27T02:00:00.000Z'))).toBe(
      '2026-09-27T10:00:00+08:00',
    );
  });

  it('formats dates crossing midnight in Singapore correctly', () => {
    expect(sgtTimestamp(new Date('2026-09-27T17:30:00.000Z'))).toBe(
      '2026-09-28T01:30:00+08:00',
    );
  });
});
