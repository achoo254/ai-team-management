import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin } from '../middleware.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'
import { Schedule } from '../models/schedule.js'

const router = Router()

// GET /api/seats — list seats with assigned users (auth)
router.get('/', authenticate, async (_req, res) => {
  try {
    const seats = await Seat.find().sort({ _id: 1 }).lean()
    const users = await User.find(
      { active: true, seat_id: { $ne: null } },
      'name email seat_id',
    ).lean()

    // Group users by seat_id string key
    const usersBySeat: Record<string, typeof users> = {}
    for (const user of users) {
      const key = String(user.seat_id)
      if (!usersBySeat[key]) usersBySeat[key] = []
      usersBySeat[key].push(user)
    }

    const enriched = seats.map((seat) => ({
      ...seat,
      users: (usersBySeat[String(seat._id)] || []).map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
      })),
    }))

    res.json({ seats: enriched })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/seats — create seat (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, label, team, max_users } = req.body

    if (!email || !label || !team) {
      res.status(400).json({ error: 'email, label, team are required' })
      return
    }

    const seat = await Seat.create({ email, label, team, max_users })
    res.status(201).json(seat)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/seats/:id — update seat (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

    const allowed = ['email', 'label', 'team', 'max_users']
    const update: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key]
    }

    const seat = await Seat.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    res.json(seat)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/seats/:id — delete seat, unassign users, clear schedules (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

    const seat = await Seat.findById(id)
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    // Unassign all users from this seat
    await User.updateMany({ seat_id: id }, { $set: { seat_id: null } })
    // Clear all schedules for this seat
    await Schedule.deleteMany({ seat_id: id })
    await seat.deleteOne()

    res.json({ message: 'Seat deleted' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/seats/:id/assign — assign user to seat (admin)
router.post('/:id/assign', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

    const { userId } = req.body
    if (!userId) {
      res.status(400).json({ error: 'userId is required' })
      return
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'Invalid user ID' })
      return
    }

    const seat = await Seat.findById(id)
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Check seat capacity
    const currentCount = await User.countDocuments({ seat_id: id, active: true })
    if (currentCount >= seat.max_users) {
      res.status(400).json({ error: 'Seat is at maximum capacity' })
      return
    }

    user.seat_id = new mongoose.Types.ObjectId(id)
    await user.save()

    res.json({ message: 'User assigned to seat', user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/seats/:id/unassign/:userId — unassign user + clear their schedules (admin)
router.delete('/:id/unassign/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string
    const userId = req.params.userId as string

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'Invalid user ID' })
      return
    }

    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (String(user.seat_id) !== id) {
      res.status(400).json({ error: 'User is not assigned to this seat' })
      return
    }

    // Clear user's schedules for this seat
    await Schedule.deleteMany({ seat_id: id, user_id: userId })
    // Unassign from seat
    user.seat_id = null
    await user.save()

    res.json({ message: 'User unassigned from seat' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
