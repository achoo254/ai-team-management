# Phase 3: API — Seat Restore Flow

**Priority:** High
**Status:** Done
**Est:** 1.5h
**Depends on:** Phase 1 (shared types)

## Context Links
- Seats routes: `packages/api/src/routes/seats.ts`
- Seat cleanup service: `packages/api/src/services/seat-cleanup-service.ts`
- Seat model: `packages/api/src/models/seat.ts`

## Overview

Modify POST /seats and POST /preview-token to detect soft-deleted seats with matching email. Return restorable info to client. Support `restore_seat_id` and `force_new` params for user's choice.

## Data Flow

```
POST /preview-token (credential_json)
  → fetchOAuthProfile → get email
  → check active seat (existing duplicate check)
  → check soft-deleted seat: Seat.findOne({ email, deleted_at: { $ne: null } })
  → return { ...existing fields, restorable_seat?: { _id, label, deleted_at, has_history } }

POST /seats (credential_json + max_users)
  ├── Case A: no restore_seat_id, no force_new (normal flow)
  │   → fetchOAuthProfile → get email
  │   → check active duplicate (409 if exists)
  │   → check soft-deleted match → return 200 { restorable: true, deleted_seat: {...} }
  │   → if no match → create new seat normally
  │
  ├── Case B: restore_seat_id provided
  │   → find soft-deleted seat by ID + verify deleted_at != null
  │   → clear deleted_at, update credential/owner/label/max_users
  │   → re-seed owner's watched_seats
  │   → return 200 restored seat
  │
  └── Case C: force_new = true
      → find soft-deleted seat by email
      → cascade hard-delete (same as cleanup service)
      → create new seat normally
```

## Related Code Files

**Modify:**
- `packages/api/src/routes/seats.ts` — POST /, POST /preview-token

**Read (reference):**
- `packages/api/src/services/seat-cleanup-service.ts` — cascade delete pattern

## Implementation Steps

### 1. Modify POST /preview-token — add restorable seat check

After the existing `duplicate` check (line ~183), add soft-deleted seat lookup:

```typescript
// Existing: check active duplicate
const duplicate = await Seat.findOne({ email: profile.account.email }).select('_id').lean()

// New: check soft-deleted seat (bypass auto-filter by explicit deleted_at)
const softDeleted = await Seat.findOne(
  { email: profile.account.email, deleted_at: { $ne: null } },
  '_id label deleted_at'
).lean()

let restorable_seat = null
if (softDeleted) {
  const snapCount = await UsageSnapshot.countDocuments({ seat_id: softDeleted._id })
  restorable_seat = {
    _id: String(softDeleted._id),
    label: softDeleted.label,
    deleted_at: softDeleted.deleted_at!.toISOString(),
    has_history: snapCount > 0,
  }
}

// Add to response:
res.json({
  account: { ... },
  organization: { ... },
  duplicate_seat_id: duplicate ? String(duplicate._id) : null,
  restorable_seat,  // NEW
})
```

Import `UsageSnapshot` at top of file.

### 2. Modify POST /seats — three-way branching

Replace the current "check existing → create" logic with:

```typescript
router.post('/', authenticate, async (req, res) => {
  try {
    const { credential_json, max_users, label, manual_mode, email: bodyEmail,
            restore_seat_id, force_new } = req.body as {
      credential_json?: string; max_users?: number; label?: string;
      manual_mode?: boolean; email?: string;
      restore_seat_id?: string; force_new?: boolean;
    }

    // ... existing validation (credential_json, max_users, parse) ...

    // ── CASE B: Restore existing soft-deleted seat ──
    if (restore_seat_id) {
      if (!mongoose.Types.ObjectId.isValid(restore_seat_id)) {
        res.status(400).json({ error: 'Invalid restore_seat_id' }); return
      }
      const deleted = await Seat.findOne(
        { _id: restore_seat_id, deleted_at: { $ne: null } }
      ).select('+oauth_credential')
      if (!deleted) {
        res.status(404).json({ error: 'Soft-deleted seat not found' }); return
      }

      // Restore
      deleted.deleted_at = null
      deleted.oauth_credential = toCredentialDoc(parsed!) as any
      deleted.owner_id = req.user!._id as any
      deleted.token_active = true
      deleted.label = label || deleted.label
      deleted.max_users = max_users!
      deleted.last_fetch_error = null

      // Fetch fresh profile (best-effort)
      try {
        const oauthProfile = await fetchOAuthProfile(parsed!.accessToken)
        deleted.profile = toProfileCache(oauthProfile) as any
      } catch { /* keep existing profile if any */ }

      await deleted.save()

      // Re-seed owner's watched_seats
      await User.findByIdAndUpdate(req.user!._id, {
        $addToSet: { watched_seats: { seat_id: deleted._id, threshold_5h_pct: 90, threshold_7d_pct: 85 } },
      })

      res.json({ restored: true, seat: deleted })
      return
    }

    // ... existing email resolution (manual_mode or fetchOAuthProfile) ...

    // ── Check active duplicate ──
    const existing = await Seat.findOne({ email }).select('_id').lean()
    if (existing) {
      res.status(409).json({
        error: 'Seat with this email already exists.',
        duplicate_seat_id: String(existing._id),
      })
      return
    }

    // ── CASE C: Force-new — hard-delete soft-deleted seat first ──
    if (force_new) {
      const softDeleted = await Seat.findOne(
        { email, deleted_at: { $ne: null } }, '_id'
      ).lean()
      if (softDeleted) {
        await cascadeHardDelete([softDeleted._id])
      }
    } else {
      // ── CASE A: Check for restorable seat ──
      const softDeleted = await Seat.findOne(
        { email, deleted_at: { $ne: null } },
        '_id label deleted_at'
      ).lean()
      if (softDeleted) {
        const snapCount = await UsageSnapshot.countDocuments({ seat_id: softDeleted._id })
        res.json({
          restorable: true,
          deleted_seat: {
            _id: String(softDeleted._id),
            label: softDeleted.label,
            deleted_at: softDeleted.deleted_at!.toISOString(),
            has_history: snapCount > 0,
          },
        })
        return
      }
    }

    // ── Normal create ──
    const seat = await Seat.create({ ... })
    // ... existing watched_seats seeding ...
    res.status(201).json(seat)
  } catch (error) { ... }
})
```

