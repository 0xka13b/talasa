# @talasa/db

The single Postgres schema for the platform — [Drizzle](https://orm.drizzle.team)
table definitions, the shared connection, and the checked-in migration history.
Every persisted row (users, vessel screenings, counterparty DD projects, monitors,
chat) is defined here; `apps/api` and `apps/jobs` are the only consumers and both
import the same `db` handle. Ships as **source** — no build step.

## Usage

```ts
import { db, createDb, screenings } from "@talasa/db"
import { desc, eq } from "drizzle-orm"

// `db` is a process-wide singleton built from DATABASE_URL at import time.
const done = await db.select().from(screenings)
  .where(eq(screenings.status, "completed")).orderBy(desc(screenings.createdAt))

// Row types come free — never hand-write a row interface.
type Screening = typeof screenings.$inferSelect
const row: typeof screenings.$inferInsert = { name: "Echo", imo: "9298595", createdBy: userId }

// Supplying your own URL (jobs pipeline, integration tests):
const scoped = createDb(process.env.DATABASE_URL!)
```

> **Why a singleton *and* a factory?** Importing `db` evaluates
> `createDb(process.env.DATABASE_URL!)` at module load — so merely importing the
> package requires the env var. `createDb` is for callers that own their URL.

## Schema

Defined in `src/schema/*`, re-exported flat from the package root.

| Domain | Tables | Notes |
|---|---|---|
| Auth | `user`, `session`, `account`, `verification` | better-auth's required shape — don't reshape by hand |
| Vessel screening | `screenings`, `batches` | the core entity; a batch is a CSV-uploaded *set* whose members are ordinary screenings |
| Monitoring | `monitors`, `monitorRuns`, `monitorChanges` | saved re-run rules; each run spawns fresh `screenings` and diffs them |
| Counterparty DD | `projects` | the company-centric DD pipeline |
| Satellite | `sarVerifications` | cached Sentinel chips + verdicts, unique per (screening, event, palette) |
| Chat | `chats`, `messages` | one chat scoped to exactly one screening/project |

Enums: `projectStatus` (from `PROJECT_STATUSES`) and `chatSubjectType`. Pipeline
output lives in `jsonb` (`brief`, `graph`, `steps`, `watchSnapshot`) typed from
`@talasa/shared` rather than relational columns — those shapes churn too fast to
migrate. Nearly everything cascades from `user.id` via `created_by`.

> **Gotcha:** `createDb` registers only a subset of tables in drizzle's `schema`
> option, so `db.query.*` can't see `batches`, `monitors`, `monitorRuns` or
> `monitorChanges`. Nothing uses `db.query` today — every call site is
> `select().from()`, which is unaffected. Register the table if you want it.

## Local setup

`pnpm db:setup` from the repo root does the lot (`db:up` + `db:migrate` + `db:seed`).
Other root scripts: `db:down`, `db:reset` (drops the volume), `db:migrate`,
`db:seed`, `db:dump`.

> **Port clash?** `docker-compose.yml` publishes Postgres on `${POSTGRES_PORT:-5432}`
> and adminer on `${ADMINER_PORT:-8080}`. If another local Postgres already owns 5432,
> the app silently talks to the *wrong* database — set e.g. `POSTGRES_PORT=5433`,
> `ADMINER_PORT=8082` and `DATABASE_URL=postgresql://talasa:talasa@localhost:5433/talasa`
> in your `.env`.

## ⚠️ Tests share the dev database

`apps/jobs/src/pipeline/run.test.ts` runs against the **dev `DATABASE_URL`** — the
same database the app is using. It inserts its own rows and removes exactly those in
`afterEach`.

**Never add a `TRUNCATE`, bulk `DELETE`, or any other wipe to a test.** One existed
and it deleted real users and projects (cascading through `created_by`); it was
removed deliberately. Don't reintroduce it — or stand up a separate test DB —
without asking first.

## Scripts

| Script | Does |
|---|---|
| `db:generate` | diff `src/schema` → new SQL in `drizzle/`. Needs no DB |
| `db:migrate` | apply pending migrations (`src/migrate.ts`) |
| `db:push` | push the schema straight at the DB with no migration file — dev only |
| `db:studio` | drizzle-kit studio |
| `db:seed` | the local admin account + the 3 curated example screenings |
| `db:dump` | refresh `seed/snapshot.json` from the current DB |

All but `db:generate` read the repo-root `.env`. Migrations (`drizzle/0000…0014`)
and their `meta/` snapshots are committed together: generate, review the SQL, commit
both. Never hand-edit a migration that has been applied.

`db:seed` (re)creates one account — `admin@talasa.sh` / `qwerty12345` — owning the
screenings in `seed/snapshot.json`. Local dev data with a public password; never run it
against a database other people can reach.
