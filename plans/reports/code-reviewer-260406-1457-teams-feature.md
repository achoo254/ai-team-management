# Code Review: Teams Feature

## Scope
- **Files:** 8 (model, routes, middleware, shared types, hooks, page, form dialog, seat model hook)
- **LOC:** ~470 new/modified
- **Focus:** Security, data integrity, correctness

## Overall Assessment

Solid implementation following existing codebase patterns. The `getAllowedSeatIds()` merge is clean with proper dedup. However, there is **one critical data integrity bug** (soft-delete cascade never fires) and several high-priority issues around input validation and authorization gaps.

---

## Critical Issues

### 1. [BUG] Soft-delete cascade hook never fires for seat deletion

**File:** `packages/api/src/models/seat.ts` (lines 121-129)
**File:** `packages/api/src/routes/seats.ts` (lines 536-538)

The pre-hook is registered on `findOneAndUpdate`, but the seat deletion route uses `seat.save()`:

```ts
// seat.ts hook — listens for findOneAndUpdate
seatSchema.pre('findOneAndUpdate', async function () { ... })

// seats.ts route — uses .save(), NOT findOneAndUpdate
seat.deleted_at = new Date()
seat.token_active = false
await seat.save()   // <-- pre('findOneAndUpdate') does NOT fire here
```

**Impact:** Soft-deleted seats remain in `team.seat_ids` permanently. `getAllowedSeatIds()` returns stale seat IDs for team members, potentially granting access to data from deleted seats. The soft-delete filter on Seat model hides the seat from queries, so team members see phantom IDs that resolve to nothing — or worse, if a new seat reuses the ObjectId somehow.

**Fix options:**
- **(A) Move cleanup to the route** (recommended — explicit, no magic):
  ```ts
  // In DELETE /api/seats/:id, before seat.save():
  await Team.updateMany({ seat_ids: id }, { $pull: { seat_ids: id } })
  ```
- **(B) Add a `pre('save')` hook** checking `this.isModified('deleted_at')` — but this couples model to domain logic.

### 2. [SECURITY] No `member_ids` validation on create/update — privilege escalation via team membership

**File:** `packages/api/src/routes/teams.ts` (lines 26, 64, 80-81)

The `seat_ids` ownership is validated for non-admin users, but `member_ids` is accepted without any validation. Any authenticated user can:
1. Create a team with arbitrary `member_ids` (any user IDs)
2. Those users then get access to the team's seats via `getAllowedSeatIds()`

**Impact:** User A can add User B to a team containing User A's seats — User B now sees data for those seats without consent. While this may be intended for "sharing", there's no opt-in for the member. More critically, a non-admin can add other users' IDs to a team with seats they don't own (if editing an existing team where admin originally added those seats).

**Fix:** At minimum, validate that `member_ids` contains valid ObjectIds. Consider whether members should be restricted (e.g., non-admin can only add themselves, or members must accept invitations).

---

## High Priority

### 3. No input validation on `name` field — potential NoSQL injection / empty names

**File:** `packages/api/src/routes/teams.ts` (lines 26, 64)

`req.body.name` is passed directly to Mongoose without type checking. If `name` is an object (e.g., `{"$gt": ""}`), Mongoose's `trim` won't prevent it from reaching the query layer for the unique index check.

**Fix:** Add explicit validation:
```ts
if (!name || typeof name !== 'string' || !name.trim()) {
  res.status(400).json({ error: 'Team name is required' })
  return
}
```

### 4. No validation that `seat_ids` / `member_ids` are valid ObjectId arrays

**File:** `packages/api/src/routes/teams.ts` (lines 29-37, 67-75)

If `seat_ids` contains non-ObjectId strings or non-array values, the `Seat.countDocuments` query silently returns 0, and the length check `ownedCount !== seat_ids.length` triggers a 403 instead of a 400. Worse, if `seat_ids` is not an array (e.g., a string), `.length` still works but semantics break.

**Fix:** Validate arrays contain valid ObjectIds before DB queries:
```ts
if (!Array.isArray(seat_ids) || !seat_ids.every(id => mongoose.Types.ObjectId.isValid(id))) {
  res.status(400).json({ error: 'Invalid seat_ids' })
  return
}
```

