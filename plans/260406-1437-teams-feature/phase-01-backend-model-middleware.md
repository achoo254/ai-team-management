---
phase: 1
status: completed
priority: high
effort: 1h
completedDate: 2026-04-06
---

# Phase 1: Backend — Team Model + Middleware Update

## Overview

Create Team Mongoose model and update `getAllowedSeatIds()` middleware to include team-based seat visibility.

## Context Links

- Brainstorm: `plans/reports/brainstorm-260406-1437-teams-feature-design.md`
- Seat model pattern: `packages/api/src/models/seat.ts`
- Middleware: `packages/api/src/middleware.ts` (lines 108-126)

## Files to Create

### `packages/api/src/models/team.ts`

```typescript
import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface ITeam extends Document {
  name: string
  description: string | null
  seat_ids: Types.ObjectId[]
  member_ids: Types.ObjectId[]
  owner_id: Types.ObjectId
  created_at: Date
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null },
    seat_ids: [{ type: Schema.Types.ObjectId, ref: 'Seat' }],
    member_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Index for getAllowedSeatIds() lookups
teamSchema.index({ member_ids: 1 })

export const Team = mongoose.model<ITeam>('Team', teamSchema)
```

## Files to Modify

### `packages/api/src/middleware.ts` — `getAllowedSeatIds()`

Update non-admin branch to also query Team collection:

```typescript
// After existing assigned + owned logic, add:
import { Team } from './models/team.js'

// Inside getAllowedSeatIds, non-admin branch:
const [dbUser, ownedSeats, userTeams] = await Promise.all([
  User.findById(user._id, 'seat_ids').lean(),
  Seat.find({ owner_id: user._id }, '_id').lean(),
  Team.find({ member_ids: user._id }, 'seat_ids').lean(),
])

// Merge team seat_ids into dedup map
const teamSeatIds = userTeams.flatMap((t) => t.seat_ids)
for (const id of [...assigned, ...owned, ...teamSeatIds.map(id => new mongoose.Types.ObjectId(String(id)))]) {
  map.set(String(id), id)
}
```

### Seat soft-delete hook — auto-remove from teams

Add to `packages/api/src/models/seat.ts` (after existing hooks):

```typescript
import { Team } from './team.js'  // circular-safe: only used in hook

// When seat is soft-deleted, remove from all teams
seatSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate() as any
  if (update?.deleted_at || update?.$set?.deleted_at) {
    const filter = this.getFilter()
    if (filter._id) {
      await Team.updateMany(
        { seat_ids: filter._id },
        { $pull: { seat_ids: filter._id } },
      )
    }
  }
})
```

## Implementation Steps

1. Create `packages/api/src/models/team.ts` with schema above
2. Update `packages/api/src/middleware.ts`:
   - Import `Team`
   - Add `Team.find({ member_ids: user._id })` to `getAllowedSeatIds()` parallel query
   - Merge team seat IDs into dedup map
3. Add seat soft-delete hook to `seat.ts` to `$pull` from teams
4. Run `pnpm -F @repo/api build` to verify no compile errors

## Success Criteria

- [x] Team model created with proper indexes
- [x] `getAllowedSeatIds()` returns team seats for non-admin users
- [x] Admin behavior unchanged (still sees all)
- [x] Soft-deleted seats auto-removed from teams
- [x] TypeScript compiles clean
