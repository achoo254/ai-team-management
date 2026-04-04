# Phase 2: API Permission Enforcement

## Overview
- **Priority:** High
- **Status:** completed
- **Effort:** Medium (~60 lines changed)
- **Depends on:** Phase 1 (shared permission function)

## Key Insights
- Current permission: `isAdmin || entry.user_id === currentUser._id` — no seat owner concept
- `requireSeatOwnerOrAdmin` middleware exists in `middleware.ts` but unused in schedules
- Swap route (`PATCH /swap`) currently `requireAdmin` — need to allow seat owners too
- GET routes return ALL schedules — need to filter by user's seat membership
- `User.seat_ids[]` available via DB query; `Seat.owner_id` via Seat lookup

## Requirements

### Functional
- POST `/entry`: Admin creates for anyone; owner creates for any member in seat; member creates for self only
- PUT `/entry/:id`: Admin edits any; owner edits any in own seat; member edits own entries only
- DELETE `/entry/:id`: Same as PUT
- PATCH `/swap`: Admin or seat owner (within their seat)
- GET `/`: Filter results to only seats user is member/owner of (admin sees all)
- DELETE `/all`: Admin only (unchanged)

### Non-functional
- Single DB query for seat (to get `owner_id`) — avoid N+1
- Clear 403 error messages indicating what's wrong

## Related Code Files

### Modify
- `packages/api/src/routes/schedules.ts` — Replace inline permission checks with `resolveSchedulePermissions()`

### Read for context
- `packages/api/src/middleware.ts` — Existing middleware patterns
- `packages/api/src/models/seat.ts` — Seat schema with `owner_id`
- `packages/api/src/models/user.ts` — User schema with `seat_ids`

## Implementation Steps

### 1. Import shared function
```typescript
import { resolveSchedulePermissions } from '@repo/shared/schedule-permissions'
```

### 2. Add helper to build permission context
At top of `schedules.ts`, add helper that loads seat + user data:
```typescript
async function getPermissionCtx(userId: string, userRole: 'admin' | 'user', seatId: string) {
  const [seat, user] = await Promise.all([
    Seat.findById(seatId).select('owner_id').lean(),
    User.findById(userId).select('seat_ids').lean(),
  ])
  if (!seat) return null
  return resolveSchedulePermissions({
    userId,
    userRole,
    seatOwnerId: seat.owner_id ? String(seat.owner_id) : null,
    userSeatIds: (user?.seat_ids ?? []).map(String),
    seatId: String(seatId),
  })
}
```

### 3. Update GET `/` — filter by membership
```typescript
// After authenticate, before query:
if (req.user!.role !== 'admin') {
  const currentUser = await User.findById(req.user!._id).select('seat_ids').lean()
  const memberSeatIds = (currentUser?.seat_ids ?? []).map(String)
  // Also include seats user owns
  const ownedSeats = await Seat.find({ owner_id: req.user!._id }).select('_id').lean()
  const ownedSeatIds = ownedSeats.map(s => String(s._id))
  const allowedSeatIds = [...new Set([...memberSeatIds, ...ownedSeatIds])]
  filter.seat_id = seatId ? (allowedSeatIds.includes(seatId) ? seatId : '__none__') : { $in: allowedSeatIds }
}
```

### 4. Update POST `/entry` (lines 90-95)
Replace current `isAdmin || userId === currentUser._id` with:
```typescript
const perms = await getPermissionCtx(req.user!._id, req.user!.role, seatId)
if (!perms) { res.status(404).json({ error: 'Seat not found' }); return }
if (!perms.canCreate) { res.status(403).json({ error: 'No permission on this seat' }); return }
if (!perms.canCreateForOthers && String(userId) !== String(req.user!._id)) {
  res.status(403).json({ error: 'Can only create schedule entries for yourself' }); return
}
```

### 5. Update PUT `/entry/:id` (lines 139-144)
Replace current check:
```typescript
const perms = await getPermissionCtx(req.user!._id, req.user!.role, String(existing.seat_id))
if (!perms || !perms.canEditEntry({ user_id: String(existing.user_id) })) {
  res.status(403).json({ error: 'No permission to edit this entry' }); return
}
```

### 6. Update DELETE `/entry/:id` (lines 223-228)
Same pattern as PUT:
```typescript
const perms = await getPermissionCtx(req.user!._id, req.user!.role, String(existing.seat_id))
if (!perms || !perms.canDeleteEntry({ user_id: String(existing.user_id) })) {
  res.status(403).json({ error: 'No permission to delete this entry' }); return
}
```

### 7. Update PATCH `/swap` (line 178)
Replace `requireAdmin` middleware with inline check:
```typescript
router.patch('/swap', authenticate, async (req, res) => {
  // ... existing fromEntry lookup ...
  const perms = await getPermissionCtx(req.user!._id, req.user!.role, String(fromEntry.seat_id))
  if (!perms?.canSwap) {
    res.status(403).json({ error: 'Only admin or seat owner can swap' }); return
  }
  // ... rest unchanged ...
})
```

### 8. Add Seat import
```typescript
import { Seat } from '../models/seat.js'
```

## Todo List
- [x] Import `resolveSchedulePermissions` + `Seat` model
- [x] Add `getPermissionCtx()` helper
- [x] Update GET `/` to filter by seat membership
- [x] Update POST `/entry` permission check
- [x] Update PUT `/entry/:id` permission check
- [x] Update DELETE `/entry/:id` permission check
- [x] Update PATCH `/swap` to allow seat owners
- [x] Verify DELETE `/all` unchanged (admin only)

## Success Criteria
- Admin: full access (unchanged behavior)
- Seat owner: CRUD on all entries in own seat + swap
- Member: create for self, edit/delete own entries
- Non-member: 403 on all write operations, filtered out of GET
- No regression in existing admin workflows

## Risk Assessment
- **Extra DB query per request**: `getPermissionCtx` does 2 queries (Seat + User). Acceptable for write operations; for GET, use separate optimized query.
- **Backward compat**: Admin behavior unchanged. Members gain ability to self-manage (was previously blocked by UI only).

## Additional Fixes Applied
- Fixed GET `/today` data leak — filtered to user's owned/member seats
- Fixed cross-seat move bypass — added validation to prevent moving entries between seats
- Fixed userId reassignment without permission — added guard to prevent unauthorized user changes on entries
