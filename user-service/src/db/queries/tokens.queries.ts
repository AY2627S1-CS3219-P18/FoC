// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4c - refresh token queries
// Author review:

import pool from '../pool.js';

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  is_revoked: boolean;
  revoked_at: Date | null;
  expires_at: Date;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Date;
}

export async function createRefreshToken({
  userId,
  tokenHash,
  expiresAt,
  userAgent,
  ipAddress,
}: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}): Promise<RefreshTokenRow> {
  const result = await pool.query<RefreshTokenRow>(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, tokenHash, expiresAt, userAgent, ipAddress],
  );
  return result.rows[0]!;
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | null> {
  const result = await pool.query<RefreshTokenRow>(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE token_hash = $1`,
    [tokenHash],
  );
}
