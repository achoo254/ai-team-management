# Code Review: User-Created Teams (Personal Teams)

**Reviewer:** code-reviewer | **Date:** 2026-04-04
**Scope:** 39 files, ~643 insertions / 182 deletions
**Focus:** Security, data integrity, edge cases, leftover hardcoded refs

---

## Overall Assessment

Solid implementation. Model migration from enum to ObjectId refs is clean. New `requireTeamOwnerOrAdmin` middleware follows existing patterns well. Frontend correctly adapted to multi-team `team_ids[]`. However, several issues found ranging from critical (data integrity violation in alert-service) to medium (leftover hardcoded refs, missing validations).

---

## CRITICAL Issues (Blocking)

### C1. `emitTeamEvent` stores `team_id` as `seat_id` in Alert model — data integrity violation

**File:** `packages/api/src/services/alert-service.ts` L108-116

```typescript
await Alert.create({
  seat_id: params.team_id,  // <-- team ObjectId stored in seat_id field
  type: 'rate_limit' as AlertType,
  message: `[Team] ${message}`,
  ...
})
```

**Impact:** Alert.seat_id is `ref: 'Seat'` with an index on `seat_id`. Storing a team_id here:
1. Breaks any `populate('seat_id')` calls on these alerts (returns null/wrong doc)
2. Corrupts the `seat_id + type + created_at` compound index, mixing team and seat IDs
3. `checkSnapshotAlerts` dedup query (`Alert.findOne({ seat_id, type })`) could false-positive match against team events
4. Dashboard `unresolvedAlerts` count includes team events with invalid seat refs

**Fix:** Either:
- (A) Add a new `alert_category: 'seat' | 'team'` field and `team_id` field to Alert model, keep `seat_id` nullable for team events
- (B) Create a separate `TeamNotification` model for team events (cleaner separation)
- (C) At minimum, set `seat_id` to a well-known sentinel ObjectId and add `team_id` to metadata only

### C2. Team `name` has no uniqueness constraint — duplicate team names possible

**File:** `packages/api/src/models/team.ts`

```typescript
name: { type: String, required: true, lowercase: true }
```

No `unique: true`. The compound index `{ created_by: 1, name: 1 }` is not unique either. Two users can create teams with same name, and same user can create duplicates via race condition (double-click).

**Impact:** Duplicate teams cause confusion in UI, query ambiguity.

**Fix:** Add unique constraint: `teamSchema.index({ created_by: 1, name: 1 }, { unique: true })` (unique per owner) or `name: { unique: true }` (globally unique).

### C3. `POST /api/teams` accepts `name` from user body without sanitization

**File:** `packages/api/src/routes/teams.ts` L84-101

`name` is used as identifier (lowercased) but no validation for:
- Max length (could store megabytes)
- Allowed characters (spaces, special chars, slashes could cause issues)
- Empty string after trim

**Impact:** Injection via team name into Telegram messages (`emitTeamEvent` uses `team.label`), potential NoSQL issues if name contains `$` operators in query contexts.

**Fix:** Add validation: `name.trim()`, length check (3-50), regex for allowed chars (alphanumeric + hyphens).

---

## HIGH Priority

### H1. JWT `team_ids` stale after team membership changes

**File:** `packages/api/src/middleware.ts` L8-14, `packages/api/src/routes/auth.ts` L59-64

JWT payload includes `team_ids` baked in at login time. When:
- User is added/removed from team via `/api/teams/:id/members`
- Admin updates user teams via `/api/admin/users/:id`

The JWT is NOT reissued. User's `team_ids` in JWT remain stale for up to 24h.

**Impact:** Any middleware/frontend logic relying on `req.user.team_ids` from JWT will have stale data. Currently no route uses JWT team_ids for authorization decisions (all check DB directly), so this is **not exploitable for authz bypass** but will cause UI inconsistencies if AuthProvider uses JWT claims.

**Fix:** Either remove `team_ids` from JWT (fetch fresh from DB when needed) or re-issue token on team membership change.

### H2. `GET /api/teams` — non-admin users see ALL teams (no filter)

**File:** `packages/api/src/routes/teams.ts` L13-26

Without `?mine=true` or `?owner=X`, the endpoint returns ALL teams for any authenticated user. While teams aren't secret, this leaks:
- Team creator info (name, email) to non-members
- Organizational structure to any logged-in user

**Impact:** Information disclosure. Any Google-authenticated user sees full team roster.

**Fix:** For non-admin, default to showing only teams where user is a member OR owner:
```typescript
if (req.user!.role !== 'admin' && !req.query.mine) {
  filter.$or = [
    { created_by: userId },
    { _id: { $in: userTeamIds } }
  ]
}
```

### H3. `DELETE /api/teams/:id/seats/:sid` — no validation that seat belongs to team

**File:** `packages/api/src/routes/teams.ts` L268-283

The endpoint removes seat from team by setting `team_id: null`, but never checks if `seat.team_id === req.params.id`. A team owner could null out ANY seat's team_id by guessing the seat ID.

**Impact:** Authorization bypass — team owner A can detach seats from team B.

**Fix:** Add check:
```typescript
const seat = await Seat.findById(sid)
if (!seat || String(seat.team_id) !== req.params.id) {
  res.status(404).json({ error: 'Seat not in this team' })
  return
}
```

### H4. `DELETE /api/teams/:id` emits notification BEFORE actual deletion

**File:** `packages/api/src/routes/teams.ts` L150-159

```typescript
emitTeamEvent({ event_type: 'team.deleted_by_admin', ... }).catch(console.error)
await Team.findByIdAndDelete(teamId)  // <-- if this fails, notification already sent
```

