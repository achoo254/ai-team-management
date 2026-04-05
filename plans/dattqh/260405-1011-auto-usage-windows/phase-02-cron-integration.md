# Phase 2 — Cron integration in usage-collector

## Overview
**Priority:** Critical | **Status:** pending | **Depends on:** Phase 1
Hook detector into existing 5-min cron. Apply detector action after each snapshot save.

## Files to modify
- `packages/api/src/services/usage-collector-service.ts` — call applier after `UsageSnapshot.create()`

## Files to create
- `packages/api/src/services/usage-window-applier.ts` — DB ops for detector actions
- `tests/api/usage-window-applier.test.ts` — integration tests with in-memory Mongo

## Implementation Steps

### 1. `usage-window-applier.ts`
```ts
export async function applyWindowForSeat(params: {
  seat_id: ObjectId
  owner_id: ObjectId          // caller MUST ensure non-null (skip seat if missing)
  snapshotNow: IUsageSnapshot
}): Promise<void>
```
Flow:
1. Query `snapshotPrev`: `UsageSnapshot.findOne({seat_id, _id: {$ne: snapshotNow._id}}).sort({fetched_at:-1}).limit(1)`
2. Query `openWindow`: `UsageWindow.findOne({seat_id, is_closed:false})`
3. Query `snapshotStart` (if openWindow exists): `UsageSnapshot.findById(openWindow.snapshot_start_id)`
4. Call `detectWindowAction({...snapshotStart, snapshotPrev, snapshotNow, openWindow})` from Phase 1
4. Execute action:
   - `noop` → return
   - `create_partial` → `UsageWindow.create(payload)` with `is_partial=true`
   - `open_new` → create new first, then close old (2 separate ops, see below)
   - `update_open` → `UsageWindow.updateOne({_id}, {$set: patch, updated_at: now})`
5. Wrap in try/catch — log error, don't fail snapshot write

**`open_new` execution (no transaction — KISS):**
```ts
// Step 1: create new window (idempotent via unique index seat_id + window_start)
await UsageWindow.create(newWindowPayload)

// Step 2: close old window with conditional guard
await UsageWindow.updateOne(
  {_id: oldWindowId, is_closed: false},   // prevents double-close race
  {$set: closePatch}
)
```
Failure mode: if step 2 fails (crash between ops), 2 open windows exist briefly. Stale-close cron heals within 30 min. Aggregations filter `is_closed=true` → no user-facing impact. **No replica set required.**

### 2. Integrate into `usage-collector-service.ts`
After line 67 (`await UsageSnapshot.create(...)`)

```ts
const created = await UsageSnapshot.create({...})  // change to capture result
// ... Seat.findByIdAndUpdate ...

// Filter guard: only apply window if seat has owner_id
if (seat.owner_id) {
  await applyWindowForSeat({
    seat_id: seat._id,
    owner_id: seat.owner_id,
    snapshotNow: created,
  }).catch(err => console.error('[UsageWindow] apply failed:', err))
} else {
  console.warn(`[UsageWindow] seat ${seat.label} has no owner_id, skipping window tracking`)
}
```

### 3. Update seat query in `collectAllUsage()`
Current: `.select('+oauth_credential')` — ADD `owner_id` to returned fields (lean project).
Also `collectSeatUsage()` single-seat variant.

### 4. Safety cron (stale window auto-close)
Add to `packages/api/src/index.ts` cron jobs:
- Every 30 min: find `UsageWindow` where `is_closed=false AND window_end < now()` → close them.
- Reason: if reset_at expired but no new snapshot detected transition (missed ticks).

```ts
cron.schedule('*/30 * * * *', closeStaleUsageWindows)
```

Implementation in `usage-window-applier.ts`:
```ts
export async function closeStaleUsageWindows(): Promise<number>
```

## Todo
- [ ] Create `usage-window-applier.ts`
- [ ] Hook into `fetchSeatUsage()` post-create
- [ ] Include `owner_id` in seat queries
- [ ] Add stale-close cron to index.ts
- [ ] Integration test: simulate 2 snapshots same cycle → window open, updated
- [ ] Integration test: simulate reset_at change → new window created, old closed
- [ ] Test crash recovery: kill between create+close → stale-close cron heals
- [ ] Integration test: stale close — window open past window_end
- [ ] `pnpm -F @repo/api build` passes

## Success Criteria
- Cron tick creates/updates UsageWindow automatically
- No error logs during normal operation
- Stale windows auto-close within 30 min of expiry

## Risks
- Applier throws → snapshot write still succeeds (try/catch wrapper)
- Race condition between cron tick + stale-close → use `$set` idempotent updates, version field optional
- Owner_id missing on legacy seats → skip window, log warning

## Next
Phase 3 backfills historical windows.
