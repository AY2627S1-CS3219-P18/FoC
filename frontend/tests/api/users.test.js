/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-04
 * Scope: Test for getFullEmail (GET /users/:id/full-email), per instructions.md Stage 20b.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-06
 * Scope: Stage 26c/26e - getFullEmail is now POST with a reason body, replacing the GET call.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-06
 * Scope: Per author direction in chat (instructions.md Stage 26 "Reasons" amendment):
 *        getFullEmail no longer takes or sends a reason; its request body is now empty.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api/http', () => ({ request: vi.fn() }))

import { request } from '../../src/api/http'
import { getFullEmail } from '../../src/api/users'

describe('getFullEmail', () => {
  it('calls POST /users/:id/full-email with no body and returns the response', async () => {
    request.mockResolvedValueOnce({ email: 'alice@example.com' })

    const result = await getFullEmail('user-1')

    expect(request).toHaveBeenCalledWith('/users/user-1/full-email', {
      method: 'POST',
      json: {},
    })
    expect(result).toEqual({ email: 'alice@example.com' })
  })
})
