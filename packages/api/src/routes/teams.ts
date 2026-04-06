import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, validateObjectId } from '../middleware.js'
import { Team } from '../models/team.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'

const router = Router()

/** Validate array of ObjectId strings. Returns true if valid. */
function isObjectIdArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every((id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
}

/** Transform populated team doc to match shared Team type (separate seats/members/owner fields + raw ID arrays). */
function transformTeam(doc: Record<string, unknown>) {
  const { seat_ids, member_ids, owner_id, ...rest } = doc
  return {
    ...rest,
    seat_ids: (seat_ids as Array<{ _id: string }>)?.map((s) => String(s._id)) ?? [],
    member_ids: (member_ids as Array<{ _id: string }>)?.map((m) => String(m._id)) ?? [],
    owner_id: owner_id ? String((owner_id as { _id: string })._id) : null,
    seats: seat_ids ?? [],
    members: member_ids ?? [],
    owner: owner_id ?? null,
  }
}

// GET /api/teams — list teams user belongs to or has a seat in (admin: all)
router.get('/', authenticate, async (req, res) => {
  const user = req.user!
  let filter = {}
  if (user.role !== 'admin') {
    // Get user's directly accessible seat IDs for team visibility
    const [dbUser, ownedSeats] = await Promise.all([
      User.findById(user._id, 'seat_ids').lean(),
      Seat.find({ owner_id: user._id }, '_id').lean(),
    ])
    const userSeatIds = [
      ...(dbUser?.seat_ids ?? []).map((id) => String(id)),
      ...ownedSeats.map((s) => String(s._id)),
    ]
    filter = {
      $or: [{ member_ids: user._id }, { owner_id: user._id }, { seat_ids: { $in: userSeatIds } }],
    }
  }
  const raw = await Team.find(filter)
    .populate('owner_id', 'name email')
    .populate('member_ids', 'name email')
    .populate('seat_ids', 'label email')
    .lean()
  res.json({ teams: raw.map((t) => transformTeam(t as unknown as Record<string, unknown>)) })
})

// POST /api/teams — create team (any authenticated user)
router.post('/', authenticate, async (req, res) => {
  const user = req.user!
  const { name, description, seat_ids = [], member_ids = [] } = req.body

  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Name is required' }); return
  }
  if (name.length > 100) {
    res.status(400).json({ error: 'Name too long (max 100)' }); return
  }
  if (description && typeof description !== 'string') {
    res.status(400).json({ error: 'Invalid description' }); return
  }
  if (!isObjectIdArray(seat_ids)) {
    res.status(400).json({ error: 'seat_ids must be array of valid IDs' }); return
  }
  if (!isObjectIdArray(member_ids)) {
    res.status(400).json({ error: 'member_ids must be array of valid IDs' }); return
  }

  // Validate member_ids exist
  if (member_ids.length > 0) {
    const memberCount = await User.countDocuments({ _id: { $in: member_ids }, active: true })
    if (memberCount !== member_ids.length) {
      res.status(400).json({ error: 'Some member IDs are invalid' }); return
    }
  }

  // Non-admin: verify owns all seats being added
  if (user.role !== 'admin' && seat_ids.length > 0) {
    const ownedCount = await Seat.countDocuments({ _id: { $in: seat_ids }, owner_id: user._id })
    if (ownedCount !== seat_ids.length) {
      res.status(403).json({ error: 'Can only add seats you own' }); return
    }
  }

  const team = await Team.create({
    name: name.trim(),
    description: description?.trim() || null,
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
  if (!team) {
    res.status(404).json({ error: 'Team not found' }); return
  }

  if (user.role !== 'admin' && team.owner_id.toString() !== user._id) {
    res.status(403).json({ error: 'Not team owner' }); return
  }

  const { name, description, seat_ids, member_ids } = req.body

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Name is required' }); return
    }
    if (name.length > 100) {
      res.status(400).json({ error: 'Name too long (max 100)' }); return
    }
  }
  if (seat_ids !== undefined && !isObjectIdArray(seat_ids)) {
    res.status(400).json({ error: 'seat_ids must be array of valid IDs' }); return
  }
  if (member_ids !== undefined && !isObjectIdArray(member_ids)) {
    res.status(400).json({ error: 'member_ids must be array of valid IDs' }); return
  }

  // Validate member_ids exist
  if (member_ids !== undefined && member_ids.length > 0) {
    const memberCount = await User.countDocuments({ _id: { $in: member_ids }, active: true })
    if (memberCount !== member_ids.length) {
      res.status(400).json({ error: 'Some member IDs are invalid' }); return
    }
  }

  // Non-admin: verify owns all new seats
  if (user.role !== 'admin' && seat_ids) {
    const ownedCount = await Seat.countDocuments({ _id: { $in: seat_ids }, owner_id: user._id })
    if (ownedCount !== seat_ids.length) {
      res.status(403).json({ error: 'Can only add seats you own' }); return
    }
  }

  if (name !== undefined) team.name = name.trim()
  if (description !== undefined) team.description = description?.trim() || null
  if (seat_ids !== undefined) team.seat_ids = seat_ids
  if (member_ids !== undefined) team.member_ids = member_ids
  await team.save()

  const populated = await Team.findById(team._id)
    .populate('owner_id', 'name email')
    .populate('member_ids', 'name email')
    .populate('seat_ids', 'label email')
    .lean()
  res.json(transformTeam(populated as unknown as Record<string, unknown>))
})

// DELETE /api/teams/:id — delete team (owner or admin)
router.delete('/:id', authenticate, validateObjectId('id'), async (req, res) => {
  const user = req.user!
  const team = await Team.findById(req.params.id)
  if (!team) {
    res.status(404).json({ error: 'Team not found' }); return
  }

  if (user.role !== 'admin' && team.owner_id.toString() !== user._id) {
    res.status(403).json({ error: 'Not team owner' }); return
  }

  await team.deleteOne()
  res.json({ message: 'Team deleted' })
})

export default router