### 5. `name` max length not enforced — unbounded string storage

**File:** `packages/api/src/models/team.ts`

No `maxlength` on `name` or `description`. A malicious client could send megabytes of text.

**Fix:** Add `maxlength: 100` for name, `maxlength: 500` for description in schema.

### 6. Missing try-catch in route handlers

**File:** `packages/api/src/routes/teams.ts` (all routes)

No try-catch blocks. Mongoose errors (e.g., duplicate `name` — E11000) propagate to the global error handler, which returns 409 for dupes. This works but is inconsistent with other routes (e.g., `seats.ts`) that use try-catch. More importantly, unexpected errors could leak stack traces in dev mode via the global handler.

**Recommendation:** Add try-catch for consistency and explicit error messages (e.g., "Team name already exists" instead of generic "Da ton tai").

---

## Medium Priority

### 7. `owner_id` comparison uses mixed types

**File:** `packages/api/src/routes/teams.ts` (lines 59, 101)

```ts
team.owner_id.toString() !== user._id
```

`team.owner_id` is a Mongoose ObjectId, `user._id` is a string from JWT. The `.toString()` on ObjectId is correct, but this pattern is fragile. Consider using a helper like `String(team.owner_id) !== String(user._id)` for consistency.

### 8. Frontend `canManage` checks both `owner_id` (string) and `owner._id` (populated)

**File:** `packages/web/src/pages/teams.tsx` (line 34)

```ts
const canManage = (team: Team) =>
  isAdmin || (team.owner_id === user?._id) || (team.owner?._id === user?._id)
```

After population, `team.owner_id` becomes the populated object (not a string). The `team.owner_id === user?._id` check may silently fail if the API returns populated data. The `team.owner?._id` fallback covers it, but the logic is confusing.

**Fix:** Use only the populated form since the API always populates:
```ts
const canManage = (team: Team) => isAdmin || team.owner?._id === user?._id
```

### 9. No pagination on GET /api/teams

**File:** `packages/api/src/routes/teams.ts` (line 15)

`Team.find(filter)` returns all matching teams with 3 populates. For a growing user base, this could become slow. Low risk now but worth noting.

### 10. `getAllowedSeatIds` fires 3 parallel queries for non-admin users

**File:** `packages/api/src/middleware.ts` (lines 118-122)

The `Promise.all` with 3 queries is fine for correctness, but every route that calls `getAllowedSeatIds` now has an additional Team query. This is called on dashboard, usage-snapshots, schedules, and seats routes. Consider caching or at minimum ensure the `member_ids` index (already added) is sufficient.

---

## Positive Observations

- Clean dedup logic in `getAllowedSeatIds()` using `Map<string, ObjectId>` — no duplicates possible
- Proper use of existing `validateObjectId` middleware on parameterized routes
- Frontend follows existing patterns (React Query hooks, shadcn/ui components, sonner toasts)
- `Team` type in shared types is well-structured with both raw IDs and populated variants
- Index on `member_ids` added proactively for the query pattern

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix soft-delete cascade — add `Team.updateMany($pull)` in `DELETE /api/seats/:id` route directly
2. **[CRITICAL]** Validate `member_ids` on server — at minimum check they're valid ObjectIds; consider authorization policy
3. **[HIGH]** Add input type validation for `name`, `seat_ids`, `member_ids` (type + format)
4. **[HIGH]** Add `maxlength` to schema fields
5. **[MEDIUM]** Simplify `canManage` in frontend
6. **[LOW]** Add try-catch to route handlers for explicit error messages

---

## Unresolved Questions

1. **Member consent model:** Should adding a user to a team require their consent? Currently any user can add any other user as a member, granting them seat visibility. This is a product decision but has security implications.
2. **Team ownership transfer:** No route for transferring team ownership. If the owner is deactivated, the team becomes unmanageable for non-admins.
3. **Seat restore flow:** When a soft-deleted seat is restored, should it be re-added to teams it was previously in? Currently there's no tracking of which teams a seat belonged to before deletion.
