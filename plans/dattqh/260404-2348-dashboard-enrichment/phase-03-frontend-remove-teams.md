# Phase 3: Frontend — Remove Teams

## Overview
- **Priority:** High
- **Status:** completed
- **Effort:** M (upgraded from S — more files than initially estimated)
- **Completed:** 2026-04-05
- **Depends on:** Phase 1 (backend Teams removed)

## Key Insight
Codebase scan found **31 frontend files** referencing "team". After filtering false positives (login text "Team Claude", CSS, chart colors), **~17 files** need modification.

## Files to DELETE (6 files)
- `packages/web/src/pages/teams.tsx`
- `packages/web/src/pages/team-detail.tsx`
- `packages/web/src/components/team-card.tsx`
- `packages/web/src/components/team-form-dialog.tsx`
- `packages/web/src/components/dashboard-team-stats.tsx`
- `packages/web/src/hooks/use-teams.ts`

## Files to MODIFY (11 files)

### Navigation & Routing
1. **`app.tsx`** — Remove Teams page imports + `/teams` routes
2. **`components/app-sidebar.tsx`** — Remove "Teams" nav item
3. **`components/mobile-nav.tsx`** — Remove "Teams" nav item
4. **`components/header.tsx`** — Remove "/teams" from breadcrumb map

### Auth & Types
5. **`components/auth-provider.tsx`** — Remove `team_ids` from AuthUser type
6. **`hooks/use-admin.ts`** — Remove `team_ids` from AdminUser type + mutation params
7. **`hooks/use-seats.ts`** — Remove `SeatTeam` interface, `team_id`/`team` from Seat type
8. **`hooks/use-schedules.ts`** — Remove `team_id`/`team` from Schedule seat type
9. **`hooks/use-user-settings.ts`** — Remove `team_id`/`team` from seat type

### Admin UI
10. **`components/user-form-dialog.tsx`** — Remove team selector dropdown, `team_ids` from form state, `useTeams` import
11. **`components/user-table.tsx`** — Remove Team column, `useTeams` import, team badge rendering

### Seat & Usage Display
12. **`components/seat-card.tsx`** — Remove team badge ("No team" fallback), simplify display
13. **`components/seat-form-dialog.tsx`** — Remove team selector, `useTeams` import
14. **`components/usage-snapshot-card.tsx`** — Remove team badge from seat display

### Dashboard & Settings
15. **`components/dashboard-seat-filter.tsx`** — Remove "group by team" logic, use flat seat list instead
16. **`components/dashboard-seat-efficiency.tsx`** — Remove `team_id`/`team_name` display
17. **`components/watched-seats-card.tsx`** — Remove team grouping, use flat seat list
18. **`pages/dashboard.tsx`** — Remove DashboardTeamStats import + render

### NOT modifying (false positives)
- `pages/login.tsx` — "Quản lý Team Claude" is product name, not Teams feature
- `tailwind.css` — no team references
- `lib/chart-colors.ts` — no team references

## Implementation Steps

### 1. Delete team-specific files
1. Delete 6 files listed above

### 2. Clean navigation & routing
1. Remove Teams imports + routes from `app.tsx`
2. Remove Teams nav item from `app-sidebar.tsx` + `mobile-nav.tsx`
3. Remove "/teams" from header breadcrumb map

### 3. Clean auth & type definitions
1. Remove `team_ids` from AuthUser in `auth-provider.tsx`
2. Remove `team_ids` from AdminUser + mutation in `use-admin.ts`
3. Remove `SeatTeam`, `team_id`, `team` from `use-seats.ts`
4. Remove team fields from `use-schedules.ts` + `use-user-settings.ts`

### 4. Clean admin UI
1. Remove team selector from `user-form-dialog.tsx` (entire Teams section + state + imports)
2. Remove Team column from `user-table.tsx` (header + cell + imports)

### 5. Clean seat & usage display
1. Remove team badge from `seat-card.tsx`
2. Remove team selector from `seat-form-dialog.tsx`
3. Remove team badge from `usage-snapshot-card.tsx`

### 6. Clean dashboard & settings
1. Flatten seat list in `dashboard-seat-filter.tsx` (remove team grouping)
2. Remove team display from `dashboard-seat-efficiency.tsx`
3. Flatten seat list in `watched-seats-card.tsx` (remove team grouping)
4. Remove DashboardTeamStats from `dashboard.tsx`

### 7. Compile check
1. `pnpm -F @repo/web build`

## Todo List
- [x] Delete 6 team-specific files
- [x] Clean app.tsx routes
- [x] Clean sidebar + mobile-nav + header
- [x] Clean auth-provider (team_ids)
- [x] Clean use-admin hook (team_ids)
- [x] Clean use-seats hook (SeatTeam, team_id, team)
- [x] Clean use-schedules + use-user-settings hooks
- [x] Clean user-form-dialog (team selector)
- [x] Clean user-table (Team column)
- [x] Clean seat-card (team badge)
- [x] Clean seat-form-dialog (team selector)
- [x] Clean usage-snapshot-card (team badge)
- [x] Clean dashboard-seat-filter (team grouping → flat)
- [x] Clean dashboard-seat-efficiency (team display)
- [x] Clean watched-seats-card (team grouping → flat)
- [x] Clean dashboard.tsx (DashboardTeamStats)
- [x] Compile check passes

## Success Criteria
- Zero `useTeams` imports in codebase
- Zero `team_id`/`team_ids` type references in hooks
- Zero team badges/selectors in UI components
- `pnpm -F @repo/web build` passes
- All pages render without errors

## Risk Assessment
- `dashboard-seat-filter.tsx` currently groups seats by team → need alternative grouping or flat list
- `watched-seats-card.tsx` groups seats by team → flat list with seat labels
- `user-form-dialog.tsx` has significant team logic (add/remove) → simplify form state
