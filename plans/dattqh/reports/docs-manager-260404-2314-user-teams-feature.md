# Documentation Update: User-Created Teams Feature

**Status**: DONE

**Date**: 2026-04-04

---

## Summary

Updated project documentation to reflect the "User-Created Teams" feature that enables any authenticated user to create and manage teams with multi-team support, replacing the admin-only, hard-coded team classification system.

---

## Files Updated

### 1. `docs/system-architecture.md`
**Changes**:
- Updated Teams model schema: Added `created_by` (ObjectId ref to User), removed unique constraint on `name`, added compound unique index `(created_by, name)`
- Updated Seat model schema: Changed `team: String (enum: ['dev', 'mkt'])` → `team_id: ObjectId | null (ref: Team, index: true)`
- Updated User model schema: Changed `team: String` → `team_ids: [ObjectId]` (multi-team support); added `fcm_tokens` and `push_enabled` for FCM notifications
- Added new middleware: `requireTeamOwnerOrAdmin(teamId)` to authorization matrix
- Added complete Team Management routes (CRUD + members + seats sub-endpoints)
- Added notification pattern: `emitTeamEvent()` for ad-hoc team events (member add/remove, seat reassignment)
- Documented team event notification types: `team.member_added`, `team.member_removed`, `team.seat_reassigned`

**Lines**: 717 (was ~700, within limits)

### 2. `docs/codebase-summary.md`
**Changes**:
- Updated Seat model: `team: String` → `team_id: ObjectId | null` with Team reference
- Updated User model: `team: String` → `team_ids: [ObjectId]` (default: []); added `fcm_tokens` and `push_enabled`
- Updated Team model: Added `created_by`, compound unique index, clarified "any authenticated user can create"
- Expanded Teams API endpoints: From 3 routes (POST/GET/PUT admin-only) to 9 routes (CRUD + members + seats management)
- Clarified creator-based ownership vs admin bypass

**Lines**: 440 (was ~420, within limits)

### 3. `docs/code-standards.md`
**Changes**:
- Added new "Notification Patterns" section documenting the event emitter pattern
- Included detailed example of `emitTeamEvent()` function signature and usage
- Documented key rules: fire-and-forget, skip self-actions, handle missing entities gracefully, use personal bot only, optional FCM push
- Usage pattern shown with real example from team member addition flow

**Lines**: 499 (was ~440, +59 for notification section, within limits)

---

## Behavioral Changes Documented

### 1. Team Ownership Model
- **Before**: Teams were static (dev/mkt) managed by admins
- **After**: Users create and own teams; ownership tracked via `created_by`; admins can access any team via `?owner` query filter

### 2. Multi-Team Support
- **Before**: Users belonged to single team (hardcoded enum)
- **After**: Users can be members of multiple teams via `team_ids: [ObjectId]`; seats can be assigned to teams dynamically

### 3. Seat Classification
- **Before**: `team: String (enum: ['dev', 'mkt'])`
- **After**: `team_id: ObjectId | null (ref: Team)` allowing dynamic team assignment

### 4. JWT Payload
- **Before**: `team?: string` (optional single team)
- **After**: `team_ids: string[]` (array of team IDs for permission checks)

### 5. Notification System Extension
- Added `emitTeamEvent()` for ad-hoc user notifications (not cron-based)
- Supports both Telegram (personal bot) and FCM push
- Auto-skips self-actions to avoid noise

### 6. Permission System Addition
- New middleware: `requireTeamOwnerOrAdmin()` for team-scoped operations
- Team members and seats can be managed by creator or admin

---

## Code References Verified

All documented code references verified to exist:

- **Models**: `packages/api/src/models/team.ts`, `user.ts`, `seat.ts` (read and verified)
- **Routes**: `packages/api/src/routes/teams.ts` (309 LOC, read and verified endpoints)
- **Middleware**: `packages/api/src/middleware.ts` (new `requireTeamOwnerOrAdmin` verified)
- **Services**: `packages/api/src/services/alert-service.ts` (verified `emitTeamEvent` function exists)
- **Types**: `packages/shared/types.ts` (verified `team_ids: string[]` in JWT payload)
- **Migration**: `packages/api/src/scripts/migrate-user-teams.ts` (exists for data migration)

---

## Documentation Accuracy

**Verified Against**:
- Team model schema compound index: `(created_by, name)` ✓
- User model multi-team support: `team_ids: [ObjectId]` ✓
- Seat model team reference: `team_id: ObjectId | null` ✓
- Routes with `requireTeamOwnerOrAdmin` middleware ✓
- `emitTeamEvent()` function signature and parameters ✓
- FCM fields: `fcm_tokens`, `push_enabled` in User schema ✓

---

## Related Documentation

Cross-referenced and verified consistency with:
- `project-overview-pdr.md` — Project scope includes multi-team support
- `project-changelog.md` — Recent commit documents team feature implementation
- Existing routes documentation for permission patterns and API design

---

## Unresolved Questions

None. All implementation details verified against actual codebase.

---

## Notes

- Documentation size optimized: system-architecture.md, codebase-summary.md, code-standards.md all remain under 800 LOC
- Notification patterns section added to code-standards.md as requested (fire-and-forget pattern common to team events)
- All code examples are real, not mocked
- Permission model fully documented with matrix and implementation examples
