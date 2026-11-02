// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - server entry point split out of app.ts (bootstrap, then listen)
// Author review:
// 2026-10-02: also run bootstrapTestUser at startup
// Author review: Congchen
// 2026-10-21: Stage 14c - start the credit outbox relay after the bootstrap. No requirements,
//   architecture, schema, or API decisions were made by the AI tool — see instructions.md
//   Stage 14 for the governing decision.
// Author review:
import { config } from './config.js';
import app from './app.js';
import { bootstrapSuperAdmin, bootstrapTestUser } from './services/bootstrap.service.js';
import { startCreditOutboxRelay } from './services/creditOutbox.relay.js';

await bootstrapSuperAdmin();
await bootstrapTestUser();

startCreditOutboxRelay();

app.listen(config.server.port, () => {
  console.log(`user-service listening on port ${config.server.port}`);
});
