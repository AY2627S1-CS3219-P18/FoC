// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4b - user queries
// Author review:

import pool from '../pool.js';

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  status: 'active' | 'suspended';
  role: 'user' | 'admin' | 'super admin';
}

export async function createUser({
  username,
  email,
  passwordHash,
}: {
  username: string;
  email: string;
  passwordHash: string;
}): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *`,
    [username, email, passwordHash],
  );
  return result.rows[0]!;
}

export async function findByUsername(username: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(`SELECT * FROM users WHERE username = $1`, [username]);
  return result.rows[0] ?? null;
}

export async function findByEmail(email: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
  return result.rows[0] ?? null;
}

export async function findById(userId: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [userId]);
  return result.rows[0] ?? null;
}
