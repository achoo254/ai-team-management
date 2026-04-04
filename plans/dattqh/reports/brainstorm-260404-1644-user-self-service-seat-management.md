# Brainstorm: User Self-Service Seat Management

**Date:** 2026-04-04
**Status:** Approved → Ready for planning

## Problem Statement

Currently all seat operations (CRUD, credential management, user assignment) are admin-only. Users cannot create or manage their own Claude seats. Need to allow users to self-service while maintaining admin oversight.

## Requirements

### Functional
- Users create their own seats (email, label, team, credential)
- 1 owner per seat (creator = owner)
- Owner has full CRUD + credential upload/export + assign/unassign users
- Per-seat credential export (not bulk) for owner + admin
- Admin retains full power over all seats (override, transfer ownership, delete)
- Other users can view basic seat info but cannot modify
- Assigned (non-owner) users can view seat details but not manage

### Non-Functional
- No limit on seats per user
- Existing seats migrate to admin as default owner
- Audit logging on credential export maintained
- Backward compatible with existing admin workflows

## Evaluated Approaches

### Approach A: Add `owner_id` to Seat model (Recommended)
- **Pros:** Minimal schema change (1 field), clear ownership, simple permission check
- **Cons:** Need migration for existing seats
- **Verdict:** ✅ Simplest, KISS-compliant

### Approach B: Separate "personal seats" collection
- **Pros:** Clean separation, no migration
- **Cons:** Duplicated logic, DRY violation, complex queries across 2 collections
- **Verdict:** ❌ Over-engineered

### Approach C: Role-based with seat-level ACL
- **Pros:** Flexible, supports future complex permissions
- **Cons:** YAGNI, complex implementation for current needs
- **Verdict:** ❌ Premature abstraction

## Chosen Solution: Approach A

### Schema Change
```typescript
// Seat model — add field
owner_id: { type: Schema.Types.ObjectId, ref: 'User', default: null }
```

### Permission Matrix

| Action | Admin | Owner | Assigned User | Other |
|--------|-------|-------|---------------|-------|
| View all seats | ✓ | ✓ (own) | ✓ (assigned) | ✓ (basic) |
| Create seat | ✓ | — | — | ✓ (becomes owner) |
| Edit seat | ✓ any | ✓ own | ✗ | ✗ |
| Delete seat | ✓ any | ✓ own | ✗ | ✗ |
| Upload credential | ✓ any | ✓ own | ✗ | ✗ |
| Export credential (per-seat) | ✓ any | ✓ own | ✗ | ✗ |
| Assign/Unassign user | ✓ any | ✓ own | ✗ | ✗ |
| Transfer ownership | ✓ only | ✗ | ✗ | ✗ |

### Backend Changes
- New middleware: `requireSeatOwnerOrAdmin()` — checks `req.user` is admin or seat owner
- Route auth changes: replace `requireAdmin` with `requireSeatOwnerOrAdmin` on most seat routes
- New endpoint: `GET /api/seats/:id/credentials/export` (per-seat)
- New endpoint: `PUT /api/seats/:id/transfer` (admin only)
- `POST /api/seats` opens to all authenticated users, auto-sets `owner_id`

### Frontend Changes
- SeatsPage: sections for My Seats / Assigned Seats / Other Seats
- SeatCard: owner badge, conditional action buttons
- Per-seat export button on card (owner + admin)
- Admin: transfer ownership UI

### Migration
- Find first admin user, set as `owner_id` for all existing ownerless seats
- Idempotent script, rollback-safe

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Credential leak via user export | High | Audit log per-export, admin can revoke token |
| Seat sprawl (no limit) | Low | Admin monitors, add limit later if needed |
| Migration failure | Medium | Idempotent script, test on staging first |
| Breaking admin workflows | Low | Admin keeps full override power |

## Next Steps
- Create detailed implementation plan with phases
- Phase 1: Schema + migration
- Phase 2: Backend middleware + routes
- Phase 3: Frontend UI updates
- Phase 4: Testing
