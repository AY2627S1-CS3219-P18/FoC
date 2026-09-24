// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5)
//  2026-09-24: Generated initial implementation as part of Stage 2b
//    Author review: No changes needed.
//  2026-09-25: Stage 5a - OTP config, SMTP optional in development
//    Author review:

import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive(),
    NODE_ENV: z.enum(["development", "production", "test"]),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive(),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),

    JWT_PRIVATE_KEY_PATH: z.string().min(1),
    JWT_PUBLIC_KEY_PATH: z.string().min(1),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive(),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive(),

    SMTP_HOST: z.string().default(""),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    SMTP_FROM: z.string().default(""),

    SUPER_ADMIN_USERNAME: z.string().min(1),
    SUPER_ADMIN_EMAIL: z.string().min(1),
    SUPER_ADMIN_PASSWORD: z.string().min(1),

    OTP_TTL_MINUTES: z.coerce.number().int().positive(),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive(),
    OTP_MAX_RESENDS: z.coerce.number().int().positive(),
  })
  .superRefine((env, ctx) => {
    // SMTP settings may be blank only in development (emails are logged instead).
    if (env.NODE_ENV === "development") return;
    for (const key of [
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_FROM",
    ] as const) {
      if (env[key].length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Required when NODE_ENV is not 'development'`,
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid or missing environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  server: {
    port: env.PORT,
  },
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  },
  jwt: {
    privateKeyPath: env.JWT_PRIVATE_KEY_PATH,
    publicKeyPath: env.JWT_PUBLIC_KEY_PATH,
    accessTokenTtlMinutes: env.ACCESS_TOKEN_TTL_MINUTES,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  },
  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
  },
  otp: {
    ttlMinutes: env.OTP_TTL_MINUTES,
    resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    maxResends: env.OTP_MAX_RESENDS,
  },
  superAdmin: {
    username: env.SUPER_ADMIN_USERNAME,
    email: env.SUPER_ADMIN_EMAIL,
    password: env.SUPER_ADMIN_PASSWORD,
  },
} as const;
