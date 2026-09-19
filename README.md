# Bond Therapy CRM

One repository containing the Next.js portal in `apps/web` and the NestJS API, Prisma schema, and authentication in `apps/api`.

## Local setup

Local development uses an ignored SQLite database so testing never reaches Railway. Production continues to use PostgreSQL.

1. Copy `apps/api/.env.example` to `apps/api/.env` and use `DATABASE_URL="file:./bond-therapy-local.db"`.
2. Copy `apps/web/.env.example` to `apps/web/.env.local`; use `ADMIN_HOST="localhost"` and `STAFF_HOST="staff.localhost"`.
3. Run `npm --prefix apps/api run db:local:setup`.
4. Start the API with `node --env-file=.env dist/main.js` from `apps/api` after a build, or use the normal development script with equivalent environment variables.
5. Start the web app with `npm --prefix apps/web run dev -- --port 3013`.

Open the Administration Portal at `http://localhost:3013/login` and the Staff Portal at `http://staff.localhost:3013/login`.

For production, keep `apps/api/prisma/schema.prisma` as the source of truth, provide Railway's private PostgreSQL `DATABASE_URL`, and use the normal production build/start commands.
