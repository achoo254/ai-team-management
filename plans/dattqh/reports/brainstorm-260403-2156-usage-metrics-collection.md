---
name: Usage Metrics Collection System
description: Brainstorm report for periodic usage data collection from Anthropic profiles
type: report
date: 2026-04-03
status: approved
---

# Usage Metrics Collection System — Brainstorm Report

## Problem Statement

Cần thu thập usage metrics từ nhiều Anthropic account (seat) mỗi 30 phút qua API `/api/oauth/usage`, lưu MongoDB để phân tích hiệu quả sử dụng AI.

## API Details

- **Endpoint**: `GET https://api.anthropic.com/api/oauth/usage`
- **Headers**: `Authorization: <access_token>`, `anthropic-beta: oauth-2025-04-20`, `content-type: application/json`
- **Response**:

```json
{
  "five_hour": { "utilization": 19.0, "resets_at": "ISO datetime" },
  "seven_day": { "utilization": 41.0, "resets_at": "ISO datetime" },
  "seven_day_sonnet": { "utilization": 5.0, "resets_at": "..." },
  "seven_day_opus": null,
  "seven_day_cowork": null,
  "seven_day_oauth_apps": null,
  "iguana_necktie": null,
  "extra_usage": { "is_enabled": false, "monthly_limit": null, "used_credits": null, "utilization": null }
}
```

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Profile storage | Extend Seat model | DRY — Seat already has email, label, team. No new collection |
| Token security | AES-256-GCM | Encrypt at rest, decrypt only when fetching |
| Data retention | Full raw response + parsed metrics | Future-proof analytics |
| Fetch strategy | Parallel with concurrency limit (3) | Balance speed vs API rate limits |
| Trigger | Cron 30min + manual button | Admin flexibility |

## Schema Design

### Seat Model — New Fields

```typescript
access_token: string | null      // AES-256-GCM encrypted
token_active: boolean            // enable/disable auto-fetch (default: false)
last_fetched_at: Date | null
last_fetch_error: string | null
```

### New Collection: `usage_snapshots`

```typescript
{
  seat_id: ObjectId              // ref Seat, indexed
  raw_response: Mixed            // full API JSON backup
  five_hour_pct: number | null
  five_hour_resets_at: Date | null
  seven_day_pct: number | null
  seven_day_resets_at: Date | null
  seven_day_sonnet_pct: number | null
  seven_day_sonnet_resets_at: Date | null
  seven_day_opus_pct: number | null
  seven_day_opus_resets_at: Date | null
  extra_usage: {
    is_enabled: boolean
    monthly_limit: number | null
    used_credits: number | null
    utilization: number | null
  }
  fetched_at: Date               // indexed
}
```

**Indexes**: `{ seat_id: 1, fetched_at: -1 }` compound index

## New Files

| File | Purpose |
|------|---------|
| `packages/api/src/services/crypto-service.ts` | AES-256-GCM encrypt/decrypt |
| `packages/api/src/services/usage-collector-service.ts` | Fetch usage per seat, save snapshots |
| `packages/api/src/models/usage-snapshot.ts` | Mongoose model |
| `packages/api/src/routes/profiles.ts` | Seat token CRUD (extend seat routes) |
| `packages/api/src/routes/usage-snapshots.ts` | Query snapshots + manual trigger |

## Modified Files

| File | Changes |
|------|---------|
| `packages/api/src/models/seat.ts` | Add access_token, token_active, last_fetched_at, last_fetch_error |
| `packages/api/src/index.ts` | Add cron job `*/30 * * * *` |
| `packages/shared/types.ts` | Add UsageSnapshot type, update Seat type |
| `packages/api/src/config.ts` | Add ENCRYPTION_KEY env var |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/api/seats/:id/token` | admin | Set/update encrypted access token |
| DELETE | `/api/seats/:id/token` | admin | Remove token |
| POST | `/api/usage-snapshots/collect` | admin | Manual trigger collect all |
| POST | `/api/usage-snapshots/collect/:seatId` | admin | Manual trigger single seat |
| GET | `/api/usage-snapshots` | auth | Query snapshots (filter: seat_id, from, to) |
| GET | `/api/usage-snapshots/latest` | auth | Latest snapshot per active seat |

## Cron Job

```
*/30 * * * *  →  collectAllUsage()
```

- Fetch all seats where `token_active === true && access_token !== null`
- Parallel fetch with concurrency limit = 3
- Per-seat error isolation: one failure doesn't block others
- Update `last_fetched_at` / `last_fetch_error` on seat

## Approaches Evaluated

| | Sequential | **Parallel + Concurrency (chosen)** | Job Queue |
|---|---|---|---|
| Complexity | Low | Medium | High |
| Speed (10 seats) | ~10s | ~3s | ~3s |
| Error isolation | Per-seat | Per-seat | Per-seat + retry |
| Dependencies | None | None | Bull/Redis or Agenda |
| Fit for 5-20 seats | OK | **Best** | Overkill |

## Security Considerations

- Access tokens encrypted AES-256-GCM before MongoDB storage
- `ENCRYPTION_KEY` env var (32-byte hex), never committed to git
- Token only decrypted in memory during API call, immediately discarded
- Admin-only access to token management endpoints
- Raw response stored as-is (no PII beyond org email already in Seat)

## Success Criteria

- [ ] Seat model extended with encrypted token fields
- [ ] Usage snapshots collected every 30 min automatically
- [ ] Manual trigger works from admin dashboard
- [ ] Snapshots queryable by seat + date range
- [ ] Failed fetches don't block other seats
- [ ] Encryption key rotation possible without data loss

## Next Steps

1. Create implementation plan with phases
2. Implement backend (model → service → routes → cron)
3. Add UI for token management + snapshot viewing
4. Add analytics/chart views for usage trends
