# Batches and monitoring

**Batches** screen several vessels from one spreadsheet. **Monitors** re-screen
a vessel or a batch on a schedule and report what changed.

## Batch screening

### Upload

In the Vessel section's batch page (`/vessel-screening/batch`), drop a `.csv`, `.tsv`, `.xlsx` or `.xls` file of up to 15 MB. Parsing happens
in the browser (`packages/shared/src/batch.ts`):

- **Sheets:** only the first sheet is read.
- **IMO column:** found by header (`IMO`, `IMO No`, `IMO Number`, …) or,
  failing that, by which column holds the most IMO-like values.
- **Name column:** found the same way, by header (`Ship name`, `Vessel name`,
  …) or by content.
- **IMO values:** normalised by stripping an `IMO` prefix, spaces, dashes and a
  trailing `.0`, then must be exactly 7 digits.
- **Duplicates and bad rows:** duplicate IMOs are merged, and invalid rows are
  counted and previewed with their line numbers.

A batch holds at most **5 vessels** (`MAX_BATCH_VESSELS`). The limit exists
because every screening scrapes Equasis at one request per 30 seconds. The
preview warns when a file has more, and only the first 5 are submitted.

### Running

The API creates the batch and one queued screening per vessel in a single
transaction. Batch members are ordinary vessel screenings: each runs the full
pipeline, one at a time per worker process.

The batch page shows overall progress, counts by status, and a card per vessel
with its verdict, linking to the full report.

Batch and monitor screenings are not shown in the flat screening list.
Archiving a batch also disables any monitors on it.

## Monitoring

A monitor re-screens a target on a schedule, compares the result with the
previous screening, and records what changed.

### Setting one up

Create a monitor from the monitoring page in the Vessel section
(`/vessel-screening/monitoring`), or with **Monitor** on a vessel report. Its
options are:

| Option | Values |
|---|---|
| Target | One vessel (IMO) or one of your batches |
| Cadence | daily, weekly, biweekly (14 days), monthly (30 days) |
| Time of day | HH:mm UTC (default 06:00) |
| Checks | which parts to re-run: `sanctions`, `ownership`, `ais`, `inspections`, `fleet`, `flag` |
| Notify mode | all changes, or escalations only (stored, not yet applied; see below) |

Each check re-runs one pipeline stage. `flag` re-runs `identify`, which also
refreshes the registered owners and managers. The `ownership` check only
refreshes the LLM-inferred ownership, so select `flag` too if you want registry
owner changes.

### How a run works

1. **Scheduling.** The worker's scheduler checks for due monitors on every loop
   iteration. When one is due, it creates a monitor run and queues one
   screening per target vessel. The next run is set one cadence later. **Run
   now** on a monitor queues a run immediately.
2. **Baseline.** Each re-screen starts from the latest completed screening of
   the same vessel by the same user. Stages that aren't selected are copied from
   that baseline, and only the selected checks run. With no baseline, the full
   pipeline runs and becomes the baseline.
3. **Diff.** The new result is reduced to a *watch snapshot* and compared with
   the baseline's snapshot. The verdict and score are always compared; the other
   parts only when their check is selected. The snapshot covers:
   - verdict and score
   - sanctions matches
   - owners
   - inferred owners
   - AIS event counts and the high-risk-zone flag
   - detentions
   - sister-vessel hits
   - flag
4. **Narrative.** The LLM narrative is rewritten only if something changed.
   Otherwise the previous report is carried forward at no LLM cost.

### Changes and escalations

Every change is stored as a monitor change. A change is marked as an
**escalation** when any of these happen:
- the verdict or score rises
- a new directly-sanctioned match appears
- a new sanctioned owner appears
- a new strong inferred owner appears
- the number of directly sanctioned sister vessels rises
- the number of detentions rises
- an AIS count rises, or the vessel enters a high-risk zone

A flag change is recorded but is not an escalation.

Changes appear in the app:
- **Monitor page:** a change feed with escalation badges, per-change and bulk
  acknowledgement, and run history.
- **Sidebar:** the monitor card shows the count of unacknowledged changes.

### Cost

Monitors run the real pipeline. A daily monitor with the `ais` check spends
about 90 Datalastic credits per vessel per run, and Equasis-backed checks take
30 seconds per request. Choose checks and cadence with that in mind.

## Known limitations

- **No outside notifications.** There is no email, push or webhook delivery.
  The notify mode is stored but not yet used, so every change is recorded
  either way.
- **Time of day:** it sets the first run. Later runs follow the cadence from
  whenever the previous run actually fired.
- **AIS drift:** AIS counts come from a trailing 90-day window, so an `ais`
  check can report changes as old events age out.
- **Stuck runs:** if a vessel's re-screen throws, the monitor run can stay in
  "running".
- **Batch actions:** batch results can't be exported, and failed members can't
  be retried from the batch page.

## Code map

| Path | What |
|---|---|
| `packages/shared/src/batch.ts` | Spreadsheet parsing, batch limits |
| `packages/shared/src/monitor.ts` | Cadences, checks, check-to-stage mapping |
| `packages/shared/src/watch-snapshot.ts` | Snapshot, diff and escalation rules |
| `apps/jobs/src/pipeline/scheduler.ts` | Monitor scheduler |
| `apps/jobs/src/pipeline/vessel/monitor-run.ts` | Re-screen with baseline, diff, change recording |
| `apps/api/src/services/{batches,monitors}.ts` | API side |
