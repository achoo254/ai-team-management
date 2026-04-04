# Phase 1: Types & Models

## Priority: High | Status: completed

## Overview
Update shared types, Alert model enum, add metadata field, create Settings model for admin-configurable thresholds.

## Files to Modify
- `packages/shared/types.ts` — Update Alert type, add Settings + AlertMetadata types
- `packages/api/src/models/alert.ts` — New type enum + metadata field
- `packages/api/src/config.ts` — Add default alert thresholds as fallback

## Files to Create
- `packages/api/src/models/setting.ts` — Settings model (single document pattern)

## Implementation Steps

### 1. Update `packages/shared/types.ts`

Replace Alert interface:
```ts
export type AlertType = 'rate_limit' | 'extra_credit' | 'token_failure'

export interface AlertMetadata {
  window?: '5h' | '7d' | '7d_sonnet' | '7d_opus'
  pct?: number
  credits_used?: number
  credits_limit?: number
  error?: string
}

export interface Alert {
  _id: string
  seat_id: string
  type: AlertType
  message: string
  metadata?: AlertMetadata
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface AlertSettings {
  rate_limit_pct: number   // default 80
  extra_credit_pct: number // default 80
}

export interface AppSettings {
  _id?: string
  alerts: AlertSettings
}
```

### 2. Update `packages/api/src/models/alert.ts`

- Change `type` enum: `['rate_limit', 'extra_credit', 'token_failure']`
- Add `metadata` field: `Schema.Types.Mixed`, default `{}`
- Add compound index: `{ seat_id: 1, type: 1, resolved: 1 }` (for dedup queries)
- Remove old `resolved` simple index (replaced by compound)

### 3. Create `packages/api/src/models/setting.ts`

Single-document pattern:
```ts
// Schema: { alerts: { rate_limit_pct: Number, extra_credit_pct: Number } }
// Static method: Setting.getOrCreate() — findOne or create with defaults
// Defaults: rate_limit_pct=80, extra_credit_pct=80
```

Collection will have at most 1 document. Use `findOne()` + upsert.

### 4. Update `packages/api/src/config.ts`

Add defaults under `alerts`:
```ts
alerts: {
  defaultRateLimitPct: 80,
  defaultExtraCreditPct: 80,
}
```
Remove `highUsagePct` and `inactivityWeeks` (no longer used).

## Todo
- [x] Update Alert interface in shared/types.ts
- [x] Add AlertMetadata, AlertSettings, AppSettings types
- [x] Update alert.ts model — new enum, metadata, compound index
- [x] Create setting.ts model with getOrCreate static
- [x] Update config.ts — new defaults, remove old
- [x] Run `pnpm build` to verify no type errors

## Success Criteria
- `pnpm build` passes with 0 errors
- Setting model can getOrCreate with defaults
- Alert model accepts new types + metadata
