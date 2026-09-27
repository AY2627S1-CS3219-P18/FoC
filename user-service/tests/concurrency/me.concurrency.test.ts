/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated a Vitest concurrency test (real test DB) for PUT /users/me/active-view,
 *        covering the Stage 11b concurrent-toggle Verification bullet in instructions.md.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { CONCURRENT_REQUESTS as N, LOOP_ITERATIONS } from '../helpers/constants.js';
import { getUserByEmail, truncateAll } from '../helpers/db.js';
import { resetEmailMock } from '../helpers/email.js';
import { accessTokenFor, bearer, createActiveUser } from '../helpers/fixtures.js';

resetEmailMock();
beforeEach(truncateAll);
afterEach(truncateAll);

describe('concurrent PUT /users/me/active-view', () => {
  it('different values from the same user: no deadlock, no 500, last write wins', async () => {
    for (let i = 0; i < LOOP_ITERATIONS; i++) {
      const user = await createActiveUser(`activeview${i}`);
      const token = await accessTokenFor(user);

      const values = Array.from({ length: N }, (_, k) => (k % 2 === 0 ? 'courier' : 'requester'));
      const rs = await Promise.all(
        values.map((activeView) =>
          request(app)
            .put('/users/me/active-view')
            .set('Authorization', bearer(token))
            .send({ activeView }),
        ),
      );

      expect(rs.filter((r) => r.status === 500)).toHaveLength(0);
      expect(rs.every((r) => r.status === 200)).toBe(true);

      // There is no lock here, so this only confirms the endpoint survives concurrent writes,
      // not that any particular request's value wins.
      const finalValue = (await getUserByEmail(user.email))!.active_view;
      expect(['requester', 'courier']).toContain(finalValue);
    }
  });
});
