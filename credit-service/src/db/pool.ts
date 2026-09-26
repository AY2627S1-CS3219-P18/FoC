// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - pg connection pool, following user-service/src/db/pool.ts.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review: Wee Jean

import pg from 'pg';
import { config } from '../config.js';

// Credits are whole numbers stored as INTEGER, so the default pg parsing (int4 -> number)
// is correct and no custom type parser is needed.
const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
});

export default pool;
