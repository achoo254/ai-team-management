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

    const raw = await Schedule.find(filter)
      .populate('user_id', 'name')
      .populate('seat_id', 'label')
      .lean()

    const schedules = raw.map((s) => {
      const user = s.user_id as unknown as { _id: string; name: string } | null
      const seat = s.seat_id as unknown as { _id: string; label: string } | null
      return {
        _id: s._id,
        seat_id: seat?._id ?? s.seat_id,
        user_id: user?._id ?? s.user_id,
        user_name: user?.name ?? '',
        seat_label: seat?.label ?? '',
        day_of_week: s.day_of_week,
        start_hour: s.start_hour,
        end_hour: s.end_hour,
        usage_budget_pct: s.usage_budget_pct,
      }
    })

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

/** Check time overlap between two ranges on same seat+day */
async function findOverlaps(seatId: string, dayOfWeek: number, startHour: number, endHour: number, excludeId?: string) {
  const filter: Record<string, unknown> = {
    seat_id: seatId,
    day_of_week: dayOfWeek,
    start_hour: { $lt: endHour },
    end_hour: { $gt: startHour },
  }
  if (excludeId) filter._id = { $ne: excludeId }
  return Schedule.find(filter).populate('user_id', 'name').lean()
}

// POST /api/schedules/entry — create new schedule entry (auth, admin or self only)
router.post('/entry', authenticate, async (req, res) => {
  try {
    const { seatId, userId, dayOfWeek, startHour, endHour, usageBudgetPct } = req.body

    if (!seatId || !userId || dayOfWeek === undefined || startHour === undefined || endHour === undefined) {
      res.status(400).json({ error: 'seatId, userId, dayOfWeek, startHour, endHour are required' })
      return
    }
    if (!mongoose.Types.ObjectId.isValid(seatId) || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'Invalid ID format' })
      return
    }
    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 || startHour >= endHour) {
      res.status(400).json({ error: 'Invalid hour range (0-23, start < end)' })
      return
    }

    // Only admin can create entries for other users
    const isAdmin = req.user!.role === 'admin'
    if (!isAdmin && String(userId) !== String(req.user!._id)) {
      res.status(403).json({ error: 'Can only create schedule entries for yourself' })
      return
    }

    // Validate user belongs to seat
    const user = await User.findById(userId)
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    if (!user.seat_ids?.some((sid) => String(sid) === String(seatId))) {
      res.status(400).json({ error: 'User does not belong to this seat' })
      return
    }

    // Overlap detection
    const overlapping = await findOverlaps(seatId, dayOfWeek, startHour, endHour)
    const warnings = overlapping.length > 0
      ? [{ type: 'overlap', conflicting: overlapping }]
      : undefined

    const entry = await Schedule.create({
      seat_id: seatId,
      user_id: userId,
      day_of_week: dayOfWeek,
      start_hour: startHour,
      end_hour: endHour,
      usage_budget_pct: usageBudgetPct ?? null,
    })

    res.status(201).json({ entry, warnings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/schedules/entry/:id — update existing entry (auth, admin or owner)
router.put('/entry/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid entry ID' })
      return
    }

    const existing = await Schedule.findById(id)
    if (!existing) { res.status(404).json({ error: 'Entry not found' }); return }

    // Only admin or entry owner can update
    const isAdmin = req.user!.role === 'admin'
    if (!isAdmin && String(existing.user_id) !== String(req.user!._id)) {
      res.status(403).json({ error: 'Can only edit your own schedule entries' })
      return
    }

    const { startHour, endHour, usageBudgetPct, userId, dayOfWeek } = req.body
    const newStart = startHour ?? existing.start_hour
    const newEnd = endHour ?? existing.end_hour
    const newDay = dayOfWeek ?? existing.day_of_week
    if (newStart >= newEnd) {
      res.status(400).json({ error: 'start_hour must be less than end_hour' })
      return
    }

    // Overlap detection (exclude self)
    const overlapping = await findOverlaps(
      String(existing.seat_id), newDay, newStart, newEnd, id,
    )
    const warnings = overlapping.length > 0
      ? [{ type: 'overlap', conflicting: overlapping }]
      : undefined

    if (dayOfWeek !== undefined) existing.day_of_week = dayOfWeek
    if (startHour !== undefined) existing.start_hour = startHour
    if (endHour !== undefined) existing.end_hour = endHour
    if (usageBudgetPct !== undefined) existing.usage_budget_pct = usageBudgetPct
    if (userId !== undefined) existing.user_id = userId

    await existing.save()
    res.json({ entry: existing, warnings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PATCH /api/schedules/swap — swap/move by entry ID (admin)
router.patch('/swap', authenticate, requireAdmin, async (req, res) => {
  try {
    const { fromId, toId } = req.body
    if (!fromId) { res.status(400).json({ error: 'fromId is required' }); return }

    const fromEntry = await Schedule.findById(fromId)
    if (!fromEntry) { res.status(404).json({ error: 'Source entry not found' }); return }

    if (toId) {
      // Swap user_ids between two entries
      const toEntry = await Schedule.findById(toId)
      if (!toEntry) { res.status(404).json({ error: 'Target entry not found' }); return }
      const fromUserId = fromEntry.user_id
      fromEntry.user_id = toEntry.user_id
      toEntry.user_id = fromUserId
      await Promise.all([fromEntry.save(), toEntry.save()])
    } else {
      // Move: update day/hours from body
      const { dayOfWeek, startHour, endHour, seatId } = req.body
      if (dayOfWeek !== undefined) fromEntry.day_of_week = dayOfWeek
      if (startHour !== undefined) fromEntry.start_hour = startHour
      if (endHour !== undefined) fromEntry.end_hour = endHour
      if (seatId !== undefined) fromEntry.seat_id = seatId
      await fromEntry.save()
    }

    res.json({ message: 'Schedule updated' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/schedules/entry/:id — delete by ID (auth, admin or owner)
router.delete('/entry/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid entry ID' })
      return
    }

    const existing = await Schedule.findById(id)
    if (!existing) { res.status(404).json({ error: 'Entry not found' }); return }

    // Only admin or entry owner can delete
    const isAdmin = req.user!.role === 'admin'
    if (!isAdmin && String(existing.user_id) !== String(req.user!._id)) {
      res.status(403).json({ error: 'Can only delete your own schedule entries' })
      return
    }

    await existing.deleteOne()

    res.json({ message: 'Schedule entry removed' })
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

export default router
