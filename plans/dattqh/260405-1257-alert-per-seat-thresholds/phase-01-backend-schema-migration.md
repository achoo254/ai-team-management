# Phase 01 — Backend Schema + Migration

**Priority:** P0 | **Status:** pending

## Context

- Brainstorm report: `plans/dattqh/reports/Explore-260405-Alert-Architecture.md`
- Models to modify: `packages/api/src/models/user.ts`, `packages/api/src/models/alert.ts`
- Migration script dir: `packages/api/src/scripts/`

## Requirements

### User Model Changes

**Remove fields** from `user.alert_settings`:
- `rate_limit_pct`
- `extra_credit_pct`

**Add fields** to `user.alert_settings`:
- `desktop_enabled: boolean` (default `false`) — mirror of existing `push_enabled` but as user-facing toggle
  - _Decision_: Reuse existing `user.push_enabled` — do NOT duplicate. Skip this field.
- `telegram_enabled: boolean` (default `true`) — new, explicit telegram channel toggle
  - _Decision_: Add this. Before, telegram was implicitly enabled if bot configured. New: explicit control.

**Final `alert_settings` shape:**
```ts
{
  enabled: boolean              // master on/off
  telegram_enabled: boolean     // send via Telegram channel
  token_failure_enabled: boolean
}
```
(Desktop push controlled by existing `user.push_enabled` field.)

**Replace** `watched_seat_ids: ObjectId[]` with:
```ts
watched_seats: [{
  seat_id: ObjectId (ref: Seat)
  threshold_5h_pct: number (1-100, default 90)
  threshold_7d_pct: number (1-100, default 85)
}]
```

### Alert Model Changes

**Remove** from `type` enum: `'extra_credit'`

**Add fields**:
- `user_id: ObjectId | null` (nullable — seat-wide alerts like 7d_risk don't need it)
- `window: '5h' | '7d' | null` (null for non-windowed alert types)

**New compound index** for dedup:
```ts
alertSchema.index({ user_id: 1, seat_id: 1, type: 1, window: 1, created_at: -1 })
```

Keep existing indexes.

## Architecture

```
User (before):
  alert_settings: { enabled, rate_limit_pct, extra_credit_pct, token_failure_enabled }
  watched_seat_ids: [ObjectId]

User (after):
  alert_settings: { enabled, telegram_enabled, token_failure_enabled }
  watched_seats: [{ seat_id, threshold_5h_pct, threshold_7d_pct }]

Alert (before):                     Alert (after):
  seat_id                             user_id (nullable)
  type (6 values)                     seat_id
  ...                                 type (5 values, extra_credit removed)
                                      window ('5h' | '7d' | null)
                                      ...
```

## Related Files

**Modify:**
- `packages/api/src/models/user.ts` — interface + schema
- `packages/api/src/models/alert.ts` — interface + schema + indexes
- `packages/shared/types.ts` — DTOs (`UserAlertSettings`, `WatchedSeat`, `AlertType`)

**Create:**
- `packages/api/src/scripts/migrate-alert-per-seat-thresholds.ts` — migration runner

## Implementation Steps

### Step 1: Update shared types
File: `packages/shared/types.ts`

```ts
export type AlertType = 'rate_limit' | 'token_failure' | 'usage_exceeded' | 'session_waste' | '7d_risk'
export type AlertWindow = '5h' | '7d' | null

export interface UserAlertSettings {
  enabled: boolean
  telegram_enabled: boolean
  token_failure_enabled: boolean
}

export interface WatchedSeat {
  seat_id: string
  threshold_5h_pct: number
  threshold_7d_pct: number
}
```

### Step 2: Update User model
- Update `IAlertSettings` interface (remove 2 fields, add `telegram_enabled`)
- Add new `IWatchedSeat` interface
- Update `IUser`: replace `watched_seat_ids?` with `watched_seats?: IWatchedSeat[]`
- Update schema definition + defaults

### Step 3: Update Alert model
- Remove `'extra_credit'` from type enum
- Add `user_id` field (`Schema.Types.ObjectId`, `ref: 'User'`, not required)
- Add `window` field (`String`, enum `['5h', '7d']`, default null)
- Add compound dedup index

### Step 4: Write migration script
File: `packages/api/src/scripts/migrate-alert-per-seat-thresholds.ts`

```ts
// Pseudocode
async function migrate() {
  // 1. Users: drop old fields, init new shape
  await User.updateMany({}, {
    $unset: {
      'alert_settings.rate_limit_pct': '',
      'alert_settings.extra_credit_pct': '',
      'watched_seat_ids': '',
    },
    $set: {
      'alert_settings.telegram_enabled': true,
      'watched_seats': [],
    },
  })

  // 2. Alerts: drop extra_credit type records + backfill window=null for existing
  await Alert.deleteMany({ type: 'extra_credit' })
  await Alert.updateMany({ window: { $exists: false } }, { $set: { window: null, user_id: null } })

  console.log('Migration complete')
}
```

Add to `package.json` scripts: `"migrate:alert-thresholds": "tsx --env-file .env.local src/scripts/migrate-alert-per-seat-thresholds.ts"`

### Step 5: Typecheck
Run `pnpm -F @repo/api build` to verify no TS errors.

## Todo

- [ ] Update `packages/shared/types.ts`
- [ ] Update `packages/api/src/models/user.ts`
- [ ] Update `packages/api/src/models/alert.ts`
- [ ] Write `migrate-alert-per-seat-thresholds.ts`
- [ ] Add npm script
- [ ] Typecheck passes
- [ ] Run migration on dev DB, verify via `mcp__plugin_mongodb_mongodb__find`

## Success Criteria

- Typecheck green.
- After migration: all users have `watched_seats: []`, `alert_settings` has only 3 fields.
- No `extra_credit` alerts remain.
- New Alert records can be created with `window` + `user_id`.

## Risks

- **Data loss**: Old `watched_seat_ids` bị xoá hoàn toàn. Mitigation: backup DB trước khi chạy.
- **Type breakage**: `AlertType` removal có thể break alert-service, telegram-service, fcm-service formatters. Phase 02 xử lý.

## Security

- No new auth surface. Migration runs with admin DB credentials (existing pattern).
- `user_id` in Alert is nullable to support seat-wide alerts; never expose other users' alerts via API (handled Phase 02).