### 3. Extract `cascadeHardDelete` helper

Reuse the same pattern from `seat-cleanup-service.ts`. Extract to a shared helper or inline in seats route:

```typescript
/** Hard-delete seat(s) + all related data. Used by force-new and cleanup service. */
async function cascadeHardDelete(seatIds: Types.ObjectId[]) {
  const { UsageSnapshot } = await import('../models/usage-snapshot.js')
  const { UsageWindow } = await import('../models/usage-window.js')
  const { Alert } = await import('../models/alert.js')
  const { SessionMetric } = await import('../models/session-metric.js')
  const { ActiveSession } = await import('../models/active-session.js')

  await Promise.all([
    UsageSnapshot.deleteMany({ seat_id: { $in: seatIds } }),
    UsageWindow.deleteMany({ seat_id: { $in: seatIds } }),
    Alert.deleteMany({ seat_id: { $in: seatIds } }),
    SessionMetric.deleteMany({ seat_id: { $in: seatIds } }),
    ActiveSession.deleteMany({ seat_id: { $in: seatIds } }),
    Schedule.deleteMany({ seat_id: { $in: seatIds } }),
    Seat.deleteMany({ _id: { $in: seatIds } }),
  ])
}
```

**Decision**: Put this in a new file `packages/api/src/services/seat-cascade-delete.ts` and have both `seat-cleanup-service.ts` and `routes/seats.ts` import it. DRY > inline duplication.

### 4. Refactor `seat-cleanup-service.ts` to use shared helper

Replace its inline delete logic with the extracted `cascadeHardDelete` call.

## Failure Modes

| Scenario | Behavior |
|----------|----------|
| `restore_seat_id` points to non-deleted seat | 404 — `deleted_at: { $ne: null }` filter rejects it |
| `restore_seat_id` points to already-restored seat (race) | 404 — same filter; first restore wins |
| `force_new` but no soft-deleted seat exists | No-op on delete, proceeds to normal create |
| `restore_seat_id` + `force_new` both sent | `restore_seat_id` takes precedence (checked first) |
| Cascade delete partially fails | Promise.all — partial failure leaves orphan data but doesn't block create. Cleanup cron catches leftovers |

## Todo List

- [ ] Extract `cascadeHardDelete` to `packages/api/src/services/seat-cascade-delete.ts`
- [ ] Refactor `seat-cleanup-service.ts` to use extracted helper
- [ ] Import `UsageSnapshot` in `routes/seats.ts`
- [ ] Add `restore_seat_id` / `force_new` params to POST /seats body parsing
- [ ] Implement Case B (restore) in POST /seats
- [ ] Implement Case A (restorable detection) in POST /seats
- [ ] Implement Case C (force-new with cascade delete) in POST /seats
- [ ] Add `restorable_seat` to POST /preview-token response
- [ ] Typecheck: `pnpm -F @repo/api build`
- [ ] Test: POST /seats with restore_seat_id → verify seat un-deleted, credential updated
- [ ] Test: POST /seats with force_new → verify old data purged, new seat created
- [ ] Test: POST /seats normal → returns restorable info if soft-deleted match exists
- [ ] Test: POST /preview-token → includes restorable_seat info

## Success Criteria

- POST /seats detects soft-deleted match and returns `restorable: true` response (200, not 201)
- `restore_seat_id` restores seat with new credentials, preserving ObjectId + history
- `force_new` cascade-deletes old seat + creates fresh
- Preview-token includes `restorable_seat` info
- Cleanup service still works with extracted helper
- All existing seat tests pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Race condition on restore | `findOne({ deleted_at: { $ne: null } })` + save — Mongoose optimistic concurrency; second caller gets 404 |
| Cascade delete slow for seats with lots of history | Acceptable — happens once; same pattern as cleanup cron |
| `seats.ts` file size (currently 529 LOC + ~80 from Phase 2 + ~60 here ≈ 670) | Still under 700; if needed, extract restore logic to `services/seat-restore-service.ts` |

## Security Considerations

- Restore requires authentication — any logged-in user can restore (same as create)
- Restored seat ownership set to current user — prevents unauthorized ownership claim
- `force_new` cascade delete gated by same auth — no admin-only restriction needed since user is creating their own seat
