/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated Vitest concurrency tests (real test DB) for PUT /users/:id/status, covering
 *        the Stage 9 concurrent-status Verification bullet in instructions.md.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added the concurrent PUT /users/:id/role test (Stage 10 Verification).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { CONCURRENT_REQUESTS as N, LOOP_ITERATIONS } from '../helpers/constants.js';
import { getRefreshTokens, getUserByEmail, seedRefreshToken, truncateAll } from '../helpers/db.js';
import { resetEmailMock } from '../helpers/email.js';
import {
  accessTokenFor,
  bearer,
  createActiveUser,
  createUserWithRole,
} from '../helpers/fixtures.js';

resetEmailMock();
beforeEach(truncateAll);
afterEach(truncateAll);

describe('concurrent PUT /users/:id/status', () => {
  it('different target statuses on the same user: no deadlock, no 500, one status wins', async () => {
    const admin = await createUserWithRole('admin', 'admin');
    const token = await accessTokenFor(admin);

    for (let i = 0; i < LOOP_ITERATIONS; i++) {
      const target = await createActiveUser(`target${i}`);
      await seedRefreshToken(target.id, `tok-${i}`);

      const statuses = Array.from({ length: N }, (_, k) => (k % 2 === 0 ? 'suspended' : 'active'));
      const rs = await Promise.all(
        statuses.map((status) =>
          request(app)
            .put(`/users/${target.id}/status`)
            .set('Authorization', bearer(token))
            .send({ status }),
        ),
      );

      expect(rs.filter((r) => r.status === 500)).toHaveLength(0);
      expect(rs.every((r) => r.status === 200)).toBe(true);

      // Exactly one final status, and it is one of the two requested.
      const finalStatus = (await getUserByEmail(target.email))!.status;
      expect(['active', 'suspended']).toContain(finalStatus);

      // A request that saw or set 'suspended' means the tokens were revoked in that same
      // locked transaction, so none may be left live.
      if (rs.some((r) => r.body.status === 'suspended')) {
        const tokens = await getRefreshTokens(target.id);
        expect(tokens.every((t) => t.is_revoked)).toBe(true);
      }
    }
  });
});

describe('concurrent PUT /users/:id/role', () => {
  it('different roles on the same target: no deadlock, no 500, one role wins', async () => {
    const superAdmin = await createUserWithRole('sa', 'super admin');
    const token = await accessTokenFor(superAdmin);

    for (let i = 0; i < LOOP_ITERATIONS; i++) {
      const target = await createActiveUser(`roletarget${i}`);
      await seedRefreshToken(target.id, `role-tok-${i}`);

      const roles = Array.from({ length: N }, (_, k) => (k % 2 === 0 ? 'admin' : 'user'));
      const rs = await Promise.all(
        roles.map((role) =>
          request(app)
            .put(`/users/${target.id}/role`)
            .set('Authorization', bearer(token))
            .send({ role }),
        ),
      );

      expect(rs.filter((r) => r.status === 500)).toHaveLength(0);
      expect(rs.every((r) => r.status === 200)).toBe(true);

      const finalRole = (await getUserByEmail(target.email))!.role;
      expect(['admin', 'user']).toContain(finalRole);

      // The target started as 'user', so any response showing 'admin' means a promotion
      // committed, and it revoked the tokens in that same locked transaction.
      if (rs.some((r) => r.body.role === 'admin')) {
        const tokens = await getRefreshTokens(target.id);
        expect(tokens.every((t) => t.is_revoked)).toBe(true);
      }
    }
  });
});
