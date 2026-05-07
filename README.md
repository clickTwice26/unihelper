# Unihelper

Production-grade full-stack React Router application using the maintained Remix-style framework path, with PostgreSQL, Redis, Prisma, infrastructure-only Docker Compose, strict TypeScript, and operational health endpoints.

## Stack

- React Router framework mode for full-stack routing and SSR
- TypeScript with strict compiler settings
- PostgreSQL with Prisma ORM
- Redis with ioredis
- Tailwind CSS v4 for styling
- Docker Compose for local PostgreSQL and Redis
- ESLint 9 and Prettier for code quality

## Typography Guideline

- Use `Space Grotesk` only for brand moments and major headings.
- Use `IBM Plex Sans` for navigation, labels, body copy, runtime data, and supporting text.
- Keep uppercase tracking only for overlines and the product wordmark, not for normal navigation or content blocks.
- Use a single type scale in the UI:
	- `type-display-hero` for the primary page headline
	- `type-heading-lg` for secondary page titles and error states
	- `type-overline` via the `eyebrow` utility for section labels
	- `type-body-lg` for lead paragraphs
	- `type-body-md` for standard descriptive copy
	- `type-body-sm` for cards, metadata, and dense supporting text
	- `type-caption` for sublabels under logos or compact helper text
	- `type-nav` for navigation links and pill buttons
- When adding new UI, reuse these typography utilities instead of mixing ad hoc `text-*`, `tracking-*`, and `font-*` classes inline.

## Project Structure

```text
app/
	lib/
		db.server.ts
		env.server.ts
		health.server.ts
		logger.server.ts
		redis.server.ts
	routes/
		home.tsx
		health.ts
		ready.ts
	app.css
	root.tsx
	routes.ts
prisma/
	schema.prisma
	seed.ts
unihelpersdocker/
	docker-compose.yml
Dockerfile
eslint.config.js
.prettierrc.json
.editorconfig
```

## Local Development

1. Copy the environment file.

```bash
cp .env.example .env
```

2. Start infrastructure.

```bash
docker compose -f unihelpersdocker/docker-compose.yml up -d postgres redis
```

3. Generate the Prisma client and apply migrations.

```bash
npm run db:generate
npm run db:migrate:dev -- --name init
```

4. Start the application.

```bash
npm run dev
```

The app runs on http://localhost:5173 by default. Health endpoints are available at http://localhost:5173/health and http://localhost:5173/ready.

When running the production server locally with `npm run start`, the app uses `http://localhost:3001` by default.

## Docker Workflow

Run the local infrastructure stack:

```bash
docker compose -f unihelpersdocker/docker-compose.yml up -d postgres redis
```

The Compose stack includes:

- `postgres` on port `5433`
- `redis` on port `6381`

The application itself runs on your local machine with `npm run dev` or `npm run start`.

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run format:check
```

## Database Commands

```bash
npm run db:generate
npm run db:migrate:dev -- --name <migration-name>
npm run db:migrate:deploy
npm run db:push
npm run db:studio
npm run db:seed
```

## Notes

- New Remix applications are now scaffolded through React Router. This repository uses that maintained path while preserving the same full-stack programming model.
- `app/lib/*.server.ts` is the intended home for database, cache, and other server-only integrations.
- `/health` is a liveness endpoint. `/ready` verifies PostgreSQL and Redis connectivity and is appropriate for orchestration checks.
- The Compose file lives in `unihelpersdocker/` and uses the compose project name `unihelpersdocker`, so Docker Desktop groups the infrastructure under that label.
