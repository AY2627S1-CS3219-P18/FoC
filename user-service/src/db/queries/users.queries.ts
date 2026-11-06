// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4b - user queries
// Author review:
// 25/09/2026: Stage 4e - super admin queries
// Author review:
// 25/09/2026: Stage 5a - optional db param, status param, lock/activate/stale-cleanup queries
// Author review:
// 25/09/2026: Stage 6d - updatePasswordHash
// Author review:
// 27/09/2026: Stage 9 - listAllUsers, updateUserStatus
// Author review:
// 27/09/2026: Stage 10 - updateUserRole
// Author review:
// 27/09/2026: Stage 11 - active_view on UserRow, updateActiveView
// Author review:
// 27/09/2026: Stage 12b - updateUsername
// Author review:
// 27/09/2026: Stage 12d - updateEmail
// Author review:
// 2026-10-19: findPublicSummariesByIds for the public lookup (GET /users/public).
//   No requirements, architecture, schema, or API decisions were made by the AI tool.
// Author review:
// 2026-10-22: Stage 15b - replaced listAllUsers with listUsersPage (paginated, filtered,
//   sorted). Governing decision: instructions.md Stage 15b.
//   No requirements, architecture, schema, or API decisions were made by the AI tool.
// Author review:
// 2026-11-04: Stage 18a/18b/18d - added the login-lockout columns to UserRow, lockUserByIdWithNow,
//   recordLoginFailure, lockLoginAccount, resetLoginLock, and the `locked` filter on
//   listUsersPage. Governing decision: instructions.md Stage 18.
//   No requirements, architecture, schema, or API decisions were made by the AI tool.
// Author review:
// 2026-11-04: Stage 20 - added findByIdWithNow, an unlocked read (no FOR UPDATE) alongside
//   clock_timestamp(), for the unmask-email actor lookup (NFR3.1.1), which needs the DB clock
//   for its log line but takes no lock since it writes no state. Governing decision:
//   instructions.md Stage 20.
//   No requirements, architecture, schema, or API decisions were made by the AI tool.
// Author review:
// 2026-11-06: Stage 26d - exported escapeLikePattern so auditLog.queries.ts's actor/target
//   filters can reuse it. No requirements, architecture, schema, or API decisions were made by
//   the AI tool.
// Author review:

import pool from "../pool.js";
import type { Queryable } from "../transaction.js";

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  status: "pending" | "active" | "suspended";
  role: "user" | "admin" | "super admin";
  active_view: "requester" | "courier";
  login_failed_attempts: number;
  login_failure_window_start: Date | null;
  login_locked_until: Date | null;
  login_lock_level: number;
}

export type UserRowWithNow = UserRow & { db_now: Date };

export async function createUser(
  {
    username,
    email,
    passwordHash,
    status,
  }: {
    username: string;
    email: string;
    passwordHash: string;
    status: "pending" | "active";
  },
  db: Queryable = pool,
): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `INSERT INTO users (username, email, password_hash, status) VALUES ($1, $2, $3, $4) RETURNING *`,
    [username, email, passwordHash, status],
  );
  return result.rows[0]!;
}

export async function findByUsername(
  username: string,
  db: Queryable = pool,
): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `SELECT * FROM users WHERE username = $1`,
    [username],
  );
  return result.rows[0] ?? null;
}

export async function findByEmail(
  email: string,
  db: Queryable = pool,
): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `SELECT * FROM users WHERE email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findById(
  userId: string,
  db: Queryable = pool,
): Promise<UserRow | null> {
  const result = await db.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [
    userId,
  ]);
  return result.rows[0] ?? null;
}

// Unlocked read plus the database's own clock, for callers that log a timestamp but take no
// lock (Stage 20's unmask-email actor lookup: a read with no state change).
export async function findByIdWithNow(
  userId: string,
  db: Queryable = pool,
): Promise<UserRowWithNow | null> {
  const result = await db.query<UserRowWithNow>(
    `SELECT *, clock_timestamp() AS db_now FROM users WHERE id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function findSuperAdmin(
  db: Queryable = pool,
): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `SELECT * FROM users WHERE role = 'super admin' LIMIT 1`,
  );
  return result.rows[0] ?? null;
}

export async function createSuperAdmin(
  {
    username,
    email,
    passwordHash,
  }: {
    username: string;
    email: string;
    passwordHash: string;
  },
  db: Queryable = pool,
): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
  `INSERT INTO users (username, email, password_hash, status, role)
   VALUES ($1, $2, $3, 'active', 'super admin')
   ON CONFLICT DO NOTHING
   RETURNING *`,
  [username, email, passwordHash],
);
  return result.rows[0] ?? null;
}

export async function lockUserById(
  userId: string,
  db: Queryable = pool,
): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `SELECT * FROM users WHERE id = $1 FOR UPDATE`,
    [userId],
  );
  return result.rows[0] ?? null;
}

// Same as lockUserById, plus the database's own clock so login-lockout decisions (Stage 18b)
// compare against the same clock that backdated test rows use, not the app server's clock.
export async function lockUserByIdWithNow(
  userId: string,
  db: Queryable = pool,
): Promise<UserRowWithNow | null> {
  const result = await db.query<UserRowWithNow>(
    `SELECT *, clock_timestamp() AS db_now FROM users WHERE id = $1 FOR UPDATE`,
    [userId],
  );
  return result.rows[0] ?? null;
}

// Call inside a transaction, against a row already locked with lockUserByIdWithNow.
// windowStart is null to start a fresh rolling window (the previous one had expired).
export async function recordLoginFailure(
  userId: string,
  { failedAttempts, windowStart }: { failedAttempts: number; windowStart: Date },
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `UPDATE users SET login_failed_attempts = $2, login_failure_window_start = $3,
       updated_at = NOW()
     WHERE id = $1`,
    [userId, failedAttempts, windowStart],
  );
}

