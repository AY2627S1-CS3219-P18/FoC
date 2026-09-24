// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4b - user queries
// Author review:
// 25/09/2026: Stage 4e - super admin queries
// Author review:
// 25/09/2026: Stage 5a - optional db param, status param, lock/activate/stale-cleanup queries
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
}

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
): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `INSERT INTO users (username, email, password_hash, status, role) VALUES ($1, $2, $3, 'active', 'super admin') RETURNING *`,
    [username, email, passwordHash],
  );
  return result.rows[0]!;
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
     WHERE status = 'pending'
       AND (username = $1 OR email = $2)
       AND NOT EXISTS (
         SELECT 1 FROM users_otps o
         WHERE o.user_id = users.id AND o.expires_at > NOW()
       )`,
    [username, email],
  );
}