Also, `emitTeamEvent` is fire-and-forget (no await), so if delete succeeds but notification creates a corrupt Alert (per C1), the error is swallowed.

**Fix:** Move notification after successful deletion, or wrap both in try-catch with rollback.

### H5. `PUT /api/teams/:id` always emits `team.updated_by_admin` even when owner updates own team

**File:** `packages/api/src/routes/teams.ts` L121-127

The notification fires regardless of who made the update. If the owner edits their own team, they get a "Admin edited your team" notification to themselves.

The `emitTeamEvent` has a self-skip (`actor_id === target_user_id`), but `target_user_id` is `team.created_by._id` after populate, which may be an object not a string. The comparison `String(team.created_by._id ?? team.created_by)` handles this, but the event_type name is misleading.

**Fix:** Only emit when `req.user!.role === 'admin' && req.user!._id !== String(team.created_by._id ?? team.created_by)`.

---

## MEDIUM Priority

### M1. Leftover hardcoded `"dev"` string comparison in `member-sidebar.tsx`

**File:** `packages/web/src/components/member-sidebar.tsx` L26

```tsx
<Badge variant={team?.toLowerCase() === "dev" ? "default" : "secondary"}>
```

Now that teams are user-created, comparing against `"dev"` is meaningless. Should use team color or remove special casing.

### M2. `useAvailableUsers` hook type mismatch — still has `team: string`

**File:** `packages/web/src/hooks/use-seats.ts` L77

```typescript
{ id: string; name: string; email: string; team: string; active: boolean; ... }
```

But the API (`/api/seats/available-users`) returns `team_ids: string[]`. Frontend type is stale.

### M3. Team deletion race condition — TOCTOU between count check and delete

**File:** `packages/api/src/routes/teams.ts` L140-159

```typescript
const [userCount, seatCount] = await Promise.all([...])
if (userCount > 0 || seatCount > 0) return error
// ... another request could add member between these lines
await Team.findByIdAndDelete(teamId)
```

Low probability in this app's scale but worth noting. Could use a transaction.

### M4. `POST /api/teams` — no rate limiting on team creation

Any authenticated user can create unlimited teams. No cap, no throttle.

### M5. `POST /api/teams/:id/members` — no check for user already being a member

Uses `$addToSet` which prevents duplicates, but returns 200 success even on no-op. Should inform the caller.

### M6. Admin `PUT /api/admin/users/:id` does not validate `team_ids` are real ObjectIds

**File:** `packages/api/src/routes/admin.ts` L76

```typescript
if (team_ids !== undefined) update.team_ids = team_ids || []
```

No validation that provided team_ids are valid ObjectIds or reference existing teams. Arbitrary strings could be stored.

---

## LOW Priority

### L1. `team-form-dialog.tsx` placeholder still says `"dev"`

**File:** `packages/web/src/components/team-form-dialog.tsx` L36
```tsx
placeholder="dev"
```
Should be a more generic example like "my-team".

### L2. Migration script does not handle `seat.team = null` case

**File:** `packages/api/src/scripts/migrate-user-teams.ts` L120
```typescript
const seatsWithTeam = await db.collection('seats').find({ team: { $exists: true } }).toArray()
```
Seats where `team: null` will be selected but `teamMap.get(null)` returns undefined, so they're silently skipped. Not harmful but logs noise.

### L3. `useTeams` query key includes `params?.mine ?? ""` — empty string and false both coerce

Minor cache key issue: `useTeams()` and `useTeams({ mine: false })` produce different cache keys but same API call.

---

## Positive Observations

1. **Clean middleware pattern** — `requireTeamOwnerOrAdmin` follows existing `requireSeatOwnerOrAdmin` pattern, attaches entity to `req.team` for downstream use
2. **Proper aggregation** — Teams list endpoint uses efficient aggregation pipeline with lookups instead of N+1 queries
3. **Migration script** — Well-structured with dry-run mode, backup, and clear step-by-step approach
4. **Input validation** on sub-endpoints (ObjectId checks on member/seat additions)
5. **Fire-and-forget notifications** properly use `.catch(console.error)` to not block the response
6. **Frontend** correctly adapted to multi-team badges with color indicators

---

## Recommended Actions (Priority Order)

1. **[CRITICAL] Fix `emitTeamEvent` Alert.seat_id corruption** — This will pollute the alerts collection with invalid refs
2. **[CRITICAL] Add unique constraint on team name** (per-owner compound unique)
3. **[CRITICAL] Add input validation on team name** (length, chars, trim)
4. **[HIGH] Fix DELETE /teams/:id/seats/:sid** to verify seat belongs to team
5. **[HIGH] Fix PUT /teams/:id** notification to only fire for admin-on-others
6. **[MEDIUM] Fix member-sidebar.tsx** hardcoded "dev" string
7. **[MEDIUM] Fix use-seats.ts** type for `useAvailableUsers`
8. **[MEDIUM] Validate team_ids in admin user update**

---

## Unresolved Questions

1. Should non-admin users be able to see all teams, or only teams they belong to / own?
2. Is there a team membership cap per user? Currently unbounded.
3. Should team deletion cascade (remove team_id from seats, team_ids from users) instead of rejecting when members/seats exist?

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Implementation is structurally sound with clean patterns but has 3 critical issues (Alert data corruption via team_id in seat_id field, missing uniqueness on team name, missing input validation) and 5 high-priority issues (stale JWT, unscoped team list, seat detachment authz bypass, notification ordering, misleading event emission).
**Concerns:** C1 (Alert.seat_id corruption) will degrade alert system integrity in production if team events are triggered frequently. H3 (seat detachment bypass) is a real authorization vulnerability.
