// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5)
//  2026-09-24: Generated initial implementation as part of Stage 2c
//    Author review: No changes needed.
//  2026-10-22: Stage 14 docker verification - added pool.on('error', ...). Found that stopping
//    user-db crashed the process: an idle client's connection-reset surfaces as an EventEmitter
//    'error' event on the Pool, which Node treats as an uncaught exception without a listener
//    (documented node-postgres behavior, not specific to this app). No requirements,
//    architecture, schema, or API decisions were made by the AI tool.
//    Author review:

import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
});

// Without this, an idle client's connection error (e.g. user-db going down) is an unhandled
// 'error' event and crashes the process instead of surfacing where the query was awaited.
pool.on('error', (err) => {
  console.error(`user-db pool error: ${err instanceof Error ? err.message : String(err)}`);
});

export default pool;
