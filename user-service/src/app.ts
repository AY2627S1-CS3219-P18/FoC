// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-24
//  Scope: Generated initial implementation as part of Stage 1
//    Author review: No changes needed.
// 25/09/2026: Stage 4a - app setup, middleware, error handler
// Author review:
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ZodError } from 'zod';
import { config } from './config.js';
import authRouter from './routes/auth.routes.js';
import { AppError } from './utils/AppError.js';

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message, code: err.code });
    return;
  }

  if (err instanceof ZodError) {
    const unrecognizedKeys = err.issues.some((issue) => issue.code === 'unrecognized_keys');
    const message = unrecognizedKeys
      ? 'Request contains unexpected fields'
      : err.issues[0]?.message;
    res.status(400).json({ message, code: 'VALIDATION_ERROR' });
    return;
  }

  if (err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Malformed JSON body', code: 'VALIDATION_ERROR' });
    return;
  }

  console.error(err);
  res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
});

app.listen(config.server.port, () => {
  console.log(`user-service listening on port ${config.server.port}`);
});

export default app;
