# Phase 2: Usage Collector Service + Cron

## Context Links
- Brainstorm: `../reports/brainstorm-260403-2156-usage-metrics-collection.md`
- Plan: `./plan.md`
- Depends on: `./phase-01-models-and-crypto.md`

## Overview
- **Priority:** High
- **Status:** completed
- **Description:** Create service that fetches usage from Anthropic OAuth API per seat, saves snapshots. Wire up 30-min cron job.

## Key Insights
- API endpoint: `GET https://api.anthropic.com/api/oauth/usage`
- Headers: `Authorization: <token>`, `anthropic-beta: oauth-2025-04-20`
- Response fields can be `null` (e.g. seven_day_opus) — must handle gracefully
- Existing cron pattern in index.ts uses `node-cron` with timezone
- Need concurrency limit to avoid hammering API — simple `Promise` pool, no external lib

## Requirements

### Functional
- Fetch usage data for each seat with active token
- Parse response into UsageSnapshot fields
- Save raw + parsed to MongoDB
- Update seat's `last_fetched_at` / `last_fetch_error`
- Cron every 30 min, timezone Asia/Ho_Chi_Minh

### Non-functional
- One seat failure must not block others
- Concurrency limit = 3 parallel fetches
- Log each fetch result (success/error) to console

## Architecture

```
Cron (*/30 * * * *)
  → collectAllUsage()
    → Seat.find({ token_active: true, access_token: { $ne: null } })
    → parallel(seats, limit=3, fetchAndSave)
      → decrypt(seat.access_token)
      → fetch(API, { Authorization: token })
      → parse response → UsageSnapshot.create()
      → update seat.last_fetched_at
```

## Related Code Files

### Modify
- `packages/api/src/index.ts` — Add cron job + import

### Create
- `packages/api/src/services/usage-collector-service.ts` — Core collector logic

## Implementation Steps

### 1. Create `packages/api/src/services/usage-collector-service.ts`

```typescript
import { Seat } from '../models/seat.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { decrypt } from './crypto-service.js'

const API_URL = 'https://api.anthropic.com/api/oauth/usage'
const CONCURRENCY = 3

/** Parse a usage bucket { utilization, resets_at } or null */
function parseBucket(bucket: unknown): { pct: number | null; resetsAt: Date | null } {
  if (!bucket || typeof bucket !== 'object') return { pct: null, resetsAt: null }
  const b = bucket as { utilization?: number; resets_at?: string }
  return {
    pct: b.utilization ?? null,
    resetsAt: b.resets_at ? new Date(b.resets_at) : null,
  }
}

/** Fetch usage for a single seat */
async function fetchSeatUsage(seat: { _id: unknown; access_token: string; label: string }) {
  const token = decrypt(seat.access_token)

  const res = await fetch(API_URL, {
    method: 'GET',
    headers: {
      'Authorization': token,
      'anthropic-beta': 'oauth-2025-04-20',
      'content-type': 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }

  const raw = await res.json()
  const fiveHour = parseBucket(raw.five_hour)
  const sevenDay = parseBucket(raw.seven_day)
  const sevenDaySonnet = parseBucket(raw.seven_day_sonnet)
  const sevenDayOpus = parseBucket(raw.seven_day_opus)

  await UsageSnapshot.create({
    seat_id: seat._id,
    raw_response: raw,
    five_hour_pct: fiveHour.pct,
    five_hour_resets_at: fiveHour.resetsAt,
    seven_day_pct: sevenDay.pct,
    seven_day_resets_at: sevenDay.resetsAt,
    seven_day_sonnet_pct: sevenDaySonnet.pct,
    seven_day_sonnet_resets_at: sevenDaySonnet.resetsAt,
    seven_day_opus_pct: sevenDayOpus.pct,
    seven_day_opus_resets_at: sevenDayOpus.resetsAt,
    extra_usage: {
      is_enabled: raw.extra_usage?.is_enabled ?? false,
      monthly_limit: raw.extra_usage?.monthly_limit ?? null,
      used_credits: raw.extra_usage?.used_credits ?? null,
      utilization: raw.extra_usage?.utilization ?? null,
    },
  })

  // Update seat metadata
  await Seat.findByIdAndUpdate(seat._id, {
    last_fetched_at: new Date(),
    last_fetch_error: null,
  })

  console.log(`[Collector] ✓ ${seat.label}`)
}

/** Run tasks with concurrency limit */
async function parallelLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing: Promise<void>[] = []
  for (const item of items) {
    const p = fn(item).then(() => { executing.splice(executing.indexOf(p), 1) })
    executing.push(p)
    if (executing.length >= limit) await Promise.race(executing)
  }
  await Promise.all(executing)
}

// Mutex guard: prevent overlapping cron runs
let isCollecting = false

/** Collect usage for all active seats */
export async function collectAllUsage(): Promise<{
  success: number
  errors: number
  failedSeats: Array<{ id: string; label: string; error: string }>
}> {
  if (isCollecting) {
    console.log('[Collector] Already running, skipping')
    return { success: 0, errors: 0, failedSeats: [] }
  }

  isCollecting = true
  try {
    const seats = await Seat.find({
      token_active: true,
      access_token: { $ne: null },
    }).lean()

    if (seats.length === 0) {
      console.log('[Collector] No active seats with tokens')
      return { success: 0, errors: 0, failedSeats: [] }
    }

    console.log(`[Collector] Fetching usage for ${seats.length} seats...`)
    let success = 0
    let errors = 0
    const failedSeats: Array<{ id: string; label: string; error: string }> = []

    await parallelLimit(seats, CONCURRENCY, async (seat) => {
      try {
        await fetchSeatUsage(seat as any)
        success++
      } catch (err) {
        errors++
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[Collector] ✗ ${seat.label}: ${message}`)
        failedSeats.push({ id: String(seat._id), label: seat.label, error: message })
        await Seat.findByIdAndUpdate(seat._id, { last_fetch_error: message })
      }
    })

    console.log(`[Collector] Done: ${success} success, ${errors} errors`)
    return { success, errors, failedSeats }
  } finally {
    isCollecting = false
  }
}

