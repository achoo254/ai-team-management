# Phase 3: UI Permission Integration

## Overview
- **Priority:** High
- **Status:** completed
- **Effort:** Medium (~80 lines changed across 5 files)
- **Depends on:** Phase 1 (shared permission function + types)

## Key Insights
- All UI currently gates on `isAdmin` boolean — 13 occurrences across 4 components
- `SeatWithUsers` interface in `use-schedules.ts` missing `owner_id` — need to add it
- Seat data already includes `owner_id` from API (GET `/seats` populates it)
- Permission can be computed client-side: `resolveSchedulePermissions({ userId, userRole, seatOwnerId, userSeatIds, seatId })`
- User's `seat_ids` not currently available in frontend `AuthUser` — but can derive from seats data (seats where user appears in `users[]` array)

## Requirements

### Functional
- Replace all `isAdmin` checks with permission-based checks
- Filter seat tabs: only show seats where user is admin/owner/member
- Owner sees: create button, edit/delete buttons on all entries, drag/drop, resize, swap
- Member sees: create button (self only), edit/delete on own entries, drag/resize own entries
- Non-member: seat tab hidden
- Admin: unchanged (sees everything)

### Non-functional
- No new API calls — compute permissions from existing data
- No layout shifts — permission checks must be synchronous after data loads

## Related Code Files

### Modify
- `packages/web/src/hooks/use-schedules.ts` — Add `owner_id` to `SeatWithUsers` interface
- `packages/web/src/pages/schedule.tsx` — Replace `isAdmin` with permission object, filter seats
- `packages/web/src/components/schedule-grid.tsx` — Replace `isAdmin` prop with `canEdit`/`canCreate` functions
- `packages/web/src/components/schedule-cell.tsx` — Replace `isAdmin` prop with per-entry permission check
- `packages/web/src/components/day-tab-view.tsx` — Replace `isAdmin` with permission checks

## Implementation Steps

### 1. Update `SeatWithUsers` in `use-schedules.ts` (line 17-24)
Add `owner_id` field:
```typescript
export interface SeatWithUsers {
  _id: string;
  email: string;
  label: string;
  team: string;
  max_users: number;
  owner_id: string | null;  // ADD THIS
  users: { _id: string; name: string; email: string; team: string }[];
}
```

### 2. Update `schedule.tsx` — compute permissions
Replace `isAdmin` with permission object:

```typescript
import { resolveSchedulePermissions } from '@repo/shared/schedule-permissions'

// After activeSeat is resolved:
const userSeatIds = seats
  .filter(s => s.users.some(u => u._id === user?._id) || s.owner_id === user?._id)
  .map(s => s._id)

const permissions = activeSeatId && user
  ? resolveSchedulePermissions({
      userId: user._id,
      userRole: user.role,
      seatOwnerId: activeSeat?.owner_id ?? null,
      userSeatIds,
      seatId: activeSeatId,
    })
  : null
```

**Filter seat tabs** (line 275):
```typescript
const visibleSeats = user?.role === 'admin'
  ? seats
  : seats.filter(s => s.users.some(u => u._id === user?._id) || s.owner_id === user?._id)
```

**Replace isAdmin usages:**
- Line 253 `{isAdmin && ...}` → `{permissions?.canCreate && ...}` for create button
- Line 253 Clear All button → `{permissions?.canClearAll && ...}`
- Line 306 pass `isAdmin` to ScheduleGrid → pass `permissions`
- Line 320 pass `isAdmin` to DayTabView → pass `permissions`
- Create dialog: if `permissions?.canCreateForOthers` show user picker, else auto-set `userId` to current user
- handleClickSlot: gate on `permissions?.canCreate` instead of implicit admin-only

### 3. Update `schedule-grid.tsx` Props
Replace `isAdmin: boolean` with permission callbacks:

```typescript
interface Props {
  // ... existing props ...
  canCreate: boolean;
  canEditEntry: (entry: ScheduleEntry) => boolean;
  currentUserId: string;
  onDelete: (id: string) => void;
  onEdit: (entry: ScheduleEntry) => void;
  onResize: (entryId: string, newEndHour: number) => void;
  onClickSlot: (dayOfWeek: number, hour: number) => void;
}
```

- `DroppableHourCell`: replace `isAdmin` with `canCreate` for click-to-create + "+" indicator
- `ScheduleCell` rendering: pass `canEdit: canEditEntry(entry)` per entry

### 4. Update `schedule-cell.tsx` Props
Replace `isAdmin: boolean` with `canEdit: boolean`:

```typescript
interface Props {
  entry: ScheduleEntry;
  span: number;
  canEdit: boolean;  // replaces isAdmin
  onDelete: (id: string) => void;
  onEdit: (entry: ScheduleEntry) => void;
  onResize?: (entryId: string, newEndHour: number) => void;
}
```

All internal `isAdmin` references → `canEdit`:
- Line 40: `disabled: !canEdit`
- Line 50: `onClickSlot` gate
- Line 53: "+" indicator
- Line 81: cursor class
- Line 88/110: grip icon
- Line 94/119: edit/delete buttons
- Line 135: resize handle

### 5. Update `day-tab-view.tsx` Props
Replace `isAdmin: boolean` with permission callbacks:

```typescript
interface Props {
  // ... existing ...
  canCreate: boolean;
  canDeleteEntry: (entry: ScheduleEntry) => boolean;
  onDelete: (id: string) => void;
  onClickSlot: (dayOfWeek: number, hour: number) => void;
}
```

- Line 55-56: "Tạo mới" link → gate on `canCreate`
- Line 83-89: delete button → gate on `canDeleteEntry(entry)`
- Line 98-105: "Thêm lịch" button → gate on `canCreate`

## Todo List
- [x] Add `owner_id` to `SeatWithUsers` interface
- [x] Compute `permissions` object in `schedule.tsx`
- [x] Filter seat tabs by membership
- [x] Replace `isAdmin` in schedule.tsx with permission checks
- [x] Update `schedule-grid.tsx` props and permission flow
- [x] Update `schedule-cell.tsx` — `isAdmin` → `canEdit`
- [x] Update `day-tab-view.tsx` — permission-based rendering
- [x] Auto-set userId when member creates entry for self
- [x] Test: admin sees everything, owner manages seat, member self-manages

## Success Criteria
- Admin UI: unchanged
- Owner UI: sees create/edit/delete/drag/resize for all entries in seat
- Member UI: sees create (self), edit/delete/drag/resize only own entries
- Non-member: seat tab hidden
- No new API calls for permissions
- No layout shifts or flash of unauthorized content

## Security Note
UI permissions are UX-only — server-side enforcement in Phase 2 is the actual security boundary. UI just prevents confusing UX.

## Additional Fixes Applied
- Fixed broken tests in `use-schedules.test.ts` — updated mock seat data to match new `owner_id` interface
- Fixed broken tests in `use-dashboard.test.ts` — aligned with schedule permission changes
