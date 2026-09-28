// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - process entry point.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review: Wee Jean

import app from './app.js';
import { config } from './config.js';
import pool from './db/pool.js';

const server = app.listen(config.port, () => {
  console.log(`credit-service listening on port ${config.port}`);
});

// Docker sends SIGTERM on `compose down`; finish in-flight requests, then close the pool
// so no transaction is cut off mid-commit.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });
}