/** Collect usage for a single seat by ID */
export async function collectSeatUsage(seatId: string): Promise<void> {
  const seat = await Seat.findById(seatId).lean()
  if (!seat) throw new Error('Seat not found')
  if (!seat.access_token) throw new Error('Seat has no access token')
  await fetchSeatUsage(seat as any)
}
```

### 2. Update `packages/api/src/index.ts`
Add import and cron job after existing crons:

```typescript
import { collectAllUsage } from './services/usage-collector-service.js'

// Inside start(), after existing cron jobs:
// Cron: Every 30 min — collect usage snapshots
cron.schedule('*/30 * * * *', () => {
  console.log('[Cron] Triggering usage collection...')
  collectAllUsage().catch(console.error)
}, { timezone: 'Asia/Ho_Chi_Minh' })
```

## Todo List
- [x] Create usage-collector-service.ts with fetchSeatUsage + collectAllUsage + collectSeatUsage
- [x] Implement parallelLimit helper (no external deps)
- [x] Add mutex guard (isCollecting flag) to prevent cron overlap
- [x] Return failedSeats array with { id, label, error } for debugging
- [x] Add cron job to index.ts
- [x] Test: single seat fetch + parse
- [x] Test: error isolation (one fail, others continue)
- [x] Test: mutex prevents double-run
- [x] Verify compile passes

## Success Criteria
- Cron triggers every 30 min
- Each active seat's usage fetched and saved as UsageSnapshot
- Failed seats log error + update last_fetch_error, don't block others
- `collectSeatUsage(id)` works for manual single-seat trigger
- Console logs clear success/error per seat

## Risk Assessment
- **Token expired/revoked**: Per-seat error handling, logged to last_fetch_error
- **API rate limiting**: Concurrency=3 conservative; if hit, increase interval or lower concurrency
- **API response shape changes**: raw_response preserved; parsed fields may be null — UI handles gracefully

## Security Considerations
- Token decrypted in memory only during fetch, not logged
- Console logs show seat label only, never token
