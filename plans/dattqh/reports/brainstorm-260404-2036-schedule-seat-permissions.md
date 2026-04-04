# Brainstorm: Schedule Seat-based Permissions

**Date:** 2026-04-04
**Status:** Approved

## Problem Statement

Schedule feature currently uses entry-level permissions (creator edits own entry + admin full access). Need seat-based permission model where seat owners manage all schedules within their seat, members self-manage, and visibility is restricted to assigned seats.

## Final Permission Matrix

| Action | Admin | Seat Owner | Member | Non-member |
|--------|-------|------------|--------|------------|
| View schedule | All seats | Own/assigned seats | Assigned seats | Hidden |
| Create entry | Anyone | Any member in seat | Self only | No |
| Edit/Delete entry | All | All in own seat | Own entries only | No |
| Swap entry | All | Within own seat | No | No |
| Clear All | Yes | No (admin only) | No | No |

## Chosen Approach: Shared Permission Function (Option B)

Pure function in `packages/shared/schedule-permissions.ts` used by both API (server-side enforce) and UI (conditional rendering).

**Why this approach:**
- DRY: 1 function, both API and UI share
- KISS: pure function, no side effects
- YAGNI: no extra API endpoint needed, UI computes from existing data
- Testable: unit test independently

**Rejected alternatives:**
- A (Inline in routes): DRY violation, 3x duplicate logic
- C (Mongoose hooks): anti-pattern, hook gotchas with `findOneAndUpdate`

## Key Changes Required

1. **`packages/shared/schedule-permissions.ts`** — `resolveSchedulePermission(user, seat)` returns `{ canView, canCreate, canCreateForOthers, canEdit(entry), canDelete(entry), canSwap }`
2. **`packages/api/routes/schedules.ts`** — Replace inline checks with shared function; filter GET by seat membership
3. **`packages/web/`** — Replace `isAdmin` gates with permission object; enable drag/resize per role; filter seat tabs by membership

## UI Behavior

- **Owner**: Full CRUD on all entries in seat, can swap, sees create button
- **Member**: Drag/resize own entries only, click empty slot to create for self, view others read-only
- **Non-member**: Seat tab hidden

## Unresolved Questions

None — all clarified during brainstorm session.
