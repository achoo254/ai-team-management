# Phase 3 Implementation Report — Frontend Remove Teams

## Phase
- Phase: phase-03-frontend-remove-teams
- Plan: D:\CONG VIEC\quan-ly-team-claude\plans\dattqh\260404-2348-dashboard-enrichment\
- Status: completed

## Files Deleted (6)
- `packages/web/src/pages/teams.tsx`
- `packages/web/src/pages/team-detail.tsx`
- `packages/web/src/components/team-card.tsx`
- `packages/web/src/components/team-form-dialog.tsx`
- `packages/web/src/components/dashboard-team-stats.tsx`
- `packages/web/src/hooks/use-teams.ts`

## Files Modified (19)

### Routing & Navigation
- `packages/web/src/app.tsx` — removed TeamsPage/TeamDetailPage imports + `/teams`, `/teams/:id` routes
- `packages/web/src/components/app-sidebar.tsx` — removed Teams nav item + `Users` lucide import
- `packages/web/src/components/mobile-nav.tsx` — removed Teams sheet item + `Users` lucide import
- `packages/web/src/components/header.tsx` — removed `/teams` from pageTitles map

### Types & Hooks
- `packages/web/src/components/auth-provider.tsx` — removed `team_ids` from AuthUser
- `packages/web/src/hooks/use-admin.ts` — removed `team_ids` from AdminUser + useCreateUser mutationFn
- `packages/web/src/hooks/use-seats.ts` — removed SeatTeam interface, `team_id`/`team` from Seat; removed `team_ids` from useAvailableUsers response type
- `packages/web/src/hooks/use-schedules.ts` — removed `team_id`/`team` from SeatWithUsers
- `packages/web/src/hooks/use-user-settings.ts` — removed `team_id`/`team` from AvailableSeat
- `packages/web/src/hooks/use-dashboard.ts` — removed `team_id`/`team_name` from SeatUsageItem; removed TeamUsageItem interface + `teamUsage` from EnhancedDashboardData

### Admin UI
- `packages/web/src/components/user-form-dialog.tsx` — removed team selector section, `useTeams` import, `team_ids` from FormState
- `packages/web/src/components/user-table.tsx` — removed Team column header + cell, `useTeams` import

### Seat & Usage Display
- `packages/web/src/components/seat-card.tsx` — removed team/no-team Badge display
- `packages/web/src/components/seat-form-dialog.tsx` — removed team selector, `useTeams` import, `team_id` from form state
- `packages/web/src/components/usage-snapshot-card.tsx` — removed team badge from seat prop type + render; removed unused Badge import

### Dashboard & Settings
- `packages/web/src/components/dashboard-seat-filter.tsx` — removed team group label chip from seat list items
- `packages/web/src/components/dashboard-seat-efficiency.tsx` — removed `team_id` from calcEfficiency; removed `team_name` from tooltip
- `packages/web/src/components/watched-seats-card.tsx` — replaced team-grouped layout with flat seat list
- `packages/web/src/pages/dashboard.tsx` — removed DashboardTeamStats import + render; collapsed Row 3 to single efficiency chart

### Bonus fix (not in phase spec)
- `packages/web/src/components/member-sidebar.tsx` — removed `team` prop from DraggableMember (referenced `seat.team?.name` from now-deleted field); removed unused Badge import

## Tests Status
- TypeScript: PASS (tsc -b clean)
- Vite build: PASS (622ms, 2736 modules)
- Bundle size warning present (>500kB) — pre-existing, not caused by this phase

## Issues Encountered
- `member-sidebar.tsx` was not in the phase spec but had a compile error (`seat.team?.name`) — fixed as part of this phase
- `dashboard-detail-table.tsx` also not in spec but contained `s.team_name` reference — fixed

## Unresolved Questions
None
