# Phase 1: Models + Migration Script

**Status:** done | **Priority:** high | **Effort:** M

## Goal
Update Mongoose models + migration script để convert enum → ObjectId refs an toàn.

## Related Files
**Modify:**
- `packages/api/src/models/team.ts` — add `created_by`, remove unique on `name`
- `packages/api/src/models/user.ts` — `team?: string` → `team_ids: ObjectId[]`
- `packages/api/src/models/seat.ts` — `team: 'dev'|'mkt'|'personal'` → `team_id: ObjectId|null`
- `packages/shared/types.ts` — update Team, User, Seat types

**Create:**
- `packages/api/src/scripts/migrate-user-teams.ts` — migration script

## Implementation Steps

### 1. Team model (`models/team.ts`)
```ts
{
  name: { type: String, required: true, lowercase: true }, // remove unique
  label: String,
  color: { type: String, default: '#3b82f6' },
  created_by: { type: ObjectId, ref: 'User', required: true, index: true }, // NEW
  created_at: Date,
}
```
Add compound index `(created_by, name)` để query fast.

### 2. User model (`models/user.ts`)
```ts
team_ids: [{ type: ObjectId, ref: 'Team', default: [] }]  // was team?: string
```
Remove old `team` field.

### 3. Seat model (`models/seat.ts`)
```ts
team_id: { type: ObjectId, ref: 'Team', default: null, index: true }  // was team: enum
```
Remove old `team` field.

### 4. Shared types (`packages/shared/types.ts`)
```ts
export type Team = {
  _id: string
  name: string
  label: string
  color: string
  created_by: string
  created_at: string
  creator?: { _id: string; name: string; email: string }  // populated
}
export type User = { ...; team_ids: string[] }  // remove team field
export type Seat = { ...; team_id: string | null }  // remove team field
```

### 5. Migration script (`migrate-user-teams.ts`)
```
Usage: tsx --env-file .env.local src/scripts/migrate-user-teams.ts [--dry-run] [--execute]
```
Steps:
1. Connect DB
2. Backup: export current `teams`, `users`, `seats` collections to JSON files
3. Find first admin user → use as `default_created_by`
4. Upsert 3 default teams: `{dev, mkt, personal}` with `created_by = default_created_by`
5. Build name→id map: `{ dev: <id>, mkt: <id>, personal: <id> }`
6. For each User with old `team` field:
   - If team string in map → set `team_ids: [map[team]]`
   - Unset old `team` field
7. For each Seat with old `team` field:
   - `team_id = map[seat.team]`
   - Unset old `team` field
8. Log summary: X users updated, Y seats updated
9. Dry-run mode: log what would change, skip writes

## Todo
- [x] Update team.ts model (add created_by, drop unique)
- [x] Update user.ts model (team_ids array)
- [x] Update seat.ts model (team_id)
- [x] Update shared/types.ts
- [x] Write migration script với dry-run flag
- [x] Test migration trên local DB copy
- [x] Document rollback procedure

## Success Criteria
- Models compile (no TS errors)
- Migration dry-run logs đúng số records sẽ update
- Sau migration: all existing seats/users giữ team assignment cũ (qua ref mới)
- Backup JSON files tồn tại trong `packages/api/backups/`

## Risks
- Mất data → backup bắt buộc trước execute
- Index conflict trên `name` (từ unique) → drop old index thủ công trước migration
