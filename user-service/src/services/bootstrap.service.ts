// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4e - super admin bootstrap
// Author review:

import bcrypt from 'bcrypt';
import { config } from '../config.js';
import * as userQueries from '../db/queries/users.queries.js';
import { PASSWORD_REGEX } from './auth.service.js';

const BCRYPT_WORK_FACTOR = 10;

export async function bootstrapSuperAdmin(): Promise<void> {
  const existing = await userQueries.findSuperAdmin();
  if (existing) {
    return;
  }

  if (!PASSWORD_REGEX.test(config.superAdmin.password)) {
    throw new Error(
      'SUPER_ADMIN_PASSWORD does not meet the required complexity: min 8 characters, with at least one uppercase, one lowercase, one digit and one special character.',
    );
  }

  const passwordHash = await bcrypt.hash(config.superAdmin.password, BCRYPT_WORK_FACTOR);

  await userQueries.createSuperAdmin({
    username: config.superAdmin.username.trim().toLowerCase(),
    email: config.superAdmin.email.trim().toLowerCase(),
    passwordHash,
  });

  console.log(`Super admin bootstrap: created super admin user '${config.superAdmin.username}'`);
}
