// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - server entry point split out of app.ts (bootstrap, then listen)
// Author review:
import { config } from './config.js';
import app from './app.js';
import { bootstrapSuperAdmin } from './services/bootstrap.service.js';

await bootstrapSuperAdmin();

app.listen(config.server.port, () => {
  console.log(`user-service listening on port ${config.server.port}`);
});
