# @talasa/jobs

The background worker. It runs the vessel screening and counterparty due
diligence pipelines, and the monitor scheduler.

There is no message broker. The API queues work by setting a row's `status` to
`queued` in Postgres, and the worker claims rows with
`UPDATE … FOR UPDATE SKIP LOCKED`. Each loop iteration:

1. `tickScheduler` enqueues screenings for any monitor that is due.
2. Claims and runs one queued counterparty DD project.
3. Claims and runs one queued vessel screening.

When there is no work it sleeps `WORKER_POLL_MS` (default 2000 ms). Stage
results are written to the row's `steps` column as they finish, so a run that
is interrupted resumes from the last completed stage once its lease
(`WORKER_LEASE_MINUTES`) expires.

See [docs/architecture.md](../../docs/architecture.md) for the queue and
[docs/vessel-screening.md](../../docs/vessel-screening.md) /
[docs/counterparty-due-diligence.md](../../docs/counterparty-due-diligence.md)
for the pipelines.

## Run

```bash
pnpm --filter @talasa/jobs dev     # reads the repo-root .env
pnpm --filter @talasa/jobs test    # some suites use the DATABASE_URL database
```

## Layout

| Path | What |
|---|---|
| `src/worker.ts` | Poll loop |
| `src/clients.ts` | Data-source clients built from env |
| `src/pipeline/queue.ts` | Row claiming, leases, per-stage retry and persistence |
| `src/pipeline/run.ts` | Counterparty DD pipeline |
| `src/pipeline/vessel/` | Vessel screening pipeline, monitor re-runs, offline maritime place data |
| `src/pipeline/scheduler.ts` | Monitor scheduler |
