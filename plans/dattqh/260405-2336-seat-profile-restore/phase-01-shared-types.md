# Phase 1: Shared Types

**Priority:** High (blocks all other phases)
**Status:** Done
**Est:** 0.5h

## Context Links
- Shared types: `packages/shared/types.ts`
- Anthropic service (OAuthProfile shape): `packages/api/src/services/anthropic-service.ts`

## Overview

Add `SeatProfile` interface + update `Seat` type + add restore-related types to shared package.

## Key Insights

- `OAuthProfile` (API-side) has nested `account` + `organization` — flatten into a single `SeatProfile` for storage/transport
- Keep fields nullable; profile may not exist for manual-mode seats
- Restore response needs a lightweight DTO (not full Seat) to avoid leaking deleted seat data

## Requirements

### Functional
- `SeatProfile` interface matching the brainstorm spec
- `Seat` type extended with optional `profile`
- `RestorableSeat` DTO for preview-token + create responses
- `CreateSeatPayload` extended (used by web hook — but the canonical type is in `use-seats.ts`, shared only has API DTOs)

### Non-functional
- No breaking changes to existing `Seat` consumers

## Related Code Files

**Modify:**
- `packages/shared/types.ts`

## Implementation Steps

### 1. Add `SeatProfile` interface

```typescript
export interface SeatProfile {
  account_name: string | null
  display_name: string | null
  org_name: string | null
  org_type: string | null
  billing_type: string | null
  rate_limit_tier: string | null
  subscription_status: string | null
  has_claude_max: boolean
  has_claude_pro: boolean
  fetched_at: string | null  // ISO string on wire
}
```

### 2. Add `RestorableSeat` DTO

```typescript
export interface RestorableSeat {
  _id: string
  label: string
  deleted_at: string
  has_history: boolean  // true if usage_snapshots exist
}
```

### 3. Update `Seat` interface

Add optional field:
```typescript
profile?: SeatProfile | null
```

Insert after `last_refreshed_at` line in existing `Seat` interface.

## Todo List

- [ ] Add `SeatProfile` interface to `packages/shared/types.ts`
- [ ] Add `RestorableSeat` interface to `packages/shared/types.ts`
- [ ] Add `profile?: SeatProfile | null` to `Seat` interface
- [ ] Run `pnpm -F @repo/shared build` (or typecheck) to verify no errors
- [ ] Verify web + api packages still compile: `pnpm build`

## Success Criteria

- `SeatProfile` and `RestorableSeat` exported from shared
- `Seat.profile` optional — no breaking changes
- All packages compile

## Risk Assessment

- **Low risk** — additive-only changes to types file
