# @talasa/platform

The analyst web app: vessel screening, counterparty due diligence, batches,
monitors and the Ask Agent chat. Built with TanStack Start, React, Tailwind and
shadcn/ui.

It is a client of `apps/api`: all data goes through `VITE_API_URL` with the
session cookie, and progress comes from polling, not push.

```bash
pnpm --filter @talasa/platform dev      # http://localhost:3001
pnpm --filter @talasa/platform test     # vitest + Testing Library
```

`VITE_*` variables are read from the repo-root `.env` and are baked in at build
time. `VITE_GOOGLE_MAPS_API_KEY` enables the AIS event map and the map in the
PDF report.

| Path | What |
|---|---|
| `src/routes/` | File-based routes; `_authed/` needs a session |
| `src/components/vessel-screening/` | Vessel report, graph board, AIS panel, PDF export |
| `src/components/counterparty-dd/` | DD intake form and report |
| `src/components/chat/` | Ask Agent panel |
| `src/hooks/` | react-query hooks over the API |
