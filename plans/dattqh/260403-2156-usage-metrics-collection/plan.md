---
status: completed
priority: high
effort: 4h
blockedBy: []
blocks: []
---

# Usage Metrics Collection System

**Brainstorm:** `../reports/brainstorm-260403-2156-usage-metrics-collection.md`
**Goal:** Auto-collect usage metrics from Anthropic profiles every 30min, store in MongoDB for analytics.

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | [Backend models + crypto service](phase-01-models-and-crypto.md) | 1h | completed |
| 2 | [Usage collector service + cron](phase-02-collector-service-and-cron.md) | 1h | completed |
| 3 | [API routes](phase-03-api-routes.md) | 45m | completed |
| 4 | [Frontend: token management + snapshots UI](phase-04-frontend.md) | 1.5h | completed |

## Dependencies

- `ENCRYPTION_KEY` env var must be set (32-byte hex string)
- Anthropic OAuth API endpoint: `GET /api/oauth/usage`
- Existing: Seat model, Express 5 middleware, node-cron

## Key Decisions

- Extend Seat model (not new collection) for token storage
- AES-256-GCM encryption for access tokens
- Full raw API response saved per snapshot
- Parallel fetch with concurrency limit = 3
- Cron `*/30 * * * *` + manual admin trigger
