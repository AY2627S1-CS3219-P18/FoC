
<!-- AI-generated (Claude Code, model: claude-sonnet-5-5, 2026-11-09). Author review: -->
## Database migrations

Schema changes are versioned SQL files in `prisma/migrations`, applied with Prisma (the service itself still queries with `pg`; `prisma/schema.prisma` has no models on purpose).

```sh
# DATABASE_URL points at the user database (see .env.example)
npm run db:deploy
```

- **Fresh database:** `npm run db:deploy` creates everything.
- **Database already built from `src/db/init.sql`** (an existing Compose volume): mark the baseline once, then deploy.
  ```sh
  npx prisma migrate resolve --applied 20261109000000_baseline
  npm run db:deploy
  ```
- The baseline is `init.sql` as it stood before `preferred_lang`; `20261109010000_add_preferred_lang` adds `users.preferred_lang`.
- Do not run `prisma migrate dev` or `db push`: with no models Prisma would try to drop the tables.
- `src/db/init.sql` is still what the test database, CI and a fresh Compose volume use, so it must also contain every column a migration adds.
