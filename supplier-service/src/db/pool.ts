/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: gpt-5.6-luna), date: 2026-09-28
 * Scope: Generated the mysql2/promise connection pool from the recorded config fields.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 */

import mysql from "mysql2/promise";

import { config } from "../config.js";

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
});
