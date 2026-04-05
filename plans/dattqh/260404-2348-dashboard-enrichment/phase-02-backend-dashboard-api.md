# Phase 2: Backend — Dashboard API Enrichment

## Overview
- **Priority:** High
- **Status:** completed
- **Effort:** M (medium)
- **Completed:** 2026-04-05
- **Depends on:** Phase 1 (Teams removed, no more teamUsage in /enhanced)

## Key Insights
- /enhanced already has 8+ DB queries — additions must be lightweight (computed from existing data)
- Seat model has `token_active` and `last_fetch_error` — available without extra query
- `Seat.owner_id` exists but never populated in dashboard routes
- After removing Teams: no team_id on seats, no teamUsage in response

## Requirements

### Extend /enhanced response
1. `tokenIssueCount` — count of seats where `token_active=false` OR `last_fetch_error` truthy (computed, no extra query)
2. `fullSeatCount` — seats where user_count >= max_users (computed from usagePerSeat)
3. `owner_name` per seat in usagePerSeat (1 batch User query by owner_ids)
4. Remove `teamUsage` from response (already removed in Phase 1)
5. Remove `team_id` from usagePerSeat items

### New /personal endpoint
```
GET /api/dashboard/personal
Auth: any logged-in user

Response: {
  mySchedulesToday: [{ seat_label, start_hour, end_hour, usage_budget_pct }],
  mySeats: [{ seat_id, label, role: 'owner' | 'member' }],
  myUsageRank: { rank: number, total: number, avgDelta5h: number } | null
}
```

## Related Code Files

### Modify
- `packages/api/src/routes/dashboard.ts` — extend /enhanced, add /personal
- `packages/web/src/hooks/use-dashboard.ts` — update types + new hook

### Read for context
- `packages/api/src/models/seat.ts` — token_active, owner_id
- `packages/api/src/models/session-metric.ts` — user_id, delta fields
- `packages/api/src/middleware.ts` — getAllowedSeatIds

## Implementation Steps

### 1. Extend /enhanced
1. After seats query, compute `tokenIssueCount` from fetched seats array
2. Collect unique non-null `owner_id` from seats, batch-query User names
3. Build `ownerMap` (owner_id string → name)
4. In usagePerSeat map: add `owner_name` from ownerMap, remove `team_id`
5. Compute `fullSeatCount` from usagePerSeat (where user_count >= max_users)
6. Add tokenIssueCount + fullSeatCount to response
7. Remove teamUsage from response (if not already removed in Phase 1)

### 2. New /personal endpoint
1. Add `GET /personal` route
2. Query today's schedules: `Schedule.find({ user_id: req.user._id, day_of_week: today })` → populate seat_id label
3. Query owned seats: `Seat.find({ owner_id: req.user._id }, 'label')`
4. Get user's seat_ids from DB, query those seats, merge with owned, label role
5. Aggregate SessionMetric: user's avg delta_5h vs all users → compute rank
6. Return combined response

### 3. Update TypeScript types
1. Remove `team_id` from `SeatUsageItem`, remove `TeamUsageItem` from hooks
2. Add `tokenIssueCount`, `fullSeatCount` to `EnhancedDashboardData`
3. Add `owner_name` to `SeatUsageItem`
4. Add `PersonalDashboardData` interface + `usePersonalDashboard` hook

## Todo List
- [x] Extend /enhanced: tokenIssueCount (computed)
- [x] Extend /enhanced: owner_name per seat (1 batch query)
- [x] Extend /enhanced: fullSeatCount (computed)
- [x] Clean /enhanced: remove team_id + teamUsage
- [x] New /personal: mySchedulesToday
- [x] New /personal: mySeats (owned + assigned with role)
- [x] New /personal: myUsageRank
- [x] Update use-dashboard.ts types + new hook
- [x] Compile check: `pnpm -F @repo/api build`

## Success Criteria
- /enhanced returns new fields, no team references
- /personal returns user-scoped data in <200ms
- No regression in existing dashboard behavior

## Security
- /personal uses req.user._id — no cross-user data leak
- Rank aggregation returns position only, no other user identities
- owner_name is non-sensitive (visible in seats page already)
