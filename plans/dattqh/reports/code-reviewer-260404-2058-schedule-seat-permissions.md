# Code Review: Schedule Seat-Based Permissions

**Scope:** 10 files | ~700 LOC changed | Focus: permission model correctness, security, consistency

## Overall Assessment

Solid design: pure permission resolver in shared package, server-side enforcement, UI-only client permissions. The core permission model is correct. Found **2 critical**, **3 high**, and **3 medium** issues.

---

## Critical Issues

### C1. `GET /api/schedules/today` bypasses all permission checks

**File:** `packages/api/src/routes/schedules.ts:80-93`

The `/today` endpoint returns ALL schedules for today's day-of-week with no visibility filtering. Any authenticated user sees every seat's schedule including seats they have no access to.

```ts
// Line 80-93: No permission filtering at all
router.get('/today', authenticate, async (_req, res) => {
  const day_of_week = new Date().getDay()
  const schedules = await Schedule.find({ day_of_week }) // Returns ALL seats
```

**Impact:** Breaks the visibility matrix. Non-members see hidden seat schedules. Leaks user names and seat assignments.

**Fix:** Apply the same membership filter as `GET /`:
```ts
router.get('/today', authenticate, async (req, res) => {
  const day_of_week = new Date().getDay()
  const filter: Record<string, unknown> = { day_of_week }
  if (req.user!.role !== 'admin') {
    const currentUser = await User.findById(req.user!._id).select('seat_ids').lean()
    const memberSeatIds = (currentUser?.seat_ids ?? []).map(String)
    const ownedSeats = await Seat.find({ owner_id: req.user!._id }).select('_id').lean()
    const allowedSeatIds = [...new Set([...memberSeatIds, ...ownedSeats.map(s => String(s._id))])]
    filter.seat_id = { $in: allowedSeatIds }
  }
  const schedules = await Schedule.find(filter)...
```

---

### C2. `PATCH /swap` allows cross-seat entry movement without target seat permission check

**File:** `packages/api/src/routes/schedules.ts:236-243`

When `toId` is absent (move mode), the `seatId` field from request body can change the entry's seat to ANY seat. Permission is only checked on `fromEntry.seat_id`, not the target `seatId`.

```ts
// Line 238-242: seatId from body is accepted without checking permissions on target seat
if (seatId !== undefined) fromEntry.seat_id = seatId  // No permission check on target seat!
```

**Impact:** A seat owner can move their entries into a seat they don't own or belong to. Auth bypass.

**Fix:** If `seatId` differs from source, run `getPermissionCtx` on target seat and verify `canCreate`:
```ts
if (seatId !== undefined && String(seatId) !== String(fromEntry.seat_id)) {
  const targetPerms = await getPermissionCtx(String(req.user!._id), req.user!.role, seatId)
  if (!targetPerms?.canCreate) {
    res.status(403).json({ error: 'No permission on target seat' }); return
  }
  fromEntry.seat_id = seatId
}
```

---

## High Priority

### H1. `PUT /entry/:id` allows reassigning entry to any user via `userId` body field

**File:** `packages/api/src/routes/schedules.ts:183,204`

The update endpoint accepts `userId` in the body and directly sets `existing.user_id = userId` without:
1. Checking if the caller has `canCreateForOthers` permission
2. Validating the target user belongs to the seat

```ts
if (userId !== undefined) existing.user_id = userId  // No permission or membership check
```

**Impact:** A regular member who can edit their own entry can reassign it to another user, or to a user not in the seat.

**Fix:** Add permission and membership validation when `userId` changes:
```ts
if (userId !== undefined && String(userId) !== String(existing.user_id)) {
  if (!perms.canCreateForOthers) {
    res.status(403).json({ error: 'Cannot reassign entries' }); return
  }
  const targetUser = await User.findById(userId)
  if (!targetUser?.seat_ids?.some(sid => String(sid) === String(existing.seat_id))) {
    res.status(400).json({ error: 'Target user not in seat' }); return
  }
}
```

---

### H2. `PATCH /swap` (swap mode) has no cross-seat validation

**File:** `packages/api/src/routes/schedules.ts:228-235`

When swapping two entries (`toId` present), there's no check that both entries belong to the same seat. If `fromEntry` is in seat A and `toEntry` is in seat B, swapping user_ids creates entries with users that may not belong to those seats.

```ts
const fromUserId = fromEntry.user_id
fromEntry.user_id = toEntry.user_id  // Could be from different seat
toEntry.user_id = fromUserId
```

**Fix:** Validate same seat, or check permissions on both seats:
```ts
if (String(fromEntry.seat_id) !== String(toEntry.seat_id)) {
  res.status(400).json({ error: 'Cannot swap entries across different seats' }); return
}
```

