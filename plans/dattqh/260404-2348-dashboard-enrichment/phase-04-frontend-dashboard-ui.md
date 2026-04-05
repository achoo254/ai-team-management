# Phase 4: Frontend — Adaptive Dashboard UI

## Overview
- **Priority:** High
- **Status:** completed
- **Effort:** M (medium)
- **Completed:** 2026-04-05
- **Depends on:** Phase 2 (API returns new fields), Phase 3 (team components removed)

## Requirements

### Update existing components

1. **DashboardStatOverview**
   - Add token health warning badge (admin only): "X seats có vấn đề" using `tokenIssueCount`
   - Update "Seats" sub text: include `fullSeatCount` indicator
   - Remove any team references

2. **DashboardDetailTable**
   - Remove "Team" column entirely
   - Add owner display: show `owner_name` as subtitle under seat label
   - Differentiate owner vs assigned users visually

3. **DashboardPage**
   - Remove DashboardTeamStats (done in Phase 3)
   - Add DashboardPersonalContext for non-admin users
   - Adjust grid layout (team stats slot freed up)

### New component

4. **DashboardPersonalContext** (non-admin only)
   - Uses `usePersonalDashboard()` hook
   - Three sections in card layout:
     - **My Schedule Today**: slots with time, seat label. Highlight current/next.
     - **My Seats**: list with role badge (owner/member)
     - **My Usage**: rank "Bạn xếp thứ X/Y" with avg delta

## Related Code Files

### Modify
- `packages/web/src/pages/dashboard.tsx`
- `packages/web/src/components/dashboard-stat-overview.tsx`
- `packages/web/src/components/dashboard-detail-table.tsx`

### Create
- `packages/web/src/components/dashboard-personal-context.tsx`

## Implementation Steps

1. Update DashboardStatOverview: token badge (admin), fullSeatCount
2. Update DashboardDetailTable: remove Team column, add owner_name
3. Create dashboard-personal-context.tsx
4. Wire into dashboard.tsx: `{user?.role !== 'admin' && <DashboardPersonalContext />}`
5. Adjust grid layout where team stats was
6. Compile check: `pnpm -F @repo/web build`

## Todo List
- [x] Update stat overview: token badge + full seats
- [x] Update detail table: remove Team, add owner
- [x] Create personal context component
- [x] Wire into dashboard page
- [x] Adjust layout
- [x] Compile check passes

## Success Criteria
- Admin sees token health badge on dashboard
- Users see personal context (schedule, seats, rank)
- No team column in detail table
- Owner clearly shown per seat
- Responsive layout works on mobile
