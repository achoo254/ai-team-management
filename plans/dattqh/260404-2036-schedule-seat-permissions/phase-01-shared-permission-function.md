# Phase 1: Shared Permission Function

## Overview
- **Priority:** High (foundation for Phase 2 + 3)
- **Status:** completed
- **Effort:** Small (~50 lines new code)

## Key Insights
- `Seat.owner_id` already exists and is populated in API responses
- `User.seat_ids[]` tracks which seats a user belongs to
- Pure function = no DB calls, no side effects → testable + shareable between API and UI
- API already has `owner_id` in seat data; UI already fetches seats via `useSeatsWithUsers`

## Requirements

### Functional
- `resolveSchedulePermissions(userRole, userId, seat)` returns permission object
- Handles 4 roles: admin, seat owner, member, non-member
- Permission object has: `canView`, `canCreate`, `canCreateForOthers`, `canEditEntry(entry)`, `canDeleteEntry(entry)`, `canSwap`, `canClearAll`

### Non-functional
- Zero dependencies (pure function)
- Works in both Node.js (API) and browser (UI) environments
- Under 50 lines

## Related Code Files

### Modify
- `packages/shared/types.ts` — Add `SchedulePermissions` interface

### Create
- `packages/shared/schedule-permissions.ts` — Pure permission resolver function

## Implementation Steps

### 1. Add types to `packages/shared/types.ts`
```typescript
export interface SchedulePermissions {
  canView: boolean
  canCreate: boolean
  canCreateForOthers: boolean
  canSwap: boolean
  canClearAll: boolean
  canEditEntry: (entry: { user_id: string }) => boolean
  canDeleteEntry: (entry: { user_id: string }) => boolean
}
```

### 2. Create `packages/shared/schedule-permissions.ts`

```typescript
import type { SchedulePermissions } from './types.js'

interface PermissionContext {
  userId: string
  userRole: 'admin' | 'user'
  seatOwnerId: string | null
  userSeatIds: string[]   // seats this user belongs to
  seatId: string          // the seat being viewed
}

export function resolveSchedulePermissions(ctx: PermissionContext): SchedulePermissions {
  const isAdmin = ctx.userRole === 'admin'
  const isOwner = ctx.seatOwnerId != null && ctx.seatOwnerId === ctx.userId
  const isMember = ctx.userSeatIds.includes(ctx.seatId)

  // Non-member and non-admin: no access
  if (!isAdmin && !isOwner && !isMember) {
    return {
      canView: false, canCreate: false, canCreateForOthers: false,
      canSwap: false, canClearAll: false,
      canEditEntry: () => false, canDeleteEntry: () => false,
    }
  }

  return {
    canView: true,
    canCreate: isAdmin || isOwner || isMember,
    canCreateForOthers: isAdmin || isOwner,
    canSwap: isAdmin || isOwner,
    canClearAll: isAdmin,
    canEditEntry: (entry) => isAdmin || isOwner || entry.user_id === ctx.userId,
    canDeleteEntry: (entry) => isAdmin || isOwner || entry.user_id === ctx.userId,
  }
}
```

### 3. Export from `packages/shared/types.ts`
Add re-export or ensure `schedule-permissions.ts` is importable from both packages.

## Todo List
- [x] Add `SchedulePermissions` interface to `types.ts`
- [x] Create `schedule-permissions.ts` with `resolveSchedulePermissions()`
- [x] Verify export works for both API and web packages

## Success Criteria
- Function compiles and exports correctly
- Covers all 4 roles with correct permission matrix
- No external dependencies
