// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-24
// Scope: Generated initial implementation as part of Stage 1
// Author review:
import express from 'express';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// TODO (Stage 2b): read the port from config.ts instead of process.env
const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`user-service listening on port ${port}`);
});

export default app;