---

### H3. `PATCH /swap` move mode: no input validation on hours

**File:** `packages/api/src/routes/schedules.ts:236-243`

The move path accepts `dayOfWeek`, `startHour`, `endHour` from request body without any range validation. Invalid values (negative hours, startHour >= endHour, day > 6) are persisted directly.

**Fix:** Add validation before save:
```ts
const newStart = startHour ?? fromEntry.start_hour
const newEnd = endHour ?? fromEntry.end_hour
const newDay = dayOfWeek ?? fromEntry.day_of_week
if (newStart < 0 || newStart > 23 || newEnd < 0 || newEnd > 24 || newStart >= newEnd) {
  res.status(400).json({ error: 'Invalid hour range' }); return
}
if (newDay < 0 || newDay > 6) {
  res.status(400).json({ error: 'Invalid day of week' }); return
}
```

---

## Medium Priority

### M1. Client-side `userSeatIds` computation includes owner seats incorrectly

**File:** `packages/web/src/pages/schedule.tsx:88-90`

```ts
const userSeatIds = seats
  .filter(s => s.users.some(u => u._id === user?._id) || s.owner_id === user?._id)
  .map(s => s._id);
```

This feeds into `resolveSchedulePermissions` as `userSeatIds`, but the resolver uses `userSeatIds.includes(seatId)` to determine `isMember`. Owners who are NOT in the users list will still pass as "member" here, which is harmless (they already get owner privileges), but it's semantically misleading. On the API side, `getPermissionCtx` correctly uses only `user.seat_ids` for membership. The mismatch is safe but inconsistent.

**Recommendation:** Keep client behavior as-is (owner already has superset permissions), but add a comment explaining the difference from server-side behavior.

---

### M2. `schedule.tsx` sets state during render

**File:** `packages/web/src/pages/schedule.tsx:82`

```ts
if (!activeSeatId && visibleSeats.length > 0) setActiveSeatId(visibleSeats[0]._id);
```

Calling `setState` during render triggers an additional re-render cycle. React 19 may handle this, but it's a known anti-pattern.

**Fix:** Use `useMemo` or a `useEffect` to initialize default seat:
```ts
const effectiveSeatId = activeSeatId ?? visibleSeats[0]?._id ?? null;
```

---

### M3. Shared package missing `exports` field

**File:** `packages/shared/package.json`

The package has `main: "types.ts"` but no `exports` field. Subpath imports like `@repo/shared/schedule-permissions` work via bundler resolution, but will break if:
- A consumer uses `node` moduleResolution (e.g., a test runner without bundler)
- The package is ever published or consumed outside pnpm workspace

**Fix:** Add exports map:
```json
{
  "exports": {
    ".": "./types.ts",
    "./types": "./types.ts",
    "./schedule-permissions": "./schedule-permissions.ts"
  }
}
```

---

## Positive Observations

1. **Pure function in shared package** -- excellent testability, no DB coupling
2. **Server-side enforcement** -- UI permissions are cosmetic, real checks happen in API
3. **Permission context helper** (`getPermissionCtx`) -- clean separation, only 2 DB queries
4. **Overlap detection** is a nice UX touch (warnings, not blocks)
5. **`DELETE /all` correctly uses `requireAdmin` middleware** -- not relying on permission resolver
6. **Input validation on POST /entry** is thorough (ObjectId format, hour ranges, membership)

---

## Recommended Actions (Priority Order)

1. **[Critical]** Add permission filtering to `GET /today` endpoint
2. **[Critical]** Validate target seat permissions in `PATCH /swap` move mode
3. **[High]** Add permission + membership checks when `PUT /entry/:id` changes `userId`
4. **[High]** Validate same-seat constraint in `PATCH /swap` swap mode
5. **[High]** Add input validation to `PATCH /swap` move mode
6. **[Medium]** Add `exports` field to shared package.json
7. **[Medium]** Fix setState-during-render in schedule.tsx

---

## Metrics

- Type Coverage: Good (shared types well-defined, PermissionContext is strict)
- Test Coverage: Low for permission logic -- no unit tests for `resolveSchedulePermissions`, no API route tests for permission enforcement
- Linting Issues: 0 in changed files (existing TS errors in user-settings.ts are unrelated)

## Unresolved Questions

- Is `GET /today` used by any internal service (cron, bot) that needs unfiltered access? If so, consider a separate internal endpoint with service auth.
- Should overlapping schedule entries be blocked (400) or just warned? Currently warns, which means data integrity depends on UI enforcing the warning.
