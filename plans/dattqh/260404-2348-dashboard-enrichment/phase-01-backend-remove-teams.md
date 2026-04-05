# Phase 1: Backend — Remove Teams

## Overview
- **Priority:** High (must complete before dashboard enrichment)
- **Status:** completed
- **Effort:** M (medium)
- **Completed:** 2026-04-05

## Key Insights
- Team model: 22 lines, simple schema (name, color, created_by)
- Teams route: 395 lines, 11 endpoints — all deletable
- Middleware: `requireTeamOwnerOrAdmin()` — deletable
- Alert service: `emitTeamEvent()` — deletable
- Cross-route refs: auth (JWT), admin, seats, dashboard, user-settings — all need cleanup

## Requirements

### Files to DELETE
- `packages/api/src/models/team.ts`
- `packages/api/src/routes/teams.ts`

### Files to MODIFY

1. **`packages/api/src/index.ts`**
   - Remove Team route import + mount (~2 lines)

2. **`packages/api/src/middleware.ts`**
   - Remove `requireTeamOwnerOrAdmin` function
   - Remove Team model import

3. **`packages/api/src/routes/auth.ts`**
   - Remove `team_ids` from JWT payload (lines ~63, ~81)
   - Remove `team_ids` from user response

4. **`packages/api/src/routes/admin.ts`**
   - Remove `team_ids` references in user management (~4 locations)

5. **`packages/api/src/routes/seats.ts`**
   - Remove `team_id` populate on seat list
   - Remove `team_id` from seat create/update
   - Remove `team_ids` from available users response

6. **`packages/api/src/routes/dashboard.ts`**
   - Remove team usage breakdown aggregation (lines ~193-223)
   - Remove `teamUsage` from response
   - Remove Team model import

7. **`packages/api/src/routes/user-settings.ts`**
   - Remove `team_id` from seat query if present

8. **`packages/api/src/services/alert-service.ts`**
   - Remove `emitTeamEvent()` function and all calls

9. **`packages/api/src/models/user.ts`**
   - Remove `team_ids` field from schema

10. **`packages/api/src/models/seat.ts`**
    - Remove `team_id` field from schema

11. **`packages/shared/types.ts`**
    - Remove `team_id` from Seat type
    - Remove `team_ids` from User type
    - Remove Team-related type definitions

## Implementation Steps

1. Delete `packages/api/src/models/team.ts`
2. Delete `packages/api/src/routes/teams.ts`
3. Remove Team import + route mount from `index.ts`
4. Remove `team_ids` from User schema (`models/user.ts`)
5. Remove `team_id` from Seat schema (`models/seat.ts`)
6. Remove `requireTeamOwnerOrAdmin` from `middleware.ts`
7. Clean `auth.ts` — remove team_ids from JWT + response
8. Clean `admin.ts` — remove team_ids references
9. Clean `seats.ts` — remove team_id populate/create/update
10. Clean `dashboard.ts` — remove teamUsage aggregation + Team import
11. Clean `user-settings.ts` — remove team_id reference
12. Clean `alert-service.ts` — remove emitTeamEvent
13. Update `packages/shared/types.ts`
14. Compile check: `pnpm -F @repo/api build`

## DB Migration (manual or script)
```js
// Run in MongoDB shell
db.teams.drop()
db.users.updateMany({}, { $unset: { team_ids: "" } })
db.seats.updateMany({}, { $unset: { team_id: "" } })
```

## Todo List
- [x] Delete team model + routes
- [x] Remove Team from index.ts
- [x] Clean User schema (team_ids)
- [x] Clean Seat schema (team_id)
- [x] Clean middleware (requireTeamOwnerOrAdmin)
- [x] Clean auth.ts (JWT payload)
- [x] Clean admin.ts
- [x] Clean seats.ts
- [x] Clean dashboard.ts (teamUsage)
- [x] Clean user-settings.ts
- [x] Clean alert-service.ts (emitTeamEvent)
- [x] Update shared types
- [x] Compile check passes

## Success Criteria
- No Team references in API codebase
- `pnpm -F @repo/api build` passes
- API starts without errors
- Existing non-team endpoints work correctly

## Security Considerations
- JWT payload shrinks (removes team_ids) — no security impact
- Seat authorization unchanged (uses owner_id + seat_ids, not team)
