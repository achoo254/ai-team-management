# Phase 4: Frontend — Token Management + Snapshots UI

## Context Links
- Plan: `./plan.md`
- Depends on: `./phase-03-api-routes.md`

## Overview
- **Priority:** Medium
- **Status:** completed
- **Description:** Add UI for admin to manage seat tokens, view latest usage snapshots, trigger manual collection, and view historical charts.

## Key Insights
- Existing UI pattern: shadcn/ui components, TanStack Query hooks, Tailwind v4
- Seat management page already exists — extend it for token management
- Usage snapshots need a new section/page for metrics dashboard
- From screenshot: usage displayed as progress bars with percentages — replicate pattern
- Use `has_token` virtual field from Seat to show token status badge (no access_token in frontend)
- raw_response excluded from API by default — lighter payloads for list views

## Requirements

### Functional
- Admin can set/remove access token per seat (dialog/modal)
- Dashboard shows latest usage snapshot per seat (session %, week %, sonnet %)
- Admin can trigger manual collection (button)
- Historical chart view: usage trends over time per seat

### Non-functional
- Token input field uses password type (hidden by default)
- Loading states during collection
- Auto-refresh after collection completes

## Related Code Files

### Create
- `packages/web/src/hooks/use-usage-snapshots.ts` — TanStack Query hooks
- `packages/web/src/components/seat-token-dialog.tsx` — Token set/remove dialog
- `packages/web/src/components/usage-snapshot-card.tsx` — Single seat usage display
- `packages/web/src/components/usage-snapshot-list.tsx` — Grid of snapshot cards
- `packages/web/src/pages/usage-metrics.tsx` — New page for metrics dashboard

### Modify
- `packages/web/src/app.tsx` — Add route for usage-metrics page
- `packages/web/src/components/sidebar.tsx` or nav — Add nav link
- `packages/web/src/hooks/use-seats.ts` — May need to include token_active in seat queries

## Implementation Steps

### 1. Create `packages/web/src/hooks/use-usage-snapshots.ts`
TanStack Query hooks:
- `useLatestSnapshots()` — GET `/api/usage-snapshots/latest`
- `useUsageSnapshots(params)` — GET `/api/usage-snapshots?seatId=&from=&to=`
- `useCollectAllUsage()` — POST mutation `/api/usage-snapshots/collect`
- `useCollectSeatUsage()` — POST mutation `/api/usage-snapshots/collect/:seatId`
- `useSetSeatToken()` — PUT mutation `/api/seats/:id/token`
- `useRemoveSeatToken()` — DELETE mutation `/api/seats/:id/token`

### 2. Create `packages/web/src/components/seat-token-dialog.tsx`
- Dialog with seat name as title
- Password input for access token
- "Save" and "Remove Token" buttons
- Show `has_token` badge, `token_active` status and `last_fetch_error` if any
- Admin only

### 3. Create `packages/web/src/components/usage-snapshot-card.tsx`
- Card per seat showing:
  - Seat label + team badge
  - 3 progress bars: Session (5h), Week (7d), Sonnet (7d)
  - Percentage values with color coding (green < 50%, yellow 50-80%, red > 80%)
  - Reset time display
  - Last fetched timestamp
  - Refresh button (single seat collect)
- Pattern matches existing screenshot UI

### 4. Create `packages/web/src/components/usage-snapshot-list.tsx`
- Grid layout of UsageSnapshotCards
- "Collect All" button (admin)
- Auto-refresh toggle (optional)
- Filter by team

### 5. Create `packages/web/src/pages/usage-metrics.tsx`
- Latest snapshots grid (primary view)
- Historical chart section (Recharts line chart — usage % over time)
- Date range picker for history
- Seat selector for chart focus

### 6. Update routing + navigation
- Add `/usage-metrics` route in app.tsx
- Add nav link with chart icon

## Todo List
- [x] Create use-usage-snapshots.ts hook
- [x] Create seat-token-dialog.tsx
- [x] Create usage-snapshot-card.tsx
- [x] Create usage-snapshot-list.tsx
- [x] Create usage-metrics.tsx page
- [x] Add route + nav link
- [x] Test: set token → collect → view snapshots
- [x] Verify build passes

## Success Criteria
- Admin can set/remove tokens via dialog
- Latest usage displayed per seat with progress bars
- Manual collect trigger works with loading state
- Historical chart shows trends
- Responsive layout (mobile-friendly)
- `pnpm build` passes

## Risk Assessment
- **UI complexity**: Keep MVP simple — cards + chart. Defer advanced filtering to later
- **Chart performance**: Limit query to last 7 days by default, paginate history

## Security Considerations
- Token input never shown after save (password field, no prefill)
- Token management UI only visible to admin role
- No token data in frontend state/cache
