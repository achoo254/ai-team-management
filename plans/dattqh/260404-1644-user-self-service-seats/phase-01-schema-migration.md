# Phase 1: Schema + Migration

## Overview
- **Priority:** Critical
- **Status:** Completed
- **Effort:** Small

Add `owner_id` field to Seat model and create migration script to assign existing seats to default admin.

## Related Files
- `packages/api/src/models/seat.ts` — modify
- `packages/api/src/scripts/migrate-seat-owners.ts` — create

## Implementation Steps

### 1.1 Add owner_id to Seat model

In `packages/api/src/models/seat.ts`:

```typescript
// Add to ISeat interface
owner_id: Types.ObjectId | null

// Add to schema definition
owner_id: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true }
```

Update `toJSON` transform to include `owner_id` in output.

### 1.2 Create migration script

Create `packages/api/src/scripts/migrate-seat-owners.ts`:

```typescript
// 1. Connect to DB
// 2. Find first admin user: User.findOne({ role: 'admin' })
// 3. Update all seats where owner_id is null: Seat.updateMany({ owner_id: null }, { owner_id: adminUser._id })
// 4. Log count of updated seats
// 5. Disconnect
```

Script must be idempotent — only updates seats with `owner_id: null`.

Add to `package.json`:
```json
"db:migrate-owners": "tsx --env-file .env.local src/scripts/migrate-seat-owners.ts"
```

### 1.3 Seed data update

In `packages/api/src/seed-data.ts`: ensure new seed seats include `owner_id` pointing to admin user.

## Todo
- [x] Add `owner_id` to ISeat interface
- [x] Add `owner_id` to Mongoose schema with index
- [x] Create migration script
- [x] Add npm script for migration
- [x] Update seed data
- [x] Run migration on dev DB

## Success Criteria
- Seat documents in DB have `owner_id` field
- Existing seats assigned to admin
- New seats created via API include `owner_id`
- Migration is idempotent (safe to run multiple times)
