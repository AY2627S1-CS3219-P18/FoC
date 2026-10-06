/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Unit tests for list-query and path-id validation per SupplierServiceArchitecture.md §7.2
 *        and §7.1.1. No requirements, architecture, schema, or API decisions were made by the AI
 *        tool.
 * Author review:
 */
import { describe, expect, it } from 'vitest';
import { AppError } from '../utils/AppError.js';
import { idParamSchema, listQuerySchema, parseOrThrow } from './supplierQuery.js';

function catchAppError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('expected an AppError');
}

describe('listQuerySchema via parseOrThrow', () => {
  it('applies defaults: page 1, sortOrder A-Z', () => {
    const q = parseOrThrow(listQuerySchema, {}, 'query');
    expect(q).toMatchObject({ page: 1, sortOrder: 'A-Z' });
  });

  it('coerces numeric strings and keeps filters', () => {
    const q = parseOrThrow(
      listQuerySchema,
      { page: '3', search: '  store ', location_id: '4', category_id: '2', sortOrder: 'Z-A', limit: '50' },
      'query',
    );
    expect(q).toMatchObject({ page: 3, search: 'store', location_id: 4, category_id: 2, sortOrder: 'Z-A' });
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('parses isOpen=%s', (raw, expected) => {
    expect(parseOrThrow(listQuerySchema, { isOpen: raw }, 'query').isOpen).toBe(expected);
  });

  it('leaves isOpen undefined when omitted', () => {
    expect(parseOrThrow(listQuerySchema, {}, 'query').isOpen).toBeUndefined();
  });

  it('rejects limit other than 50 with a 422 naming the field', () => {
    const err = catchAppError(() => parseOrThrow(listQuerySchema, { limit: '51' }, 'query'));
    expect(err.statusCode).toBe(422);
    expect(err.details?.[0]).toMatchObject({ field: 'limit', location: 'query' });
  });

  it.each([
    ['page', '0'],
    ['page', 'abc'],
    ['location_id', '-1'],
    ['category_id', 'x'],
    ['sortOrder', 'newest'],
    ['limit', '0'],
    ['isOpen', 'maybe'],
    ['isOpen', '1'],
  ])('rejects invalid %s=%s with 422', (field, value) => {
    const err = catchAppError(() => parseOrThrow(listQuerySchema, { [field]: value }, 'query'));
    expect(err.statusCode).toBe(422);
    expect(err.error).toBe('Unprocessable Entity');
    expect(err.details?.[0]?.field).toBe(field);
  });
});

describe('idParamSchema via parseOrThrow', () => {
  it('parses a positive integer id', () => {
    expect(parseOrThrow(idParamSchema, { id: '101' }, 'path')).toEqual({ id: 101 });
  });

  it.each(['0', 'abc', '1.5', '-3'])('rejects id=%s with 422', (id) => {
    const err = catchAppError(() => parseOrThrow(idParamSchema, { id }, 'path'));
    expect(err.statusCode).toBe(422);
    expect(err.details?.[0]).toMatchObject({ field: 'id', location: 'path' });
  });
});