// Call inside a transaction, against a row already locked with lockUserByIdWithNow.
// Also clears the failure counter/window: once locked, further attempts are rejected before
// reaching this point and do not extend it (Stage 18b), and a fresh window starts once the
// lock has passed.
export async function lockLoginAccount(
  userId: string,
  { lockedUntil, lockLevel }: { lockedUntil: Date; lockLevel: number },
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `UPDATE users SET login_failed_attempts = 0, login_failure_window_start = NULL,
       login_locked_until = $2, login_lock_level = $3, updated_at = NOW()
     WHERE id = $1`,
    [userId, lockedUntil, lockLevel],
  );
}

// A successful login, a correct current password on the email/password change endpoints, or
// an admin unlock all clear the failure count, the window and the escalation level (Stage 18b).
export async function resetLoginLock(userId: string, db: Queryable = pool): Promise<void> {
  await db.query(
    `UPDATE users SET login_failed_attempts = 0, login_failure_window_start = NULL,
       login_locked_until = NULL, login_lock_level = 0, updated_at = NOW()
     WHERE id = $1`,
    [userId],
  );
}

export async function activateUser(
  userId: string,
  db: Queryable = pool,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
    [userId],
  );
  return (result.rowCount ?? 0) > 0;
}


export async function deleteStalePendingUsers(
  { username, email }: { username: string; email: string },
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `DELETE FROM users
     WHERE id IN (
       SELECT id FROM users
       WHERE status = 'pending'
         AND (username = $1 OR email = $2)
         AND NOT EXISTS (
           SELECT 1 FROM users_otps o
           WHERE o.user_id = users.id AND o.expires_at > NOW()
         )
       FOR UPDATE SKIP LOCKED
     )`,
    [username, email],
  );
}

export async function updatePasswordHash(
  userId: string,
  passwordHash: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
    [userId, passwordHash],
  );
}

// Only id and username are selected, so no other column can reach a caller even by
// accident. Unknown ids simply do not come back.
export async function findPublicSummariesByIds(
  ids: string[],
  db: Queryable = pool,
): Promise<{ id: string; username: string }[]> {
  const result = await db.query<{ id: string; username: string }>(
    `SELECT id, username FROM users WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return result.rows;
}

const SORT_COLUMNS = {
  username: "username",
  email: "email",
  createdAt: "created_at",
} as const;

const SORT_DIRECTIONS = {
  asc: "ASC",
  desc: "DESC",
} as const;

// Escapes \, % and _ so a LIKE pattern built from user input matches those characters
// literally instead of as wildcards or the escape character itself. Exported for
// auditLog.queries.ts's actor/target filters (Stage 26d), which use the same technique.
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export interface ListUsersPageParams {
  usernameContains?: string;
  email?: string;
  status?: "pending" | "active" | "suspended";
  role?: "user" | "admin" | "super admin";
  locked?: boolean;
  sortBy: keyof typeof SORT_COLUMNS;
  sortDir: keyof typeof SORT_DIRECTIONS;
  limit: number;
  offset: number;
}

export async function listUsersPage(
  { usernameContains, email, status, role, locked, sortBy, sortDir, limit, offset }: ListUsersPageParams,
  db: Queryable = pool,
): Promise<{ rows: UserRow[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (usernameContains) {
    values.push(`%${escapeLikePattern(usernameContains)}%`);
    conditions.push(`username LIKE $${values.length} ESCAPE '\\'`);
  }
  if (email) {
    values.push(email);
    conditions.push(`email = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (role) {
    values.push(role);
    conditions.push(`role = $${values.length}`);
  }
  if (locked !== undefined) {
    conditions.push(locked ? `login_locked_until > NOW()` : `(login_locked_until IS NULL OR login_locked_until <= NOW())`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortColumn = SORT_COLUMNS[sortBy];
  const sortDirection = SORT_DIRECTIONS[sortDir];

  const result = await db.query<UserRow & { full_count: string }>(
    `SELECT *, COUNT(*) OVER() AS full_count FROM users
     ${whereClause}
     ORDER BY ${sortColumn} ${sortDirection}, id ${sortDirection}
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  if (result.rows.length > 0) {
    const total = Number(result.rows[0]!.full_count);
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      rows: result.rows.map(({ full_count, ...row }) => row),
      total,
    };
  }

  // A page past the end gets no rows from the window function above, so total
  // needs its own query here.
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM users ${whereClause}`,
    values,
  );
  return { rows: [], total: Number(countResult.rows[0]!.count) };
}

export async function updateUserStatus(
  userId: string,
  status: "active" | "suspended",
  db: Queryable = pool,
): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, status],
  );
  return result.rows[0]!;
}

// Call inside a transaction, against a row already locked with lockUserById.
export async function updateUserRole(
  userId: string,
  role: "admin" | "user",
  db: Queryable = pool,
): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, role],
  );
  return result.rows[0]!;
}

export async function updateUsername(
  userId: string,
  username: string,
  db: Queryable = pool,
): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `UPDATE users SET username = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, username],
  );
  return result.rows[0]!;
}

export async function updateEmail(
  userId: string,
  email: string,
  db: Queryable = pool,
): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `UPDATE users SET email = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, email],
  );
  return result.rows[0]!;
}

export async function updateActiveView(
  userId: string,
  activeView: "requester" | "courier",
  db: Queryable = pool,
): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `UPDATE users SET active_view = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, activeView],
  );
  return result.rows[0] ?? null;
}
