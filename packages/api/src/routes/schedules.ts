import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin } from '../middleware.js'
import { Schedule } from '../models/schedule.js'
import { User } from '../models/user.js'

const router = Router()

// GET /api/schedules — list with optional ?seatId= filter (auth)
router.get('/', authenticate, async (req, res) => {
  try {
    const seatId = req.query.seatId as string | undefined

    const filter: Record<string, unknown> = {}
    if (seatId) filter.seat_id = seatId

    const schedules = await Schedule.find(filter)
      .populate('user_id', 'name')
      .populate('seat_id', 'label')
      .lean()

    res.json({ schedules })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/schedules/today — today's schedules (auth)
router.get('/today', authenticate, async (_req, res) => {
  try {
    const day_of_week = new Date().getDay()

    const schedules = await Schedule.find({ day_of_week })
      .populate('user_id', 'name email')
      .populate('seat_id', 'label email')
      .lean()

    res.json({ schedules })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/schedules/:seatId — bulk replace schedules for a seat (admin)
router.put('/:seatId', authenticate, requireAdmin, async (req, res) => {
  try {
    const seatId = req.params.seatId as string

    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

    const entries: { userId: string; dayOfWeek: number; slot: string }[] = req.body

    if (!Array.isArray(entries)) {
      res.status(400).json({ error: 'Body must be an array' })
      return
    }

    const ops = entries.map((entry) => ({
      updateOne: {
        filter: {
          seat_id: seatId,
          day_of_week: entry.dayOfWeek,
          slot: entry.slot,
        },
        update: {
          $set: {
            seat_id: seatId,
            user_id: entry.userId,
            day_of_week: entry.dayOfWeek,
            slot: entry.slot,
          },
        },
        upsert: true,
      },
    }))

    await Schedule.bulkWrite(ops)

    const schedules = await Schedule.find({ seat_id: seatId })
      .populate('user_id', 'name')
      .lean()

    res.json(schedules)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/schedules/assign — assign user to specific cell (admin)
router.post('/assign', authenticate, requireAdmin, async (req, res) => {
  try {
    const { seatId, userId, dayOfWeek, slot } = req.body

    if (!seatId || !userId || dayOfWeek === undefined || !slot) {
      res.status(400).json({ error: 'seatId, userId, dayOfWeek, slot are required' })
      return
    }
    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'Invalid user ID' })
      return
    }

    // Validate user belongs to seat
    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (String(user.seat_id) !== String(seatId)) {
      res.status(400).json({ error: 'User does not belong to this seat' })
      return
    }

    const schedule = await Schedule.findOneAndUpdate(
      { seat_id: seatId, day_of_week: dayOfWeek, slot },
      { $set: { seat_id: seatId, user_id: userId, day_of_week: dayOfWeek, slot } },
      { upsert: true, new: true },
    )

    res.status(201).json(schedule)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PATCH /api/schedules/swap — swap/move between two cells (admin)
router.patch('/swap', authenticate, requireAdmin, async (req, res) => {
  try {
    interface CellRef { seatId: string; dayOfWeek: number; slot: string }
    const { from, to }: { from: CellRef; to: CellRef } = req.body

    if (!from || !to) {
      res.status(400).json({ error: 'from and to cells are required' })
      return
    }

    const fromEntry = await Schedule.findOne({
      seat_id: from.seatId,
      day_of_week: from.dayOfWeek,
      slot: from.slot,
    })
    if (!fromEntry) {
      res.status(404).json({ error: 'Source schedule entry not found' })
      return
    }

    // Validate that user being moved belongs to the target seat
    const user = await User.findById(fromEntry.user_id)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (String(user.seat_id) !== String(to.seatId)) {
      res.status(400).json({ error: 'User does not belong to the target seat' })
      return
    }

    const toEntry = await Schedule.findOne({
      seat_id: to.seatId,
      day_of_week: to.dayOfWeek,
      slot: to.slot,
    })

    if (toEntry) {
      // Swap: exchange user_ids between from and to
      const fromUserId = fromEntry.user_id
      fromEntry.user_id = toEntry.user_id
      toEntry.user_id = fromUserId
      await Promise.all([fromEntry.save(), toEntry.save()])
    } else {
      // Move: create target entry, delete source
      await Schedule.create({
        seat_id: to.seatId,
        user_id: fromEntry.user_id,
        day_of_week: to.dayOfWeek,
        slot: to.slot,
      })
      await fromEntry.deleteOne()
    }

    res.json({ message: 'Schedule updated' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/schedules/all — clear ALL schedules (admin)
router.delete('/all', authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await Schedule.deleteMany({})
    res.json({ message: 'All schedules cleared', deleted: result.deletedCount })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/schedules/entry — remove single schedule cell (admin)
// Body: { seatId, dayOfWeek, slot }
router.delete('/entry', authenticate, requireAdmin, async (req, res) => {
  try {
    const { seatId, dayOfWeek, slot } = req.body

    if (!seatId || dayOfWeek === undefined || !slot) {
      res.status(400).json({ error: 'seatId, dayOfWeek, slot are required' })
      return
    }

    const result = await Schedule.findOneAndDelete({
      seat_id: seatId,
      day_of_week: dayOfWeek,
      slot,
    })

    if (!result) {
      res.status(404).json({ error: 'Schedule entry not found' })
      return
    }

    res.json({ message: 'Schedule entry removed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
