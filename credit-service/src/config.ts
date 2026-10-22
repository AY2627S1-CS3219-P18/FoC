// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - env schema and config object, following the same
//    zod-validated pattern as user-service/src/config.ts.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review: Wee Jean
//  2026-10-19: Week 9 - USER_SERVICE_URL, the origin the JWKS key set is fetched from.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review:
//  2026-10-22: Credit transfer consumer - REDIS_HOST / REDIS_PORT, the broker the
//    transfer worker consumes from. Same shape as the sibling services' env.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review:

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(['development', 'production', 'test']),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  // Origin of user-service, used only to build the JWKS URL. Same value compose already
  // gives supplier-service.
  USER_SERVICE_URL: z.string().url(),

  // order-redis, the broker order-service publishes credit_transfer jobs to. Validated
  // for the API process too, so a misconfigured broker fails at startup rather than at
  // the first job. Same env-var names the sibling workers use.
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  },
  userServiceUrl: env.USER_SERVICE_URL,
  // Published by user-service; see user-service/docs/jwks-verification-guide.md.
  jwksUrl: new URL('/auth/.well-known/jwks.json', env.USER_SERVICE_URL),
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
} as const;
