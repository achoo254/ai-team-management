---
phase: 2
status: completed
priority: high
effort: 1.5h
completedDate: 2026-04-06
---

# Phase 2: Backend — Team API Routes

## Overview

Create CRUD routes for teams at `/api/teams`. Auth: admin or seat owner (restricted seat addition).

## Context Links

- Route pattern: `packages/api/src/routes/seats.ts`, `packages/api/src/routes/admin.ts`
- Route registration: `packages/api/src/index.ts` (lines 34-44)
- Middleware: `packages/api/src/middleware.ts`

## Files to Create

### `packages/api/src/routes/teams.ts`

```typescript
import { Router } from 'express'
import { authenticate, requireAdmin, validateObjectId } from '../middleware.js'
import { Team } from '../models/team.js'
import { Seat } from '../models/seat.js'

const router = Router()

// GET /api/teams — list teams user belongs to (admin: all)
router.get('/', authenticate, async (req, res) => {
  const user = req.user!
  const filter = user.role === 'admin' ? {} : {
    $or: [{ member_ids: user._id }, { owner_id: user._id }],
  }
  const teams = await Team.find(filter)
    .populate('owner_id', 'name email')
    .populate('member_ids', 'name email')
    .populate('seat_ids', 'label email')
    .lean()
  res.json({ teams })
})

// POST /api/teams — create team (any authenticated user)
router.post('/', authenticate, async (req, res) => {
  const user = req.user!
  const { name, description, seat_ids = [], member_ids = [] } = req.body

  // Non-admin: verify owns all seats being added
  if (user.role !== 'admin' && seat_ids.length > 0) {
    const ownedCount = await Seat.countDocuments({
      _id: { $in: seat_ids },
      owner_id: user._id,
    })
    if (ownedCount !== seat_ids.length) {
      res.status(403).json({ error: 'Can only add seats you own' })
      return
    }
  }

  const team = await Team.create({
    name,
    description: description || null,
    seat_ids,
    member_ids,
    owner_id: user._id,
  })
  res.status(201).json(team)
})

// PUT /api/teams/:id — update team (owner or admin)
router.put('/:id', authenticate, validateObjectId('id'), async (req, res) => {
  const user = req.user!
  const team = await Team.findById(req.params.id)
  if (!team) { res.status(404).json({ error: 'Team not found' }); return }

  // Only owner or admin can update
  if (user.role !== 'admin' && team.owner_id.toString() !== user._id) {
    res.status(403).json({ error: 'Not team owner' })
    return
  }

  const { name, description, seat_ids, member_ids } = req.body

  // Non-admin: verify owns all new seats
  if (user.role !== 'admin' && seat_ids) {
    const ownedCount = await Seat.countDocuments({
      _id: { $in: seat_ids },
      owner_id: user._id,
    })
    if (ownedCount !== seat_ids.length) {
      res.status(403).json({ error: 'Can only add seats you own' })
      return
    }
  }

  if (name !== undefined) team.name = name
  if (description !== undefined) team.description = description
  if (seat_ids !== undefined) team.seat_ids = seat_ids
  if (member_ids !== undefined) team.member_ids = member_ids
  await team.save()

  const populated = await Team.findById(team._id)
    .populate('owner_id', 'name email')
    .populate('member_ids', 'name email')
    .populate('seat_ids', 'label email')
    .lean()
  res.json(populated)
})

// DELETE /api/teams/:id — delete team (owner or admin)
router.delete('/:id', authenticate, validateObjectId('id'), async (req, res) => {
  const user = req.user!
  const team = await Team.findById(req.params.id)
  if (!team) { res.status(404).json({ error: 'Team not found' }); return }

  if (user.role !== 'admin' && team.owner_id.toString() !== user._id) {
    res.status(403).json({ error: 'Not team owner' })
    return
  }

  await team.deleteOne()
  res.json({ message: 'Team deleted' })
})

export default router
```

## Files to Modify

### `packages/api/src/index.ts`

Add after existing route imports:

```typescript
import teamRoutes from './routes/teams.js'
// ...
app.use('/api/teams', teamRoutes)
```

## Implementation Steps

1. Create `packages/api/src/routes/teams.ts` with CRUD routes
2. Register route in `packages/api/src/index.ts`
3. Run `pnpm -F @repo/api build` to verify

## Success Criteria

- [x] GET /api/teams returns user's teams (admin: all)
- [x] POST creates team, owner auto-set to creator
- [x] PUT updates team (owner/admin only)
- [x] DELETE removes team (owner/admin only)
- [x] Non-admin cannot add seats they don't own
- [x] Proper 403/404 error handling
- [x] Input validation (name type/length, ObjectId array, member existence check)
