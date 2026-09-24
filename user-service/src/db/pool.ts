// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5)
//  2026-09-24: Generated initial implementation as part of Stage 2c
//    Author review: No changes needed. 

import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
});

export default pool;
