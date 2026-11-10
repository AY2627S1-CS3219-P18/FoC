/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-07
 * Scope: Implemented the team-specified chat creation endpoint and supporting scaffold.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-11-10, Claude Code, model: claude-opus-5): ECS Fargate migration - verified TLS to
 *        RDS when DB_SSL is on, per George's ECS Fargate plan, Phase 1 items 1 and 3.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
export type { PrismaClient };
export function createPrismaClient(databaseUrl: string, ssl = false): PrismaClient {
  const url = new URL(databaseUrl);
  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      timezone: "+00:00",
      // Unlike mysql2, this driver has no verifyIdentity flag: it always runs
      // tls.checkServerIdentity against a CA-issued certificate and fails the handshake on a
      // hostname mismatch, so supplier-service's extra option has no equivalent here.
      // rejectUnauthorized is passed explicitly for parity with the other services, though an
      // ssl object already defaults it to true. The RDS CA itself is trusted through
      // NODE_EXTRA_CA_CERTS, set in the ECS task definition.
      ...(ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    }),
  });
}
