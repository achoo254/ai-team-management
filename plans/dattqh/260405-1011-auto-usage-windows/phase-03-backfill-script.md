# Phase 3 — Backfill CLI script

## Overview
**Priority:** High | **Status:** pending | **Depends on:** Phase 1, 2
One-shot script to rebuild `UsageWindow` history from existing `usage_snapshots`.

## Files to create
- `packages/api/src/scripts/backfill-usage-windows.ts` — CLI entry

## Implementation Steps

### 1. Script logic
```ts
// pnpm tsx --env-file .env.local src/scripts/backfill-usage-windows.ts [--dry-run] [--seat-id=xxx]

async function main() {
  const seats = await Seat.find({}, 'owner_id label').lean()
  for (const seat of seats) {
    await backfillSeat(seat)
  }
}

async function backfillSeat(seat) {
  if (!seat.owner_id) {
    console.warn(`[Backfill] skip ${seat.label}: no owner_id`)
    return
  }
  const snapshots = await UsageSnapshot.find({seat_id: seat._id})
    .sort({fetched_at: 1}).lean()
  if (snapshots.length === 0) return

  // Clear existing windows for this seat (idempotent)
  if (!dryRun) await UsageWindow.deleteMany({seat_id: seat._id})

  // In-memory state: use SAME detectWindowAction from Phase 1 (no logic duplication)
  const builtWindows: IUsageWindow[] = []
  let openWindow: IUsageWindow | null = null

  for (let i = 0; i < snapshots.length; i++) {
    const snapshotNow = snapshots[i]
    const snapshotPrev = i > 0 ? snapshots[i-1] : null

    const action = detectWindowAction({
      seat_id: seat._id,
      owner_id: seat.owner_id,
      snapshotNow, snapshotPrev, openWindow,
    })

    // applyActionInMemory: thin wrapper that mutates builtWindows array + openWindow
    // reuses action semantics from detector — no business logic here
    openWindow = applyActionInMemory(action, openWindow, builtWindows)
  }

  if (!dryRun && builtWindows.length > 0) {
    await UsageWindow.insertMany(builtWindows, {ordered: false})
  }

  console.log(`[Backfill] ${seat.label}: ${builtWindows.length} windows`)
}
```

**`applyActionInMemory` is a thin dispatch** — only mutates state based on action kind, never computes metrics. Metrics come from detector payload. Keeps single source of truth: `detectWindowAction` is the ONLY place with detection logic.

### 2. Key decisions
- **Idempotent:** Drop existing + rebuild per seat (safer than dedupe)
- **Bulk insert:** Collect windows in memory, `insertMany` once per seat (faster)
- **In-memory state:** Don't hit DB between snapshots. Call `detectWindowAction` directly (no mirroring) — same function as production cron uses
- **Stop at last snapshot:** Final window stays `is_closed=false` if reset_at not yet reached; production cron will continue from there

### 3. CLI flags
- `--dry-run` — log only, no writes
- `--seat-id=<id>` — single seat
- `--batch-size=1000` — chunk snapshots if memory concern

### 4. Add npm script
`packages/api/package.json`:
```json
"scripts": {
  "backfill:windows": "tsx --env-file .env.local src/scripts/backfill-usage-windows.ts"
}
```

## Todo
- [ ] Create backfill script
- [ ] Add npm script entry
- [ ] Dry-run on prod-like data → verify window counts make sense (~24/day/seat over a week)
- [ ] Run actual backfill on dev DB → verify dashboard shows data
- [ ] Document rollback: `db.usagewindows.drop()` is safe

## Success Criteria
- Script runs without error on all seats
- Window counts: ~4-5 per 24h per seat (5h cycles)
- Dashboard `/efficiency` returns non-empty data immediately after run
- Script idempotent — rerun produces same output

## Risks
- Memory: if seat has 10k+ snapshots, chunking needed
- Snapshots with null `five_hour_resets_at` at start → partial first window
- Long backfill on prod → run during low-traffic; no locks needed (collector uses its own mutex)

## Next
Phase 4 updates API endpoint to read UsageWindow.
