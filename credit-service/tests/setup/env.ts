// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - loads .env before src/config.ts validates it.
//    Uses Node's built-in process.loadEnvFile rather than adding dotenv, keeping the
//    dependency list to the stack in credit-service-context.md §4.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review: Wee Jean

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Runs before the test module is imported, so config.ts sees the variables.
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
