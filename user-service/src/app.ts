// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-24
//  Scope: Generated initial implementation as part of Stage 1
//    Author review: No changes needed. 
import express from 'express';
import { config } from './config.js';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.server.port, () => {
  console.log(`user-service listening on port ${config.server.port}`);
});

export default app;
