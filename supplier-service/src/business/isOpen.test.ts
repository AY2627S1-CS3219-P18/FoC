/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Unit tests for the is_open rules in SupplierServiceArchitecture.md §6.2, including the
 *        dedicated 00:00-23:59 check. No requirements, architecture, schema, or API decisions were
 *        made by the AI tool.
 * Author review:
 */
import { describe, expect, it } from 'vitest';
import { computeIsOpen } from './isOpen.js';

const at = (iso: string) => new Date(iso);
const monday9to18 = [{ dayOfWeek: 1, open: '09:00', close: '18:00' }];
const monday24h = [{ dayOfWeek: 1, open: '00:00', close: '23:59' }];

describe('computeIsOpen', () => {
  it('is open at any time on a day with a 00:00-23:59 entry', () => {
    expect(computeIsOpen(monday24h, at('2026-09-27T16:00:00Z'))).toBe(true); // Mon 00:00 SGT
    expect(computeIsOpen(monday24h, at('2026-09-28T02:00:00Z'))).toBe(true); // Mon 10:00
    expect(computeIsOpen(monday24h, at('2026-09-28T15:59:00Z'))).toBe(true); // Mon 23:59
  });

  it('does not extend a 00:00-23:59 entry to other days', () => {
    expect(computeIsOpen(monday24h, at('2026-09-29T02:00:00Z'))).toBe(false); // Tue 10:00
  });

  it('is closed with no hours entries', () => {
    expect(computeIsOpen([], at('2026-09-28T02:00:00Z'))).toBe(false);
  });

  it('is open inside a same-day interval in Singapore time', () => {
    expect(computeIsOpen(monday9to18, at('2026-09-28T02:00:00Z'))).toBe(true); // Mon 10:00 SGT
  });

  it('is open exactly at open_time and closed exactly at close_time', () => {
    expect(computeIsOpen(monday9to18, at('2026-09-28T01:00:00Z'))).toBe(true); // 09:00 SGT
    expect(computeIsOpen(monday9to18, at('2026-09-28T10:00:00Z'))).toBe(false); // 18:00 SGT
  });

  it('is closed before opening', () => {
    expect(computeIsOpen(monday9to18, at('2026-09-28T00:59:00Z'))).toBe(false); // 08:59 SGT
  });

  it('is closed on a day with no hours row', () => {
    expect(computeIsOpen(monday9to18, at('2026-09-29T02:00:00Z'))).toBe(false); // Tue 10:00 SGT
  });

  it('uses Singapore time, not UTC, to pick the day', () => {
    // Sun 16:30 UTC is already Mon 00:30 SGT; a Monday 00:00-02:00 row must match.
    const early = [{ dayOfWeek: 1, open: '00:00', close: '02:00' }];
    expect(computeIsOpen(early, at('2026-09-27T16:30:00Z'))).toBe(true);
  });

  it('continues an overnight interval into the next day', () => {
    const overnight = [{ dayOfWeek: 1, open: '22:00', close: '02:00' }];
    expect(computeIsOpen(overnight, at('2026-09-28T15:30:00Z'))).toBe(true); // Mon 23:30
    expect(computeIsOpen(overnight, at('2026-09-28T17:00:00Z'))).toBe(true); // Tue 01:00
    expect(computeIsOpen(overnight, at('2026-09-28T18:00:00Z'))).toBe(false); // Tue 02:00
  });

  it('does not apply an overnight row to the day before it starts', () => {
    const overnight = [{ dayOfWeek: 1, open: '22:00', close: '02:00' }];
    expect(computeIsOpen(overnight, at('2026-09-27T17:00:00Z'))).toBe(false); // Mon 01:00
  });

  it('wraps an overnight Saturday interval into Sunday', () => {
    const satNight = [{ dayOfWeek: 6, open: '22:00', close: '02:00' }];
    expect(computeIsOpen(satNight, at('2026-09-26T17:00:00Z'))).toBe(true); // Sun 01:00
  });

  it('never counts a zero-length interval as open', () => {
    const zero = [{ dayOfWeek: 1, open: '09:00', close: '09:00' }];
    expect(computeIsOpen(zero, at('2026-09-28T02:00:00Z'))).toBe(false);
  });
});
