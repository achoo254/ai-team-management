# Phase 1 — UsageWindow model + detection service

## Overview
**Priority:** Critical | **Status:** pending
Create Mongoose model + pure detection function. No side effects yet.

## Requirements
- Model persists 5h billing cycle as a window row
- Detection function: pure, takes 2 snapshots + current open window → returns action (create/close/update)
- Unit-testable without DB

## Files to create
- `packages/api/src/models/usage-window.ts` — Mongoose schema
- `packages/api/src/services/usage-window-detector.ts` — pure detection logic
- `tests/api/usage-window-detector.test.ts` — unit tests

## Implementation Steps

### 1. `usage-window.ts` model
```ts
export interface IUsageWindow extends Document {
  seat_id: Types.ObjectId
  owner_id: Types.ObjectId
  window_start: Date
  window_end: Date                  // expected close time (= five_hour_resets_at while open)
  is_closed: boolean
  is_partial: boolean               // true if no S_prev available at creation
  duration_hours: number
  utilization_pct: number           // peak five_hour_pct observed in window
  delta_7d_pct: number              // = snapshot_end.seven_day_pct - snapshot_start.seven_day_pct
  delta_7d_sonnet_pct: number       // same formula, sonnet bucket
  delta_7d_opus_pct: number         // same formula, opus bucket
  impact_ratio: number | null       // delta_7d_pct / utilization_pct (null if util < 1)
  is_waste: boolean
  peak_hour_of_day: number | null   // 0-23, Asia/Ho_Chi_Minh — hour when largest delta occurred
  snapshot_start_id: Types.ObjectId | null
  snapshot_end_id: Types.ObjectId | null
  created_at: Date
  updated_at: Date
}
```
Indexes:
- `{seat_id: 1, window_start: -1}`
- `{owner_id: 1, window_start: -1}`
- `{window_start: -1}`
- `{is_closed: 1, seat_id: 1}` — for finding open window per seat
- Unique: `{seat_id: 1, window_start: 1}` — dedup for idempotent backfill

### 2. `usage-window-detector.ts` (pure logic)
Exports:
```ts
type DetectorInput = {
  seat_id: ObjectId
  owner_id: ObjectId              // REQUIRED — caller must filter seats without owner_id upfront
  snapshotNow: { fetched_at, five_hour_pct, five_hour_resets_at, seven_day_pct, seven_day_sonnet_pct, seven_day_opus_pct, _id }
  snapshotPrev: same | null
  snapshotStart: same | null      // start snapshot of openWindow (for delta computation)
  openWindow: IUsageWindow | null
}
type DetectorAction =
  | { kind: 'noop' }
  | { kind: 'create_partial'; payload: Partial<IUsageWindow> }
  | { kind: 'open_new'; closePrev: Partial<IUsageWindow>; createNew: Partial<IUsageWindow> }
  | { kind: 'update_open'; windowId: ObjectId; patch: Partial<IUsageWindow> }

export function detectWindowAction(input: DetectorInput): DetectorAction
```

Logic:
```
if snapshotNow.five_hour_resets_at == null → noop
if openWindow == null && snapshotPrev == null → create_partial (first-ever snapshot for seat)
if openWindow == null && snapshotPrev != null:
  → treat as create_partial starting from snapshotPrev (backfill case)
if snapshotNow.five_hour_resets_at !== snapshotPrev.five_hour_resets_at → open_new
else → update_open with utilization=max, delta_7d recompute, peak_hour track
```

### 3. Helper functions
- `computeUtilization(openWindow, snapshotNow)` → `max(openWindow.utilization_pct, snapshotNow.five_hour_pct)`
- `computeDelta7d(snapshotStart, snapshotNow)` → `snapshotNow.seven_day_pct - snapshotStart.seven_day_pct` (clamp ≥ 0). **Formula: end − start.**
- `computeImpactRatio(delta_7d, utilization)` → `utilization < 1 ? null : delta_7d / utilization`
- `computeIsWaste(duration_hours, utilization)` → `duration_hours >= 2 && utilization < 5`
- `getPeakHourVN(fetched_at)` → number 0-23 (Asia/Ho_Chi_Minh timezone)
- `trackPeakHour(openWindow, snapshotPrev, snapshotNow)` → update `peak_hour_of_day` if current delta > previous max delta

**Important:** snapshot_start (captured at window creation) is the reference point. All deltas computed vs this fixed anchor. **Applier layer** (Phase 2) queries `snapshotStart` via `openWindow.snapshot_start_id` and passes it into detector input — keeps detector pure, schema clean (no denormalization).

## Todo
- [ ] Create `usage-window.ts` model
- [ ] Create `usage-window-detector.ts` with pure detector
- [ ] Write unit tests covering: null resets_at, first snapshot, same-cycle update, reset transition, partial window
- [ ] `pnpm -F @repo/api build` — no TS errors

## Success Criteria
- Detector returns correct action for all 4 scenarios in tests
- Model compiles, indexes defined
- 100% branch coverage on detector (no DB)

## Risks
- Timezone: `peak_hour_of_day` must use Asia/Ho_Chi_Minh consistently with dashboard aggregations
- Edge: reset_at can shift if Claude API returns different value mid-cycle (use `!==` comparison by timestamp)

## Next
Phase 2 integrates detector into cron.
