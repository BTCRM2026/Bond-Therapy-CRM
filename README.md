# Bond Therapy CRM

One repository containing the Next.js portal in `apps/web` and the NestJS API, Prisma schema, and authentication in `apps/api`.

## Local setup

1. Copy each `.env.example` to `.env` in the same app.
2. Set a PostgreSQL `DATABASE_URL` in `apps/api/.env`.
3. Run `npm --prefix apps/api run db:migrate` and `npm --prefix apps/api run db:seed`.
4. Start the API with `npm run dev:api` and web with `npm run dev:web`.

